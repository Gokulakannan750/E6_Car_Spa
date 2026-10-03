using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Boots the real API pipeline in-process (JWT validation, [RequirePermission] policies, middleware, controllers)
/// against a throwaway PostgreSQL database, and calls it over HTTP. Covers Phase 0 P0-5 / P0-6 / P0-10.
/// </summary>
public sealed class ApiTestHost : IAsyncLifetime
{
    private readonly PostgresTestDatabase _database = new();
    private WebApplicationFactory<AppDbContext>? _factory;

    public HttpClient Client { get; private set; } = null!;
    public IServiceProvider Services => _factory!.Services;
    public Dictionary<string, User> Users { get; } = new();
    public Guid StaffMemberId { get; private set; }
    public const string Password = "Valid-Pass123!";

    public async Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is null) return;
        await _database.InitializeAsync();

        // Random per-run secrets: nothing here is a real credential.
        var jwtKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        var encryptionKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

        _factory = new WebApplicationFactory<AppDbContext>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Testing");
            b.UseSetting("ConnectionStrings:DefaultConnection", _database.ConnectionString);
            b.UseSetting("Jwt:Key", jwtKey);
            b.UseSetting("WhatsApp:EncryptionKey", encryptionKey);
        });
        Client = _factory.CreateClient();

        await SeedAsync();
    }

    private async Task SeedAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasherService>();
        var permissions = await db.Permissions.ToDictionaryAsync(p => p.Code);

        User Add(string username, UserRole role, params string[] codes)
        {
            var user = new User { FullName = username, Username = username, Role = role, IsActive = true };
            user.PasswordHash = hasher.HashPassword(user, Password);
            foreach (var code in codes)
                user.UserPermissions.Add(new UserPermission { UserId = user.Id, PermissionId = permissions[code].Id });
            db.Users.Add(user);
            Users[username] = user;
            return user;
        }

        Add("owner", UserRole.Owner);
        Add("manager.a", UserRole.Manager, "users.view", "users.edit", "users.deactivate", "users.create", "staff.view");
        Add("manager.b", UserRole.Manager, "users.view", "users.edit");
        Add("staff.viewer", UserRole.Staff, "staff.view");
        Add("staff.sensitive", UserRole.Staff, "staff.view", "staff.view_sensitive");
        Add("staff.inactive", UserRole.Staff, "staff.view", "staff.view_sensitive").IsActive = false;

        // Staff member with an Aadhaar document on disk (dummy bytes, not a real document).
        var docPath = Path.Combine(Path.GetTempPath(), $"carspa-test-aadhaar-{Guid.NewGuid():N}.pdf");
        await File.WriteAllBytesAsync(docPath, "%PDF-1.4 test"u8.ToArray());
        var staffMember = new Staff
        {
            Name = "Document Holder",
            PhoneNumber = "9000000001",
            StaffMasterId = "TS001A",
            AadhaarDocumentPath = docPath,
            AadhaarDocumentFileName = "aadhaar.pdf",
            AadhaarDocumentContentType = "application/pdf",
            AadhaarDocumentSize = 13,
        };
        db.Staff.Add(staffMember);
        StaffMemberId = staffMember.Id;

        await db.SaveChangesAsync();
    }

    public string TokenFor(string username, DateTime? expires = null, string? signingKeyOverride = null)
    {
        var options = Services.GetRequiredService<IOptions<JwtOptions>>().Value;
        var user = Users[username];
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKeyOverride ?? options.Key));
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("isOwner", (user.Role == UserRole.Owner).ToString().ToLowerInvariant()),
        };
        var exp = expires ?? DateTime.UtcNow.AddMinutes(10);
        var token = new JwtSecurityToken(options.Issuer, options.Audience, claims,
            notBefore: exp.AddMinutes(-20), expires: exp,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string? asUser, object? body = null, string? rawToken = null)
    {
        var request = new HttpRequestMessage(method, url);
        var token = rawToken ?? (asUser is null ? null : TokenFor(asUser));
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        return await Client.SendAsync(request);
    }

    public async Task<string> PasswordHashOf(string username)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return (await db.Users.AsNoTracking().SingleAsync(u => u.Id == Users[username].Id)).PasswordHash;
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null) await _factory.DisposeAsync();
        await _database.DisposeAsync();
    }
}

public class ApiSecurityHttpTests : IClassFixture<ApiTestHost>
{
    private readonly ApiTestHost _api;
    public ApiSecurityHttpTests(ApiTestHost api) => _api = api;

    private static object PasswordReset(string fullName) => new
    {
        fullName,
        password = "Changed-Pass456!",
        confirmPassword = "Changed-Pass456!",
    };

    // ── Authentication ──────────────────────────────────────────────────────

    [PostgresFact]
    public async Task Health_IsAnonymous()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/health", asUser: null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [PostgresFact]
    public async Task Login_WithInvalidCredentials_Returns401_AndValidCredentials_Return200()
    {
        var bad = await _api.Client.PostAsJsonAsync("/api/auth/login", new { username = "manager.a", password = "wrong-password-1!" });
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);

        var unknown = await _api.Client.PostAsJsonAsync("/api/auth/login", new { username = "no.such.user", password = "wrong-password-1!" });
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);

        var ok = await _api.Client.PostAsJsonAsync("/api/auth/login", new { username = "staff.viewer", password = ApiTestHost.Password });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var body = await ok.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.True(body!.ContainsKey("token"));
    }

    [PostgresFact]
    public async Task ProtectedEndpoint_WithoutToken_Returns401()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/users", asUser: null);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [PostgresFact]
    public async Task ExpiredToken_Returns401()
    {
        var expired = _api.TokenFor("owner", expires: DateTime.UtcNow.AddMinutes(-1));
        var res = await _api.SendAsync(HttpMethod.Get, "/api/users", asUser: null, rawToken: expired);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [PostgresFact]
    public async Task TokenSignedWithWrongKey_Returns401()
    {
        var forged = _api.TokenFor("owner", signingKeyOverride: Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)));
        var res = await _api.SendAsync(HttpMethod.Get, "/api/users", asUser: null, rawToken: forged);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [PostgresFact]
    public async Task DeactivatedUser_WithStillValidToken_IsForbidden()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/staff-advances/staff", asUser: "staff.inactive");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // ── P0-5: user management ───────────────────────────────────────────────

    [PostgresFact]
    public async Task Staff_WithoutUsersEdit_CannotManageUsers()
    {
        var before = await _api.PasswordHashOf("manager.b");
        var res = await _api.SendAsync(HttpMethod.Put, $"/api/users/{_api.Users["manager.b"].Id}", "staff.viewer", PasswordReset("manager.b"));
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(before, await _api.PasswordHashOf("manager.b"));
    }

    [PostgresFact]
    public async Task Manager_CannotResetAnotherManagersPassword_OverHttp()
    {
        var before = await _api.PasswordHashOf("manager.b");
        var res = await _api.SendAsync(HttpMethod.Put, $"/api/users/{_api.Users["manager.b"].Id}", "manager.a", PasswordReset("manager.b"));
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(before, await _api.PasswordHashOf("manager.b"));
    }

    [PostgresFact]
    public async Task Manager_CannotModifyOwner_OverHttp()
    {
        var before = await _api.PasswordHashOf("owner");
        var res = await _api.SendAsync(HttpMethod.Put, $"/api/users/{_api.Users["owner"].Id}", "manager.a", PasswordReset("owner"));
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(before, await _api.PasswordHashOf("owner"));
    }

    [PostgresFact]
    public async Task Manager_CannotDeactivateAnotherManager_OverHttp()
    {
        var res = await _api.SendAsync(HttpMethod.Patch, $"/api/users/{_api.Users["manager.b"].Id}/toggle-status", "manager.a");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [PostgresFact]
    public async Task Manager_CannotEscalateOwnRole_OverHttp()
    {
        var res = await _api.SendAsync(HttpMethod.Put, $"/api/users/{_api.Users["manager.a"].Id}", "manager.a", new { fullName = "manager.a", role = "Owner" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [PostgresFact]
    public async Task Owner_CanResetManagerPassword_OverHttp()
    {
        var before = await _api.PasswordHashOf("manager.b");
        var res = await _api.SendAsync(HttpMethod.Put, $"/api/users/{_api.Users["manager.b"].Id}", "owner", PasswordReset("manager.b"));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.NotEqual(before, await _api.PasswordHashOf("manager.b"));
    }

    // ── P0-6: Aadhaar document ──────────────────────────────────────────────

    [PostgresFact]
    public async Task AadhaarDocument_WithOnlyStaffView_Returns403()
    {
        var res = await _api.SendAsync(HttpMethod.Get, $"/api/staff-advances/staff/{_api.StaffMemberId}/aadhaar-document", "staff.viewer");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [PostgresFact]
    public async Task AadhaarDocument_WithViewSensitive_ReturnsFile()
    {
        var res = await _api.SendAsync(HttpMethod.Get, $"/api/staff-advances/staff/{_api.StaffMemberId}/aadhaar-document", "staff.sensitive");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("application/pdf", res.Content.Headers.ContentType?.MediaType);
    }

    [PostgresFact]
    public async Task AadhaarDocument_Anonymous_Returns401()
    {
        var res = await _api.SendAsync(HttpMethod.Get, $"/api/staff-advances/staff/{_api.StaffMemberId}/aadhaar-document", asUser: null);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [PostgresFact]
    public async Task AadhaarStorage_IsNotServedAsStaticFiles()
    {
        foreach (var path in new[] { "/App_Data/uploads/aadhaar_documents/", "/uploads/aadhaar_documents/", "/App_Data/" })
        {
            var res = await _api.SendAsync(HttpMethod.Get, path, asUser: null);
            Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        }
    }

    // ── P0-8: seed data ─────────────────────────────────────────────────────

    [PostgresFact]
    public async Task NonDevelopmentStartup_SeedsBootstrapData_ButNoDemoVendors()
    {
        using var scope = _api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Assert.Empty(await db.Vendors.IgnoreQueryFilters().ToListAsync());
        Assert.True(await db.Permissions.AnyAsync(p => p.Code == "staff.view_sensitive"));
        Assert.True(await db.ShowroomVehicleTypes.AnyAsync());
        Assert.True(await db.SystemPreferences.AnyAsync());
    }

    [PostgresFact]
    public async Task AadhaarNumberReveal_WithOnlyStaffView_Returns403()
    {
        var res = await _api.SendAsync(HttpMethod.Get, $"/api/staff-advances/staff/{_api.StaffMemberId}/aadhaar", "staff.viewer");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }
}
