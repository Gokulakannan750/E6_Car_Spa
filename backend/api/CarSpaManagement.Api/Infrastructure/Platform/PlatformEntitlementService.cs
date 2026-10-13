using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>Single-company servers: no subscriptions, everything allowed.</summary>
public sealed class UnmanagedEntitlementService : IEntitlementService
{
    public Task<CompanyEntitlements> GetCurrentAsync(CancellationToken cancellationToken = default) => Task.FromResult(CompanyEntitlements.Unmanaged);
    public Task<CompanyEntitlements> GetForCompanyAsync(Guid companyId, CancellationToken cancellationToken = default) => Task.FromResult(CompanyEntitlements.Unmanaged);
    public void Invalidate(Guid companyId) { }
}

/// <summary>
/// Trovo's platform: entitlements come from the company's current subscription in the catalog: its plan version's
/// features plus the add-ons it has bought. Answers are cached briefly so a change takes effect within seconds.
/// </summary>
public sealed class PlatformEntitlementService(PlatformDbContext catalog, ITenantContext tenant, IMemoryCache cache) : IEntitlementService
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    /// <summary>Franchise branches included with the Franchise network add-on (more come in packs of 10).</summary>
    public const int IncludedFranchiseBranches = 10;

    public Task<CompanyEntitlements> GetCurrentAsync(CancellationToken cancellationToken = default) =>
        tenant.OrganizationId is { } companyId
            ? GetForCompanyAsync(companyId, cancellationToken)
            : Task.FromResult(NoAccess());

    public async Task<CompanyEntitlements> GetForCompanyAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var key = CacheKey(companyId);
        if (cache.TryGetValue(key, out CompanyEntitlements? cached) && cached is not null)
        {
            return cached;
        }

        var resolved = await ResolveAsync(companyId, DateTime.UtcNow, cancellationToken);
        cache.Set(key, resolved, CacheFor);
        return resolved;
    }

    public void Invalidate(Guid companyId) => cache.Remove(CacheKey(companyId));

    private static string CacheKey(Guid companyId) => $"entitlements:{companyId}";

    private async Task<CompanyEntitlements> ResolveAsync(Guid companyId, DateTime now, CancellationToken cancellationToken)
    {
        var subscription = await catalog.Subscriptions.AsNoTracking()
            .Include(s => s.PlanVersion!).ThenInclude(v => v.Plan)
            .Include(s => s.PlanVersion!).ThenInclude(v => v.Entitlements)
            .Include(s => s.Items).ThenInclude(i => i.AddOnPrice!).ThenInclude(p => p.AddOn)
            .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.IsCurrent, cancellationToken);

        if (subscription?.PlanVersion is null)
        {
            return NoAccess();
        }

        return Build(subscription, now);
    }

    /// <summary>Turns a subscription into entitlements. Public so the rules can be tested without a database.</summary>
    public static CompanyEntitlements Build(Subscription subscription, DateTime now)
    {
        var version = subscription.PlanVersion!;
        var features = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entitlement in version.Entitlements)
        {
            features[entitlement.FeatureKey] = entitlement.Value;
        }

        var seatLimit = version.IncludedSeats;
        var extraFranchiseBranches = 0;
        foreach (var item in subscription.Items.Where(i => i.EffectiveFrom <= now && (i.EffectiveTo is null || i.EffectiveTo > now)))
        {
            var addOn = item.AddOnPrice?.AddOn;
            if (addOn is null) continue;

            if (!FeatureKeys.All.TryGetValue(addOn.FeatureKey, out var type)) continue;
            if (type == EntitlementValueType.Bool)
            {
                features[addOn.FeatureKey] = "true";
            }
            else if (int.TryParse(addOn.Value, out var perUnit))
            {
                if (addOn.FeatureKey == FeatureKeys.UsersMaxActive) seatLimit += perUnit * item.Quantity;
                else if (addOn.FeatureKey == FeatureKeys.FranchiseNetworkBranches) extraFranchiseBranches += perUnit * item.Quantity;
            }
        }

        // Per-app user licences replace the old "users included + 5-user packs" limit when a subscription has them.
        LicenceCounts? licences = subscription.Licences.Total > 0 ? subscription.Licences : null;
        if (licences is { } bought)
        {
            seatLimit = bought.Total;
            features[FeatureKeys.LicencesAndroid] = bought.Android.ToString();
            features[FeatureKeys.LicencesWindows] = bought.Windows.ToString();
            features[FeatureKeys.LicencesBoth] = bought.Both.ToString();
        }

        features[FeatureKeys.UsersMaxActive] = seatLimit.ToString();
        features[FeatureKeys.FranchiseNetworkBranches] = features.TryGetValue(FeatureKeys.FranchiseNetwork, out var franchise) && franchise == "true"
            ? (IncludedFranchiseBranches + extraFranchiseBranches).ToString()
            : "0";

        return new CompanyEntitlements(
            Managed: true,
            Access: AccessFor(subscription, now),
            Status: subscription.Status,
            PlanCode: version.Plan?.Code,
            PlanName: version.Plan?.Name,
            Interval: version.Interval,
            Features: features,
            SeatLimit: seatLimit,
            TrialEndsAt: subscription.TrialEndsAt,
            GraceEndsAt: subscription.GraceEndsAt,
            CurrentPeriodEnd: subscription.CurrentPeriodEnd,
            RetainUntil: subscription.RetainUntil,
            Licences: licences);
    }

    /// <summary>The access each subscription state gives (see the lifecycle table in docs/SAAS_PHASE2_PLAN.md §5).</summary>
    public static CompanyAccessLevel AccessFor(Subscription subscription, DateTime now) => subscription.Status switch
    {
        SubscriptionStatus.Trialing or SubscriptionStatus.Active or SubscriptionStatus.PastDue => CompanyAccessLevel.Full,
        SubscriptionStatus.ReadOnly => CompanyAccessLevel.ReadOnly,
        SubscriptionStatus.Canceled when subscription.RetainUntil is { } until && until > now => CompanyAccessLevel.ReadOnly,
        _ => CompanyAccessLevel.None
    };

    private static CompanyEntitlements NoAccess() => new(
        true, CompanyAccessLevel.None, null, null, null, null, new Dictionary<string, string>(), 0, null, null, null, null);
}
