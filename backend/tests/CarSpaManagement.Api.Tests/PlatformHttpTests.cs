using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>Runs the real API as Trovo's platform (in-process) for the HTTP-level platform tests.</summary>
public sealed class PlatformApiHost : IAsyncLifetime
{
    private WebApplicationFactory<AppDbContext>? _factory;
    public string ProductKey { get; } = "pt" + Guid.NewGuid().ToString("N")[..10];
    public HttpClient Client { get; private set; } = null!;
    public IServiceProvider Services => _factory!.Services;

    public Task InitializeAsync()
    {
        var admin = PostgresTestEnvironment.AdminConnectionString;
        if (admin is null) return Task.CompletedTask;

        _factory = new WebApplicationFactory<AppDbContext>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Testing");
            b.UseSetting("Platform:Enabled", "true");
            b.UseSetting("Platform:ProductKey", ProductKey);
            b.UseSetting("Platform:DirectoryCacheSeconds", "1");
            b.UseSetting("ConnectionStrings:Platform", new Npgsql.NpgsqlConnectionStringBuilder(admin) { Database = $"{ProductKey}_catalog" }.ConnectionString);
            b.UseSetting("ConnectionStrings:PlatformAdmin", new Npgsql.NpgsqlConnectionStringBuilder(admin) { Database = "postgres" }.ConnectionString);
            b.UseSetting("Jwt:Key", "company-http-test-signing-key-at-least-32-chars");
            b.UseSetting("Platform:Jwt:Key", "platform-http-test-signing-key-at-least-32-chars");
            b.UseSetting("WhatsApp:EncryptionKey", "platform-http-test-encryption-key-32-chars!!");
        });
        Client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (_factory is null) return;
        await _factory.DisposeAsync();
        await PlatformTestEnvironment.DropEverythingAsync(ProductKey);
    }

    public async Task<T> InScopeAsync<T>(Func<IServiceProvider, Task<T>> work)
    {
        await using var scope = Services.CreateAsyncScope();
        return await work(scope.ServiceProvider);
    }

    /// <summary>A registered company and its Owner's id.</summary>
    public async Task<(PlatformCompany Company, Guid OwnerId)> RegisteredCompanyAsync(string name, CompanyPlan? plan = null)
    {
        var created = await InScopeAsync(sp => sp.GetRequiredService<CompanyDatabaseProvisioner>().CreateCompanyAsync(name, plan));
        await InScopeAsync(sp => sp.GetRequiredService<CompanyRegistrationService>().RegisterAsync(new Application.DTOs.RegisterCompanyRequest
        {
            CompanyCode = created.Company.Code, RegistrationCode = created.RegistrationCode, FullName = "Owner", Username = "owner",
            Password = PlatformTestEnvironment.OwnerPassword, ConfirmPassword = PlatformTestEnvironment.OwnerPassword
        }));
        var ownerId = await InScopeAsync(async sp =>
        {
            sp.GetRequiredService<TenantContext>().Set(created.Company.Id);
            return await sp.GetRequiredService<AppDbContext>().Users.Where(u => u.Role == UserRole.Owner).Select(u => u.Id).SingleAsync();
        });
        return (created.Company, ownerId);
    }

    /// <summary>A company sign-in token, signed like the real ones (the user must exist in the company database).</summary>
    public string CompanyToken(Guid companyId, Guid userId)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(JwtTokenService.OrganizationClaim, companyId.ToString()),
            new Claim(ClaimTypes.Role, "Owner"),
            new Claim("isOwner", "true")
        };
        var token = new JwtSecurityToken("CarSpaManagement", "CarSpaManagementClients", claims, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10),
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes("company-http-test-signing-key-at-least-32-chars")), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<string> AdminTokenAsync(PlatformAdminRole role)
    {
        return await InScopeAsync(async sp =>
        {
            var (admin, _) = await sp.GetRequiredService<PlatformAdminService>().CreateAsync($"{role}-{Guid.NewGuid():N}@trovo.test", role.ToString(), role);
            return sp.GetRequiredService<PlatformTokenService>().CreateAccessToken(admin);
        });
    }

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string? token, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        return await Client.SendAsync(request);
    }

    public async Task SetStatusAsync(Guid companyId, SubscriptionStatus status) =>
        await InScopeAsync(async sp =>
        {
            var catalog = sp.GetRequiredService<PlatformDbContext>();
            var subscription = await catalog.Subscriptions.SingleAsync(s => s.CompanyId == companyId && s.IsCurrent);
            subscription.Status = status;
            await catalog.SaveChangesAsync();
            sp.GetRequiredService<Application.Interfaces.IEntitlementService>().Invalidate(companyId);
            return true;
        });
}

public class PlatformHttpTests(PlatformApiHost host) : IClassFixture<PlatformApiHost>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    [PostgresFact]
    public async Task AdminSignIn_NeedsThePassword_ThenAnAuthenticatorCode_AndAWrongCodeIsRefused()
    {
        var (admin, password) = await host.InScopeAsync(sp =>
            sp.GetRequiredService<PlatformAdminService>().CreateAsync($"owner-{Guid.NewGuid():N}@trovo.test", "Trovo Owner", PlatformAdminRole.Owner));

        var login = await host.SendAsync(HttpMethod.Post, "/api/platform/auth/login", null, new { email = admin.Email, password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var step = await Json(login);
        Assert.Equal("totp-setup", step.GetProperty("stage").GetString());
        var secret = step.GetProperty("totpSecret").GetString()!;
        var challenge = step.GetProperty("challengeToken").GetString()!;

        // The challenge token is not a sign-in token.
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.SendAsync(HttpMethod.Get, "/api/platform/dashboard", challenge)).StatusCode);

        var wrong = await host.SendAsync(HttpMethod.Post, "/api/platform/auth/verify", null, new { challengeToken = challenge, code = "000000" });
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);

        var verify = await host.SendAsync(HttpMethod.Post, "/api/platform/auth/verify", null,
            new { challengeToken = challenge, code = Totp.CodeAt(secret, DateTime.UtcNow) });
        Assert.Equal(HttpStatusCode.OK, verify.StatusCode);
        var token = (await Json(verify)).GetProperty("token").GetString()!;

        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, "/api/platform/dashboard", token)).StatusCode);
        var me = await Json(await host.SendAsync(HttpMethod.Get, "/api/platform/auth/me", token));
        Assert.Equal("Owner", me.GetProperty("role").GetString());
    }

    [PostgresFact]
    public async Task CompanyAndPlatformTokens_NeverWorkOnEachOthersApi()
    {
        var (company, ownerId) = await host.RegisteredCompanyAsync("Token Wall Co");
        var companyToken = host.CompanyToken(company.Id, ownerId);
        var platformToken = await host.AdminTokenAsync(PlatformAdminRole.Owner);

        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, "/api/customers", companyToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, "/api/platform/companies", platformToken)).StatusCode);

        var companyOnPlatform = await host.SendAsync(HttpMethod.Get, "/api/platform/companies", companyToken);
        Assert.Contains(companyOnPlatform.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden });
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.SendAsync(HttpMethod.Get, "/api/customers", platformToken)).StatusCode);
    }

    [PostgresFact]
    public async Task AReadOnlyCompany_CanViewButNotChange_AndSeesTheBanner()
    {
        var (company, ownerId) = await host.RegisteredCompanyAsync("Read Only Co");
        var token = host.CompanyToken(company.Id, ownerId);
        await host.SetStatusAsync(company.Id, SubscriptionStatus.ReadOnly);

        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, "/api/customers", token)).StatusCode);
        var create = await host.SendAsync(HttpMethod.Post, "/api/customers", token, new { name = "Blocked", phoneNumber = "9000000009" });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal("SUBSCRIPTION_READ_ONLY", (await Json(create)).GetProperty("code").GetString());

        var status = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/status", token));
        Assert.Equal("ReadOnly", status.GetProperty("access").GetString());
        Assert.Equal("error", status.GetProperty("banner").GetProperty("level").GetString());
    }

    [PostgresFact]
    public async Task ASuspendedCompany_CannotSignIn_AndItsExistingTokensStopWorking()
    {
        var (company, ownerId) = await host.RegisteredCompanyAsync("Suspended Co");
        var token = host.CompanyToken(company.Id, ownerId);
        await host.SetStatusAsync(company.Id, SubscriptionStatus.Suspended);

        var login = await host.SendAsync(HttpMethod.Post, "/api/auth/login", null,
            new { companyCode = company.Code, username = "owner", password = PlatformTestEnvironment.OwnerPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Contains("switched off", (await Json(login)).GetProperty("error").GetString());

        var request = await host.SendAsync(HttpMethod.Get, "/api/customers", token);
        Assert.Equal(HttpStatusCode.Forbidden, request.StatusCode);
        Assert.Equal("SUBSCRIPTION_INACTIVE", (await Json(request)).GetProperty("code").GetString());
    }

    [PostgresFact]
    public async Task OnStarter_ModulesOutsideThePlan_AreRefusedByTheServer()
    {
        var (company, ownerId) = await host.RegisteredCompanyAsync("Starter Co",
            new CompanyPlan("starter", BillingInterval.Month, new Dictionary<string, int>(), DateTime.UtcNow.AddMonths(1)));
        var token = host.CompanyToken(company.Id, ownerId);

        foreach (var url in new[] { "/api/showrooms", "/api/staff-advances", "/api/audit-logs", "/api/vendors" })
        {
            var response = await host.SendAsync(HttpMethod.Get, url, token);
            Assert.True(response.StatusCode == HttpStatusCode.Forbidden, $"{url} returned {response.StatusCode}");
            Assert.Equal("FEATURE_NOT_IN_PLAN", (await Json(response)).GetProperty("code").GetString());
        }
        Assert.Equal(HttpStatusCode.OK, (await host.SendAsync(HttpMethod.Get, "/api/customers", token)).StatusCode);

        var status = await Json(await host.SendAsync(HttpMethod.Get, "/api/subscription/status", token));
        Assert.Equal("starter", status.GetProperty("planCode").GetString());
        Assert.Equal(3, status.GetProperty("seatLimit").GetInt32());
        Assert.Equal(1, status.GetProperty("seatsUsed").GetInt32());
        Assert.Equal("false", status.GetProperty("features").GetProperty(FeatureKeys.Showroom).GetString());
    }

    [PostgresFact]
    public async Task PlatformRoles_LimitWhatEachAdminCanChange_AndChangesAreAudited()
    {
        var (company, _) = await host.RegisteredCompanyAsync("Roles Co");
        var support = await host.AdminTokenAsync(PlatformAdminRole.Support);
        var billing = await host.AdminTokenAsync(PlatformAdminRole.Billing);
        var readOnly = await host.AdminTokenAsync(PlatformAdminRole.ReadOnly);
        var change = new { planCode = "starter", reason = "Customer asked to downgrade" };

        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Put, $"/api/platform/companies/{company.Id}/subscription", support, change)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Put, $"/api/platform/companies/{company.Id}/status", readOnly,
            new { action = "suspend", reason = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await host.SendAsync(HttpMethod.Get, "/api/platform/audit-logs", billing)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await host.SendAsync(HttpMethod.Put, $"/api/platform/companies/{company.Id}/subscription", billing, change)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Put, $"/api/platform/companies/{company.Id}/status", support,
            new { action = "suspend", reason = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await host.SendAsync(HttpMethod.Put, $"/api/platform/companies/{company.Id}/status", support,
            new { action = "suspend", reason = "Testing suspension" })).StatusCode);

        var actions = await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().AuditLogs
            .Where(a => a.TargetCompanyId == company.Id).OrderBy(a => a.CreatedAt).Select(a => a.Action + ":" + a.Reason).ToListAsync());
        Assert.Equal(new[] { "subscription.changed:Customer asked to downgrade", "company.suspend:Testing suspension" }, actions);
    }

    [PostgresFact]
    public async Task TrovoCreatesACompany_AndGetsItsRegistrationCodeOnce_ThroughTheApi()
    {
        var support = await host.AdminTokenAsync(PlatformAdminRole.Support);

        var created = await host.SendAsync(HttpMethod.Post, "/api/platform/companies", support, new { name = "Portal Made Co" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await Json(created);
        var id = body.GetProperty("id").GetGuid();
        Assert.Matches("^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$", body.GetProperty("registrationCode").GetString()!);

        var detail = await Json(await host.SendAsync(HttpMethod.Get, $"/api/platform/companies/{id}", support));
        Assert.Equal("AwaitingRegistration", detail.GetProperty("companyStatus").GetString());
        Assert.True(detail.GetProperty("registrationCodeOpen").GetBoolean());
        Assert.Equal("Trialing", detail.GetProperty("subscription").GetProperty("status").GetString());
        Assert.False(detail.ToString().Contains("DatabasePassword", StringComparison.OrdinalIgnoreCase));

        var again = await host.SendAsync(HttpMethod.Post, $"/api/platform/companies/{id}/registration-code", support);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.NotEqual(body.GetProperty("registrationCode").GetString(), (await Json(again)).GetProperty("registrationCode").GetString());
    }
}
