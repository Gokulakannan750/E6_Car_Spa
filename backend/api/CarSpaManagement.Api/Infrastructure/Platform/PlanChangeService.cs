using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>The plan, interval, user licences and add-ons a change would move the company to.</summary>
public sealed record PlanChangeTarget(string PlanCode, BillingInterval Interval, LicenceCounts Licences, IReadOnlyDictionary<string, int> AddOns, IReadOnlyDictionary<string, int>? Seats = null);

/// <summary>What a change would cost and when it would take effect, worked out from today's prices and dates.</summary>
public sealed record PlanChangePreview(
    PlanChangeTiming Timing,
    long CurrentPeriodPriceMinor,
    long NewPeriodPriceMinor,
    long AmountNowMinor,
    string Currency,
    DateTime EffectiveAt);

/// <summary>
/// Changes to a company's plan that Trovo proposes and the company's Owner approves in the app
/// (docs/SAAS_HANDOFF_AND_NEXT_STEPS.md, decisions of 13 Oct 2026):
/// - an upgrade (a higher price for the period) takes effect at once, and the price difference for the rest of the
///   paid period is invoiced;
/// - a downgrade (a lower price) and any change of billing interval take effect when the paid period ends, with no
///   refund; the renewal invoice is made on the new terms;
/// - a company that is not in a paid period (trial, unpaid) changes at once and pays the new price on its next invoice.
/// </summary>
public sealed class PlanChangeService(PlatformDbContext catalog, SubscriptionService subscriptions, BillingInvoiceService invoices)
{
    public static readonly TimeSpan ProposalLifetime = TimeSpan.FromDays(7);

    public async Task<PlanChangePreview> PreviewAsync(Guid companyId, PlanChangeTarget target, CancellationToken cancellationToken = default)
    {
        var subscription = await subscriptions.CurrentAsync(companyId, cancellationToken);
        var productId = await catalog.Companies.Where(c => c.Id == companyId).Select(c => c.ProductId).FirstAsync(cancellationToken);
        var newTerms = await subscriptions.TermsForAsync(productId, target.PlanCode, target.Interval, target.Licences, target.AddOns, cancellationToken, target.Seats);
        var now = DateTime.UtcNow;
        var current = BillingInvoiceService.PeriodSubtotal(InvoiceTerms.Of(subscription, now));
        var next = BillingInvoiceService.PeriodSubtotal(newTerms);
        var currency = newTerms.Version.Currency;

        if (subscription.Status != SubscriptionStatus.Active || subscription.CurrentPeriodEnd <= now)
        {
            return new PlanChangePreview(PlanChangeTiming.Now, current, next, 0, currency, now);
        }
        if (target.Interval != subscription.PlanVersion!.Interval || next < current)
        {
            return new PlanChangePreview(PlanChangeTiming.AtPeriodEnd, current, next, 0, currency, subscription.CurrentPeriodEnd);
        }

        var amount = ProratedMinor(next - current, subscription.CurrentPeriodStart, subscription.CurrentPeriodEnd, now);
        return amount > 0
            ? new PlanChangePreview(PlanChangeTiming.NowWithCharge, current, next, amount, currency, now)
            : new PlanChangePreview(PlanChangeTiming.Now, current, next, 0, currency, now);
    }

    /// <summary>The share of <paramref name="differenceMinor"/> for the rest of the period, rounded to whole rupees.</summary>
    public static long ProratedMinor(long differenceMinor, DateTime periodStart, DateTime periodEnd, DateTime now)
    {
        if (differenceMinor <= 0 || periodEnd <= periodStart) return 0;
        var remaining = Math.Clamp((periodEnd - now).TotalSeconds / (periodEnd - periodStart).TotalSeconds, 0, 1);
        return (long)Math.Round(differenceMinor * remaining / 100, MidpointRounding.AwayFromZero) * 100;
    }

    /// <summary>Trovo proposes a change; it replaces an earlier unanswered proposal. Nothing changes until the Owner approves.</summary>
    public async Task<PlanChangeRequest> ProposeAsync(Guid companyId, PlanChangeTarget target, string reason, Guid? adminId, string? adminEmail,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason)) throw new ValidationException("A reason is required.");
        var company = await catalog.Companies.FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken)
            ?? throw new NotFoundException("Company not found.");
        if (company.Status == PlatformCompanyStatus.AwaitingRegistration)
        {
            throw new ConflictException("This company has not registered yet, so nobody can approve a change. Change the plan directly.");
        }

        var subscription = await subscriptions.CurrentAsync(companyId, cancellationToken);
        if (subscription.Status is SubscriptionStatus.Canceled or SubscriptionStatus.Suspended)
        {
            throw new ConflictException("A cancelled or suspended subscription cannot be changed.");
        }
        if (IsCurrent(subscription, target)) throw new ValidationException("That is already the company's plan.");

        var preview = await PreviewAsync(companyId, target, cancellationToken);
        var productId = await catalog.Companies.Where(c => c.Id == companyId).Select(c => c.ProductId).SingleAsync(cancellationToken);
        var terms = await subscriptions.TermsForAsync(productId, target.PlanCode, target.Interval, target.Licences, target.AddOns, cancellationToken, target.Seats);
        var seatModel = await catalog.Products.Where(p => p.Id == productId).Select(p => p.SeatModel).SingleAsync(cancellationToken);
        target = target with { Seats = terms.Seats, Licences = seatModel == SeatModel.PerType
            ? ProductSeats.LicenceView(terms.Seats!) : new LicenceCounts(0, 0, 0) };
        var now = DateTime.UtcNow;
        await catalog.PlanChangeRequests
            .Where(r => r.CompanyId == companyId && r.Status == PlanChangeStatus.Pending)
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.Status, PlanChangeStatus.Cancelled), cancellationToken);

        var request = new PlanChangeRequest
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SubscriptionId = subscription.Id,
            Status = PlanChangeStatus.Pending,
            PlanCode = target.PlanCode,
            Interval = target.Interval,
            Licences = target.Licences,
            SeatsJson = target.Seats is null ? null : JsonSerializer.Serialize(target.Seats),
            AddOnsJson = JsonSerializer.Serialize(target.AddOns.Where(a => a.Value > 0).ToDictionary(a => a.Key, a => a.Value)),
            Reason = reason.Trim().Length > 500 ? reason.Trim()[..500] : reason.Trim(),
            RequestedByAdminId = adminId,
            RequestedByEmail = adminEmail,
            CreatedAt = now,
            ExpiresAt = now + ProposalLifetime
        };
        Fill(request, preview);
        catalog.PlanChangeRequests.Add(request);
        await catalog.SaveChangesAsync(cancellationToken);
        await subscriptions.RecordPlanChangeEventAsync(subscription.Id, "plan_change_proposed", new SubscriptionActor(PlatformActorType.Admin, adminId),
            new { request.Id, target.PlanCode, interval = target.Interval.ToString(), target.Licences, target.AddOns, timing = preview.Timing.ToString(), preview.AmountNowMinor, reason },
            cancellationToken);
        return request;
    }

    /// <summary>
    /// The Owner changes the plan in the app: the same rules as an approved proposal (upgrade now with the rest of
    /// the period invoiced, downgrade at the period end). It replaces any proposal from Trovo still waiting.
    /// </summary>
    public async Task<PlanChangeRequest> ChangeByOwnerAsync(Guid companyId, PlanChangeTarget target, Guid? userId, string? userName,
        CancellationToken cancellationToken = default)
    {
        var subscription = await subscriptions.CurrentAsync(companyId, cancellationToken);
        if (subscription.Status is SubscriptionStatus.Canceled or SubscriptionStatus.Suspended)
        {
            throw new ConflictException("A cancelled or suspended subscription cannot be changed. Please contact Trovo.");
        }
        if (IsCurrent(subscription, target)) throw new ValidationException("That is already your plan.");

        var preview = await PreviewAsync(companyId, target, cancellationToken);
        var productId = await catalog.Companies.Where(c => c.Id == companyId).Select(c => c.ProductId).SingleAsync(cancellationToken);
        var terms = await subscriptions.TermsForAsync(productId, target.PlanCode, target.Interval, target.Licences, target.AddOns, cancellationToken, target.Seats);
        var seatModel = await catalog.Products.Where(p => p.Id == productId).Select(p => p.SeatModel).SingleAsync(cancellationToken);
        target = target with { Seats = terms.Seats, Licences = seatModel == SeatModel.PerType
            ? ProductSeats.LicenceView(terms.Seats!) : new LicenceCounts(0, 0, 0) };
        var now = DateTime.UtcNow;
        await catalog.PlanChangeRequests
            .Where(r => r.CompanyId == companyId && r.Status == PlanChangeStatus.Pending)
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.Status, PlanChangeStatus.Cancelled), cancellationToken);
        var request = new PlanChangeRequest
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SubscriptionId = subscription.Id,
            Status = PlanChangeStatus.Pending,
            PlanCode = target.PlanCode,
            Interval = target.Interval,
            Licences = target.Licences,
            SeatsJson = target.Seats is null ? null : JsonSerializer.Serialize(target.Seats),
            AddOnsJson = JsonSerializer.Serialize(target.AddOns.Where(a => a.Value > 0).ToDictionary(a => a.Key, a => a.Value)),
            Reason = "Changed by the Owner in the app",
            CreatedAt = now,
            ExpiresAt = now + ProposalLifetime
        };
        Fill(request, preview);
        catalog.PlanChangeRequests.Add(request);
        await catalog.SaveChangesAsync(cancellationToken);
        return await ApproveAsync(companyId, request.Id, userId, userName, cancellationToken);
    }

    /// <summary>Trovo withdraws a proposal, or a downgrade the Owner approved that has not started yet.</summary>
    public async Task CancelAsync(Guid companyId, Guid requestId, CancellationToken cancellationToken = default)
    {
        var request = await catalog.PlanChangeRequests.FirstOrDefaultAsync(r => r.Id == requestId && r.CompanyId == companyId, cancellationToken)
            ?? throw new NotFoundException("Plan change not found.");
        if (request.Status is not (PlanChangeStatus.Pending or PlanChangeStatus.Scheduled))
        {
            throw new ConflictException("Only a proposal or a change that has not started yet can be withdrawn.");
        }
        var wasScheduled = request.Status == PlanChangeStatus.Scheduled;
        request.Status = PlanChangeStatus.Cancelled;
        await catalog.SaveChangesAsync(cancellationToken);
        // A renewal invoice made on the downgraded terms goes back to the current terms.
        if (wasScheduled) await subscriptions.ReissueOpenPeriodInvoicesAsync(companyId, cancellationToken);
    }

    /// <summary>The company's open proposal or approved-but-not-started change, or null. Expired proposals are closed first.</summary>
    public async Task<PlanChangeRequest?> OpenForCompanyAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await catalog.PlanChangeRequests
            .Where(r => r.CompanyId == companyId && r.Status == PlanChangeStatus.Pending && r.ExpiresAt <= now)
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.Status, PlanChangeStatus.Expired), cancellationToken);
        return await catalog.PlanChangeRequests.AsNoTracking()
            .Where(r => r.CompanyId == companyId && (r.Status == PlanChangeStatus.Pending || r.Status == PlanChangeStatus.Scheduled))
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// The Owner approves. The price and timing are worked out again now (the days left have changed since Trovo
    /// proposed it), and the change is applied, invoiced or scheduled. Approving twice is refused.
    /// </summary>
    public async Task<PlanChangeRequest> ApproveAsync(Guid companyId, Guid requestId, Guid? userId, string? userName,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await catalog.Database.BeginTransactionAsync(cancellationToken);
        var request = await catalog.PlanChangeRequests
            .FromSqlInterpolated($"""SELECT * FROM "PlanChangeRequests" WHERE "Id" = {requestId} AND "CompanyId" = {companyId} FOR UPDATE""")
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Plan change not found.");
        if (request.Status != PlanChangeStatus.Pending) throw new ConflictException("This proposal has already been answered or withdrawn.");
        var now = DateTime.UtcNow;
        if (request.ExpiresAt <= now)
        {
            request.Status = PlanChangeStatus.Expired;
            await catalog.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            throw new ConflictException("This proposal has expired. Ask Trovo to send it again.");
        }

        var subscription = await subscriptions.CurrentAsync(companyId, cancellationToken);
        if (subscription.Id != request.SubscriptionId || subscription.Status is SubscriptionStatus.Canceled or SubscriptionStatus.Suspended)
        {
            throw new ConflictException("The subscription has changed since this was proposed. Ask Trovo to send it again.");
        }

        var target = new PlanChangeTarget(request.PlanCode, request.Interval, request.Licences, SubscriptionService.AddOnsOf(request), SubscriptionService.SeatsOf(request));
        var preview = await PreviewAsync(companyId, target, cancellationToken);
        Fill(request, preview);
        request.DecidedAt = now;
        request.DecidedByUserId = userId;
        request.DecidedByName = userName is { Length: > 150 } ? userName[..150] : userName;

        // An earlier approved downgrade is replaced by this decision.
        await catalog.PlanChangeRequests
            .Where(r => r.CompanyId == companyId && r.Status == PlanChangeStatus.Scheduled && r.Id != request.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.Status, PlanChangeStatus.Cancelled), cancellationToken);

        var owner = new SubscriptionActor(PlatformActorType.Owner, userId);
        if (preview.Timing == PlanChangeTiming.AtPeriodEnd)
        {
            request.Status = PlanChangeStatus.Scheduled;
            await catalog.SaveChangesAsync(cancellationToken);
        }
        else
        {
            var periodStart = subscription.CurrentPeriodStart;
            var periodEnd = subscription.CurrentPeriodEnd;
            await subscriptions.ChangeAsync(companyId,
                new SubscriptionChange(target.PlanCode, target.Interval, target.AddOns, null, target.Licences, target.Seats), owner, cancellationToken);
            request.Status = PlanChangeStatus.Applied;
            request.AppliedAt = now;
            if (preview.Timing == PlanChangeTiming.NowWithCharge)
            {
                var changed = await subscriptions.CurrentAsync(companyId, cancellationToken);
                var days = Math.Max(1, (int)Math.Ceiling((periodEnd - now).TotalDays));
                var totalDays = Math.Max(1, (int)Math.Round((periodEnd - periodStart).TotalDays));
                var description = $"Upgrade to {changed.PlanVersion!.Plan!.Name} ({Describe(target)}): price difference for the rest of the paid period, " +
                                  $"{days} of {totalDays} days (until {BillingInvoiceService.ToIndia(periodEnd).AddDays(-1):dd MMM yyyy})";
                var invoice = await invoices.CreateAdjustmentAsync(changed, description, preview.AmountNowMinor, preview.Currency, cancellationToken);
                request.AdjustmentInvoiceId = invoice.Id;
            }
            await catalog.SaveChangesAsync(cancellationToken);
        }

        // Unpaid period invoices (e.g. a renewal already issued) are issued again on the terms that now apply.
        await subscriptions.ReissueOpenPeriodInvoicesAsync(companyId, cancellationToken);
        await subscriptions.RecordPlanChangeEventAsync(subscription.Id,
            request.Status == PlanChangeStatus.Scheduled ? "plan_change_scheduled" : "plan_change_applied", owner,
            new { request.Id, timing = preview.Timing.ToString(), preview.AmountNowMinor, request.EffectiveAt, approvedBy = request.DecidedByName },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        Log.Information("Platform: plan change {RequestId} approved for company {CompanyId} ({Timing})", request.Id, companyId, preview.Timing);
        return request;
    }

    public async Task<PlanChangeRequest> DeclineAsync(Guid companyId, Guid requestId, Guid? userId, string? userName,
        CancellationToken cancellationToken = default)
    {
        var request = await catalog.PlanChangeRequests.FirstOrDefaultAsync(r => r.Id == requestId && r.CompanyId == companyId, cancellationToken)
            ?? throw new NotFoundException("Plan change not found.");
        if (request.Status != PlanChangeStatus.Pending) throw new ConflictException("This proposal has already been answered or withdrawn.");
        request.Status = PlanChangeStatus.Declined;
        request.DecidedAt = DateTime.UtcNow;
        request.DecidedByUserId = userId;
        request.DecidedByName = userName is { Length: > 150 } ? userName[..150] : userName;
        await catalog.SaveChangesAsync(cancellationToken);
        await subscriptions.RecordPlanChangeEventAsync(request.SubscriptionId, "plan_change_declined", new SubscriptionActor(PlatformActorType.Owner, userId),
            new { request.Id, declinedBy = request.DecidedByName }, cancellationToken);
        return request;
    }

    private static void Fill(PlanChangeRequest request, PlanChangePreview preview)
    {
        request.Timing = preview.Timing;
        request.CurrentPeriodPriceMinor = preview.CurrentPeriodPriceMinor;
        request.NewPeriodPriceMinor = preview.NewPeriodPriceMinor;
        request.AmountNowMinor = preview.AmountNowMinor;
        request.Currency = preview.Currency;
        request.EffectiveAt = preview.EffectiveAt;
    }

    private static bool IsCurrent(Subscription subscription, PlanChangeTarget target)
    {
        var addOns = subscription.Items.Where(i => i.EffectiveTo is null).ToDictionary(i => i.AddOnPrice!.AddOn!.Code, i => i.Quantity);
        var wanted = target.AddOns.Where(a => a.Value > 0).ToDictionary(a => a.Key, a => a.Value);
        return subscription.PlanVersion!.Plan!.Code == target.PlanCode
               && subscription.PlanVersion.Interval == target.Interval
               && (target.Seats is null ? subscription.Licences == target.Licences
                   : ProductSeats.Of(subscription).Count == target.Seats.Count && target.Seats.All(s => ProductSeats.Of(subscription).GetValueOrDefault(s.Key) == s.Value))
               && addOns.Count == wanted.Count && addOns.All(a => wanted.TryGetValue(a.Key, out var q) && q == a.Value);
    }

    private static string Describe(PlanChangeTarget target) => target.Interval == BillingInterval.Year ? "yearly" : "monthly";
}
