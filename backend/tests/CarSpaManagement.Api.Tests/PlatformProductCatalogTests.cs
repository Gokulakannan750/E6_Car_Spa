using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class PlatformProductCatalogTests
{
    [PostgresTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ExistingCatalog_UpgradesProductMetadata_BeforeEfReadsTheEnum(bool genericMigrationAlreadyApplied)
    {
        await using var env = new PlatformTestEnvironment();
        await using var scope = env.Scope();
        var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var migrator = catalog.Database.GetService<IMigrator>();
        await migrator.MigrateAsync("20261013125409_PlanChangeRequests");
        var id = Guid.NewGuid();
        await catalog.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Products" ("Id", "Key", "Name", "IsActive", "CreatedAt")
            VALUES ({id}, 'carspa', 'Existing Car Spa', TRUE, NOW())
            """);

        if (genericMigrationAlreadyApplied)
            await migrator.MigrateAsync("20261014170242_GenericProductCatalog");
        await migrator.MigrateAsync();
        var product = await catalog.Products.AsNoTracking().SingleAsync(p => p.Id == id);
        Assert.Equal(SeatModel.PerType, product.SeatModel);
        Assert.Equal("professional", product.TrialPlanCode);
        Assert.Equal("carspa", product.DatabasePrefix);
        Assert.Equal("franchise", product.Capabilities);

        // The SQL defaults must be readable even if another caller omits these two fields.
        var defaultedId = Guid.NewGuid();
        await catalog.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Products" ("Id", "Key", "Name", "IsActive", "CreatedAt", "DatabasePrefix", "Capabilities")
            VALUES ({defaultedId}, 'defaulted', 'Defaulted product', TRUE, NOW(), 'defaulted', '')
            """);
        var defaulted = await catalog.Products.AsNoTracking().SingleAsync(p => p.Id == defaultedId);
        Assert.Equal(SeatModel.None, defaulted.SeatModel);
        Assert.Equal("professional", defaulted.TrialPlanCode);
        Assert.Equal(string.Empty, defaulted.Capabilities);
    }

    [PostgresFact]
    public async Task FreshCatalog_HasGenericSeatsAndFeatures_AndSeederPreservesEditedPrices()
    {
        await using var env = new PlatformTestEnvironment();
        await using var scope = env.Scope();
        var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var product = await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().EnsureCatalogAsync();
        Assert.Equal(SeatModel.PerType, product.SeatModel);
        Assert.Equal("professional", product.TrialPlanCode);
        Assert.Equal(product.Key, product.DatabasePrefix);
        Assert.Equal("franchise", product.Capabilities);
        var types = await catalog.ProductSeatTypes.Where(t => t.ProductId == product.Id).OrderBy(t => t.SortOrder).ToListAsync();
        Assert.Equal(new[] { "android", "windows", "both" }, types.Select(t => t.Code));
        Assert.Equal(new[] { "Android only", "Windows only", "Windows + Android" }, types.Select(t => t.Name));
        Assert.All(types, t => Assert.True(t.IsActive));
        var features = await catalog.ProductFeatures.Where(f => f.ProductId == product.Id).ToListAsync();
        Assert.Equal(FeatureKeys.All.Count + 3, features.Count);
        Assert.All(features, f => Assert.NotEqual(f.Key, f.Label));
        foreach (var (key, type) in FeatureKeys.All)
            Assert.Equal(type, features.Single(f => f.Key == key).ValueType);
        foreach (var key in new[] { FeatureKeys.LicencesAndroid, FeatureKeys.LicencesWindows, FeatureKeys.LicencesBoth })
            Assert.Equal(EntitlementValueType.Int, features.Single(f => f.Key == key).ValueType);

        var versions = await catalog.PlanVersions.Include(v => v.Plan).ToListAsync();
        Assert.Equal(4, versions.Count);
        foreach (var version in versions)
        {
            var month = versions.Single(v => v.PlanId == version.PlanId && v.Interval == BillingInterval.Month);
            Assert.Equal(3, version.SeatPrices.Count);
            foreach (var price in version.SeatPrices)
                Assert.Equal(month.SeatPrices.Single(p => p.SeatTypeId == price.SeatTypeId).PriceMinor
                    * (version.Interval == BillingInterval.Year ? 10 : 1), price.PriceMinor);
        }
        var edited = versions[0].SeatPrices[0];
        edited.PriceMinor = 123_456;
        await catalog.SaveChangesAsync();
        await PlatformCatalogSeeder.SeedAsync(catalog, product);
        catalog.ChangeTracker.Clear();
        Assert.Equal(123_456, (await catalog.PlanVersionSeatPrices.SingleAsync(p => p.Id == edited.Id)).PriceMinor);
        Assert.Equal(3, await catalog.ProductSeatTypes.CountAsync());
        Assert.Equal(features.Count, await catalog.ProductFeatures.CountAsync());
        Assert.Equal(12, await catalog.PlanVersionSeatPrices.CountAsync());

        var columns = await catalog.Database.SqlQueryRaw<string>("""
            SELECT column_name AS "Value" FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name IN ('Subscriptions', 'PlanVersions', 'SignupOrders')
            """).ToListAsync();
        Assert.DoesNotContain("AndroidLicences", columns);
        Assert.DoesNotContain("WindowsLicences", columns);
        Assert.DoesNotContain("BothLicences", columns);
        Assert.DoesNotContain("AndroidUserPriceMinor", columns);
        Assert.DoesNotContain("WindowsUserPriceMinor", columns);
        Assert.DoesNotContain("BothUserPriceMinor", columns);
    }

    [PostgresFact]
    public async Task Settings_UseProductOverrideThenGlobalThenConfiguration_WithoutCacheLeakage()
    {
        await using var env = new PlatformTestEnvironment();
        await using var scope = env.Scope();
        await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().EnsureCatalogAsync();
        var settings = scope.ServiceProvider.GetRequiredService<PlatformSettingsService>();
        Assert.Equal(7, (await settings.GetAsync(productKey: env.ProductKey)).TrialDays);
        await settings.SaveAsync(new Dictionary<string, int> { [PlatformSettingsService.TrialDaysKey] = 9 }, "test");
        Assert.Equal(9, (await settings.GetAsync(productKey: env.ProductKey)).TrialDays);
        await settings.SaveAsync(new Dictionary<string, int> { [PlatformSettingsService.TrialDaysKey] = 12 }, "test", productKey: env.ProductKey);
        Assert.Equal(12, (await settings.GetAsync(productKey: env.ProductKey)).TrialDays);
        Assert.Equal(9, (await settings.GetAsync()).TrialDays);
        Assert.Equal(9, (await settings.GetAsync(productKey: "other")).TrialDays);
        await settings.SaveAsync(new Dictionary<string, int> { [PlatformSettingsService.TrialDaysKey] = 10 }, "test");
        Assert.Equal(12, (await settings.GetAsync(productKey: env.ProductKey)).TrialDays);
        Assert.Equal(10, (await settings.GetAsync()).TrialDays);
        Assert.Equal(10, (await settings.GetAsync(productKey: "other")).TrialDays);
    }
}
