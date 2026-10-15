using System.Net;
using System.Text.Json;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Platform.Products;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class GenericSeatHttpTests
{
    private static async Task<JsonElement> Read(HttpResponseMessage response, HttpStatusCode expected)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expected, $"Expected {expected}, got {response.StatusCode}: {body}");
        return JsonDocument.Parse(body).RootElement;
    }

    [PostgresTheory]
    [InlineData(SeatModel.None)]
    [InlineData(SeatModel.Counted)]
    public async Task GenericProduct_TrialQuotePaidSignupInvoiceRenewalAndOwnerChange(SeatModel model)
    {
        // Register an actual test module under this host's isolated runtime product key. Its billing catalog is
        // generic; reuse the Car Spa test database schema solely to exercise existing owner authentication over HTTP.
        await using var host = new PlatformApiHost((builder, key) => builder.ConfigureServices(services =>
        {
            services.RemoveAll<IProductModuleRegistry>();
            services.AddSingleton<IProductModuleRegistry>(sp => new TestRegistry(new TestModule(key, model,
                new CarSpaProductModule(sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IOptions<PlatformOptions>>()))));
        }));
        await host.InitializeAsync();
        var quantities = model == SeatModel.None ? new Dictionary<string, int>() : new Dictionary<string, int> { ["user"] = 2 };
        var amount = model == SeatModel.None ? 1000 : 1500;
        var choice = new { planCode = "basic", interval = "Month", seats = quantities, addOns = new { } };
        var quote = await Read(await host.SendAsync(HttpMethod.Post, "/api/public/signup/quote", null, choice), HttpStatusCode.OK);
        Assert.Equal(amount, quote.GetProperty("totalMinor").GetInt64());
        Assert.Equal(model == SeatModel.None ? 0 : 1, quote.GetProperty("seats").GetArrayLength());
        if (model == SeatModel.Counted)
        {
            var line = Assert.Single(quote.GetProperty("seats").EnumerateArray());
            Assert.Equal("user", line.GetProperty("code").GetString());
            Assert.Equal("User", line.GetProperty("name").GetString());
            Assert.Equal(2, line.GetProperty("quantity").GetInt32());
            Assert.Equal(250, line.GetProperty("priceMinor").GetInt64());
            Assert.Contains("User seat", quote.GetProperty("lines").ToString());
        }

        var order = await Read(await host.SendAsync(HttpMethod.Post, "/api/public/signup", null, new
        {
            business = new { name = "Generic paid", ownerName = "Owner", mobile = "9876543210", email = "paid@generic.test", city = "Erode", state = "Tamil Nadu" },
            startTrial = false, plan = choice, acceptTerms = true
        }), HttpStatusCode.Created);
        var orderId = order.GetProperty("orderId").GetGuid();
        var orderToken = order.GetProperty("orderToken").GetString();
        var paid = await Read(await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{orderId}/test-payment", null,
            new { token = orderToken }), HttpStatusCode.OK);
        Assert.Equal("Completed", paid.GetProperty("status").GetString());

        var company = await host.InScopeAsync(async sp =>
        {
            var db = sp.GetRequiredService<PlatformDbContext>();
            var savedOrder = await db.SignupOrders.SingleAsync(o => o.Id == orderId);
            Assert.Equal(model == SeatModel.None ? 0 : 2, savedOrder.Seats.Sum(s => s.Quantity));
            Assert.Equal(model == SeatModel.None ? 0 : 1, savedOrder.Seats.Count);
            var invoice = await db.BillingInvoices.Include(i => i.Lines).SingleAsync(i => i.CompanyId == savedOrder.CompanyId);
            Assert.Equal(amount, invoice.TotalMinor);
            Assert.Equal(BillingInvoiceStatus.Paid, invoice.Status);
            Assert.Equal(model == SeatModel.None ? 1 : 2, invoice.Lines.Count);
            var entitlement = await sp.GetRequiredService<IEntitlementService>().GetForCompanyAsync(savedOrder.CompanyId!.Value);
            Assert.Equal(model == SeatModel.None ? (int?)null : 2, entitlement.SeatLimit);
            Assert.True(entitlement.Has("test.enabled"));
            Assert.False(entitlement.Has(FeatureKeys.Showroom));
            return await db.Companies.SingleAsync(c => c.Id == savedOrder.CompanyId);
        });

        var status = await Read(await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{orderId}/status", null,
            new { token = orderToken }), HttpStatusCode.OK);
        Assert.Equal(quote.GetProperty("seats").ToString(), status.GetProperty("quote").GetProperty("seats").ToString());

        var adminToken = await host.AdminTokenAsync(PlatformAdminRole.Owner);
        var listed = await Read(await host.SendAsync(HttpMethod.Get, "/api/platform/signups", adminToken), HttpStatusCode.OK);
        var listedOrder = Assert.Single(listed.EnumerateArray(), o => o.GetProperty("id").GetGuid() == orderId);
        Assert.Equal(quote.GetProperty("seats").ToString(), listedOrder.GetProperty("seats").ToString());

        // Obtain a real registered owner in this same product. This also starts and verifies a generic trial.
        var (trialCompany, ownerId) = await host.RegisteredCompanyAsync("Generic trial");
        var ownerToken = host.CompanyToken(trialCompany.Id, ownerId);
        var owner = await Read(await host.SendAsync(HttpMethod.Get, "/api/subscription/self", ownerToken), HttpStatusCode.OK);
        Assert.Equal(model == SeatModel.None ? JsonValueKind.Null : JsonValueKind.Number, owner.GetProperty("seatLimit").ValueKind);
        Assert.Equal(model == SeatModel.None ? 0 : 1, owner.GetProperty("seats").GetArrayLength());
        if (model == SeatModel.Counted) Assert.Equal(3, owner.GetProperty("seatLimit").GetInt32());
        var change = await Read(await host.SendAsync(HttpMethod.Post, "/api/subscription/self/change", ownerToken,
            new { planCode = "plus", interval = "Month", seats = quantities, addOns = new { } }), HttpStatusCode.OK);
        Assert.Equal("Applied", change.GetProperty("status").GetString());
        owner = await Read(await host.SendAsync(HttpMethod.Get, "/api/subscription/self", ownerToken), HttpStatusCode.OK);
        Assert.Equal("plus", owner.GetProperty("current").GetProperty("planCode").GetString());
        if (model == SeatModel.None) Assert.Equal(JsonValueKind.Null, owner.GetProperty("seatLimit").ValueKind);
        else Assert.Equal(2, owner.GetProperty("seatLimit").GetInt32());

        await host.InScopeAsync(async sp =>
        {
            var subscriptions = sp.GetRequiredService<SubscriptionService>();
            var renewed = await subscriptions.IssueNextInvoiceAsync(company.Id);
            Assert.Equal(amount, renewed.TotalMinor);
            var preview = await sp.GetRequiredService<PlanChangeService>().PreviewAsync(company.Id,
                new PlanChangeTarget("plus", BillingInterval.Month, new LicenceCounts(0, 0, 0), new Dictionary<string, int>(), quantities));
            Assert.Equal(amount, preview.CurrentPeriodPriceMinor);
            Assert.Equal(model == SeatModel.None ? 2000 : 3000, preview.NewPeriodPriceMinor);
            var request = await sp.GetRequiredService<PlanChangeService>().ChangeByOwnerAsync(company.Id,
                new PlanChangeTarget("plus", BillingInterval.Month, new LicenceCounts(0, 0, 0), new Dictionary<string, int>(), quantities), null, "Owner");
            Assert.Equal(PlanChangeStatus.Applied, request.Status);
            var changed = await subscriptions.CurrentAsync(company.Id, default);
            Assert.Equal(model == SeatModel.None ? 0 : 2, changed.Seats.Sum(s => s.Quantity));
            return true;
        });
    }

    [PostgresFact]
    public async Task ExplicitWriterLoadsPlanAndTypes_AndInsertsChildOnTrackedParent()
    {
        await using var env = new PlatformTestEnvironment();
        var company = (await env.CreateCompanyAsync("Tracked seat parent")).Company;
        await using var scope = env.Scope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var persisted = await db.Subscriptions.SingleAsync(s => s.CompanyId == company.Id);
        db.SubscriptionSeats.RemoveRange(persisted.Seats);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        persisted = await db.Subscriptions.IgnoreAutoIncludes().SingleAsync(s => s.CompanyId == company.Id);
        Assert.Null(persisted.PlanVersion);
        Assert.Equal(ValueGenerated.Never, db.Model.FindEntityType(typeof(SubscriptionSeat))!.FindProperty("Id")!.ValueGenerated);
        await ProductSeats.SetAsync(db, persisted, company.ProductId, new Dictionary<string, int> { ["both"] = 4 }, null, default);
        db.ChangeTracker.DetectChanges();
        Assert.All(db.ChangeTracker.Entries<SubscriptionSeat>(), e => Assert.Equal(EntityState.Added, e.State));
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var saved = await db.Subscriptions.SingleAsync(s => s.Id == persisted.Id);
        Assert.Equal(4, saved.Licences.Both);
        Assert.Equal(3, saved.Seats.Count);
    }

    private sealed class TestRegistry(IProductModule module) : IProductModuleRegistry
    {
        public IReadOnlyList<IProductModule> All => [module];
        public IProductModule Get(string key) => key == module.Key ? module : throw new InvalidOperationException("Unknown test product");
        public bool TryGet(string key, out IProductModule result) { result = module; return key == module.Key; }
    }

    private sealed class TestModule(string key, SeatModel model, CarSpaProductModule databaseModule) : IProductModule
    {
        public string Key => key;
        public string Name => "Generic test product";
        public string DatabasePrefix => key;
        public string TrialPlanCode => "basic";
        public SeatModel SeatModel => model;
        public IReadOnlyList<SeatTypeDefinition> SeatTypes => model == SeatModel.None ? [] : [new("user", "User", 1)];
        public IReadOnlyList<FeatureDefinition> Features => [new("test.enabled", EntitlementValueType.Bool, "Test access", 1)];
        public IReadOnlySet<string> Capabilities => new HashSet<string>();
        public Task<string?> MigrateCompanyDatabaseAsync(ProvisionContext context, CancellationToken ct) => databaseModule.MigrateCompanyDatabaseAsync(context, ct);
        public Task SeedCatalogAsync(PlatformDbContext catalog, PlatformProduct product, CancellationToken ct)
        {
            var config = new ExternalProductOptions { SeatModel = model, SeatTypes = SeatTypes.ToList(), Features = Features.ToList() };
            foreach (var (code, multiplier) in new[] { ("basic", 1), ("plus", 2) })
                config.SeedPlans.Add(new ExternalPlanSeed
                {
                    Code = code, Name = code, MonthlyPriceMinor = 1000 * multiplier, YearlyPriceMinor = 10000 * multiplier,
                    IncludedSeats = model == SeatModel.None ? 0 : 1,
                    SeatPrices = model == SeatModel.None ? [] : new Dictionary<string, ExternalSeatPriceSeed>
                    { ["user"] = new() { MonthlyPriceMinor = 250 * multiplier, YearlyPriceMinor = 2500 * multiplier } },
                    Entitlements = new Dictionary<string, string> { ["test.enabled"] = "true" }
                });
            return new ExternalCommandProductModule(key, config).SeedCatalogAsync(catalog, product, ct);
        }
    }
}
