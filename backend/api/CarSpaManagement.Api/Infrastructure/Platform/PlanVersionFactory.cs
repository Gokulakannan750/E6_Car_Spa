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
    IReadOnlyDictionary<string, string> Features, IReadOnlyDictionary<string, long>? SeatPrices = null);

/// <summary>Builds plan versions: checks the terms and writes every known feature (missing ones are off).</summary>
public static class PlanVersionFactory
{
    /// <summary>Upper bound for any single price (₹1 crore), to catch typing mistakes such as an extra zero or two.</summary>
    public const long MaxPriceMinor = 1_00_00_000_00;

    public static void Validate(PlanTerms terms, PlatformProduct? product = null, IReadOnlyList<ProductFeature>? definitions = null)
    {
        product ??= new PlatformProduct { SeatModel = SeatModel.PerType };
        definitions ??= Products.CarSpaProductModule.LegacyFeatureDefinitions();
        var known = definitions.ToDictionary(f => f.Key, f => f.ValueType);
        foreach (var (name, price) in new[]
                 {
                     ("company fee", terms.CompanyFeeMinor), ("Android licence price", terms.AndroidUserPriceMinor),
                     ("Windows licence price", terms.WindowsUserPriceMinor), ("Windows + Android licence price", terms.BothUserPriceMinor)
                 })
        {
            if (price < 0 || price > MaxPriceMinor) throw new ValidationException($"The {name} must be between ₹0 and ₹1,00,00,000.");
        }
        if (terms.MinimumLicences < (product.SeatModel == SeatModel.None ? 0 : 1) || terms.MinimumLicences > 100) throw new ValidationException("The minimum number of user licences must be 1 to 100.");
        if (terms.CompanyFeeMinor + terms.AndroidUserPriceMinor + terms.WindowsUserPriceMinor + terms.BothUserPriceMinor + (terms.SeatPrices?.Values.Sum() ?? 0) == 0)
        {
            throw new ValidationException("A plan needs a price: a company fee or at least one licence price.");
        }
        foreach (var (key, value) in terms.Features)
        {
            if (!known.TryGetValue(key, out var type) || (product.SeatModel == SeatModel.PerType && key is FeatureKeys.UsersMaxActive or FeatureKeys.FranchiseNetworkBranches))
            {
                throw new ValidationException($"Unknown feature '{key}'.");
            }
            if (type == EntitlementValueType.Int && (!int.TryParse(value, out var number) || number < 0))
                throw new ValidationException($"Feature '{key}' must be a non-negative whole number.");
            if (type == EntitlementValueType.Bool && value is not ("true" or "false"))
            {
                throw new ValidationException($"Feature '{key}' must be true or false.");
            }
        }
    }

    public static PlanVersion Create(Plan plan, BillingInterval interval, PlanTerms terms, DateTime now, IReadOnlyList<ProductSeatType> seatTypes, PlatformProduct? product = null, IReadOnlyList<ProductFeature>? definitions = null)
    {
        product ??= new PlatformProduct { SeatModel = SeatModel.PerType };
        definitions ??= Products.CarSpaProductModule.LegacyFeatureDefinitions();
        Validate(terms, product, definitions);
        if (terms.SeatPrices?.Any(p => seatTypes.All(t => t.Code != p.Key) || p.Value < 0 || p.Value > MaxPriceMinor) == true)
            throw new ValidationException("Unknown seat type or invalid seat price.");
        var version = new PlanVersion
        {
            Id = Guid.NewGuid(),
            PlanId = plan.Id,
            Version = plan.Versions.Where(v => v.Interval == interval).Select(v => v.Version).DefaultIfEmpty(0).Max() + 1,
            Interval = interval,
            Currency = "INR",
            PriceMinor = terms.CompanyFeeMinor,
            IncludedSeats = product.SeatModel == SeatModel.None ? 0 : terms.MinimumLicences,
            EffectiveFrom = now,
            CreatedAt = now
        };
        var prices = terms.SeatPrices ?? new Dictionary<string, long>
        {
            ["android"] = terms.AndroidUserPriceMinor, ["windows"] = terms.WindowsUserPriceMinor, ["both"] = terms.BothUserPriceMinor
        };
        if (product.SeatModel != SeatModel.None)
            foreach (var type in seatTypes)
            {
                if (!prices.TryGetValue(type.Code, out var price)) throw new ValidationException($"Supply a price for seat '{type.Code}'.");
                version.SeatPrices.Add(new PlanVersionSeatPrice { Id = Guid.NewGuid(), PlanVersionId = version.Id, SeatTypeId = type.Id, SeatType = type, PriceMinor = price });
            }
        foreach (var definition in definitions)
        {
            var (key, type) = (definition.Key, definition.ValueType);
            if (product.SeatModel == SeatModel.PerType && (key == FeatureKeys.FranchiseNetworkBranches || key.StartsWith("licences."))) continue;
            var value = key == FeatureKeys.UsersMaxActive && product.SeatModel == SeatModel.PerType
                ? terms.MinimumLicences.ToString()
                : terms.Features.TryGetValue(key, out var v) ? v : (type == EntitlementValueType.Bool ? "false" : "0");
            version.Entitlements.Add(new PlanEntitlement { Id = Guid.NewGuid(), PlanVersionId = version.Id, FeatureKey = key, ValueType = type, Value = value });
        }
        return version;
    }
}
