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
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// RBAC Phase 2D security test host running against live PostgreSQL.
/// Verifies granular authorization boundaries for showroom payment deletion and invoice price overrides.
/// </summary>
public sealed class RbacPhase2dHost : IAsyncLifetime
{
    private readonly PostgresTestDatabase _database = new();
    private WebApplicationFactory<AppDbContext>? _factory;

    public HttpClient Client { get; private set; } = null!;
    public IServiceProvider Services => _factory!.Services;
    public Dictionary<string, User> Users { get; } = new();
    public const string Password = "Valid-Pass123!";

    public async Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is null) return;
        await _database.InitializeAsync();

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

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasherService>();
        var permissions = await db.Permissions.ToDictionaryAsync(p => p.Code);

        void Add(string username, UserRole role, params string[] codes)
        {
            var user = new User { FullName = username, Username = username, Role = role, IsActive = true };
            user.PasswordHash = hasher.HashPassword(user, Password);
            foreach (var code in codes)
                user.UserPermissions.Add(new UserPermission { UserId = user.Id, PermissionId = permissions[code].Id });
            db.Users.Add(user);
            Users[username] = user;
        }

        Add("owner", UserRole.Owner);
        Add("showroom.billing.manager", UserRole.Staff, "showroom.manage_billing");
        Add("showroom.payment.deleter", UserRole.Staff, "showroom.delete_payment");
        Add("invoices.draft.editor", UserRole.Staff, "invoices.edit_draft");
        Add("invoices.price.overrider", UserRole.Staff, "invoices.edit_draft", "invoices.price_override");
        Add("no.permissions", UserRole.Staff);
        await db.SaveChangesAsync();
    }

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string asUser, object? body = null)
    {
        var options = Services.GetRequiredService<IOptions<JwtOptions>>().Value;
        var user = Users[asUser];
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("isOwner", (user.Role == UserRole.Owner).ToString().ToLowerInvariant()),
        };
        var token = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(options.Issuer, options.Audience, claims,
            notBefore: DateTime.UtcNow.AddMinutes(-1), expires: DateTime.UtcNow.AddMinutes(10),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key)), SecurityAlgorithms.HmacSha256)));

        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        return await Client.SendAsync(request);
    }

    public ClaimsPrincipal CreateUserPrincipal(string asUser)
    {
        var user = Users[asUser];
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("isOwner", (user.Role == UserRole.Owner).ToString().ToLowerInvariant()),
        };
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"));
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null) await _factory.DisposeAsync();
        await _database.DisposeAsync();
    }
}

public class RbacPhase2dSecurityTests : IClassFixture<RbacPhase2dHost>
{
    private readonly RbacPhase2dHost _api;
    public RbacPhase2dSecurityTests(RbacPhase2dHost api) => _api = api;

    // ══════════════════════════════════════════════════════════════════════════
    // ITEM 5B: SHOWROOM PAYMENT DELETION GRANULAR BOUNDARY (HTTP PIPELINE)
    // ══════════════════════════════════════════════════════════════════════════

    [PostgresFact]
    public async Task Http_ShowroomPaymentDelete_WithManageBillingOnly_ReturnsForbidden403()
    {
        var targetPaymentId = Guid.NewGuid();

        // Caller has showroom.manage_billing but lacks showroom.delete_payment -> must return 403 Forbidden
        var res = await _api.SendAsync(HttpMethod.Delete, $"/api/showroom-payments/{targetPaymentId}", "showroom.billing.manager");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [PostgresFact]
    public async Task Http_ShowroomPaymentDelete_WithoutPermissions_ReturnsForbidden403()
    {
        var targetPaymentId = Guid.NewGuid();

        var res = await _api.SendAsync(HttpMethod.Delete, $"/api/showroom-payments/{targetPaymentId}", "no.permissions");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [PostgresFact]
    public async Task Http_ShowroomPaymentDelete_WithDeletePaymentPermission_IsAllowed()
    {
        var targetPaymentId = Guid.NewGuid();

        // Caller has showroom.delete_payment -> passes authorization check and reaches service layer (404 since ID doesn't exist)
        var res = await _api.SendAsync(HttpMethod.Delete, $"/api/showroom-payments/{targetPaymentId}", "showroom.payment.deleter");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [PostgresFact]
    public async Task Http_ShowroomPaymentDelete_Owner_IsAllowed()
    {
        var targetPaymentId = Guid.NewGuid();

        // Owner automatically passes authorization check
        var res = await _api.SendAsync(HttpMethod.Delete, $"/api/showroom-payments/{targetPaymentId}", "owner");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ITEM 5A: INVOICE PRICE OVERRIDE AUTHORIZATION POLICY
    // ══════════════════════════════════════════════════════════════════════════

    [PostgresFact]
    public async Task AuthorizationService_InvoicesPriceOverride_StaffWithoutPermission_IsDenied()
    {
        using var scope = _api.Services.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthorizationService>();

        var principal = _api.CreateUserPrincipal("invoices.draft.editor");
        var result = await authService.AuthorizeAsync(principal, "Permission:invoices.price_override");

        Assert.False(result.Succeeded);
    }

    [PostgresFact]
    public async Task AuthorizationService_InvoicesPriceOverride_StaffWithPermission_IsAllowed()
    {
        using var scope = _api.Services.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthorizationService>();

        var principal = _api.CreateUserPrincipal("invoices.price.overrider");
        var result = await authService.AuthorizeAsync(principal, "Permission:invoices.price_override");

        Assert.True(result.Succeeded);
    }

    [PostgresFact]
    public async Task AuthorizationService_InvoicesPriceOverride_Owner_IsAllowed()
    {
        using var scope = _api.Services.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthorizationService>();

        var principal = _api.CreateUserPrincipal("owner");
        var result = await authService.AuthorizeAsync(principal, "Permission:invoices.price_override");

        Assert.True(result.Succeeded);
    }
}
