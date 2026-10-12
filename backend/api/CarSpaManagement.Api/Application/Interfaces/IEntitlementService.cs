using CarSpaManagement.Api.Domain.Platform;

namespace CarSpaManagement.Api.Application.Interfaces;

/// <summary>What a company may do right now, according to its subscription.</summary>
public enum CompanyAccessLevel
{
    /// <summary>Sign in and work normally.</summary>
    Full = 0,
    /// <summary>Sign in, view and export; nothing can be created or changed.</summary>
    ReadOnly = 1,
    /// <summary>No access (suspended by Trovo, never paid, or past the retention period).</summary>
    None = 2
}

/// <summary>
/// A company's subscription as the rest of the server sees it: access level, enabled features and seat limit.
/// On a single-company server (not Trovo's platform) <see cref="Managed"/> is false and everything is allowed.
/// </summary>
public sealed record CompanyEntitlements(
    bool Managed,
    CompanyAccessLevel Access,
    SubscriptionStatus? Status,
    string? PlanCode,
    string? PlanName,
    BillingInterval? Interval,
    IReadOnlyDictionary<string, string> Features,
    int? SeatLimit,
    DateTime? TrialEndsAt,
    DateTime? GraceEndsAt,
    DateTime? CurrentPeriodEnd,
    DateTime? RetainUntil)
{
    /// <summary>Everything allowed: single-company servers, and tools that run without a subscription.</summary>
    public static readonly CompanyEntitlements Unmanaged = new(
        false, CompanyAccessLevel.Full, null, null, null, null, new Dictionary<string, string>(), null, null, null, null, null);

    /// <summary>Whether a feature (see <see cref="FeatureKeys"/>) is switched on for the company.</summary>
    public bool Has(string featureKey) =>
        !Managed || (Features.TryGetValue(featureKey, out var value) && string.Equals(value, "true", StringComparison.OrdinalIgnoreCase));

    /// <summary>A whole-number feature value, or null when not granted (or not managed).</summary>
    public int? Number(string featureKey) =>
        Managed && Features.TryGetValue(featureKey, out var value) && int.TryParse(value, out var number) ? number : null;
}

/// <summary>Resolves a company's entitlements. The server is the authority; the apps only display them.</summary>
public interface IEntitlementService
{
    /// <summary>The current company's entitlements (from the sign-in token).</summary>
    Task<CompanyEntitlements> GetCurrentAsync(CancellationToken cancellationToken = default);

    Task<CompanyEntitlements> GetForCompanyAsync(Guid companyId, CancellationToken cancellationToken = default);

    /// <summary>Forget a cached answer after the company's subscription changed.</summary>
    void Invalidate(Guid companyId);
}
