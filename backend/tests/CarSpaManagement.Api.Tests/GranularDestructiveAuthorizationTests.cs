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

public class GranularDestructiveAuthorizationTests
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

    // ── 1. Permission Seeding Verification ───────────────────────────────────

    [Fact]
    public async Task PermissionSeeder_SeedsNewDestructivePermissions()
    {
        var (db, _) = CreateTestDatabase();

        await PermissionSeeder.SeedAsync(db);

        var seededCodes = await db.Permissions.Select(p => p.Code).ToListAsync();

        Assert.Contains("showroom.delete_payment", seededCodes);
        Assert.Contains("jobcards.delete", seededCodes);
        Assert.Contains("vehicles.delete", seededCodes);
        Assert.Contains("staff.delete", seededCodes);
        Assert.Contains("invoices.cancel", seededCodes);
        Assert.Contains("customers.delete", seededCodes);
    }

    // ── 2. Showroom Payment Deletion Boundary ────────────────────────────────

    [Fact]
    public void ShowroomPaymentsController_Delete_RequiresShowroomDeletePayment()
    {
        var method = typeof(ShowroomPaymentsController).GetMethod(nameof(ShowroomPaymentsController.Delete));
        Assert.NotNull(method);

        var attr = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>()
            .FirstOrDefault();

        Assert.NotNull(attr);
        Assert.Equal("Permission:showroom.delete_payment", attr!.Policy);
    }

    [Fact]
    public async Task Staff_WithShowroomRecordPaymentOnly_CannotDeleteShowroomPayment()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var recordPaymentPerm = await db.Permissions.FirstAsync(p => p.Code == "showroom.record_payment");

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Showroom Cashier",
            Username = "cashier1",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = staff.Id,
            PermissionId = recordPaymentPerm.Id
        });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, "Staff", isOwner: false, "showroom.record_payment");
        var requirement = new PermissionRequirement("showroom.delete_payment");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task User_WithShowroomDeletePayment_CanDeleteShowroomPayment()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var deletePaymentPerm = await db.Permissions.FirstAsync(p => p.Code == "showroom.delete_payment");

        var manager = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Showroom Manager",
            Username = "showroom_mgr",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        manager.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = manager.Id,
            PermissionId = deletePaymentPerm.Id
        });
        db.Users.Add(manager);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(manager.Id, "Manager", isOwner: false, "showroom.delete_payment");
        var requirement = new PermissionRequirement("showroom.delete_payment");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task Owner_RetainsShowroomPaymentDeletionAuthority()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var owner = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Owner User",
            Username = "owner_user",
            Role = UserRole.Owner,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(owner);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(owner.Id, "Owner", isOwner: true);
        var requirement = new PermissionRequirement("showroom.delete_payment");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    // ── 3. Job Card Deletion Boundary ────────────────────────────────────────

    [Fact]
    public void JobCardsController_Delete_RequiresJobCardsDeletePermission()
    {
        var method = typeof(JobCardsController).GetMethod(nameof(JobCardsController.Delete));
        Assert.NotNull(method);

        var attr = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>()
            .FirstOrDefault();

        Assert.NotNull(attr);
        Assert.Equal("Permission:jobcards.delete", attr!.Policy);
    }

    [Fact]
    public async Task Staff_WithJobCardsEditOnly_CannotDeleteJobCard()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var editPerm = await db.Permissions.FirstAsync(p => p.Code == "jobcards.edit");

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Service Advisor",
            Username = "advisor1",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = staff.Id,
            PermissionId = editPerm.Id
        });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, "Staff", isOwner: false, "jobcards.edit");
        var requirement = new PermissionRequirement("jobcards.delete");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task User_WithJobCardsDelete_CanDeleteJobCard()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var deletePerm = await db.Permissions.FirstAsync(p => p.Code == "jobcards.delete");

        var manager = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Workshop Manager",
            Username = "workshop_mgr",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        manager.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = manager.Id,
            PermissionId = deletePerm.Id
        });
        db.Users.Add(manager);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(manager.Id, "Manager", isOwner: false, "jobcards.delete");
        var requirement = new PermissionRequirement("jobcards.delete");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    // ── 4. Vehicle Deletion Boundary ─────────────────────────────────────────

    [Fact]
    public void VehiclesController_Delete_RequiresVehiclesDeletePermission()
    {
        var method = typeof(VehiclesController).GetMethod(nameof(VehiclesController.Delete));
        Assert.NotNull(method);

        var attr = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>()
            .FirstOrDefault();

        Assert.NotNull(attr);
        Assert.Equal("Permission:vehicles.delete", attr!.Policy);
    }

    [Fact]
    public async Task Staff_WithVehiclesEditOnly_CannotDeleteVehicle()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var editPerm = await db.Permissions.FirstAsync(p => p.Code == "vehicles.edit");

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Vehicle Desk",
            Username = "vdesk1",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = staff.Id,
            PermissionId = editPerm.Id
        });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, "Staff", isOwner: false, "vehicles.edit");
        var requirement = new PermissionRequirement("vehicles.delete");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task User_WithVehiclesDelete_CanDeleteVehicle()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var deletePerm = await db.Permissions.FirstAsync(p => p.Code == "vehicles.delete");

        var manager = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Operations Manager",
            Username = "ops_mgr",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        manager.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = manager.Id,
            PermissionId = deletePerm.Id
        });
        db.Users.Add(manager);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(manager.Id, "Manager", isOwner: false, "vehicles.delete");
        var requirement = new PermissionRequirement("vehicles.delete");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    // ── 5. Staff Deletion Boundary ───────────────────────────────────────────

    [Fact]
    public void StaffAdvancesController_DeleteStaff_RequiresStaffDeletePermission()
    {
        var method = typeof(StaffAdvancesController).GetMethod(nameof(StaffAdvancesController.DeleteStaff));
        Assert.NotNull(method);

        var attr = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), true)
            .Cast<RequirePermissionAttribute>()
            .FirstOrDefault();

        Assert.NotNull(attr);
        Assert.Equal("Permission:staff.delete", attr!.Policy);
    }

    [Fact]
    public async Task Staff_WithStaffEditOnly_CannotDeleteStaffMember()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var editPerm = await db.Permissions.FirstAsync(p => p.Code == "staff.edit");

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "HR Assistant",
            Username = "hr_asst",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = staff.Id,
            PermissionId = editPerm.Id
        });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, "Staff", isOwner: false, "staff.edit");
        var requirement = new PermissionRequirement("staff.delete");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task User_WithStaffDelete_CanDeleteStaffMember()
    {
        var (db, scopeFactory) = CreateTestDatabase();
        await PermissionSeeder.SeedAsync(db);
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var deletePerm = await db.Permissions.FirstAsync(p => p.Code == "staff.delete");

        var manager = new User
        {
            Id = Guid.NewGuid(),
            FullName = "HR Manager",
            Username = "hr_mgr",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        manager.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = manager.Id,
            PermissionId = deletePerm.Id
        });
        db.Users.Add(manager);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(manager.Id, "Manager", isOwner: false, "staff.delete");
        var requirement = new PermissionRequirement("staff.delete");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }
}
