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

/// <summary>The API additions for the admin portal, over HTTP: one-time passwords, admins, invoices, CORS.</summary>
public class PlatformAdminPortalApiTests(PlatformApiHost host) : IClassFixture<PlatformApiHost>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private Task<(PlatformAdmin Admin, string Password)> NewAdminAsync(PlatformAdminRole role) =>
        host.InScopeAsync(sp => sp.GetRequiredService<PlatformAdminService>()
            .CreateAsync($"{role}-{Guid.NewGuid():N}@trovo.test", $"{role} admin", role));

    private Task<string> TokenAsync(PlatformAdmin admin) =>
        host.InScopeAsync(sp => Task.FromResult(sp.GetRequiredService<PlatformTokenService>().CreateAccessToken(admin)));

    [PostgresFact]
    public async Task WithAOneTimePassword_OnlyChangingItIsAllowed_ThenTheNewSessionWorks()
    {
        var (admin, oneTime) = await NewAdminAsync(PlatformAdminRole.Owner);
        Assert.True(admin.MustChangePassword);
        var token = await TokenAsync(admin);

        var blocked = await host.SendAsync(HttpMethod.Get, "/api/platform/dashboard", token);
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Equal("PASSWORD_CHANGE_REQUIRED", (await Json(blocked)).GetProperty("code").GetString());
        Assert.True((await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/auth/me", token))).GetProperty("mustChangePassword").GetBoolean());

        var tooShort = await host.SendAsync(HttpMethod.Post, "/api/platform/auth/change-password", token,
            new { currentPassword = oneTime, newPassword = "Short#2026", confirmPassword = "Short#2026" });
        Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);
        Assert.Contains("at least 12", (await Json(tooShort)).GetProperty("error").GetString());

        var wrongCurrent = await host.SendAsync(HttpMethod.Post, "/api/platform/auth/change-password", token,
            new { currentPassword = "not-the-password", newPassword = "Trovo#Platform2026", confirmPassword = "Trovo#Platform2026" });
        Assert.Equal(HttpStatusCode.BadRequest, wrongCurrent.StatusCode);

        var changed = await host.SendAsync(HttpMethod.Post, "/api/platform/auth/change-password", token,
            new { currentPassword = oneTime, newPassword = "Trovo#Platform2026", confirmPassword = "Trovo#Platform2026" });
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var session = await Json(changed);
        Assert.False(session.GetProperty("admin").GetProperty("mustChangePassword").GetBoolean());

        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, "/api/platform/dashboard", session.GetProperty("token").GetString())).StatusCode);
    }

    [PostgresFact]
    public async Task OnlyOwners_ManageAdmins_AndANewAdminGetsAOneTimePasswordOnce()
    {
        var (owner, _) = await NewAdminAsync(PlatformAdminRole.Owner);
        await host.InScopeAsync(async sp =>
        {
            var catalog = sp.GetRequiredService<PlatformDbContext>();
            (await catalog.Admins.SingleAsync(a => a.Id == owner.Id)).MustChangePassword = false;
            return await catalog.SaveChangesAsync();
        });
        owner.MustChangePassword = false;
        var ownerToken = await TokenAsync(owner);
        var (billing, _) = await NewAdminAsync(PlatformAdminRole.Billing);
        billing.MustChangePassword = false;

        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Get, "/api/platform/admins", await TokenAsync(billing))).StatusCode);

        var created = await host.SendAsync(HttpMethod.Post, "/api/platform/admins", ownerToken,
            new { email = $"support-{Guid.NewGuid():N}@trovo.test", name = "Support Person", role = "Support" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await Json(created);
        Assert.Equal(20, body.GetProperty("oneTimePassword").GetString()!.Length);
        Assert.True(body.GetProperty("admin").GetProperty("mustChangePassword").GetBoolean());
        var newId = body.GetProperty("admin").GetProperty("id").GetGuid();

        var list = await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/admins", ownerToken));
        Assert.Contains(list.EnumerateArray(), a => a.GetProperty("id").GetGuid() == newId);
        Assert.DoesNotContain("passwordHash", list.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("totpSecret", list.ToString(), StringComparison.OrdinalIgnoreCase);

        Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Put, $"/api/platform/admins/{owner.Id}", ownerToken,
            new { isActive = false, reason = "testing" })).StatusCode); // not yourself
        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Put, $"/api/platform/admins/{newId}", ownerToken,
            new { role = "Billing", reason = "Moved to accounts" })).StatusCode);

        var reset = await host.SendAsync(HttpMethod.Post, $"/api/platform/admins/{newId}/reset", ownerToken, new { reason = "Lost phone" });
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        var actions = await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().AuditLogs
            .Where(a => a.AdministratorId == owner.Id).Select(a => a.Action).ToListAsync());
        Assert.Contains("admin.created", actions);
        Assert.Contains("admin.updated", actions);
        Assert.Contains("admin.reset", actions);
    }

    [PostgresFact]
    public async Task Invoices_AreListedAcrossCompanies_AndOneOpensWithTrovosDetailsForPrinting()
    {
        var (billingAdmin, _) = await NewAdminAsync(PlatformAdminRole.Billing);
        billingAdmin.MustChangePassword = false;
        var token = await TokenAsync(billingAdmin);
        var (company, _) = await host.RegisteredCompanyAsync("Invoice List Co",
            new CompanyPlan("professional", BillingInterval.Month, new Dictionary<string, int> { ["showroom"] = 1 }, DateTime.UtcNow.AddMonths(1)));

        var issued = await Json(await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{company.Id}/invoices", token));
        var invoiceId = issued.GetProperty("id").GetGuid();

        var open = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/invoices?status=open&search={company.Code}", token));
        var row = Assert.Single(open.EnumerateArray());
        Assert.Equal(company.Code, row.GetProperty("companyCode").GetString());
        Assert.Equal(299_800, row.GetProperty("amountDueMinor").GetInt64()); // ₹1,999 + ₹999 showroom
        Assert.False(row.GetProperty("overdue").GetBoolean());

        await host.InScopeAsync(async sp =>
        {
            var catalog = sp.GetRequiredService<PlatformDbContext>();
            (await catalog.BillingInvoices.SingleAsync(i => i.Id == invoiceId)).DueAt = DateTime.UtcNow.AddDays(-1);
            return await catalog.SaveChangesAsync();
        });
        var overdue = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/invoices?status=overdue&companyId={company.Id}", token));
        Assert.True(Assert.Single(overdue.EnumerateArray()).GetProperty("overdue").GetBoolean());

        var detail = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/invoices/{invoiceId}", token));
        Assert.Equal("Trovo Tech Solutions", detail.GetProperty("seller").GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("seller").GetProperty("gstin").ValueKind);
        Assert.Equal("Invoice", detail.GetProperty("invoice").GetProperty("title").GetString());
        Assert.Equal(2, detail.GetProperty("invoice").GetProperty("lines").GetArrayLength());
        Assert.Equal(company.Code, detail.GetProperty("companyCode").GetString());
    }

    [PostgresFact]
    public async Task TheAdminPortalsAddress_MayCallTheApi_AndOtherAddressesMayNot()
    {
        async Task<string?> AllowedOriginFor(string origin)
        {
            var request = new HttpRequestMessage(HttpMethod.Options, "/api/platform/dashboard");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "GET");
            request.Headers.Add("Access-Control-Request-Headers", "authorization");
            var response = await host.Client.SendAsync(request);
            return response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) ? values.Single() : null;
        }

        Assert.Equal("https://admin.trovo.test", await AllowedOriginFor("https://admin.trovo.test"));
        Assert.Null(await AllowedOriginFor("https://evil.example"));
    }
}

/// <summary>The admin account rules, on their own catalog (so the Owner count is known).</summary>
public class PlatformAdminRulesTests : IAsyncLifetime
{
    private PlatformTestEnvironment? _env;

    public async Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is null) return;
        _env = new PlatformTestEnvironment();
        await using var scope = _env.Scope();
        await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().EnsureCatalogAsync();
    }

    public async Task DisposeAsync()
    {
        if (_env is not null) await _env.DisposeAsync();
    }

    private async Task<T> Admins<T>(Func<PlatformAdminService, Task<T>> work)
    {
        await using var scope = _env!.Scope();
        return await work(scope.ServiceProvider.GetRequiredService<PlatformAdminService>());
    }

    [PostgresFact]
    public async Task ThePlatformAlwaysKeepsAnActiveOwner_AndNobodyDemotesOrSwitchesOffThemselves()
    {
        var (owner, _) = await Admins(a => a.CreateAsync("owner@trovo.test", "Owner", PlatformAdminRole.Owner));
        var (second, _) = await Admins(a => a.CreateAsync("second@trovo.test", "Second", PlatformAdminRole.Support));

        var self = await Assert.ThrowsAsync<ValidationException>(() => Admins(a => a.UpdateAsync(owner.Id, PlatformAdminRole.Support, null, owner.Id)));
        Assert.Contains("your own", self.Message);
        var lastOwner = await Assert.ThrowsAsync<ValidationException>(() => Admins(a => a.UpdateAsync(owner.Id, null, false, second.Id)));
        Assert.Contains("at least one active Owner", lastOwner.Message);

        await Admins(a => a.UpdateAsync(second.Id, PlatformAdminRole.Owner, null, owner.Id));
        var demoted = await Admins(a => a.UpdateAsync(owner.Id, PlatformAdminRole.Billing, null, second.Id));
        Assert.Equal(PlatformAdminRole.Billing, demoted.Role);
    }

    [PostgresFact]
    public async Task AResetGivesANewOneTimePassword_AndRequiresSettingUpTheAuthenticatorAgain()
    {
        var (admin, first) = await Admins(a => a.CreateAsync("lost-phone@trovo.test", "Lost Phone", PlatformAdminRole.Support));
        await Admins(a => a.VerifyPasswordAsync(admin.Email, first)); // creates a 2-step secret

        var second = await Admins(a => a.ResetAsync(admin.Id));

        Assert.NotEqual(first, second);
        await Assert.ThrowsAsync<UnauthorizedException>(() => Admins(a => a.VerifyPasswordAsync(admin.Email, first)));
        var step = await Admins(a => a.VerifyPasswordAsync(admin.Email, second));
        Assert.True(step.NeedsTotpSetup);
        Assert.True(step.Admin.MustChangePassword);
    }

    [PostgresFact]
    public async Task ChangingThePassword_NeedsTheCurrentOne_AStrongNewOne_AndADifferentOne()
    {
        var (admin, oneTime) = await Admins(a => a.CreateAsync("changer@trovo.test", "Changer", PlatformAdminRole.Billing));

        await Assert.ThrowsAsync<ValidationException>(() => Admins(a => a.ChangePasswordAsync(admin.Id, "wrong", "Trovo#Platform2026", "Trovo#Platform2026")));
        await Assert.ThrowsAsync<ValidationException>(() => Admins(a => a.ChangePasswordAsync(admin.Id, oneTime, "Trovo#2026", "Trovo#2026")));
        await Assert.ThrowsAsync<ValidationException>(() => Admins(a => a.ChangePasswordAsync(admin.Id, oneTime, "Trovo#Platform2026", "Different#Platform2026")));
        await Assert.ThrowsAsync<ValidationException>(() => Admins(a => a.ChangePasswordAsync(admin.Id, oneTime, oneTime, oneTime)));

        var changed = await Admins(a => a.ChangePasswordAsync(admin.Id, oneTime, "Trovo#Platform2026", "Trovo#Platform2026"));
        Assert.False(changed.MustChangePassword);
        await Admins(a => a.VerifyPasswordAsync(admin.Email, "Trovo#Platform2026"));
    }
}
