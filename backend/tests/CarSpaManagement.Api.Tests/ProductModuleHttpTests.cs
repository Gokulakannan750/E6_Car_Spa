using System.Net;
using System.Text.Json;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

[Collection("Product module logging")]
public class ProductModuleHttpTests
{
    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    [ExternalProductTheory]
    [InlineData("fail")]
    [InlineData("timeout")]
    public async Task Startup_MigratesRuntimeProduct_WithoutInvokingFailingOrSlowExternalCommand(string mode)
    {
        await using var env = new PlatformTestEnvironment(configureSettings: ExternalProductTestScript.Configure);
        var runtime = await env.CreateCompanyAsync("Runtime company");
        var external = await env.WithCatalogAsync(async catalog =>
        {
            await using var scope = env.Scope();
            var made = await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().CreateCompanyAsync("demo", "Demo company");
            var company = await catalog.Companies.SingleAsync(c => c.Id == made.Company.Id);
            company.MigrationError = "previous external failure";
            company.LastMigratedAt = DateTime.UnixEpoch;
            await catalog.SaveChangesAsync();
            return company;
        });
        await env.WithCatalogAsync(async catalog =>
        {
            var company = await catalog.Companies.SingleAsync(c => c.Id == runtime.Company.Id);
            company.SchemaVersion = "before-startup";
            company.LastMigratedAt = DateTime.UnixEpoch;
            await catalog.SaveChangesAsync();
            return true;
        });
        var marker = Path.Combine(Path.GetTempPath(), $"trovo-external-startup-{Guid.NewGuid():N}.txt");
        var host = new PlatformApiHost((builder, _) =>
        {
            ExternalProductTestScript.Configure(builder, env.ProductKey);
            builder.UseSetting("Platform:ProductKey", env.ProductKey);
            builder.UseSetting("ConnectionStrings:Platform", env.Settings["ConnectionStrings:Platform"]);
            builder.UseSetting("Platform:ExternalProducts:demo:MigrateArguments", ExternalProductTestScript.Arguments(mode) + $" -InvocationMarker \"{marker}\"");
            builder.UseSetting("Platform:ExternalProducts:demo:MigrateTimeoutSeconds", "5");
        });
        try
        {
            await host.InitializeAsync();
            Assert.False(File.Exists(marker), "Runtime startup must never execute the external migration, even if it would fail quickly or sleep.");
            var token = await host.AdminTokenAsync(PlatformAdminRole.Owner);
            Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, $"/api/platform/dashboard?product={env.ProductKey}", token)).StatusCode);
            await host.InScopeAsync(async sp =>
            {
                var catalog = sp.GetRequiredService<PlatformDbContext>();
                var spa = await catalog.Companies.SingleAsync(c => c.Id == runtime.Company.Id);
                Assert.Null(spa.MigrationError);
                Assert.NotEqual("before-startup", spa.SchemaVersion);
                Assert.True(spa.LastMigratedAt > DateTime.UnixEpoch);
                var demo = await catalog.Companies.SingleAsync(c => c.Id == external.Id);
                Assert.Equal("previous external failure", demo.MigrationError);
                Assert.Equal(DateTime.UnixEpoch, demo.LastMigratedAt);
                Assert.Equal(external.SchemaVersion, demo.SchemaVersion);
                return true;
            });
            // An operator can still deliberately run the all-product rollout, including this bad command.
            var maintenance = await host.SendAsync(HttpMethod.Post, "/api/platform/migrations/run", token);
            Assert.Equal(HttpStatusCode.OK, maintenance.StatusCode);
            Assert.True(File.Exists(marker));
            var results = (await Json(maintenance)).EnumerateArray().ToList();
            Assert.Equal(2, results.Count);
            Assert.Equal(JsonValueKind.Null, results.Single(r => r.GetProperty("productKey").GetString() == env.ProductKey).GetProperty("migrationError").ValueKind);
            Assert.False(string.IsNullOrEmpty(results.Single(r => r.GetProperty("productKey").GetString() == "demo").GetProperty("migrationError").GetString()));
        }
        finally
        {
            await host.DisposeAsync();
            if (File.Exists(marker)) File.Delete(marker);
        }
    }

    [ExternalProductFact(true)]
    public async Task Api_ListsBothProducts_SelectsCatalogAndCreation_FiltersAdminLists_AndMigratesOnRestart()
    {
        var host = new PlatformApiHost(ExternalProductTestScript.Configure);
        await host.InitializeAsync();
        try
        {
            var token = await host.AdminTokenAsync(PlatformAdminRole.Owner);
            var products = await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/products", token));
            Assert.Equal(2, products.GetArrayLength());
            var spa = products.EnumerateArray().Single(p => p.GetProperty("key").GetString() == host.ProductKey);
            Assert.Equal("PerType", spa.GetProperty("seatModel").GetString());
            Assert.Equal(3, spa.GetProperty("seatTypes").GetArrayLength());
            Assert.Contains("franchise", spa.GetProperty("capabilities").EnumerateArray().Select(c => c.GetString()));
            var demo = products.EnumerateArray().Single(p => p.GetProperty("key").GetString() == "demo");
            Assert.Equal("None", demo.GetProperty("seatModel").GetString());
            Assert.Empty(demo.GetProperty("seatTypes").EnumerateArray());
            Assert.Equal("Demo access", demo.GetProperty("features")[0].GetProperty("label").GetString());

            foreach (var url in new[] { "/api/platform/plans", "/api/platform/settings", "/api/public/catalog" })
                Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Get, url, token)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Post, "/api/platform/companies", token, new { name = "Missing product" })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Get, "/api/platform/companies?product=unknown", token)).StatusCode);

            var catalog = await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/plans?product=demo", token));
            Assert.Equal("demo_trial", Assert.Single(catalog.GetProperty("plans").EnumerateArray()).GetProperty("code").GetString());
            var publicCatalog = await Json(await host.SendAsync(HttpMethod.Get, "/api/public/catalog?product=demo", null));
            Assert.Equal("Demo", publicCatalog.GetProperty("productName").GetString());
            var spaCatalog = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/plans?product={host.ProductKey}", token));
            Assert.Equal(2, spaCatalog.GetProperty("plans").GetArrayLength());

            var settings = await host.SendAsync(HttpMethod.Put, "/api/platform/settings?product=demo", token, new { trialDays = 11, reason = "Demo trial policy" });
            Assert.Equal(HttpStatusCode.OK, settings.StatusCode);
            var spaSettings = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/settings?product={host.ProductKey}", token));
            Assert.NotEqual(11, spaSettings.GetProperty("trialDays").GetInt32());

            var madeSpa = await host.SendAsync(HttpMethod.Post, $"/api/platform/companies?product={host.ProductKey}", token, new { name = "Car Spa company" });
            Assert.Equal(HttpStatusCode.Created, madeSpa.StatusCode);
            var spaCompany = await Json(madeSpa);
            var madeDemo = await host.SendAsync(HttpMethod.Post, "/api/platform/companies?product=demo", token, new { name = "Demo company" });
            Assert.Equal(HttpStatusCode.Created, madeDemo.StatusCode);
            var demoCompany = await Json(madeDemo);
            Assert.Equal("0001", spaCompany.GetProperty("code").GetString());
            Assert.Equal("0001", demoCompany.GetProperty("code").GetString());
            var demoId = demoCompany.GetProperty("id").GetGuid();
            var spaId = spaCompany.GetProperty("id").GetGuid();
            var detail = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/companies/{demoId}", token));
            Assert.Equal("demo_trial", detail.GetProperty("subscription").GetProperty("plan").GetString());
            var trialEnd = detail.GetProperty("subscription").GetProperty("trialEndsAt").GetDateTime();
            Assert.InRange(trialEnd - DateTime.UtcNow, TimeSpan.FromDays(10.9), TimeSpan.FromDays(11.1));
            var spaDetail = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/companies/{spaId}", token));
            Assert.Equal(3, spaDetail.GetProperty("subscription").GetProperty("licences").GetProperty("both").GetInt32());

            var all = await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/companies", token));
            Assert.Equal(2, all.GetArrayLength());
            Assert.All(all.EnumerateArray(), row => Assert.False(string.IsNullOrEmpty(row.GetProperty("productKey").GetString())));
            foreach (var key in new[] { "demo", host.ProductKey })
            {
                var filtered = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/companies?product={key}", token));
                Assert.Equal(key, Assert.Single(filtered.EnumerateArray()).GetProperty("productKey").GetString());
                var migrations = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/migrations?product={key}", token));
                Assert.Equal(key, Assert.Single(migrations.EnumerateArray()).GetProperty("productKey").GetString());
                var dashboard = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/dashboard?product={key}", token));
                Assert.Equal(1, dashboard.GetProperty("companies").GetInt32());
                var audit = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/audit-logs?product={key}", token));
                Assert.All(audit.EnumerateArray(), a => Assert.Equal(key == "demo" ? demoId : spaId, a.GetProperty("targetCompanyId").GetGuid()));
                Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, $"/api/platform/invoices?product={key}", token)).StatusCode);
                Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, $"/api/platform/signups?product={key}", token)).StatusCode);
            }

            // The real startup path must migrate a pre-existing Car Spa database, rather than only seeding a fresh catalog.
            await host.InScopeAsync(async sp =>
            {
                var db = sp.GetRequiredService<PlatformDbContext>();
                var company = await db.Companies.SingleAsync(c => c.Id == spaId);
                company.SchemaVersion = "before-restart";
                company.LastMigratedAt = DateTime.UnixEpoch;
                await db.SaveChangesAsync();
                return true;
            });
            var catalogConnection = await host.InScopeAsync(sp => Task.FromResult(sp.GetRequiredService<PlatformDbContext>().Database.GetConnectionString()!));
            var restarted = new PlatformApiHost((builder, _) =>
            {
                ExternalProductTestScript.Configure(builder, host.ProductKey);
                builder.UseSetting("Platform:ProductKey", host.ProductKey);
                builder.UseSetting("ConnectionStrings:Platform", catalogConnection);
            });
            await restarted.InitializeAsync();
            try
            {
                await restarted.InScopeAsync(async sp =>
                {
                    var company = await sp.GetRequiredService<PlatformDbContext>().Companies.SingleAsync(c => c.Id == spaId);
                    Assert.Null(company.MigrationError);
                    Assert.NotEqual("before-restart", company.SchemaVersion);
                    Assert.True(company.LastMigratedAt > DateTime.UnixEpoch);
                    return true;
                });
            }
            finally { await restarted.DisposeAsync(); }
        }
        finally { await host.DisposeAsync(); }
    }
}
