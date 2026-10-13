using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>Who caused a subscription change, for its history and the audit log.</summary>
public sealed record SubscriptionActor(PlatformActorType Type, Guid? Id = null)
{
    public static readonly SubscriptionActor System = new(PlatformActorType.System);
}

/// <summary>A change Trovo makes to a company's subscription. Null fields stay as they are.</summary>
public sealed record SubscriptionChange(
    string? PlanCode = null,
    BillingInterval? Interval = null,
    IReadOnlyDictionary<string, int>? AddOns = null,
    int? ExtendTrialDays = null,
    LicenceCounts? Licences = null);

/// <summary>
/// A company's subscription over its life: trial, paid periods, renewals, grace, read-only, suspension and
/// cancellation (docs/SAAS_PHASE2_PLAN.md §5). Every change is written to the subscription's history.
/// </summary>
public sealed class SubscriptionService(
    PlatformDbContext catalog,
    BillingInvoiceService invoices,
    IEntitlementService entitlements,
    IOptions<PlatformOptions> options,
    PlatformSettingsService platformSettings)
{
    private PlatformOptions Settings => options.Value;

    // ── Starting ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// A new company's free trial: full Professional for the trial days, with the trial's user licences (for both
    /// apps). Both come from the platform settings Trovo can change in the admin portal.
    /// </summary>
    public async Task<Subscription> StartTrialAsync(PlatformCompany company, SubscriptionActor actor, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var effective = await platformSettings.GetAsync(cancellationToken);
        var version = await CurrentVersionAsync(company.ProductId, "professional", BillingInterval.Month, cancellationToken);
        var account = await EnsureBillingAccountAsync(company, cancellationToken);
        var trialEnd = now.AddDays(effective.TrialDays);

        var subscription = NewSubscription(company, account, version, SubscriptionStatus.Trialing, now, now, trialEnd);
        subscription.TrialEndsAt = trialEnd;
        subscription.Licences = new LicenceCounts(0, 0, effective.TrialLicences);
        catalog.Subscriptions.Add(subscription);
        AddEvent(subscription, "trial_started", actor, new { plan = "professional", trialEndsAt = trialEnd, licences = subscription.Licences });
        await catalog.SaveChangesAsync(cancellationToken);
        entitlements.Invalidate(company.Id);
        return subscription;
    }

    /// <summary>
    /// A subscription that is already paid for a period (an existing client moved onto the platform, or a payment
    /// Trovo received outside the system before the company was created).
    /// </summary>
    public async Task<Subscription> StartPaidAsync(PlatformCompany company, string planCode, BillingInterval interval,
        IReadOnlyDictionary<string, int> addOns, LicenceCounts licences, DateTime periodStart, DateTime periodEnd, SubscriptionActor actor,
        CancellationToken cancellationToken = default)
    {
        if (periodEnd <= periodStart) throw new ValidationException("The paid period must end after it starts.");

        var version = await CurrentVersionAsync(company.ProductId, planCode, interval, cancellationToken);
        RequireValid(licences, version);
        var account = await EnsureBillingAccountAsync(company, cancellationToken);
        var subscription = NewSubscription(company, account, version, SubscriptionStatus.Active, periodStart, periodStart, periodEnd);
        subscription.Licences = licences;
        catalog.Subscriptions.Add(subscription);
        await SetAddOnsAsync(subscription, version, company.ProductId, interval, addOns, periodStart, cancellationToken);
        AddEvent(subscription, "activated", actor, new { plan = planCode, interval = interval.ToString(), addOns, licences, periodStart, periodEnd });
        await catalog.SaveChangesAsync(cancellationToken);
        entitlements.Invalidate(company.Id);
        return subscription;
    }

    // ── Changes by Trovo ─────────────────────────────────────────────────────────

    /// <summary>
    /// Changes plan, interval, add-ons or extends the trial. Prices apply from the next invoice (no proration in v1);
    /// features change immediately.
    /// </summary>
    public async Task<Subscription> ChangeAsync(Guid companyId, SubscriptionChange change, SubscriptionActor actor, CancellationToken cancellationToken = default)
    {
        var subscription = await CurrentAsync(companyId, cancellationToken);
        var company = await catalog.Companies.FirstAsync(c => c.Id == companyId, cancellationToken);
        var now = DateTime.UtcNow;
        var before = Describe(subscription);

        var planCode = change.PlanCode ?? subscription.PlanVersion!.Plan!.Code;
        var interval = change.Interval ?? subscription.PlanVersion!.Interval;
        var planChanged = planCode != subscription.PlanVersion!.Plan!.Code || interval != subscription.PlanVersion.Interval;
        if (planChanged)
        {
            var version = await CurrentVersionAsync(company.ProductId, planCode, interval, cancellationToken);
            subscription.PlanVersionId = version.Id;
            subscription.PlanVersion = version;
        }

        if (change.Licences is { } licences)
        {
            RequireValid(licences, subscription.PlanVersion);
            subscription.Licences = licences;
        }
        else if (planChanged)
        {
            RequireValid(subscription.Licences, subscription.PlanVersion);
        }

        if (change.AddOns is not null || planChanged)
        {
            var wanted = change.AddOns ?? subscription.Items
                .Where(i => i.EffectiveTo is null)
                .ToDictionary(i => i.AddOnPrice!.AddOn!.Code, i => i.Quantity);
            if (planChanged && change.AddOns is null)
            {
                // Moving to a plan that includes a module ends that module's add-on, so it is not paid for twice.
                wanted = await WithoutIncludedModulesAsync(wanted, subscription.PlanVersion, company.ProductId, cancellationToken);
            }
            await SetAddOnsAsync(subscription, subscription.PlanVersion, company.ProductId, interval, wanted, now, cancellationToken);
        }

        if (change.ExtendTrialDays is { } days)
        {
            if (subscription.Status is not (SubscriptionStatus.Trialing or SubscriptionStatus.ReadOnly) || subscription.TrialEndsAt is null)
            {
                throw new ValidationException("Only a trial can be extended.");
            }
            if (days is < 1 or > 90) throw new ValidationException("A trial can be extended by 1 to 90 days.");

            var from = subscription.TrialEndsAt.Value > now ? subscription.TrialEndsAt.Value : now;
            subscription.TrialEndsAt = from.AddDays(days);
            subscription.CurrentPeriodEnd = subscription.TrialEndsAt.Value;
            subscription.Status = SubscriptionStatus.Trialing;
        }

        subscription.UpdatedAt = now;
        AddEvent(subscription, "changed", actor, new { before, after = Describe(subscription) });
        await catalog.SaveChangesAsync(cancellationToken);
        entitlements.Invalidate(companyId);
        return subscription;
    }

    /// <summary>Trovo switches a company off. Nobody can sign in until it is reactivated. No data is deleted.</summary>
    public async Task SuspendAsync(Guid companyId, string reason, SubscriptionActor actor, CancellationToken cancellationToken = default)
    {
        RequireReason(reason);
        var subscription = await CurrentAsync(companyId, cancellationToken);
        if (subscription.Status == SubscriptionStatus.Suspended) return;

        subscription.StatusBeforeSuspension = subscription.Status;
        subscription.Status = SubscriptionStatus.Suspended;
        subscription.UpdatedAt = DateTime.UtcNow;
        AddEvent(subscription, "suspended", actor, new { reason, previous = subscription.StatusBeforeSuspension.ToString() });
        await catalog.SaveChangesAsync(cancellationToken);
        entitlements.Invalidate(companyId);
    }

    /// <summary>Lifts a suspension: the company returns to the state it was in (re-checked against its dates).</summary>
    public async Task ReactivateAsync(Guid companyId, string reason, SubscriptionActor actor, CancellationToken cancellationToken = default)
    {
        RequireReason(reason);
        var subscription = await CurrentAsync(companyId, cancellationToken);
        if (subscription.Status != SubscriptionStatus.Suspended) return;

        subscription.Status = subscription.StatusBeforeSuspension ?? SubscriptionStatus.ReadOnly;
        subscription.StatusBeforeSuspension = null;
        subscription.UpdatedAt = DateTime.UtcNow;
        AddEvent(subscription, "reactivated", actor, new { reason, status = subscription.Status.ToString() });
        ApplyDates(subscription, DateTime.UtcNow, (await platformSettings.GetAsync(cancellationToken)).GraceDays);
        await catalog.SaveChangesAsync(cancellationToken);
        entitlements.Invalidate(companyId);
    }

    /// <summary>Cancels at the end of the paid period, or now. Data stays read-only for the retention period.</summary>
    public async Task CancelAsync(Guid companyId, bool atPeriodEnd, string reason, SubscriptionActor actor, CancellationToken cancellationToken = default)
    {
        RequireReason(reason);
        var subscription = await CurrentAsync(companyId, cancellationToken);
        var now = DateTime.UtcNow;
        if (atPeriodEnd && subscription.Status is SubscriptionStatus.Active or SubscriptionStatus.PastDue)
        {
            subscription.CancelAtPeriodEnd = true;
            AddEvent(subscription, "cancel_scheduled", actor, new { reason, at = subscription.CurrentPeriodEnd });
        }
        else
        {
            subscription.Status = SubscriptionStatus.Canceled;
            subscription.CanceledAt = now;
            subscription.RetainUntil = now.AddDays(Settings.CanceledRetentionDays);
            AddEvent(subscription, "canceled", actor, new { reason, retainUntil = subscription.RetainUntil });
        }
        subscription.UpdatedAt = now;
        await catalog.SaveChangesAsync(cancellationToken);
        entitlements.Invalidate(companyId);
    }

    /// <summary>Takes back a cancellation scheduled for the period end (the subscription renews as usual).</summary>
    public async Task ResumeAsync(Guid companyId, SubscriptionActor actor, CancellationToken cancellationToken = default)
    {
        var subscription = await CurrentAsync(companyId, cancellationToken);
        if (!subscription.CancelAtPeriodEnd || subscription.Status is SubscriptionStatus.Canceled)
        {
            throw new ConflictException("There is no cancellation to take back.");
        }
        subscription.CancelAtPeriodEnd = false;
        subscription.UpdatedAt = DateTime.UtcNow;
        AddEvent(subscription, "cancel_withdrawn", actor, new { });
        await catalog.SaveChangesAsync(cancellationToken);
        entitlements.Invalidate(companyId);
    }

    // ── Payments ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Records a payment Trovo received outside a gateway (bank transfer, UPI). When the invoice is fully paid the
    /// subscription is activated or renewed for the invoice's period. A reference already recorded is refused, so the
    /// same payment cannot be entered twice.
    /// </summary>
    public Task<PaymentTransaction> RecordManualPaymentAsync(Guid invoiceId, long amountMinor, string reference, DateTime? paidAt,
        SubscriptionActor actor, CancellationToken cancellationToken = default) =>
        RecordPaymentAsync(invoiceId, amountMinor, "Manual", reference, paidAt, actor, cancellationToken);

    /// <summary>
    /// Records a payment from any source ("Manual" by Trovo, "Test" on test servers, later the gateway's name).
    /// The same reference cannot be recorded twice for one source. Fully paying the invoice activates or renews.
    /// </summary>
    public async Task<PaymentTransaction> RecordPaymentAsync(Guid invoiceId, long amountMinor, string provider, string reference, DateTime? paidAt,
        SubscriptionActor actor, CancellationToken cancellationToken = default)
    {
        if (amountMinor <= 0) throw new ValidationException("The amount must be more than zero.");
        if (string.IsNullOrWhiteSpace(reference)) throw new ValidationException("A payment reference (UTR, UPI id or note) is required.");

        await using var transaction = catalog.Database.CurrentTransaction is null
            ? await catalog.Database.BeginTransactionAsync(cancellationToken)
            : null;
        var invoice = await catalog.BillingInvoices
            .FromSqlInterpolated($"""SELECT * FROM "BillingInvoices" WHERE "Id" = {invoiceId} FOR UPDATE""")
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Invoice not found.");

        if (invoice.Status is not BillingInvoiceStatus.Open)
        {
            throw new ValidationException($"Invoice {invoice.InvoiceNumber} is {invoice.Status.ToString().ToLowerInvariant()}, so no payment can be recorded.");
        }
        if (amountMinor > invoice.AmountDueMinor)
        {
            throw new ValidationException("The amount is more than what is due on the invoice.");
        }

        var trimmedReference = reference.Trim();
        if (await catalog.PaymentTransactions.AnyAsync(p => p.Provider == provider && p.Reference == trimmedReference, cancellationToken))
        {
            throw new ConflictException("A payment with this reference has already been recorded.");
        }

        var now = DateTime.UtcNow;
        var payment = new PaymentTransaction
        {
            Id = Guid.NewGuid(),
            BillingInvoiceId = invoice.Id,
            Provider = provider,
            AmountMinor = amountMinor,
            Currency = invoice.Currency,
            Status = PaymentTransactionStatus.Succeeded,
            PaidAt = paidAt ?? now,
            Reference = trimmedReference,
            CreatedAt = now
        };
        catalog.PaymentTransactions.Add(payment);

        invoice.AmountDueMinor -= amountMinor;
        if (invoice.AmountDueMinor == 0)
        {
            invoice.Status = BillingInvoiceStatus.Paid;
            invoice.PaidAt = payment.PaidAt;
            await ApplyPaidInvoiceAsync(invoice, actor, cancellationToken);
        }

        await catalog.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        entitlements.Invalidate(invoice.CompanyId);
        return payment;
    }

    /// <summary>
    /// A fully paid invoice activates or renews its subscription. A company that was in trial or read-only starts a
    /// fresh period from today; an active or past-due company keeps its anniversary (the invoice's period).
    /// Applying the same invoice twice changes nothing.
    /// </summary>
    private async Task ApplyPaidInvoiceAsync(BillingInvoice invoice, SubscriptionActor actor, CancellationToken cancellationToken)
    {
        if (invoice.SubscriptionId is not { } subscriptionId || invoice.Kind == BillingInvoiceKind.Adjustment) return;
        var subscription = await catalog.Subscriptions.Include(s => s.PlanVersion)
            .FirstAsync(s => s.Id == subscriptionId, cancellationToken);
        if (!subscription.IsCurrent || subscription.Status is SubscriptionStatus.Canceled or SubscriptionStatus.Suspended) return;

        var now = DateTime.UtcNow;
        DateTime start, end;
        if (subscription.Status is SubscriptionStatus.Trialing or SubscriptionStatus.ReadOnly or SubscriptionStatus.Incomplete)
        {
            start = now;
            end = AddInterval(now, subscription.PlanVersion!.Interval);
        }
        else
        {
            start = invoice.PeriodStart ?? subscription.CurrentPeriodEnd;
            end = invoice.PeriodEnd ?? AddInterval(start, subscription.PlanVersion!.Interval);
            if (subscription.CurrentPeriodEnd >= end) return; // already applied
        }

        var previous = subscription.Status;
        subscription.Status = SubscriptionStatus.Active;
        subscription.CurrentPeriodStart = start;
        subscription.CurrentPeriodEnd = end;
        subscription.GraceEndsAt = null;
        subscription.UpdatedAt = now;
        AddEvent(subscription, previous == SubscriptionStatus.Active ? "renewed" : "activated", actor,
            new { invoice = invoice.InvoiceNumber, previous = previous.ToString(), periodStart = start, periodEnd = end });
    }

    /// <summary>Issues an invoice now for the company's next period (Trovo's "send invoice" action).</summary>
    public async Task<BillingInvoice> IssueNextInvoiceAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await CurrentAsync(companyId, cancellationToken);
        if (await catalog.BillingInvoices.AnyAsync(i => i.SubscriptionId == subscription.Id && i.Status == BillingInvoiceStatus.Open
                && i.Kind == BillingInvoiceKind.Period, cancellationToken))
        {
            throw new ConflictException("This company already has an open invoice.");
        }
        var (start, end) = NextPeriod(subscription, DateTime.UtcNow);
        var terms = await ScheduledTermsAsync(subscription, start, cancellationToken);
        if (terms is not null) end = AddInterval(start, terms.Version.Interval);
        return await invoices.CreateForPeriodAsync(subscription, start, end, cancellationToken, terms);
    }

    // ── Time-based rules (run every few minutes) ─────────────────────────────────

    /// <summary>
    /// Applies the time rules to every subscription: trial or grace ended unpaid → read-only; a paid period ended
    /// unpaid → past due with grace; scheduled cancellations; and renewal invoices a few days before a period ends.
    /// Returns how many subscriptions changed. Safe to run as often as wanted.
    /// </summary>
    public async Task<int> RunLifecycleAsync(DateTime now, CancellationToken cancellationToken = default)
    {
        var changed = await ApplyScheduledChangesAsync(now, cancellationToken);
        await ExpireProposalsAsync(now, cancellationToken);
        var effective = await platformSettings.GetAsync(cancellationToken);
        var due = await catalog.Subscriptions
            .Include(s => s.PlanVersion!).ThenInclude(v => v.Plan)
            .Include(s => s.Items).ThenInclude(i => i.AddOnPrice!).ThenInclude(p => p.AddOn)
            .Where(s => s.IsCurrent && (
                (s.Status == SubscriptionStatus.Trialing) ||
                (s.Status == SubscriptionStatus.Active) ||
                (s.Status == SubscriptionStatus.PastDue)))
            .ToListAsync(cancellationToken);

        foreach (var subscription in due)
        {
            var before = subscription.Status;
            ApplyDates(subscription, now, effective.GraceDays);
            if (subscription.Status != before)
            {
                changed++;
                entitlements.Invalidate(subscription.CompanyId);
            }
        }
        await catalog.SaveChangesAsync(cancellationToken);

        // Renewal (or first) invoices, so Trovo and the company see what to pay before access is affected.
        foreach (var subscription in due.Where(s =>
                     s.Status is SubscriptionStatus.Active or SubscriptionStatus.PastDue or SubscriptionStatus.Trialing && !s.CancelAtPeriodEnd))
        {
            // A trial gets its first invoice in its last 3 days; a paid period gets its renewal invoice earlier.
            var daysBefore = subscription.Status == SubscriptionStatus.Trialing ? 3 : effective.RenewalInvoiceDaysBefore;
            var issueFrom = subscription.CurrentPeriodEnd.AddDays(-daysBefore);
            if (now < issueFrom) continue;
            var hasInvoice = await catalog.BillingInvoices.AnyAsync(i =>
                i.SubscriptionId == subscription.Id &&
                i.Kind == BillingInvoiceKind.Period &&
                (i.Status == BillingInvoiceStatus.Open || (i.Status == BillingInvoiceStatus.Paid && i.PeriodStart >= subscription.CurrentPeriodEnd)),
                cancellationToken);
            if (hasInvoice) continue;

            var (start, end) = NextPeriod(subscription, now);
            // A downgrade the Owner approved starts with the next period, so that period is billed on the new terms.
            var terms = await ScheduledTermsAsync(subscription, start, cancellationToken);
            if (terms is not null) end = AddInterval(start, terms.Version.Interval);
            var invoice = await invoices.CreateForPeriodAsync(subscription, start, end, cancellationToken, terms);
            AddEvent(subscription, "invoice_issued", SubscriptionActor.System, new { invoice = invoice.InvoiceNumber, total = invoice.TotalMinor });
            await catalog.SaveChangesAsync(cancellationToken);
            Log.Information("Platform: issued {Invoice} to company {CompanyId}", invoice.InvoiceNumber, subscription.CompanyId);
        }

        return changed;
    }

    /// <summary>The date rules for one subscription (no saving).</summary>
    private void ApplyDates(Subscription subscription, DateTime now, int graceDays)
    {
        switch (subscription.Status)
        {
            case SubscriptionStatus.Trialing when subscription.TrialEndsAt is { } trialEnd && trialEnd <= now:
                subscription.Status = SubscriptionStatus.ReadOnly;
                AddEvent(subscription, "trial_ended_unpaid", SubscriptionActor.System, new { trialEnd });
                break;

            case SubscriptionStatus.Active when subscription.CurrentPeriodEnd <= now && subscription.CancelAtPeriodEnd:
                subscription.Status = SubscriptionStatus.Canceled;
                subscription.CanceledAt = subscription.CurrentPeriodEnd;
                subscription.RetainUntil = now.AddDays(Settings.CanceledRetentionDays);
                AddEvent(subscription, "canceled", SubscriptionActor.System, new { reason = "cancellation at period end", retainUntil = subscription.RetainUntil });
                break;

            case SubscriptionStatus.Active when subscription.CurrentPeriodEnd <= now:
                subscription.Status = SubscriptionStatus.PastDue;
                subscription.GraceEndsAt = subscription.CurrentPeriodEnd.AddDays(graceDays);
                AddEvent(subscription, "period_ended_unpaid", SubscriptionActor.System, new { graceEndsAt = subscription.GraceEndsAt });
                if (subscription.GraceEndsAt <= now)
                {
                    subscription.Status = SubscriptionStatus.ReadOnly;
                    AddEvent(subscription, "grace_ended_unpaid", SubscriptionActor.System, new { graceEnd = subscription.GraceEndsAt });
                }
                break;

            case SubscriptionStatus.PastDue when subscription.GraceEndsAt is { } graceEnd && graceEnd <= now:
                subscription.Status = SubscriptionStatus.ReadOnly;
                AddEvent(subscription, "grace_ended_unpaid", SubscriptionActor.System, new { graceEnd });
                break;
        }
        subscription.UpdatedAt = now;
    }

    // ── Approved plan changes ────────────────────────────────────────────────────

    /// <summary>
    /// The plan, licences and add-ons of a change, priced from today's catalog (validated as a sale would be: the
    /// plan's minimum licences, add-ons on sale, no add-on the plan already includes).
    /// </summary>
    public async Task<InvoiceTerms> TermsForAsync(Guid productId, string planCode, BillingInterval interval, LicenceCounts licences,
        IReadOnlyDictionary<string, int> addOns, CancellationToken cancellationToken = default)
    {
        var version = await CurrentVersionAsync(productId, planCode, interval, cancellationToken);
        RequireValid(licences, version);
        var now = DateTime.UtcNow;
        var priced = new List<(AddOnPrice Price, int Quantity)>();
        foreach (var (code, quantity) in addOns.Where(a => a.Value > 0))
        {
            if (quantity > 100) throw new ValidationException($"Add-on '{code}': quantity must be 0 to 100.");
            var price = await catalog.AddOnPrices.Include(p => p.AddOn)
                .Where(p => p.AddOn!.ProductId == productId && p.AddOn.Code == code && p.AddOn.IsActive && p.Interval == interval
                            && p.EffectiveFrom <= now && (p.EffectiveTo == null || p.EffectiveTo > now))
                .OrderByDescending(p => p.Version)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new ValidationException($"Add-on '{code}' is not available.");
            if (PlanIncludes(version, price.AddOn!))
            {
                throw new ValidationException($"The {version.Plan?.Name ?? "chosen"} plan already includes {price.AddOn!.Name}; it cannot be added again.");
            }
            priced.Add((price, quantity));
        }
        return new InvoiceTerms(version, licences, priced);
    }

    /// <summary>The terms of a downgrade approved to start at or before <paramref name="periodStart"/>, or null.</summary>
    private async Task<InvoiceTerms?> ScheduledTermsAsync(Subscription subscription, DateTime periodStart, CancellationToken cancellationToken)
    {
        var scheduled = await catalog.PlanChangeRequests.AsNoTracking()
            .Where(r => r.SubscriptionId == subscription.Id && r.Status == PlanChangeStatus.Scheduled && r.EffectiveAt <= periodStart)
            .OrderByDescending(r => r.DecidedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (scheduled is null) return null;
        var productId = await catalog.Companies.Where(c => c.Id == subscription.CompanyId).Select(c => c.ProductId).FirstAsync(cancellationToken);
        return await TermsForAsync(productId, scheduled.PlanCode, scheduled.Interval, scheduled.Licences, AddOnsOf(scheduled), cancellationToken);
    }

    public static IReadOnlyDictionary<string, int> AddOnsOf(PlanChangeRequest request) =>
        JsonSerializer.Deserialize<Dictionary<string, int>>(request.AddOnsJson) ?? new Dictionary<string, int>();

    /// <summary>Approved downgrades whose date has come: the subscription moves to the new terms.</summary>
    private async Task<int> ApplyScheduledChangesAsync(DateTime now, CancellationToken cancellationToken)
    {
        var dueChanges = await catalog.PlanChangeRequests
            .Where(r => r.Status == PlanChangeStatus.Scheduled && r.EffectiveAt <= now)
            .ToListAsync(cancellationToken);
        var applied = 0;
        foreach (var request in dueChanges)
        {
            var subscription = await catalog.Subscriptions.FirstOrDefaultAsync(s => s.CompanyId == request.CompanyId && s.IsCurrent, cancellationToken);
            if (subscription is null || subscription.Id != request.SubscriptionId || subscription.Status is SubscriptionStatus.Canceled)
            {
                request.Status = PlanChangeStatus.Cancelled;
                await catalog.SaveChangesAsync(cancellationToken);
                continue;
            }
            await ChangeAsync(request.CompanyId,
                new SubscriptionChange(request.PlanCode, request.Interval, AddOnsOf(request), null, request.Licences),
                SubscriptionActor.System, cancellationToken);
            request.Status = PlanChangeStatus.Applied;
            request.AppliedAt = now;
            await catalog.SaveChangesAsync(cancellationToken);
            Log.Information("Platform: scheduled plan change {RequestId} applied to company {CompanyId}", request.Id, request.CompanyId);
            applied++;
        }
        return applied;
    }

    private async Task ExpireProposalsAsync(DateTime now, CancellationToken cancellationToken) =>
        await catalog.PlanChangeRequests
            .Where(r => r.Status == PlanChangeStatus.Pending && r.ExpiresAt <= now)
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.Status, PlanChangeStatus.Expired), cancellationToken);

    /// <summary>
    /// Unpaid period invoices no longer match after the terms changed: each is voided and issued again for the same
    /// period on the terms that apply to it. Paid invoices are never touched.
    /// </summary>
    public async Task ReissueOpenPeriodInvoicesAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var subscription = await CurrentAsync(companyId, cancellationToken);
        var open = await catalog.BillingInvoices
            .Where(i => i.SubscriptionId == subscription.Id && i.Status == BillingInvoiceStatus.Open && i.Kind == BillingInvoiceKind.Period
                        && i.PeriodStart != null && i.PeriodEnd != null)
            .ToListAsync(cancellationToken);
        foreach (var old in open)
        {
            old.Status = BillingInvoiceStatus.Void;
            await catalog.SaveChangesAsync(cancellationToken);
            var terms = await ScheduledTermsAsync(subscription, old.PeriodStart!.Value, cancellationToken);
            var end = terms is null ? old.PeriodEnd!.Value : AddInterval(old.PeriodStart.Value, terms.Version.Interval);
            var replacement = await invoices.CreateForPeriodAsync(subscription, old.PeriodStart.Value, end, cancellationToken, terms);
            AddEvent(subscription, "invoice_reissued", SubscriptionActor.System,
                new { voided = old.InvoiceNumber, issued = replacement.InvoiceNumber, total = replacement.TotalMinor });
            await catalog.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>Records a step of a plan change in the subscription's history.</summary>
    public async Task RecordPlanChangeEventAsync(Guid subscriptionId, string type, SubscriptionActor actor, object metadata,
        CancellationToken cancellationToken = default)
    {
        catalog.SubscriptionEvents.Add(new SubscriptionEvent
        {
            Id = Guid.NewGuid(),
            SubscriptionId = subscriptionId,
            EventType = type,
            EffectiveAt = DateTime.UtcNow,
            ActorType = actor.Type,
            ActorId = actor.Id,
            Metadata = JsonSerializer.Serialize(metadata),
            CreatedAt = DateTime.UtcNow
        });
        await catalog.SaveChangesAsync(cancellationToken);
    }

    public static DateTime NextIntervalEnd(DateTime start, BillingInterval interval) => AddInterval(start, interval);

    // ── Helpers ──────────────────────────────────────────────────────────────────

    public async Task<Subscription> CurrentAsync(Guid companyId, CancellationToken cancellationToken) =>
        await catalog.Subscriptions
            .Include(s => s.PlanVersion!).ThenInclude(v => v.Plan)
            .Include(s => s.PlanVersion!).ThenInclude(v => v.Entitlements)
            .Include(s => s.Items).ThenInclude(i => i.AddOnPrice!).ThenInclude(p => p.AddOn)
            .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.IsCurrent, cancellationToken)
        ?? throw new NotFoundException("This company has no subscription.");

    private async Task<PlanVersion> CurrentVersionAsync(Guid productId, string planCode, BillingInterval interval, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        return await catalog.PlanVersions.Include(v => v.Plan).Include(v => v.Entitlements)
            .Where(v => v.Plan!.ProductId == productId && v.Plan.Code == planCode && v.Plan.IsActive && v.Interval == interval
                        && v.EffectiveFrom <= now && (v.EffectiveTo == null || v.EffectiveTo > now))
            .OrderByDescending(v => v.Version)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new ValidationException($"Plan '{planCode}' ({interval.ToString().ToLowerInvariant()}ly) is not available.");
    }

    private async Task<BillingAccount> EnsureBillingAccountAsync(PlatformCompany company, CancellationToken cancellationToken)
    {
        var account = await catalog.BillingAccounts.FirstOrDefaultAsync(b => b.CompanyId == company.Id, cancellationToken);
        if (account is not null) return account;

        account = new BillingAccount
        {
            Id = Guid.NewGuid(),
            CompanyId = company.Id,
            BillingName = string.IsNullOrWhiteSpace(company.Name) ? company.Code : company.Name,
            CreatedAt = DateTime.UtcNow
        };
        catalog.BillingAccounts.Add(account);
        return account;
    }

    /// <summary>
    /// Makes the subscription's add-ons match the wanted quantities (0 removes). History is kept. A module the plan
    /// already includes cannot be bought again.
    /// </summary>
    private async Task SetAddOnsAsync(Subscription subscription, PlanVersion version, Guid productId, BillingInterval interval,
        IReadOnlyDictionary<string, int> wanted, DateTime at, CancellationToken cancellationToken)
    {
        foreach (var (code, quantity) in wanted)
        {
            if (quantity < 0 || quantity > 100) throw new ValidationException($"Add-on '{code}': quantity must be 0 to 100.");
        }

        var wantedCodes = wanted.Where(w => w.Value > 0).Select(w => w.Key).ToList();
        var wantedAddOns = await catalog.AddOns.AsNoTracking()
            .Where(a => a.ProductId == productId && wantedCodes.Contains(a.Code))
            .ToListAsync(cancellationToken);
        if (wantedAddOns.FirstOrDefault(a => PlanIncludes(version, a)) is { } duplicate)
        {
            throw new ValidationException($"The {version.Plan?.Name ?? "chosen"} plan already includes {duplicate.Name}; it cannot be added again.");
        }

        var current = subscription.Items.Where(i => i.EffectiveTo is null).ToList();
        foreach (var item in current)
        {
            var code = item.AddOnPrice!.AddOn!.Code;
            var keep = wanted.TryGetValue(code, out var quantity) && quantity > 0 && item.Quantity == quantity && item.AddOnPrice.Interval == interval;
            if (!keep) item.EffectiveTo = at;
        }

        foreach (var (code, quantity) in wanted.Where(w => w.Value > 0))
        {
            if (current.Any(i => i.EffectiveTo is null && i.AddOnPrice!.AddOn!.Code == code)) continue;

            var price = await catalog.AddOnPrices.Include(p => p.AddOn)
                .Where(p => p.AddOn!.ProductId == productId && p.AddOn.Code == code && p.AddOn.IsActive && p.Interval == interval
                            && p.EffectiveFrom <= at && (p.EffectiveTo == null || p.EffectiveTo > at))
                .OrderByDescending(p => p.Version)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new ValidationException($"Add-on '{code}' is not available.");

            // Added to the table explicitly: on an existing subscription EF would otherwise take a new item with its
            // id already set for an existing row.
            catalog.SubscriptionItems.Add(new SubscriptionItem
            {
                Id = Guid.NewGuid(),
                SubscriptionId = subscription.Id,
                ItemType = SubscriptionItemType.AddOn,
                AddOnPriceId = price.Id,
                AddOnPrice = price,
                Quantity = quantity,
                EffectiveFrom = at
            });
        }
    }

    /// <summary>Whether a plan version already grants what a module add-on would switch on.</summary>
    public static bool PlanIncludes(PlanVersion version, AddOn addOn) =>
        addOn.Value == "true" && version.Entitlements.Any(e =>
            string.Equals(e.FeatureKey, addOn.FeatureKey, StringComparison.OrdinalIgnoreCase) && e.Value == "true");

    private async Task<IReadOnlyDictionary<string, int>> WithoutIncludedModulesAsync(IReadOnlyDictionary<string, int> wanted, PlanVersion version,
        Guid productId, CancellationToken cancellationToken)
    {
        var codes = wanted.Keys.ToList();
        var addOns = await catalog.AddOns.AsNoTracking().Where(a => a.ProductId == productId && codes.Contains(a.Code)).ToListAsync(cancellationToken);
        var drop = addOns.Where(a => PlanIncludes(version, a)).Select(a => a.Code).ToHashSet();
        return wanted.Where(w => !drop.Contains(w.Key)).ToDictionary(w => w.Key, w => w.Value);
    }

    private static void RequireValid(LicenceCounts licences, PlanVersion version)
    {
        if (licences.Problem(version.IncludedSeats) is { } problem) throw new ValidationException(problem);
    }

    private static Subscription NewSubscription(PlatformCompany company, BillingAccount account, PlanVersion version,
        SubscriptionStatus status, DateTime started, DateTime periodStart, DateTime periodEnd) => new()
    {
        Id = Guid.NewGuid(),
        CompanyId = company.Id,
        BillingAccountId = account.Id,
        PlanVersionId = version.Id,
        PlanVersion = version,
        Status = status,
        IsCurrent = true,
        StartedAt = started,
        CurrentPeriodStart = periodStart,
        CurrentPeriodEnd = periodEnd,
        CreatedAt = DateTime.UtcNow
    };

    private static (DateTime Start, DateTime End) NextPeriod(Subscription subscription, DateTime now)
    {
        var interval = subscription.PlanVersion!.Interval;
        var start = subscription.Status is SubscriptionStatus.Active or SubscriptionStatus.PastDue
            ? subscription.CurrentPeriodEnd
            : (subscription.TrialEndsAt is { } trialEnd && trialEnd > now ? trialEnd : now);
        return (start, AddInterval(start, interval));
    }

    private static DateTime AddInterval(DateTime start, BillingInterval interval) =>
        interval == BillingInterval.Year ? start.AddYears(1) : start.AddMonths(1);

    private void AddEvent(Subscription subscription, string type, SubscriptionActor actor, object? metadata) =>
        catalog.SubscriptionEvents.Add(new SubscriptionEvent
        {
            Id = Guid.NewGuid(),
            SubscriptionId = subscription.Id,
            EventType = type,
            EffectiveAt = DateTime.UtcNow,
            ActorType = actor.Type,
            ActorId = actor.Id,
            Metadata = metadata is null ? null : JsonSerializer.Serialize(metadata),
            CreatedAt = DateTime.UtcNow
        });

    private static object Describe(Subscription subscription) => new
    {
        plan = subscription.PlanVersion?.Plan?.Code,
        interval = subscription.PlanVersion?.Interval.ToString(),
        status = subscription.Status.ToString(),
        trialEndsAt = subscription.TrialEndsAt,
        licences = new { android = subscription.AndroidLicences, windows = subscription.WindowsLicences, both = subscription.BothLicences },
        addOns = subscription.Items.Where(i => i.EffectiveTo is null).Select(i => new { code = i.AddOnPrice?.AddOn?.Code, i.Quantity })
    };

    private static void RequireReason(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason)) throw new ValidationException("A reason is required.");
    }
}
