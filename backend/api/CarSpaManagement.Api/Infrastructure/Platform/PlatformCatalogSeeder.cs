using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// The starting plans and add-ons of the car spa product, from docs/PRICING_AND_PLANS_DRAFT.md. Added only when
/// missing, so prices changed later (as new versions) are never overwritten. Monthly and yearly (2 months free).
/// </summary>
public static class PlatformCatalogSeeder
{
    private sealed record PlanSeed(string Code, string Name, int Sort, long MonthMinor, long YearMinor, int Seats, string[] Features);
    private sealed record AddOnSeed(string Code, string Name, string FeatureKey, string Value, long MonthMinor, long YearMinor);

    private static readonly string[] AllBoolFeatures =
    [
        FeatureKeys.Showroom, FeatureKeys.WhatsAppAutomation, FeatureKeys.FranchiseNetwork, FeatureKeys.OutsideJobs,
        FeatureKeys.StaffAdvances, FeatureKeys.AdvancedReports, FeatureKeys.AuditTrail
    ];

    private static readonly PlanSeed[] Plans =
    [
        new("starter", "Starter", 1, 99_900, 999_000, 3, []),
        new("professional", "Professional", 2, 199_900, 1_999_000, 10,
            [FeatureKeys.WhatsAppAutomation, FeatureKeys.OutsideJobs, FeatureKeys.StaffAdvances, FeatureKeys.AdvancedReports, FeatureKeys.AuditTrail]),
    ];

    private static readonly AddOnSeed[] AddOns =
    [
        new("showroom", "Showroom / B2B module", FeatureKeys.Showroom, "true", 99_900, 999_000),
        new("seats_5", "5 more users", FeatureKeys.UsersMaxActive, "5", 29_900, 299_000),
        new("franchise_network", "Franchise network (up to 10 franchise branches)", FeatureKeys.FranchiseNetwork, "true", 299_900, 2_999_000),
        new("franchise_branches_10", "10 more franchise branches", FeatureKeys.FranchiseNetworkBranches, "10", 149_900, 1_499_000),
    ];

    public static async Task SeedAsync(PlatformDbContext catalog, PlatformProduct product, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var added = 0;

        foreach (var seed in Plans)
        {
            if (await catalog.Plans.AnyAsync(p => p.ProductId == product.Id && p.Code == seed.Code, cancellationToken)) continue;

            var plan = new Plan { Id = Guid.NewGuid(), ProductId = product.Id, Code = seed.Code, Name = seed.Name, SortOrder = seed.Sort, CreatedAt = now };
            foreach (var (interval, price) in new[] { (BillingInterval.Month, seed.MonthMinor), (BillingInterval.Year, seed.YearMinor) })
            {
                var version = new PlanVersion
                {
                    Id = Guid.NewGuid(),
                    PlanId = plan.Id,
                    Version = 1,
                    Interval = interval,
                    Currency = "INR",
                    PriceMinor = price,
                    IncludedSeats = seed.Seats,
                    EffectiveFrom = now,
                    CreatedAt = now
                };
                version.Entitlements.Add(new PlanEntitlement
                {
                    Id = Guid.NewGuid(), PlanVersionId = version.Id, FeatureKey = FeatureKeys.UsersMaxActive,
                    ValueType = EntitlementValueType.Int, Value = seed.Seats.ToString()
                });
                foreach (var feature in AllBoolFeatures)
                {
                    version.Entitlements.Add(new PlanEntitlement
                    {
                        Id = Guid.NewGuid(), PlanVersionId = version.Id, FeatureKey = feature,
                        ValueType = EntitlementValueType.Bool, Value = seed.Features.Contains(feature) ? "true" : "false"
                    });
                }
                plan.Versions.Add(version);
            }
            catalog.Plans.Add(plan);
            added++;
        }

        foreach (var seed in AddOns)
        {
            if (await catalog.AddOns.AnyAsync(a => a.ProductId == product.Id && a.Code == seed.Code, cancellationToken)) continue;

            var addOn = new AddOn
            {
                Id = Guid.NewGuid(), ProductId = product.Id, Code = seed.Code, Name = seed.Name,
                FeatureKey = seed.FeatureKey, Value = seed.Value, CreatedAt = now
            };
            foreach (var (interval, price) in new[] { (BillingInterval.Month, seed.MonthMinor), (BillingInterval.Year, seed.YearMinor) })
            {
                addOn.Prices.Add(new AddOnPrice
                {
                    Id = Guid.NewGuid(), AddOnId = addOn.Id, Version = 1, Interval = interval, Currency = "INR",
                    UnitPriceMinor = price, EffectiveFrom = now, CreatedAt = now
                });
            }
            catalog.AddOns.Add(addOn);
            added++;
        }

        if (added > 0)
        {
            await catalog.SaveChangesAsync(cancellationToken);
            Log.Information("Platform catalog: added {Count} plans/add-ons for product {Product}", added, product.Key);
        }
    }
}
