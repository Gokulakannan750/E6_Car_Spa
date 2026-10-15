using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>A single-company server has no Trovo subscription, so nothing is ever proposed.</summary>
public sealed class NoPlanChangeApprovals : IPlanChangeApprovals
{
    public Task<PlanChangeProposalDto?> GetOpenAsync(CancellationToken cancellationToken = default) => Task.FromResult<PlanChangeProposalDto?>(null);
    public Task<PlanChangeProposalDto?> ApproveAsync(Guid id, CancellationToken cancellationToken = default) => throw new NotFoundException("Plan change not found.");
    public Task DeclineAsync(Guid id, CancellationToken cancellationToken = default) => throw new NotFoundException("Plan change not found.");
}

/// <summary>The company's Owner sees Trovo's proposal (with today's price) and approves or declines it.</summary>
public sealed class PlatformPlanChangeApprovals(
    PlatformDbContext catalog,
    PlanChangeService planChanges,
    SubscriptionService subscriptions,
    ITenantContext tenant,
    IHttpContextAccessor http) : IPlanChangeApprovals
{
    private Guid Company => tenant.OrganizationId is { } id && id != Guid.Empty ? id : throw new ForbiddenException("No company is signed in.");

    private ClaimsPrincipal? User => http.HttpContext?.User;

    private Guid? UserId => Guid.TryParse(User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public async Task<PlanChangeProposalDto?> GetOpenAsync(CancellationToken cancellationToken = default)
    {
        var request = await planChanges.OpenForCompanyAsync(Company, cancellationToken);
        if (request is null) return null;
        var subscription = await subscriptions.CurrentAsync(Company, cancellationToken);
        var target = new PlanChangeTarget(request.PlanCode, request.Interval, request.Licences, SubscriptionService.AddOnsOf(request), SubscriptionService.SeatsOf(request));

        // A proposal shows today's price and timing (the days left change every day); a scheduled one what was approved.
        var (timing, current, next, now, effective) =
            (request.Timing, request.CurrentPeriodPriceMinor, request.NewPeriodPriceMinor, request.AmountNowMinor, request.EffectiveAt);
        if (request.Status == PlanChangeStatus.Pending)
        {
            try
            {
                var preview = await planChanges.PreviewAsync(Company, target, cancellationToken);
                (timing, current, next, now, effective) =
                    (preview.Timing, preview.CurrentPeriodPriceMinor, preview.NewPeriodPriceMinor, preview.AmountNowMinor, preview.EffectiveAt);
            }
            catch (ValidationException)
            {
                // The plan or an add-on is no longer sold: the stored figures are shown, and approving says why.
            }
        }

        var productId = await catalog.Companies.Where(c => c.Id == Company).Select(c => c.ProductId).FirstAsync(cancellationToken);
        var addOnNames = await catalog.AddOns.AsNoTracking().Where(a => a.ProductId == productId)
            .ToDictionaryAsync(a => a.Code, a => a.Name, cancellationToken);
        var planName = await catalog.Plans.AsNoTracking().Where(p => p.ProductId == productId && p.Code == request.PlanCode)
            .Select(p => p.Name).FirstOrDefaultAsync(cancellationToken) ?? request.PlanCode;
        var from = new PlanTermsSummaryDto(subscription.PlanVersion!.Plan!.Name, subscription.PlanVersion.Interval.ToString(),
            subscription.Licences.Android, subscription.Licences.Windows, subscription.Licences.Both,
            subscription.Items.Where(i => i.EffectiveTo is null).Select(i => Named(i.AddOnPrice!.AddOn!.Name, i.Quantity)).ToList(), ProductSeats.Describe(subscription.PlanVersion, ProductSeats.Of(subscription)));
        // Display remains available after a plan stops being sold; approval still validates current sale terms.
        var targetVersion = await catalog.PlanVersions.AsNoTracking()
            .Where(v => v.Plan!.ProductId == productId && v.Plan.Code == target.PlanCode && v.Interval == target.Interval)
            .OrderByDescending(v => v.Version).FirstOrDefaultAsync(cancellationToken);
        var to = new PlanTermsSummaryDto(planName, request.Interval.ToString(), request.AndroidLicences, request.WindowsLicences, request.BothLicences,
            target.AddOns.Where(a => a.Value > 0).Select(a => Named(addOnNames.GetValueOrDefault(a.Key, a.Key), a.Value)).ToList(), targetVersion is null ? [] : ProductSeats.Describe(targetVersion, target.Seats ?? ProductSeats.Legacy(target.Licences)));
        return new PlanChangeProposalDto(request.Id, request.Status.ToString(), timing.ToString(), from, to, current, next, now, request.Currency,
            effective, request.ExpiresAt, request.Reason);
    }

    /// <summary>Approves; returns the change while it still waits for the period end (a downgrade), or null once applied.</summary>
    public async Task<PlanChangeProposalDto?> ApproveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await planChanges.ApproveAsync(Company, id, UserId, User?.FindFirstValue(ClaimTypes.Name), cancellationToken);
        return await GetOpenAsync(cancellationToken);
    }

    public async Task DeclineAsync(Guid id, CancellationToken cancellationToken = default) =>
        await planChanges.DeclineAsync(Company, id, UserId, User?.FindFirstValue(ClaimTypes.Name), cancellationToken);

    private static string Named(string name, int quantity) => quantity > 1 ? $"{name} × {quantity}" : name;
}
