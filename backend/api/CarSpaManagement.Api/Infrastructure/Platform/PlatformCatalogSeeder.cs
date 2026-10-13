using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// The starting plans and add-ons of the car spa product. Added only when missing, so prices changed later in the
/// admin portal (as new versions) are never overwritten.
///
/// A plan's price is per user licence: Android only, Windows only, or both apps, each with its own price, plus an
/// optional company fee (0 here). Every subscription has at least one licence. Starter can buy the Professional
/// modules one by one as add-ons. <b>The prices below are placeholders until Trovo sets the real ones in the portal.</b>
/// Monthly and yearly (yearly = 10 × monthly, two months free).
/// </summary>
public static class PlatformCatalogSeeder
{
    private sealed record PlanSeed(string Code, string Name, int Sort, long AndroidMonth, long WindowsMonth, long BothMonth, string[] Features);
    private sealed record AddOnSeed(string Code, string Name, string FeatureKey, string Value, long MonthMinor);

    private static readonly string[] AllBoolFeatures =
    [
        FeatureKeys.Showroom, FeatureKeys.WhatsAppAutomation, FeatureKeys.FranchiseNetwork, FeatureKeys.OutsideJobs,
        FeatureKeys.StaffAdvances, FeatureKeys.AdvancedReports, FeatureKeys.AuditTrail
    ];

    /// <summary>The modules Professional includes; Starter can buy each as an add-on.</summary>
    private static readonly string[] ProfessionalModules =
        [FeatureKeys.WhatsAppAutomation, FeatureKeys.OutsideJobs, FeatureKeys.StaffAdvances, FeatureKeys.AdvancedReports, FeatureKeys.AuditTrail];

    private static readonly PlanSeed[] Plans =
    [
        new("starter", "Starter", 1, 49_900, 69_900, 99_900, []),
        new("professional", "Professional", 2, 79_900, 119_900, 149_900, ProfessionalModules),
    ];

    private static readonly AddOnSeed[] AddOns =
    [
        new("showroom", "Showroom / B2B module", FeatureKeys.Showroom, "true", 99_900),
        new("franchise_network", "Franchise network (up to 10 franchise branches)", FeatureKeys.FranchiseNetwork, "true", 299_900),
        new("franchise_branches_10", "10 more franchise branches", FeatureKeys.FranchiseNetworkBranches, "10", 149_900),
        new("outside_jobs", "Outside jobs & vendors", FeatureKeys.OutsideJobs, "true", 29_900),
        new("staff_advances", "Staff advances & salary", FeatureKeys.StaffAdvances, "true", 29_900),
        new("whatsapp_automation", "WhatsApp automation", FeatureKeys.WhatsAppAutomation, "true", 29_900),
        new("advanced_reports", "Advanced reports", FeatureKeys.AdvancedReports, "true", 29_900),
        new("audit_trail", "Audit trail", FeatureKeys.AuditTrail, "true", 29_900),
    ];

    private static long Yearly(long monthly) => monthly * 10;

    public static async Task SeedAsync(PlatformDbContext catalog, PlatformProduct product, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var added = 0;

        foreach (var seed in Plans)
        {
            if (await catalog.Plans.AnyAsync(p => p.ProductId == product.Id && p.Code == seed.Code, cancellationToken)) continue;

            var plan = new Plan { Id = Guid.NewGuid(), ProductId = product.Id, Code = seed.Code, Name = seed.Name, SortOrder = seed.Sort, CreatedAt = now };
            foreach (var interval in new[] { BillingInterval.Month, BillingInterval.Year })
            {
                long Price(long monthly) => interval == BillingInterval.Year ? Yearly(monthly) : monthly;
                var version = new PlanVersion
                {
                    Id = Guid.NewGuid(),
                    PlanId = plan.Id,
                    Version = 1,
                    Interval = interval,
                    Currency = "INR",
                    PriceMinor = 0,
                    IncludedSeats = 1,
                    AndroidUserPriceMinor = Price(seed.AndroidMonth),
                    WindowsUserPriceMinor = Price(seed.WindowsMonth),
                    BothUserPriceMinor = Price(seed.BothMonth),
                    EffectiveFrom = now,
                    CreatedAt = now
                };
                version.Entitlements.Add(new PlanEntitlement
                {
                    Id = Guid.NewGuid(), PlanVersionId = version.Id, FeatureKey = FeatureKeys.UsersMaxActive,
                    ValueType = EntitlementValueType.Int, Value = "1"
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
            foreach (var (interval, price) in new[] { (BillingInterval.Month, seed.MonthMinor), (BillingInterval.Year, Yearly(seed.MonthMinor)) })
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
