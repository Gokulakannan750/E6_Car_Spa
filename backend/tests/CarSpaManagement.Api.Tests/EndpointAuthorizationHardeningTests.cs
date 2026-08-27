using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.Services;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class EndpointAuthorizationHardeningTests
{
    private class DummyAuditLogService : IAuditLogService
    {
        public Task RecordAsync(
            string action,
            string module,
            string description,
            Guid? userId = null,
            string? userName = null,
            string? userRole = null,
            string? entityType = null,
            Guid? entityId = null,
            string? entityReference = null,
            string? oldValues = null,
            string? newValues = null,
            string? metadata = null,
            string outcome = "Success",
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(
            AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
        }
    }

    private class DummyWhatsAppService : IWhatsAppService
    {
        public Task<WhatsAppConfigResponse> GetConfigurationAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<WhatsAppConfigResponse> UpdateConfigurationAsync(UpdateWhatsAppConfigRequest request, Guid? userId = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<TestWhatsAppConnectionResponse> TestConnectionAsync(TestWhatsAppConnectionRequest? request = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<WhatsAppMessage?> QueueInvoiceFinalizedNotificationAsync(Guid invoiceId, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default) => Task.FromResult<WhatsAppMessage?>(null);
        public Task<WhatsAppMessage?> QueuePaymentCompletedNotificationAsync(Guid invoiceId, decimal paymentReceived, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default) => Task.FromResult<WhatsAppMessage?>(null);
        public Task<bool> ProcessMessageAsync(Guid messageId, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task ProcessPendingMessagesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<InvoiceWhatsAppStatusDto>> GetInvoiceWhatsAppStatusAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<InvoiceWhatsAppStatusDto>>(new List<InvoiceWhatsAppStatusDto>());
        public string? NormalizePhoneNumber(string? phone) => phone;
    }

    private static (AppDbContext db, IServiceScopeFactory scopeFactory, IInvoiceService invoiceService) CreateTestEnvironment()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var provider = services.BuildServiceProvider();
        var scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();
        var db = provider.GetRequiredService<AppDbContext>();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PublicInvoiceBaseUrl"] = "http://localhost:5173"
            })
            .Build();

        var httpContextAccessor = new HttpContextAccessor();
        var invoiceService = new InvoiceService(db, new DummyAuditLogService(), config, httpContextAccessor, new DummyWhatsAppService(), scopeFactory);

        return (db, scopeFactory, invoiceService);
    }

    private static ClaimsPrincipal CreatePrincipal(Guid userId, string role, bool isOwner, params string[] permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("sub", userId.ToString()),
            new(ClaimTypes.Role, role),
            new("role", role),
            new("isOwner", isOwner ? "true" : "false")
        };

        foreach (var p in permissions)
        {
            claims.Add(new Claim("permission", p));
        }

        var identity = new ClaimsIdentity(claims, "TestAuthType");
        return new ClaimsPrincipal(identity);
    }

    // ── P1-1: Services Catalogue API Protection ─────────────────────────────

    [Fact]
    public void ServicesController_HasClassLevelAuthorizeAttribute()
    {
        var attributes = typeof(ServicesController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        Assert.NotEmpty(attributes);
    }

    [Fact]
    public async Task ServicesController_GetAll_ReturnsServicesForAuthenticatedUser()
    {
        var (db, _, _) = CreateTestEnvironment();
        var serviceService = new ServiceService(db);
        var controller = new ServicesController(serviceService);

        db.Services.Add(new Service
        {
            Id = Guid.NewGuid(),
            Name = "Premium Foam Wash",
            Category = "Washing",
            Price = 500,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var result = await controller.GetAll();
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ServiceListResponse>(okResult.Value);
        Assert.Single(response.Items);
        Assert.Equal("Premium Foam Wash", response.Items[0].Name);
    }

    // ── P1-2: Showroom Payment Deletion Protection ──────────────────────────

    [Fact]
    public void ShowroomPaymentsController_Delete_RequiresShowroomManagePermission()
    {
        var deleteMethod = typeof(ShowroomPaymentsController).GetMethod(nameof(ShowroomPaymentsController.Delete));
        Assert.NotNull(deleteMethod);

        var requirePermAttr = deleteMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), inherit: true)
            .Cast<RequirePermissionAttribute>()
            .FirstOrDefault();

        Assert.NotNull(requirePermAttr);
        // Must require showroom.manage, NOT showroom.record_payment
        Assert.Equal("Permission:showroom.manage", requirePermAttr!.Policy);
    }

    [Fact]
    public void ShowroomPaymentsController_HasClassLevelAuthorizeAttribute()
    {
        var attributes = typeof(ShowroomPaymentsController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        Assert.NotEmpty(attributes);
    }

    // ── P1-3: Attendance Unlock Protection ──────────────────────────────────

    [Fact]
    public void ShowroomsController_UnlockAttendance_HasAuthorizeAttribute()
    {
        var unlockMethod = typeof(ShowroomsController).GetMethod(nameof(ShowroomsController.UnlockAttendance));
        Assert.NotNull(unlockMethod);

        var authAttrs = unlockMethod!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        Assert.NotEmpty(authAttrs);
    }

    [Fact]
    public void ShowroomsController_HasClassLevelAuthorizeAttribute()
    {
        var attributes = typeof(ShowroomsController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        Assert.NotEmpty(attributes);
    }

    // ── P1-4: Public Invoice Token & Link Protection ────────────────────────

    [Fact]
    public async Task PublicInvoices_GetWithValidToken_ReturnsPublicInvoice()
    {
        var (db, _, invoiceService) = CreateTestEnvironment();
        var controller = new PublicInvoicesController(invoiceService);

        var customer = new Customer { Id = Guid.NewGuid(), Name = "John Doe", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), RegistrationNumber = "TN01AB1234", CustomerId = customer.Id };
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-2026-0001",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Customer = customer,
            Vehicle = vehicle,
            Status = InvoiceStatus.Paid,
            TotalAmount = 1000,
            PaidAmount = 1000,
            BalanceAmount = 0,
            CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.Invoices.Add(invoice);

        // Generate raw 64-hex token and store sha256 hash
        var rawToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        var tokenHash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken.ToLowerInvariant()));
        var tokenHashHex = Convert.ToHexString(tokenHash).ToLowerInvariant();

        db.InvoicePublicLinks.Add(new InvoicePublicLink
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            TokenHash = tokenHashHex,
            IsRevoked = false,
            CreatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await controller.GetPublicInvoice(rawToken, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<PublicInvoiceDto>(okResult.Value);
        Assert.Equal("INV-2026-0001", dto.InvoiceNumber);
        Assert.Equal("John Doe", dto.Customer.CustomerName);
    }

    [Theory]
    [InlineData("invalid_short_token")]
    [InlineData("non_hex_token_that_is_64_characters_long_01234567890123456789012345zz")]
    [InlineData("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")] // non-existent
    public async Task PublicInvoices_GetWithInvalidOrUnknownToken_ReturnsNotFound(string invalidToken)
    {
        var (_, _, invoiceService) = CreateTestEnvironment();
        var controller = new PublicInvoicesController(invoiceService);

        var result = await controller.GetPublicInvoice(invalidToken, CancellationToken.None);
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public void InvoicesController_PublicLinkMutations_RequireInvoicesGeneratePermission()
    {
        var createLinkMethod = typeof(InvoicesController).GetMethod(nameof(InvoicesController.CreatePublicLink));
        var revokeLinkMethod = typeof(InvoicesController).GetMethod(nameof(InvoicesController.RevokePublicLink));
        var rotateLinkMethod = typeof(InvoicesController).GetMethod(nameof(InvoicesController.RotatePublicLink));

        Assert.NotNull(createLinkMethod);
        Assert.NotNull(revokeLinkMethod);
        Assert.NotNull(rotateLinkMethod);

        var createAttr = createLinkMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true).Cast<RequirePermissionAttribute>().First();
        var revokeAttr = revokeLinkMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true).Cast<RequirePermissionAttribute>().First();
        var rotateAttr = rotateLinkMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true).Cast<RequirePermissionAttribute>().First();

        Assert.Equal("Permission:invoices.generate", createAttr.Policy);
        Assert.Equal("Permission:invoices.generate", revokeAttr.Policy);
        Assert.Equal("Permission:invoices.generate", rotateAttr.Policy);
    }

    // ── P2-1: Owner Deactivation & JWT Staleness ─────────────────────────────

    [Fact]
    public async Task DeactivatedOwner_WithValidOwnerJwt_IsDeniedImmediately()
    {
        var (db, scopeFactory, _) = CreateTestEnvironment();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var owner = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Deactivated Owner",
            Username = "inactive_owner",
            Role = UserRole.Owner,
            IsActive = false, // Deactivated in database!
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(owner);
        await db.SaveChangesAsync();

        // Caller presents an active Owner JWT
        var principal = CreatePrincipal(owner.Id, role: "Owner", isOwner: true);
        var requirement = new PermissionRequirement("settings.business");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        // Requirement must NOT be succeeded because the user is inactive in database
        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task ActiveOwner_WithOwnerJwt_SucceedsBypass()
    {
        var (db, scopeFactory, _) = CreateTestEnvironment();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var owner = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Active Owner",
            Username = "active_owner",
            Role = UserRole.Owner,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(owner);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(owner.Id, role: "Owner", isOwner: true);
        var requirement = new PermissionRequirement("settings.business");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task ActiveStaff_WithAssignedPermission_Succeeds()
    {
        var (db, scopeFactory, _) = CreateTestEnvironment();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var permission = new Permission
        {
            Id = Guid.NewGuid(),
            Code = "customers.view",
            Name = "View Customers",
            Module = "Customers"
        };
        db.Permissions.Add(permission);

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Staff Member",
            Username = "staff_member",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = staff.Id,
            PermissionId = permission.Id
        });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, role: "Staff", isOwner: false);
        var requirement = new PermissionRequirement("customers.view");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task ActiveStaff_WithoutAssignedPermission_IsDenied()
    {
        var (db, scopeFactory, _) = CreateTestEnvironment();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Staff Member",
            Username = "staff_member2",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, role: "Staff", isOwner: false);
        var requirement = new PermissionRequirement("reports.sales");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }
}
