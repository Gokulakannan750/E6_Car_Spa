using System.Security.Claims;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class FinancialAndCatalogueAuthorizationTests
{
    private static (AppDbContext db, IServiceScopeFactory scopeFactory) CreateTestDatabase()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var provider = services.BuildServiceProvider();
        var scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();
        var db = provider.GetRequiredService<AppDbContext>();

        return (db, scopeFactory);
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

    // ── 1. Catalogue Permission Attributes & Enforcement ─────────────────────

    [Fact]
    public void ServicesController_Endpoints_RequireCataloguePermissions()
    {
        var getMethod = typeof(ServicesController).GetMethod(nameof(ServicesController.GetAll));
        Assert.NotNull(getMethod);
        var getAttr = getMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>().FirstOrDefault();
        Assert.NotNull(getAttr);
        Assert.Equal("Permission:catalogue.view", getAttr!.Policy);

        var createMethod = typeof(ServicesController).GetMethod(nameof(ServicesController.Create));
        Assert.NotNull(createMethod);
        var createAttr = createMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>().FirstOrDefault();
        Assert.NotNull(createAttr);
        Assert.Equal("Permission:catalogue.create", createAttr!.Policy);

        var updateMethod = typeof(ServicesController).GetMethod(nameof(ServicesController.Update));
        Assert.NotNull(updateMethod);
        var updateAttr = updateMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>().FirstOrDefault();
        Assert.NotNull(updateAttr);
        Assert.Equal("Permission:catalogue.edit", updateAttr!.Policy);

        var deleteMethod = typeof(ServicesController).GetMethod(nameof(ServicesController.Delete));
        Assert.NotNull(deleteMethod);
        var deleteAttr = deleteMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>().FirstOrDefault();
        Assert.NotNull(deleteAttr);
        Assert.Equal("Permission:catalogue.delete", deleteAttr!.Policy);
    }

    [Fact]
    public async Task Staff_WithCatalogueViewOnly_CannotCreateOrEditOrDeleteCatalogue()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var viewPerm = await db.Permissions.FirstAsync(p => p.Code == "catalogue.view");

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Service Advisor",
            Username = "advisor_cat",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission { Id = Guid.NewGuid(), UserId = staff.Id, PermissionId = viewPerm.Id });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, "Staff", isOwner: false, "catalogue.view");

        // Try create
        var createCtx = new AuthorizationHandlerContext(new[] { new PermissionRequirement("catalogue.create") }, principal, null);
        await handler.HandleAsync(createCtx);
        Assert.False(createCtx.HasSucceeded);

        // Try edit
        var editCtx = new AuthorizationHandlerContext(new[] { new PermissionRequirement("catalogue.edit") }, principal, null);
        await handler.HandleAsync(editCtx);
        Assert.False(editCtx.HasSucceeded);

        // Try delete
        var deleteCtx = new AuthorizationHandlerContext(new[] { new PermissionRequirement("catalogue.delete") }, principal, null);
        await handler.HandleAsync(deleteCtx);
        Assert.False(deleteCtx.HasSucceeded);
    }

    // ── 2. Discount Authorization (Manager vs Staff vs Owner) ─────────────────

    [Fact]
    public async Task Manager_WithInvoicesDiscount_CanApplyDiscount()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var discountPerm = await db.Permissions.FirstAsync(p => p.Code == "invoices.discount");

        var manager = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Service Manager",
            Username = "mgr_discount",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        manager.UserPermissions.Add(new UserPermission { Id = Guid.NewGuid(), UserId = manager.Id, PermissionId = discountPerm.Id });
        db.Users.Add(manager);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(manager.Id, "Manager", isOwner: false, "invoices.discount");
        var context = new AuthorizationHandlerContext(new[] { new PermissionRequirement("invoices.discount") }, principal, null);

        await handler.HandleAsync(context);
        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task Staff_WithoutInvoicesDiscount_CannotApplyDiscount()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var editDraftPerm = await db.Permissions.FirstAsync(p => p.Code == "invoices.edit_draft");

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Billing Staff",
            Username = "staff_nodiscount",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission { Id = Guid.NewGuid(), UserId = staff.Id, PermissionId = editDraftPerm.Id });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, "Staff", isOwner: false, "invoices.edit_draft");
        var context = new AuthorizationHandlerContext(new[] { new PermissionRequirement("invoices.discount") }, principal, null);

        await handler.HandleAsync(context);
        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task Owner_RetainsDiscountAuthorityAutomatically()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var owner = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Owner User",
            Username = "owner_disc",
            Role = UserRole.Owner,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(owner);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(owner.Id, "Owner", isOwner: true);
        var context = new AuthorizationHandlerContext(new[] { new PermissionRequirement("invoices.discount") }, principal, null);

        await handler.HandleAsync(context);
        Assert.True(context.HasSucceeded);
    }

    // ── 3. Payment Permission Mapping ────────────────────────────────────────

    [Fact]
    public void InvoicesController_PaymentsEndpoints_RequirePaymentPermissions()
    {
        var recordMethod = typeof(InvoicesController).GetMethod(nameof(InvoicesController.RecordPayment));
        Assert.NotNull(recordMethod);
        var recordAttr = recordMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>().FirstOrDefault();
        Assert.NotNull(recordAttr);
        Assert.Equal("Permission:payments.record", recordAttr!.Policy);

        var getPaymentsMethod = typeof(InvoicesController).GetMethod(nameof(InvoicesController.GetPayments));
        Assert.NotNull(getPaymentsMethod);
        var getPaymentsAttr = getPaymentsMethod!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>().FirstOrDefault();
        Assert.NotNull(getPaymentsAttr);
        Assert.Equal("Permission:payments.view", getPaymentsAttr!.Policy);
    }

    [Fact]
    public async Task Staff_WithPaymentsRecord_CannotVoidPayment()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var recordPerm = await db.Permissions.FirstAsync(p => p.Code == "payments.record");

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Cashier Staff",
            Username = "cashier_novoid",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission { Id = Guid.NewGuid(), UserId = staff.Id, PermissionId = recordPerm.Id });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, "Staff", isOwner: false, "payments.record");
        var context = new AuthorizationHandlerContext(new[] { new PermissionRequirement("payments.void") }, principal, null);

        await handler.HandleAsync(context);
        Assert.False(context.HasSucceeded);
    }

    // ── 4. Seeder Catalog Completeness ───────────────────────────────────────

    [Fact]
    public async Task PermissionSeeder_SeedsAllPhase3BPermissions()
    {
        var (db, _) = CreateTestDatabase();

        await PermissionSeeder.SeedAsync(db);

        var seededCodes = await db.Permissions.Select(p => p.Code).ToListAsync();

        Assert.Contains("catalogue.view", seededCodes);
        Assert.Contains("catalogue.create", seededCodes);
        Assert.Contains("catalogue.edit", seededCodes);
        Assert.Contains("catalogue.delete", seededCodes);
        Assert.Contains("invoices.discount", seededCodes);
        Assert.Contains("invoices.price_override", seededCodes);
        Assert.Contains("payments.view", seededCodes);
        Assert.Contains("payments.record", seededCodes);
        Assert.Contains("payments.edit", seededCodes);
        Assert.Contains("payments.void", seededCodes);
        Assert.Contains("staff_advances.edit", seededCodes);
        Assert.Contains("staff_advances.delete", seededCodes);
    }
}
