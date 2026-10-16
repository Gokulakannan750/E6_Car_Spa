using System.Net;
using System.Text.Json;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// The Owner manages the subscription in the app: change plan and licences, see and pay invoices (test payment until
/// the gateway), renew early, cancel at the period end and take it back.
/// </summary>
public class PlatformOwnerSubscriptionHttpTests(PlatformApiHost host) : IClassFixture<PlatformApiHost>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static object Choice(string plan, int both = 1, int windows = 0, string interval = "Year", object? addOns = null) =>
        new { planCode = plan, interval, licences = new { android = 0, windows, both }, addOns = addOns ?? new Dictionary<string, int>() };

    private async Task<(PlatformCompany Company, string Owner)> HalfWayAsync(string name, string plan, LicenceCounts licences)
    {
        var (company, ownerId) = await host.RegisteredCompanyAsync(name,
            new CompanyPlan(plan, BillingInterval.Year, new Dictionary<string, int>(), DateTime.UtcNow.AddYears(1), licences));
        await host.InScopeAsync(async sp =>
        {
            var catalog = sp.GetRequiredService<PlatformDbContext>();
            var subscription = await catalog.Subscriptions.SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent);
            subscription.CurrentPeriodStart = DateTime.UtcNow.AddDays(-182);
            subscription.CurrentPeriodEnd = DateTime.UtcNow.AddDays(183);
            return await catalog.SaveChangesAsync();
        });
        return (company, host.CompanyToken(company.Id, ownerId));
    }

    [PostgresFact]
    public async Task SeatsOnlyChange_UsesEffectiveQuantities_AndPreservesLegacyResponse()
    {
        var (_, owner) = await HalfWayAsync("Seats only owner", "starter", new LicenceCounts(0, 0, 1));
        var response = await host.SendAsync(HttpMethod.Post, "/api/subscription/self/change", owner, new
        {
            planCode = "starter", interval = "Year", seats = new { android = 2, windows = 1, both = 3 }, addOns = new { }
        });
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        Assert.Equal("Applied", (await Json(response)).GetProperty("status").GetString());
        var page = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/self", owner));
        Assert.Equal(6, page.GetProperty("seatLimit").GetInt32());
        Assert.Equal(1, page.GetProperty("licencesInUse").GetProperty("both").GetInt32());
        foreach (var (code, quantity) in new[] { ("android", 2), ("windows", 1), ("both", 3) })
        {
            Assert.Equal(quantity, page.GetProperty("seats").EnumerateArray().Single(s => s.GetProperty("code").GetString() == code).GetProperty("quantity").GetInt32());
            Assert.Equal(quantity, page.GetProperty("current").GetProperty("licences").GetProperty(code).GetInt32());
        }
    }

    [PostgresTheory]
    [InlineData("both", "Windows + Android", false)]
    [InlineData("both", "Windows + Android", true)]
    [InlineData("windows", "Windows only", false)]
    [InlineData("windows", "Windows only", true)]
    [InlineData("android", "Android only", false)]
    [InlineData("android", "Android only", true)]
    public async Task SeatsOnlyChange_RefusesBelowUsage_EvenWhenLegacyCountsAreHigher(string code, string label, bool includeLegacy)
    {
        var (_, owner) = await HalfWayAsync("Seats usage " + code, "starter", new LicenceCounts(1, 1, 1));
        if (code != "both")
        {
            var password = PlatformTestEnvironment.OwnerPassword;
            Assert.Equal(HttpStatusCode.Created, (await host.SendAsync(HttpMethod.Post, "/api/users", owner, new
            {
                fullName = "Seat user", username = "seat-user", password, confirmPassword = password, role = "Staff",
                appAccess = code == "android" ? "Android" : "Windows"
            })).StatusCode);
        }
        var seats = new Dictionary<string, int> { ["android"] = 1, ["windows"] = 1, ["both"] = 1 };
        seats[code] = 0;
        var response = await host.SendAsync(HttpMethod.Post, "/api/subscription/self/change", owner, new
        {
            planCode = "professional", interval = "Year", seats, licences = includeLegacy ? new { android = 5, windows = 5, both = 5 } : null, addOns = new { }
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal($"1 active users have a {label} licence. Deactivate users or change their app access in Users first.",
            (await Json(response)).GetProperty("error").GetString());
    }

    [PostgresFact]
    public async Task TheOwner_UpgradesInTheApp_PaysTheInvoiceForTheRestOfThePeriod_AndSeesItPaid()
    {
        var (company, owner) = await HalfWayAsync("Self Upgrade Co", "starter", new LicenceCounts(0, 0, 1));

        var page = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/self", owner));
        Assert.Equal("starter", page.GetProperty("current").GetProperty("planCode").GetString());
        Assert.Equal(1, page.GetProperty("licencesInUse").GetProperty("both").GetInt32()); // the Owner
        Assert.True(page.GetProperty("canPayOnline").GetBoolean()); // test payments on this host
        Assert.Contains(page.GetProperty("catalog").GetProperty("plans").EnumerateArray(), p => p.GetProperty("code").GetString() == "professional");

        var preview = await Json(await host.SendAsync(HttpMethod.Post, "/api/subscription/self/preview", owner, Choice("professional", both: 2)));
        Assert.Equal("NowWithCharge", preview.GetProperty("timing").GetString());

        var changed = await host.SendAsync(HttpMethod.Post, "/api/subscription/self/change", owner, Choice("professional", both: 2));
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var result = await Json(changed);
        Assert.Equal("Applied", result.GetProperty("status").GetString());
        var invoiceId = result.GetProperty("invoiceId").GetGuid();
        Assert.StartsWith("TROVO/", result.GetProperty("invoiceNumber").GetString());

        var invoices = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/self/invoices", owner));
        var adjustment = invoices.EnumerateArray().Single(i => i.GetProperty("id").GetGuid() == invoiceId);
        Assert.Equal("Adjustment", adjustment.GetProperty("kind").GetString());
        Assert.Equal("Open", adjustment.GetProperty("status").GetString());

        var paid = await Json(await host.SendAsync(HttpMethod.Post, $"/api/subscription/self/invoices/{invoiceId}/pay", owner));
        Assert.Equal("Paid", paid.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await host.SendAsync(HttpMethod.Post, $"/api/subscription/self/invoices/{invoiceId}/pay", owner)).StatusCode);

        // Another company's invoice cannot be paid from here.
        var (other, otherOwner) = await HalfWayAsync("Other Co", "starter", new LicenceCounts(0, 0, 1));
        Assert.Equal(HttpStatusCode.NotFound, (await host.SendAsync(HttpMethod.Post, $"/api/subscription/self/invoices/{invoiceId}/pay", otherOwner)).StatusCode);
        Assert.NotEqual(company.Id, other.Id);
    }

    [PostgresFact]
    public async Task Licences_CannotGoBelowTheUsersWhoHaveThem_AndADowngradeWaitsForThePeriodEnd()
    {
        var (_, owner) = await HalfWayAsync("Self Downgrade Co", "professional", new LicenceCounts(0, 1, 1));
        var password = PlatformTestEnvironment.OwnerPassword;
        Assert.Equal(HttpStatusCode.Created, (await host.SendAsync(HttpMethod.Post, "/api/users", owner, new
        {
            fullName = "Desk", username = "desk", password, confirmPassword = password, role = "Staff", appAccess = "Windows"
        })).StatusCode);

        var tooFew = await host.SendAsync(HttpMethod.Post, "/api/subscription/self/change", owner, Choice("starter", both: 1, windows: 0));
        Assert.Equal(HttpStatusCode.BadRequest, tooFew.StatusCode);
        Assert.Contains("1 active users have a Windows only licence", (await Json(tooFew)).GetProperty("error").GetString());

        var downgrade = await Json(await host.SendAsync(HttpMethod.Post, "/api/subscription/self/change", owner, Choice("starter", both: 1, windows: 1)));
        Assert.Equal("Scheduled", downgrade.GetProperty("status").GetString());
        Assert.Equal(0, downgrade.GetProperty("amountNowMinor").GetInt64());
        Assert.Equal(JsonValueKind.Null, downgrade.GetProperty("invoiceId").ValueKind);
    }

    [PostgresFact]
    public async Task OnlyTheOwner_ManagesIt_AndCanRenewEarly_CancelAtThePeriodEnd_AndTakeItBack()
    {
        var (company, owner) = await HalfWayAsync("Self Cancel Co", "starter", new LicenceCounts(0, 0, 2));
        var password = PlatformTestEnvironment.OwnerPassword;
        Assert.Equal(HttpStatusCode.Created, (await host.SendAsync(HttpMethod.Post, "/api/users", owner, new
        {
            fullName = "Manager", username = "manager", password, confirmPassword = password, role = "Manager", appAccess = "Both"
        })).StatusCode);
        var login = await Json(await host.SendAsync(HttpMethod.Post, "/api/auth/login", null, new { companyCode = company.Code, username = "manager", password, app = "windows" }));
        var manager = login.GetProperty("token").GetString();
        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Get, "/api/subscription/self", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Post, "/api/subscription/self/change", manager, Choice("professional"))).StatusCode);

        // Renew early: the next year's invoice; asking again returns the same open one.
        var renewal = await Json(await host.SendAsync(HttpMethod.Post, "/api/subscription/self/renew", owner));
        Assert.Equal("Period", renewal.GetProperty("kind").GetString());
        Assert.Equal(2 * 9_99_000, renewal.GetProperty("totalMinor").GetInt64());
        Assert.Equal(renewal.GetProperty("id").GetGuid(), (await Json(await host.SendAsync(HttpMethod.Post, "/api/subscription/self/renew", owner))).GetProperty("id").GetGuid());

        Assert.Equal(HttpStatusCode.NoContent, (await host.SendAsync(HttpMethod.Post, "/api/subscription/self/cancel", owner, new { reason = "Closing the shop" })).StatusCode);
        Assert.True((await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/self", owner))).GetProperty("cancelAtPeriodEnd").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, (await host.SendAsync(HttpMethod.Post, "/api/subscription/self/renew", owner)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await host.SendAsync(HttpMethod.Post, "/api/subscription/self/resume", owner)).StatusCode);
        Assert.False((await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/self", owner))).GetProperty("cancelAtPeriodEnd").GetBoolean());
    }
}
