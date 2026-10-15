using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class ProductSeatMetadataTests
{
    [PostgresTheory]
    [InlineData(0)] // no default
    [InlineData(1)] // one explicit default, with no Car Spa codes
    [InlineData(2)] // ambiguous defaults
    [InlineData(3)] // inactive default
    public async Task PerTypeTrialWithoutBoth_UsesMetadataOrReturnsValidation(int defaults)
    {
        await using var env = new PlatformTestEnvironment();
        await using var scope = env.Scope();
        var sp = scope.ServiceProvider;
        await sp.GetRequiredService<CompanyDatabaseProvisioner>().EnsureCatalogAsync();
        var db = sp.GetRequiredService<PlatformDbContext>();
        var product = new PlatformProduct { Id = Guid.NewGuid(), Key = "workshop", Name = "Workshop",
            DatabasePrefix = env.ProductKey + "_workshop", TrialPlanCode = "basic", SeatModel = SeatModel.PerType };
        var operatorSeat = new ProductSeatType { Id = Guid.NewGuid(), ProductId = product.Id, Code = "operator",
            Name = "Operator", SortOrder = 20, DefaultSeat = defaults != 0, IsActive = defaults != 3,
            InvoiceLabel = "Licensed operator" };
        var reviewer = new ProductSeatType { Id = Guid.NewGuid(), ProductId = product.Id, Code = "reviewer",
            Name = "Reviewer", SortOrder = 1, DefaultSeat = defaults == 2 };
        var plan = new Plan { Id = Guid.NewGuid(), ProductId = product.Id, Code = "basic", Name = "Basic" };
        var version = new PlanVersion { Id = Guid.NewGuid(), PlanId = plan.Id, Interval = BillingInterval.Month,
            Version = 1, IncludedSeats = 1, EffectiveFrom = DateTime.UtcNow.AddDays(-1) };
        foreach (var type in new[] { operatorSeat, reviewer })
            version.SeatPrices.Add(new PlanVersionSeatPrice { Id = Guid.NewGuid(), PlanVersionId = version.Id,
                SeatTypeId = type.Id, SeatType = type, PriceMinor = 250 });
        plan.Versions.Add(version);
        // Only catalog services are exercised: no fake business database or new login is created.
        var company = new PlatformCompany { Id = Guid.NewGuid(), ProductId = product.Id, Code = "0001", Name = "Workshop company",
            DatabaseName = env.ProductKey + "_unused", DatabaseUser = "unused", DatabasePasswordEncrypted = "unused" };
        db.Products.Add(product);
        db.ProductSeatTypes.AddRange(operatorSeat, reviewer);
        db.Plans.Add(plan);
        db.Companies.Add(company);
        await db.SaveChangesAsync();
        var subscriptions = sp.GetRequiredService<SubscriptionService>();
        if (defaults != 1)
        {
            var error = await Assert.ThrowsAsync<ValidationException>(() => subscriptions.StartTrialAsync(company, SubscriptionActor.System));
            Assert.Contains("exactly one active default seat", error.Message);
            Assert.False(await db.Subscriptions.AnyAsync(s => s.CompanyId == company.Id));
            return;
        }
        var subscription = await subscriptions.StartTrialAsync(company, SubscriptionActor.System);
        Assert.Equal(3, subscription.Seats.Single(s => s.SeatTypeId == operatorSeat.Id).Quantity);
        Assert.Equal(0, subscription.Seats.Single(s => s.SeatTypeId == reviewer.Id).Quantity);
        var invoice = await subscriptions.IssueNextInvoiceAsync(company.Id);
        var line = Assert.Single(invoice.Lines);
        Assert.StartsWith("Licensed operator, Basic (monthly)", line.Description);
        Assert.Equal(750, invoice.TotalMinor);
    }

    [PostgresFact]
    public async Task ExistingCatalogUpgradePreservesCarSpaDefaults_AndReseedingPreservesAdminLabels()
    {
        await using var env = new PlatformTestEnvironment();
        await using var scope = env.Scope();
        var sp = scope.ServiceProvider;
        var provisioner = sp.GetRequiredService<CompanyDatabaseProvisioner>();
        var product = await provisioner.EnsureCatalogAsync();
        var db = sp.GetRequiredService<PlatformDbContext>();
        var migrator = db.Database.GetService<IMigrator>();
        // Test only this new migration's Down/Up on throwaway data; applied migration files remain unchanged.
        await migrator.MigrateAsync("20261015114018_GenericSeatChoices");
        await migrator.MigrateAsync();
        db.ChangeTracker.Clear();
        var types = await db.ProductSeatTypes.Where(t => t.ProductId == product.Id).ToDictionaryAsync(t => t.Code);
        Assert.True(types["both"].DefaultSeat);
        Assert.False(types["android"].DefaultSeat);
        Assert.False(types["windows"].DefaultSeat);
        Assert.Equal("Android user licence", types["android"].InvoiceLabel);
        Assert.Equal("Windows user licence", types["windows"].InvoiceLabel);
        Assert.Equal("Windows + Android user licence", types["both"].InvoiceLabel);
        var company = (await provisioner.CreateCompanyAsync("Exact invoice labels", new CompanyPlan("starter", BillingInterval.Month,
            new Dictionary<string, int>(), DateTime.UtcNow.AddMonths(1), new LicenceCounts(1, 1, 1)))).Company;
        var invoice = await sp.GetRequiredService<SubscriptionService>().IssueNextInvoiceAsync(company.Id);
        Assert.Equal(219700, invoice.TotalMinor);
        foreach (var label in new[] { "Android user licence", "Windows user licence", "Windows + Android user licence" })
            Assert.Contains(invoice.Lines, l => l.Description.StartsWith(label + ", Starter (monthly)", StringComparison.Ordinal));

        types["both"].InvoiceLabel = "Admin-edited membership";
        types["both"].DefaultSeat = false;
        await db.SaveChangesAsync();
        await provisioner.EnsureCatalogAsync();
        db.ChangeTracker.Clear();
        var both = await db.ProductSeatTypes.SingleAsync(t => t.ProductId == product.Id && t.Code == "both");
        Assert.Equal("Admin-edited membership", both.InvoiceLabel);
        Assert.False(both.DefaultSeat);
        Assert.Equal("Admin-edited membership", ProductSeats.InvoiceLabel(both));
        both.InvoiceLabel = null;
        await db.SaveChangesAsync();
        await provisioner.EnsureCatalogAsync();
        db.ChangeTracker.Clear();
        both = await db.ProductSeatTypes.SingleAsync(t => t.ProductId == product.Id && t.Code == "both");
        Assert.Null(both.InvoiceLabel);
        Assert.Equal("Windows + Android seat", ProductSeats.InvoiceLabel(both));
    }
}
