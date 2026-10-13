using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>The terms of a new plan version, as Trovo enters them in the admin portal.</summary>
public sealed record PlanTerms(
    long CompanyFeeMinor,
    int MinimumLicences,
    long AndroidUserPriceMinor,
    long WindowsUserPriceMinor,
    long BothUserPriceMinor,
    IReadOnlyDictionary<string, string> Features);

/// <summary>Builds plan versions: checks the terms and writes every known feature (missing ones are off).</summary>
public static class PlanVersionFactory
{
    /// <summary>Upper bound for any single price (₹1 crore), to catch typing mistakes such as an extra zero or two.</summary>
    public const long MaxPriceMinor = 1_00_00_000_00;

    public static void Validate(PlanTerms terms)
    {
        foreach (var (name, price) in new[]
                 {
                     ("company fee", terms.CompanyFeeMinor), ("Android licence price", terms.AndroidUserPriceMinor),
                     ("Windows licence price", terms.WindowsUserPriceMinor), ("Windows + Android licence price", terms.BothUserPriceMinor)
                 })
        {
            if (price < 0 || price > MaxPriceMinor) throw new ValidationException($"The {name} must be between ₹0 and ₹1,00,00,000.");
        }
        if (terms.MinimumLicences is < 1 or > 100) throw new ValidationException("The minimum number of user licences must be 1 to 100.");
        if (terms.CompanyFeeMinor + terms.AndroidUserPriceMinor + terms.WindowsUserPriceMinor + terms.BothUserPriceMinor == 0)
        {
            throw new ValidationException("A plan needs a price: a company fee or at least one licence price.");
        }
        foreach (var (key, value) in terms.Features)
        {
            if (!FeatureKeys.All.TryGetValue(key, out var type) || key is FeatureKeys.UsersMaxActive or FeatureKeys.FranchiseNetworkBranches)
            {
                throw new ValidationException($"Unknown feature '{key}'.");
            }
            if (type == EntitlementValueType.Bool && value is not ("true" or "false"))
            {
                throw new ValidationException($"Feature '{key}' must be true or false.");
            }
        }
    }

    public static PlanVersion Create(Plan plan, BillingInterval interval, PlanTerms terms, DateTime now)
    {
        Validate(terms);
        var version = new PlanVersion
        {
            Id = Guid.NewGuid(),
            PlanId = plan.Id,
            Version = plan.Versions.Where(v => v.Interval == interval).Select(v => v.Version).DefaultIfEmpty(0).Max() + 1,
            Interval = interval,
            Currency = "INR",
            PriceMinor = terms.CompanyFeeMinor,
            IncludedSeats = terms.MinimumLicences,
            AndroidUserPriceMinor = terms.AndroidUserPriceMinor,
            WindowsUserPriceMinor = terms.WindowsUserPriceMinor,
            BothUserPriceMinor = terms.BothUserPriceMinor,
            EffectiveFrom = now,
            CreatedAt = now
        };
        foreach (var (key, type) in FeatureKeys.All)
        {
            if (key == FeatureKeys.FranchiseNetworkBranches) continue; // comes from the Franchise network add-on
            var value = key == FeatureKeys.UsersMaxActive
                ? terms.MinimumLicences.ToString()
                : terms.Features.TryGetValue(key, out var v) ? v : (type == EntitlementValueType.Bool ? "false" : "0");
            version.Entitlements.Add(new PlanEntitlement { Id = Guid.NewGuid(), PlanVersionId = version.Id, FeatureKey = key, ValueType = type, Value = value });
        }
        return version;
    }
}
