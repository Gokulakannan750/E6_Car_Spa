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
/// Plan changes with the customer's consent: Trovo proposes in the portal, the company's Owner approves in the app.
/// Upgrades start at once with an invoice for the rest of the paid period; downgrades start at the period end.
/// </summary>
public class PlatformPlanChangeHttpTests(PlatformApiHost host) : IClassFixture<PlatformApiHost>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static object Plan(string code, string interval = "Year", int both = 1, object? addOns = null) =>
        new { planCode = code, interval, licences = new { android = 0, windows = 0, both }, addOns, reason = "Customer asked on the phone" };

    /// <summary>A paid yearly company half-way through its period, so an upgrade costs half the price difference.</summary>
    private async Task<(PlatformCompany Company, string OwnerToken)> HalfWayCompanyAsync(string name, string plan)
    {
        var (company, ownerId) = await host.RegisteredCompanyAsync(name,
            new CompanyPlan(plan, BillingInterval.Year, new Dictionary<string, int>(), DateTime.UtcNow.AddYears(1), new LicenceCounts(0, 0, 1)));
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

    private Task<Subscription> SubscriptionOf(Guid companyId) => host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().Subscriptions
        .Include(s => s.PlanVersion!).ThenInclude(v => v.Plan).SingleAsync(s => s.CompanyId == companyId && s.IsCurrent));

    [PostgresFact]
    public async Task SeatsOnlyProposalAndApproval_PreserveSeatQuantitiesAndLegacyProjection()
    {
        var (company, owner) = await HalfWayCompanyAsync("Seats proposal", "starter");
        var billing = await host.AdminTokenAsync(PlatformAdminRole.Billing);
        var response = await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/plan-change", billing, new
        {
            planCode = "professional", interval = "Year", seats = new { android = 2, windows = 1, both = 3 },
            addOns = new { }, reason = "Customer requested more seats"
        });
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var proposed = await Json(response);
        var id = proposed.GetProperty("id").GetGuid();
        Assert.Equal(3, proposed.GetProperty("licences").GetProperty("both").GetInt32());
        var shown = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/plan-change", owner));
        Assert.Equal(3, shown.GetProperty("to").GetProperty("bothLicences").GetInt32());
        Assert.Equal(6, shown.GetProperty("to").GetProperty("seats").EnumerateArray().Sum(s => s.GetProperty("quantity").GetInt32()));
        var approved = await host.SendAsync(HttpMethod.Post, $"/api/subscription/plan-change/{id}/approve", owner);
        Assert.Equal(HttpStatusCode.NoContent, approved.StatusCode);
        var page = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/self", owner));
        Assert.Equal("professional", page.GetProperty("current").GetProperty("planCode").GetString());
        Assert.Equal(6, page.GetProperty("seatLimit").GetInt32());
        foreach (var (code, quantity) in new[] { ("android", 2), ("windows", 1), ("both", 3) })
            Assert.Equal(quantity, page.GetProperty("seats").EnumerateArray().Single(s => s.GetProperty("code").GetString() == code).GetProperty("quantity").GetInt32());
    }

    [PostgresFact]
    public async Task AnUpgrade_WaitsForTheOwner_ThenStartsAtOnce_WithAnInvoiceForTheRestOfThePeriod()
    {
        var (company, owner) = await HalfWayCompanyAsync("Upgrade Co", "starter");
        var billing = await host.AdminTokenAsync(PlatformAdminRole.Billing);

        // A registered company's plan cannot be changed directly any more.
        var direct = await host.SendAsync(HttpMethod.Put, $"/api/platform/companies/{company.Id}/subscription", billing,
            new { planCode = "professional", reason = "x" });
        Assert.Equal(HttpStatusCode.Conflict, direct.StatusCode);
        Assert.Contains("Owner must approve", (await Json(direct)).GetProperty("error").GetString());

        // The preview: an upgrade, charged now, about half of (₹14,990 − ₹9,990).
        var preview = await Json(await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/plan-change/preview", billing, Plan("professional")));
        Assert.Equal("NowWithCharge", preview.GetProperty("timing").GetString());
        Assert.InRange(preview.GetProperty("amountNowMinor").GetInt64(), 2_45_000, 2_55_000);

        var proposed = await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/plan-change", billing, Plan("professional"));
        Assert.Equal(HttpStatusCode.OK, proposed.StatusCode);
        var requestId = (await Json(proposed)).GetProperty("id").GetGuid();
        Assert.Equal("starter", (await SubscriptionOf(company.Id)).PlanVersion!.Plan!.Code); // nothing changed yet

        // The app shows it, with a banner for everyone and the details on the Subscription page.
        var status = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/status", owner));
        Assert.Contains("proposed a change", status.GetProperty("banner").GetProperty("message").GetString());
        var shown = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/plan-change", owner));
        Assert.Equal("Pending", shown.GetProperty("status").GetString());
        Assert.Equal("Starter", shown.GetProperty("from").GetProperty("planName").GetString());
        Assert.Equal("Professional", shown.GetProperty("to").GetProperty("planName").GetString());

        var approved = await host.SendAsync(HttpMethod.Post, $"/api/subscription/plan-change/{requestId}/approve", owner);
        Assert.Equal(HttpStatusCode.NoContent, approved.StatusCode); // in effect at once
        var after = await SubscriptionOf(company.Id);
        Assert.Equal("professional", after.PlanVersion!.Plan!.Code);
        Assert.Equal(HttpStatusCode.Conflict, (await host.SendAsync(HttpMethod.Post, $"/api/subscription/plan-change/{requestId}/approve", owner)).StatusCode);

        // The invoice for the rest of the period; paying it does not move the period's dates.
        var invoice = await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().BillingInvoices
            .SingleAsync(i => i.CompanyId == company.Id && i.Kind == BillingInvoiceKind.Adjustment));
        Assert.InRange(invoice.TotalMinor, 2_45_000, 2_55_000);
        Assert.StartsWith("Upgrade to Professional", (await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().BillingInvoiceLines
            .SingleAsync(l => l.BillingInvoiceId == invoice.Id))).Description);
        await host.InScopeAsync(async sp =>
        {
            await sp.GetRequiredService<SubscriptionService>().RecordManualPaymentAsync(invoice.Id, invoice.TotalMinor, $"UTR-{Guid.NewGuid():N}", null,
                SubscriptionActor.System);
            return 0;
        });
        Assert.Equal(after.CurrentPeriodEnd, (await SubscriptionOf(company.Id)).CurrentPeriodEnd);
    }

    [PostgresFact]
    public async Task ADowngrade_StartsWhenThePaidPeriodEnds_AndTheRenewalIsBilledOnTheNewPlan_WithNoRefund()
    {
        var (company, owner) = await HalfWayCompanyAsync("Downgrade Co", "professional");
        var billing = await host.AdminTokenAsync(PlatformAdminRole.Billing);
        var periodEnd = (await SubscriptionOf(company.Id)).CurrentPeriodEnd;

        var requestId = (await Json(await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/plan-change", billing, Plan("starter"))))
            .GetProperty("id").GetGuid();
        var approved = await host.SendAsync(HttpMethod.Post, $"/api/subscription/plan-change/{requestId}/approve", owner);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        var waiting = await Json(approved);
        Assert.Equal("Scheduled", waiting.GetProperty("status").GetString());
        Assert.Equal("AtPeriodEnd", waiting.GetProperty("timing").GetString());
        Assert.Equal(0, waiting.GetProperty("amountNowMinor").GetInt64());
        Assert.Equal("professional", (await SubscriptionOf(company.Id)).PlanVersion!.Plan!.Code); // keeps what was paid for
        Assert.False(await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().BillingInvoices
            .AnyAsync(i => i.CompanyId == company.Id && i.Kind == BillingInvoiceKind.Adjustment)));

        // The renewal invoice is for Starter.
        var renewal = await host.InScopeAsync(sp => sp.GetRequiredService<SubscriptionService>().IssueNextInvoiceAsync(company.Id));
        Assert.Equal(9_99_000, renewal.TotalMinor);

        // When the period ends, the company moves to Starter.
        await host.InScopeAsync(async sp =>
        {
            var catalog = sp.GetRequiredService<PlatformDbContext>();
            var subscription = await catalog.Subscriptions.SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent);
            subscription.CurrentPeriodEnd = DateTime.UtcNow.AddMinutes(-1);
            var request = await catalog.PlanChangeRequests.SingleAsync(r => r.Id == requestId);
            request.EffectiveAt = DateTime.UtcNow.AddMinutes(-1);
            await catalog.SaveChangesAsync();
            return await sp.GetRequiredService<SubscriptionService>().RunLifecycleAsync(DateTime.UtcNow);
        });
        Assert.Equal("starter", (await SubscriptionOf(company.Id)).PlanVersion!.Plan!.Code);
        Assert.Equal(PlanChangeStatus.Applied, await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().PlanChangeRequests
            .Where(r => r.Id == requestId).Select(r => r.Status).SingleAsync()));
        Assert.True(periodEnd > DateTime.UtcNow); // the original date was in the future: no early switch
    }

    [PostgresFact]
    public async Task OnlyTheOwnerAnswers_ADeclineChangesNothing_AndTrovoCanWithdraw()
    {
        var (company, owner) = await HalfWayCompanyAsync("Decline Co", "starter");
        var billing = await host.AdminTokenAsync(PlatformAdminRole.Billing);
        var password = PlatformTestEnvironment.OwnerPassword;
        // The company has 1 licence (the Owner's); add one so the manager can sign in.
        await host.InScopeAsync(async sp =>
        {
            var catalog = sp.GetRequiredService<PlatformDbContext>();
            (await catalog.Subscriptions.SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent)).Seats.Single(s => s.SeatType!.Code == "both").Quantity = 2;
            var saved = await catalog.SaveChangesAsync();
            sp.GetRequiredService<CarSpaManagement.Api.Application.Interfaces.IEntitlementService>().Invalidate(company.Id);
            return saved;
        });
        var createdManager = await host.SendAsync(HttpMethod.Post, "/api/users", owner, new
        {
            fullName = "Manager", username = "manager", password, confirmPassword = password, role = "Manager", appAccess = "Both",
            permissionCodes = new[] { "settings.view" }
        });
        Assert.True(createdManager.StatusCode == HttpStatusCode.Created, await createdManager.Content.ReadAsStringAsync());

        var first = (await Json(await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/plan-change", billing, Plan("professional"))))
            .GetProperty("id").GetGuid();
        // Trovo withdraws it and sends another; only the newest is open.
        Assert.Equal(HttpStatusCode.NoContent, (await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/plan-change/{first}/cancel", billing)).StatusCode);
        var second = (await Json(await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/plan-change", billing, Plan("professional"))))
            .GetProperty("id").GetGuid();

        var login = await Json(await host.SendAsync(HttpMethod.Post, "/api/auth/login", null, new { companyCode = company.Code, username = "manager", password, app = "windows" }));
        var manager = login.GetProperty("token").GetString();
        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, "/api/subscription/plan-change", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Post, $"/api/subscription/plan-change/{second}/approve", manager)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await host.SendAsync(HttpMethod.Post, $"/api/subscription/plan-change/{second}/decline", owner)).StatusCode);
        Assert.Equal("starter", (await SubscriptionOf(company.Id)).PlanVersion!.Plan!.Code);
        Assert.Equal(HttpStatusCode.NoContent, (await host.SendAsync(HttpMethod.Get, "/api/subscription/plan-change", owner)).StatusCode);

        var history = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/companies/{company.Id}/plan-changes", billing));
        Assert.Equal(["Declined", "Cancelled"], history.EnumerateArray().Select(r => r.GetProperty("status").GetString()!).ToArray());
    }

    [PostgresFact]
    public async Task AChangeOfBillingInterval_WaitsForThePeriodEnd()
    {
        var (company, owner) = await HalfWayCompanyAsync("Interval Co", "starter");
        var billing = await host.AdminTokenAsync(PlatformAdminRole.Billing);
        var preview = await Json(await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/plan-change/preview", billing,
            Plan("professional", interval: "Month")));
        Assert.Equal("AtPeriodEnd", preview.GetProperty("timing").GetString());
        Assert.Equal(0, preview.GetProperty("amountNowMinor").GetInt64());
    }

    [Fact]
    public void TheChargeIsTheShareOfTheDifferenceForTheDaysLeft_InWholeRupees()
    {
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddDays(100);
        Assert.Equal(2_500_00, PlanChangeService.ProratedMinor(10_000_00, start, end, start.AddDays(75)));
        Assert.Equal(0, PlanChangeService.ProratedMinor(-500_00, start, end, start));
        Assert.Equal(0, PlanChangeService.ProratedMinor(10_000_00, start, end, end.AddDays(1)));
        Assert.Equal(0, PlanChangeService.ProratedMinor(10_000_00, start, end, start.AddDays(10)) % 100);
    }
}
