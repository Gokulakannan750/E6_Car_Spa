using System.Net;
using System.Text.Json;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Per-app user licences over HTTP: a user signs in only to the apps their licence covers, an Owner's change applies
/// on the next request, and Trovo manages plans, add-ons and settings from the portal API.
/// </summary>
public class PlatformLicenceHttpTests(PlatformApiHost host) : IClassFixture<PlatformApiHost>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    [PostgresFact]
    public async Task AUser_SignsInOnlyToTheAppsTheirLicenceCovers_AndTheOwnersChangeAppliesAtOnce()
    {
        var (company, ownerId) = await host.RegisteredCompanyAsync("Licence Co",
            new CompanyPlan("starter", BillingInterval.Month, new Dictionary<string, int>(), DateTime.UtcNow.AddMonths(1), new LicenceCounts(1, 1, 1)));
        var owner = host.CompanyToken(company.Id, ownerId);
        var password = PlatformTestEnvironment.OwnerPassword;

        var created = await host.SendAsync(HttpMethod.Post, "/api/users", owner, new
        {
            fullName = "Field Staff", username = "field", password, confirmPassword = password, role = "Staff",
            appAccess = "Android", permissionCodes = new[] { "customers.view" }
        });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var staffId = (await Json(created)).GetProperty("id").GetGuid();

        var fromWindows = await host.SendAsync(HttpMethod.Post, "/api/auth/login", null, new { companyCode = company.Code, username = "field", password, app = "windows" });
        Assert.Equal(HttpStatusCode.Forbidden, fromWindows.StatusCode);
        Assert.Contains("covers the Android app only", (await Json(fromWindows)).GetProperty("error").GetString());

        var oldApp = await host.SendAsync(HttpMethod.Post, "/api/auth/login", null, new { companyCode = company.Code, username = "field", password });
        Assert.Equal(HttpStatusCode.Forbidden, oldApp.StatusCode);
        Assert.Contains("update the app", (await Json(oldApp)).GetProperty("error").GetString());

        var fromAndroid = await host.SendAsync(HttpMethod.Post, "/api/auth/login", null, new { companyCode = company.Code, username = "field", password, app = "android" });
        Assert.Equal(HttpStatusCode.OK, fromAndroid.StatusCode);
        var android = await Json(fromAndroid);
        Assert.Equal("Android", android.GetProperty("user").GetProperty("appAccess").GetString());
        var staffToken = android.GetProperty("token").GetString();
        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, "/api/customers", staffToken)).StatusCode);

        // The Owner moves the user to the Windows licence: the Android sign-in stops working on its next request.
        var moved = await host.SendAsync(HttpMethod.Put, $"/api/users/{staffId}", owner, new { fullName = "Field Staff", appAccess = "Windows" });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Get, "/api/customers", staffToken)).StatusCode);

        // Both other licences are taken now (Owner: both apps; this user: Windows); the Android one is free again.
        var status = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/status", owner));
        var usage = status.GetProperty("licences").EnumerateArray().ToDictionary(l => l.GetProperty("appAccess").GetString()!, l => l.GetProperty("used").GetInt32());
        Assert.Equal(new Dictionary<string, int> { ["Both"] = 1, ["Windows"] = 1, ["Android"] = 0 }, usage);
        var noWindows = await host.SendAsync(HttpMethod.Post, "/api/users", owner, new
        {
            fullName = "Desk", username = "desk", password, confirmPassword = password, role = "Staff", appAccess = "Windows"
        });
        Assert.Equal(HttpStatusCode.BadRequest, noWindows.StatusCode);

        // The portal shows how many users have each access.
        var billing = await host.AdminTokenAsync(PlatformAdminRole.Billing);
        var detail = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/companies/{company.Id}", billing));
        Assert.Equal(1, detail.GetProperty("licencesUsed").GetProperty("windows").GetInt32());
        Assert.Equal(1, detail.GetProperty("subscription").GetProperty("licences").GetProperty("android").GetInt32());
        Assert.Equal(49_900, detail.GetProperty("subscription").GetProperty("licencePrices").GetProperty("android").GetInt64());
    }

    [PostgresFact]
    public async Task Trovo_CreatesPlansAndAddOns_ChangesLicencePrices_AndSettings_WithItsRoles()
    {
        var billing = await host.AdminTokenAsync(PlatformAdminRole.Billing);
        var support = await host.AdminTokenAsync(PlatformAdminRole.Support);
        var owner = await host.AdminTokenAsync(PlatformAdminRole.Owner);
        var terms = new { companyFeeMinor = 0L, androidUserPriceMinor = 59_900L, windowsUserPriceMinor = 79_900L, bothUserPriceMinor = 1_09_900L };
        var yearly = new { companyFeeMinor = 0L, androidUserPriceMinor = 5_99_000L, windowsUserPriceMinor = 7_99_000L, bothUserPriceMinor = 10_99_000L };
        var plan = new
        {
            code = "growth", name = "Growth", minimumLicences = 2, monthly = terms, yearly,
            features = new Dictionary<string, string> { [FeatureKeys.OutsideJobs] = "true", [FeatureKeys.AdvancedReports] = "true" },
            reason = "New mid plan"
        };

        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Post, "/api/platform/plans", support, plan)).StatusCode);
        var createdPlan = await host.SendAsync(HttpMethod.Post, "/api/platform/plans", billing, plan);
        Assert.True(createdPlan.StatusCode == HttpStatusCode.Created, await createdPlan.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Conflict, (await host.SendAsync(HttpMethod.Post, "/api/platform/plans", billing, plan)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Post, "/api/platform/plans", billing,
            plan with { code = "Bad Code!" })).StatusCode);

        var catalog = await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/plans", billing));
        var growth = catalog.GetProperty("plans").EnumerateArray().Single(p => p.GetProperty("code").GetString() == "growth");
        var monthly = growth.GetProperty("versions").EnumerateArray().Single(v => v.GetProperty("interval").GetString() == "Month");
        Assert.Equal(59_900, monthly.GetProperty("androidUserPriceMinor").GetInt64());
        Assert.Equal(2, monthly.GetProperty("includedSeats").GetInt32());

        // A new price version with new licence prices.
        var newPrice = await host.SendAsync(HttpMethod.Post, "/api/platform/plans/growth/versions", billing, new
        {
            interval = "Month", priceMinor = 0, includedSeats = 1, entitlements = new Dictionary<string, string> { [FeatureKeys.OutsideJobs] = "true" },
            androidUserPriceMinor = 64_900, windowsUserPriceMinor = 84_900, bothUserPriceMinor = 1_14_900, reason = "Price revision"
        });
        Assert.Equal(HttpStatusCode.Created, newPrice.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Post, "/api/platform/plans/growth/versions", billing, new
        {
            interval = "Month", priceMinor = 0, includedSeats = 1, entitlements = new Dictionary<string, string>(), reason = "No price at all"
        })).StatusCode);

        // A new module add-on, then stopping its sale.
        Assert.Equal(HttpStatusCode.Created, (await host.SendAsync(HttpMethod.Post, "/api/platform/addons", billing, new
        {
            code = "showroom_plus", name = "Showroom (second outlet)", featureKey = FeatureKeys.Showroom, value = "true",
            monthlyPriceMinor = 49_900, yearlyPriceMinor = 4_99_000, reason = "Test"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Post, "/api/platform/addons", billing, new
        {
            code = "more_users", name = "More users", featureKey = FeatureKeys.UsersMaxActive, value = "5",
            monthlyPriceMinor = 1, yearlyPriceMinor = 1, reason = "Licences belong to the plan"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await host.SendAsync(HttpMethod.Put, "/api/platform/addons/showroom_plus", billing,
            new { isActive = false, reason = "Not selling yet" })).StatusCode);

        // The seeded catalog: five Professional modules for sale to Starter, and no more 5-user pack.
        var addOns = (await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/plans", billing))).GetProperty("addOns").EnumerateArray()
            .ToDictionary(a => a.GetProperty("code").GetString()!, a => a.GetProperty("isActive").GetBoolean());
        foreach (var code in new[] { "outside_jobs", "staff_advances", "whatsapp_automation", "advanced_reports", "audit_trail" }) Assert.True(addOns[code]);
        Assert.False(addOns.ContainsKey("seats_5"));
        Assert.False(addOns["showroom_plus"]);

        // Settings: everyone can read; only the Owner changes them, within limits.
        Assert.Equal(7, (await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/settings", support))).GetProperty("trialDays").GetInt32());
        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Put, "/api/platform/settings", billing, new { trialDays = 10, reason = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Put, "/api/platform/settings", owner, new { trialDays = 400, reason = "x" })).StatusCode);
        var saved = await host.SendAsync(HttpMethod.Put, "/api/platform/settings", owner, new { trialDays = 10, trialLicences = 2, reason = "Longer trial for launch" });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(10, (await Json(saved)).GetProperty("trialDays").GetInt32());
        Assert.Equal(2, (await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/settings", support))).GetProperty("trialLicences").GetInt32());
        await host.SendAsync(HttpMethod.Put, "/api/platform/settings", owner, new { trialDays = 7, trialLicences = 3, reason = "Back to the default" });

        var actions = await host.InScopeAsync(sp => Task.FromResult(sp.GetRequiredService<PlatformDbContext>().AuditLogs.Select(a => a.Action).ToList()));
        foreach (var action in new[] { "plan.created", "plan.version_created", "addon.created", "addon.updated", "settings.updated" }) Assert.Contains(action, actions);
    }
}
