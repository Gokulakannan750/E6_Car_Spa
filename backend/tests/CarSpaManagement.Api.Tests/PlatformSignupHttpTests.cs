using System.Net;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// The public sign-up website's API over HTTP: prices, quotes, a free trial and a paid order completed by the test
/// payment, with the company created, invoiced and paid, and the codes working in the app's registration.
/// </summary>
public class PlatformSignupHttpTests(PlatformApiHost host) : IClassFixture<PlatformApiHost>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static object Business(string email, string mobile = "98765 43210") => new
    {
        name = "Sunrise Detailing", ownerName = "Arun Kumar", mobile, email, city = "Erode", state = "Tamil Nadu", gstin = (string?)null
    };

    [PostgresFact]
    public async Task ThePricingPage_GetsPlansLicencePricesAndAddOnsOnSale()
    {
        var catalog = await Json(await host.SendAsync(HttpMethod.Get, "/api/public/catalog", null));
        var plans = catalog.GetProperty("plans").EnumerateArray().ToDictionary(p => p.GetProperty("code").GetString()!);
        Assert.Equal(99_900, plans["starter"].GetProperty("monthly").GetProperty("bothUserPriceMinor").GetInt64());
        Assert.Equal(7_99_000, plans["professional"].GetProperty("yearly").GetProperty("androidUserPriceMinor").GetInt64());
        Assert.Contains(FeatureKeys.WhatsAppAutomation, plans["professional"].GetProperty("modules").EnumerateArray().Select(m => m.GetString()));

        var addOns = catalog.GetProperty("addOns").EnumerateArray().Select(a => a.GetProperty("code").GetString()).ToList();
        Assert.Contains("outside_jobs", addOns);
        Assert.DoesNotContain("seats_5", addOns);
        Assert.Equal(7, catalog.GetProperty("trialDays").GetInt32());
        Assert.True(catalog.GetProperty("testPayments").GetBoolean());
        Assert.Equal("Trovo Tech Solutions", catalog.GetProperty("sellerName").GetString());
    }

    [PostgresFact]
    public async Task AQuote_IsWorkedOutByTheServer_AndRefusesWhatCannotBeBought()
    {
        var quote = await host.SendAsync(HttpMethod.Post, "/api/public/signup/quote", null, new
        {
            planCode = "starter", interval = "Year", licences = new { android = 2, windows = 0, both = 1 },
            addOns = new Dictionary<string, int> { ["outside_jobs"] = 1 }
        });
        Assert.Equal(HttpStatusCode.OK, quote.StatusCode);
        var body = await Json(quote);
        Assert.Equal(9_99_000 + 2 * 4_99_000 + 2_99_000, body.GetProperty("totalMinor").GetInt64());
        Assert.Equal(3, body.GetProperty("lines").GetArrayLength());
        Assert.Equal(0, body.GetProperty("taxMinor").GetInt64());

        // Five modules on Starter cost more than Professional: the quote says so.
        var allModules = await Json(await host.SendAsync(HttpMethod.Post, "/api/public/signup/quote", null, new
        {
            planCode = "starter", interval = "Month", licences = new { android = 0, windows = 0, both = 1 },
            addOns = new Dictionary<string, int>
            {
                ["outside_jobs"] = 1, ["staff_advances"] = 1, ["whatsapp_automation"] = 1, ["advanced_reports"] = 1, ["audit_trail"] = 1
            }
        }));
        Assert.Equal("professional", allModules.GetProperty("cheaper").GetProperty("planCode").GetString());

        foreach (var (choice, message) in new (object, string)[]
                 {
                     (new { planCode = "professional", interval = "Month", licences = new { android = 0, windows = 0, both = 1 },
                         addOns = new Dictionary<string, int> { ["whatsapp_automation"] = 1 } }, "already includes"),
                     (new { planCode = "starter", interval = "Month", licences = new { android = 0, windows = 0, both = 0 }, addOns = (object?)null }, "At least 1"),
                     (new { planCode = "starter", interval = "Month", licences = new { android = 0, windows = 0, both = 1 },
                         addOns = new Dictionary<string, int> { ["seats_5"] = 1 } }, "not on sale"),
                     (new { planCode = "gold", interval = "Month", licences = new { android = 0, windows = 0, both = 1 }, addOns = (object?)null }, "plans on sale"),
                 })
        {
            var refused = await host.SendAsync(HttpMethod.Post, "/api/public/signup/quote", null, choice);
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
            Assert.Contains(message, (await Json(refused)).GetProperty("error").GetString());
        }
    }

    [PostgresFact]
    public async Task AFreeTrial_CreatesTheCompanyAtOnce_TheCodesWork_AndOnlyOneTrialPerEmailOrMobile()
    {
        var email = $"trial-{Guid.NewGuid():N}@sunrise.test";
        var badMobile = await host.SendAsync(HttpMethod.Post, "/api/public/signup", null,
            new { business = Business(email, "12345"), startTrial = true, acceptTerms = true });
        Assert.Equal(HttpStatusCode.BadRequest, badMobile.StatusCode);
        Assert.Contains("10-digit mobile", (await Json(badMobile)).GetProperty("error").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Post, "/api/public/signup", null,
            new { business = Business(email), startTrial = true, acceptTerms = false })).StatusCode);

        var mobile = $"9{Random.Shared.Next(100_000_000, 999_999_999)}";
        var trial = await host.SendAsync(HttpMethod.Post, "/api/public/signup", null,
            new { business = Business(email.ToUpperInvariant(), $"+91 {mobile}"), startTrial = true, acceptTerms = true });
        Assert.Equal(HttpStatusCode.Created, trial.StatusCode);
        var result = await Json(trial);
        Assert.Equal("Completed", result.GetProperty("status").GetString());
        var code = result.GetProperty("companyCode").GetString()!;
        var registrationCode = result.GetProperty("registrationCode").GetString()!;
        Assert.True(result.GetProperty("trialEndsAt").GetDateTime() > DateTime.UtcNow.AddDays(6));

        var company = await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().Companies.SingleAsync(c => c.Code == code));
        Assert.Equal(PlatformCompanyStatus.AwaitingRegistration, company.Status);
        var account = await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().BillingAccounts.SingleAsync(b => b.CompanyId == company.Id));
        Assert.Equal(email, account.BillingEmail); // stored in lower case
        Assert.Equal($"+91 {mobile}", account.BillingPhone);

        // The codes work in the app's registration.
        var registered = await host.SendAsync(HttpMethod.Post, "/api/auth/register", null, new
        {
            companyCode = code, registrationCode, fullName = "Arun Kumar", username = "arun",
            password = PlatformTestEnvironment.OwnerPassword, confirmPassword = PlatformTestEnvironment.OwnerPassword
        });
        Assert.Equal(HttpStatusCode.Created, registered.StatusCode);

        var again = await host.SendAsync(HttpMethod.Post, "/api/public/signup", null,
            new { business = Business($"other-{Guid.NewGuid():N}@x.test", mobile), startTrial = true, acceptTerms = true });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Contains("already used", (await Json(again)).GetProperty("error").GetString());
    }

    [PostgresFact]
    public async Task APaidOrder_IsCreatedOnPayment_InvoicedAndPaid_AndCannotBePaidTwice()
    {
        var order = await host.SendAsync(HttpMethod.Post, "/api/public/signup", null, new
        {
            business = Business($"paid-{Guid.NewGuid():N}@sunrise.test", $"8{Random.Shared.Next(100_000_000, 999_999_999)}"),
            startTrial = false,
            plan = new { planCode = "starter", interval = "Year", licences = new { android = 2, windows = 0, both = 1 }, addOns = new Dictionary<string, int> { ["outside_jobs"] = 1 } },
            acceptTerms = true
        });
        Assert.Equal(HttpStatusCode.Created, order.StatusCode);
        var placed = await Json(order);
        Assert.Equal("AwaitingPayment", placed.GetProperty("status").GetString());
        var orderId = placed.GetProperty("orderId").GetGuid();
        var token = placed.GetProperty("orderToken").GetString()!;
        Assert.Equal(22_96_000, placed.GetProperty("amountMinor").GetInt64());
        Assert.Equal(JsonValueKind.Null, placed.GetProperty("companyCode").ValueKind); // no company before payment

        Assert.Equal(HttpStatusCode.NotFound, (await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{orderId}/status", null, new { token = "wrong" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{orderId}/test-payment", null, new { token = "wrong" })).StatusCode);

        var paid = await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{orderId}/test-payment", null, new { token });
        Assert.Equal(HttpStatusCode.OK, paid.StatusCode);
        var result = await Json(paid);
        var code = result.GetProperty("companyCode").GetString()!;
        Assert.False(string.IsNullOrEmpty(result.GetProperty("registrationCode").GetString()));
        Assert.StartsWith("TROVO/", result.GetProperty("invoiceNumber").GetString());

        var (subscription, invoice, payment) = await host.InScopeAsync(async sp =>
        {
            var catalog = sp.GetRequiredService<PlatformDbContext>();
            var company = await catalog.Companies.SingleAsync(c => c.Code == code);
            var s = await catalog.Subscriptions.Include(x => x.PlanVersion!).ThenInclude(v => v.Plan).SingleAsync(x => x.CompanyId == company.Id && x.IsCurrent);
            var i = await catalog.BillingInvoices.SingleAsync(x => x.CompanyId == company.Id);
            var p = await catalog.PaymentTransactions.SingleAsync(x => x.BillingInvoiceId == i.Id);
            return (s, i, p);
        });
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
        Assert.Equal("starter", subscription.PlanVersion!.Plan!.Code);
        Assert.Equal(new LicenceCounts(2, 0, 1), subscription.Licences);
        Assert.InRange(subscription.CurrentPeriodEnd - DateTime.UtcNow, TimeSpan.FromDays(364), TimeSpan.FromDays(366));
        Assert.Equal(BillingInvoiceStatus.Paid, invoice.Status);
        Assert.Equal(22_96_000, invoice.TotalMinor);
        Assert.Equal(SignupService.TestProvider, payment.Provider);

        var twice = await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{orderId}/test-payment", null, new { token });
        Assert.Equal(HttpStatusCode.Conflict, twice.StatusCode);

        var status = await Json(await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{orderId}/status", null, new { token }));
        Assert.Equal("Completed", status.GetProperty("status").GetString());
        Assert.Equal(code, status.GetProperty("companyCode").GetString());
        Assert.Equal(JsonValueKind.Null, status.GetProperty("registrationCode").ValueKind); // shown once only

        var actions = await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().AuditLogs.Select(a => a.Action).ToListAsync());
        Assert.Contains("signup.paid", actions);

        // Trovo sees the order in the admin portal's Sign-ups list.
        var support = await host.AdminTokenAsync(PlatformAdminRole.Support);
        var listed = (await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/signups?status=Completed", support))).EnumerateArray()
            .Single(o => o.GetProperty("id").GetGuid() == orderId);
        Assert.Equal(code, listed.GetProperty("companyCode").GetString());
        Assert.Equal("Paid", listed.GetProperty("start").GetString());
        Assert.Equal("Test", listed.GetProperty("paymentProvider").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.SendAsync(HttpMethod.Get, "/api/platform/signups", null)).StatusCode);
    }

    [Fact]
    public void BusinessDetails_AreCleaned_AndCheckedWithClearMessages()
    {
        var clean = SignupService.Clean(new SignupBusiness("  Sunrise   Detailing ", "Arun", "+91 98765-43210", " Arun@Sunrise.IN ", "Erode", "Tamil Nadu", "33abcde1234f1z5"));
        Assert.Equal("Sunrise Detailing", clean.Name);
        Assert.Equal("9876543210", clean.Mobile);
        Assert.Equal("arun@sunrise.in", clean.Email);
        Assert.Equal("33ABCDE1234F1Z5", clean.Gstin);

        Assert.Contains("10-digit", Assert.Throws<ValidationException>(() =>
            SignupService.Clean(new SignupBusiness("Sunrise", "Arun", "5876543210", "a@b.in", "Erode", "TN", null))).Message);
        Assert.Contains("email", Assert.Throws<ValidationException>(() =>
            SignupService.Clean(new SignupBusiness("Sunrise", "Arun", "9876543210", "not-an-email", "Erode", "TN", null))).Message);
        Assert.Contains("GSTIN", Assert.Throws<ValidationException>(() =>
            SignupService.Clean(new SignupBusiness("Sunrise", "Arun", "9876543210", "a@b.in", "Erode", "TN", "1234"))).Message);
    }
}
