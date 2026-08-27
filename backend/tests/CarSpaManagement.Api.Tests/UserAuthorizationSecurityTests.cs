using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class UserAuthorizationSecurityTests
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

    private static async Task<(AppDbContext db, UserService userService, User owner, User manager, User staff, List<Permission> permissions)> CreateTestEnvironmentAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var db = new AppDbContext(options);
        var hasher = new PasswordHasherService();
        var auditService = new DummyAuditLogService();
        var userService = new UserService(db, hasher, auditService);

        // Seed standard permissions
        var permissions = new List<Permission>
        {
            new() { Id = Guid.NewGuid(), Code = "users.view", Name = "View Users", Module = "Users", CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Code = "users.create", Name = "Create Users", Module = "Users", CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Code = "users.edit", Name = "Edit Users", Module = "Users", CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Code = "users.deactivate", Name = "Deactivate Users", Module = "Users", CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Code = "settings.business", Name = "Business Settings", Module = "Settings", CreatedAt = DateTime.UtcNow },
            new() { Id = Guid.NewGuid(), Code = "reports.sales", Name = "Sales Report", Module = "Reports", CreatedAt = DateTime.UtcNow }
        };
        db.Permissions.AddRange(permissions);

        // 1. Owner user
        var owner = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Primary Owner",
            Username = "e6owner",
            Email = "owner@e6carspa.com",
            Role = UserRole.Owner,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        owner.PasswordHash = hasher.HashPassword(owner, "OwnerPassword123!");
        db.Users.Add(owner);

        // 2. Manager user with users.view and users.edit
        var manager = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Store Manager",
            Username = "e6manager",
            Email = "manager@e6carspa.com",
            Role = UserRole.Manager,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        manager.PasswordHash = hasher.HashPassword(manager, "ManagerPassword123!");
        manager.UserPermissions.Add(new UserPermission { Id = Guid.NewGuid(), UserId = manager.Id, PermissionId = permissions.First(p => p.Code == "users.view").Id });
        manager.UserPermissions.Add(new UserPermission { Id = Guid.NewGuid(), UserId = manager.Id, PermissionId = permissions.First(p => p.Code == "users.edit").Id });
        db.Users.Add(manager);

        // 3. Staff user with users.view only
        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Floor Staff",
            Username = "e6staff",
            Email = "staff@e6carspa.com",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.PasswordHash = hasher.HashPassword(staff, "StaffPassword123!");
        staff.UserPermissions.Add(new UserPermission { Id = Guid.NewGuid(), UserId = staff.Id, PermissionId = permissions.First(p => p.Code == "users.view").Id });
        db.Users.Add(staff);

        await db.SaveChangesAsync();

        return (db, userService, owner, manager, staff, permissions);
    }

    [Fact]
    public async Task Owner_CanModifyUserRoleAndPermissions_Succeeds()
    {
        var (db, userService, owner, _, staff, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = "Promoted Staff",
            Role = "Manager",
            PermissionCodes = new List<string> { "users.view", "reports.sales" }
        };

        var updated = await userService.UpdateUserAsync(staff.Id, request, currentUserId: owner.Id, isOwner: true);

        Assert.Equal("Promoted Staff", updated.FullName);
        Assert.Equal("Manager", updated.Role);
        Assert.Contains("reports.sales", updated.Permissions);
    }

    [Fact]
    public async Task Manager_CannotModifyOwnPermissions_ThrowsForbiddenException()
    {
        var (_, userService, _, manager, _, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = manager.FullName,
            Role = "Manager",
            PermissionCodes = new List<string> { "users.view", "users.edit", "settings.business", "reports.sales" }
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(manager.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can assign or modify user permissions", ex.Message);
    }

    [Fact]
    public async Task Manager_CannotChangeOwnRole_ThrowsForbiddenException()
    {
        var (_, userService, _, manager, _, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = manager.FullName,
            Role = "Owner"
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(manager.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can change user roles", ex.Message);
    }

    [Fact]
    public async Task Staff_CannotModifyOwnPermissions_ThrowsForbiddenException()
    {
        var (_, userService, _, _, staff, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = staff.FullName,
            Role = "Staff",
            PermissionCodes = new List<string> { "users.view", "settings.business" }
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(staff.Id, request, currentUserId: staff.Id, isOwner: false));

        Assert.Contains("Only an Owner can assign or modify user permissions", ex.Message);
    }

    [Fact]
    public async Task NonOwner_CannotAssignArbitraryPermissionsToAnotherUser_ThrowsForbiddenException()
    {
        var (_, userService, _, manager, staff, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = staff.FullName,
            Role = "Staff",
            PermissionCodes = new List<string> { "settings.business", "reports.sales" }
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(staff.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can assign or modify user permissions", ex.Message);
    }

    [Fact]
    public async Task NonOwner_CannotChangeAnotherUsersRole_ThrowsForbiddenException()
    {
        var (_, userService, _, manager, staff, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = staff.FullName,
            Role = "Manager"
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(staff.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can change user roles", ex.Message);
    }

    [Fact]
    public async Task NonOwner_CannotChangeOwnerPassword_ThrowsForbiddenException()
    {
        var (db, userService, owner, manager, _, _) = await CreateTestEnvironmentAsync();
        var originalOwnerHash = owner.PasswordHash;

        var request = new UpdateUserRequest
        {
            FullName = owner.FullName,
            Role = "Owner",
            Password = "HackedPassword123!",
            ConfirmPassword = "HackedPassword123!"
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(owner.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can modify an Owner account", ex.Message);

        var refreshedOwner = await db.Users.FirstAsync(u => u.Id == owner.Id);
        Assert.Equal(originalOwnerHash, refreshedOwner.PasswordHash);
    }

    [Fact]
    public async Task NonOwner_CannotChangeOwnerEmail_ThrowsForbiddenException()
    {
        var (db, userService, owner, manager, _, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = owner.FullName,
            Email = "attacker@evil.com"
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(owner.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can modify an Owner account", ex.Message);

        var refreshedOwner = await db.Users.FirstAsync(u => u.Id == owner.Id);
        Assert.Equal("owner@e6carspa.com", refreshedOwner.Email);
    }

    [Fact]
    public async Task NonOwner_CannotChangeOwnerFullName_ThrowsForbiddenException()
    {
        var (db, userService, owner, manager, _, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = "Tampered Owner Name"
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(owner.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can modify an Owner account", ex.Message);

        var refreshedOwner = await db.Users.FirstAsync(u => u.Id == owner.Id);
        Assert.Equal("Primary Owner", refreshedOwner.FullName);
    }

    [Fact]
    public async Task NonOwner_CannotChangeOwnerRole_ThrowsForbiddenException()
    {
        var (_, userService, owner, manager, _, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = owner.FullName,
            Role = "Staff"
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(owner.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can modify an Owner account", ex.Message);
    }

    [Fact]
    public async Task NonOwner_CannotChangeOwnerPermissions_ThrowsForbiddenException()
    {
        var (_, userService, owner, manager, _, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = owner.FullName,
            PermissionCodes = new List<string> { "users.view" }
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(owner.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can modify an Owner account", ex.Message);
    }

    [Fact]
    public async Task LegitimateNonSecurityProfileUpdate_ByNonOwner_Succeeds()
    {
        var (db, userService, _, manager, staff, _) = await CreateTestEnvironmentAsync();

        // Manager updating staff's name and email without touching role or permissions
        var request = new UpdateUserRequest
        {
            FullName = "Updated Staff Full Name",
            Email = "staff_new@e6carspa.com"
        };

        var updated = await userService.UpdateUserAsync(staff.Id, request, currentUserId: manager.Id, isOwner: false);

        Assert.Equal("Updated Staff Full Name", updated.FullName);
        Assert.Equal("staff_new@e6carspa.com", updated.Email);

        var inDb = await db.Users.FirstAsync(u => u.Id == staff.Id);
        Assert.Equal("Updated Staff Full Name", inDb.FullName);
        Assert.Equal("staff_new@e6carspa.com", inDb.Email);
    }

    [Fact]
    public async Task ForgedRoleOrPermissionsInRequest_FromNonOwner_IsRejected()
    {
        var (_, userService, _, manager, staff, _) = await CreateTestEnvironmentAsync();

        // Non-owner attempts to inject role = Manager and permission = settings.business
        var request = new UpdateUserRequest
        {
            FullName = staff.FullName,
            Role = "Manager",
            PermissionCodes = new List<string> { "users.view", "settings.business" }
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(staff.Id, request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner", ex.Message);
    }

    [Fact]
    public async Task Owner_CanUpdateOwnProfile_Succeeds()
    {
        var (db, userService, owner, _, _, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = "Renamed Primary Owner",
            Email = "owner_new@e6carspa.com",
            Role = "Owner"
        };

        var updated = await userService.UpdateUserAsync(owner.Id, request, currentUserId: owner.Id, isOwner: true);

        Assert.Equal("Renamed Primary Owner", updated.FullName);
        Assert.Equal("owner_new@e6carspa.com", updated.Email);

        var inDb = await db.Users.FirstAsync(u => u.Id == owner.Id);
        Assert.Equal("Renamed Primary Owner", inDb.FullName);
    }

    [Fact]
    public async Task Owner_CannotDowngradeOwnRoleAwayFromOwner_ThrowsValidationException()
    {
        var (_, userService, owner, _, _, _) = await CreateTestEnvironmentAsync();

        var request = new UpdateUserRequest
        {
            FullName = owner.FullName,
            Role = "Staff"
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            userService.UpdateUserAsync(owner.Id, request, currentUserId: owner.Id, isOwner: true));

        Assert.Contains("Owner role cannot be changed", ex.Message);
    }

    [Fact]
    public async Task NonOwner_CannotCreateManagerAccount_ThrowsForbiddenException()
    {
        var (_, userService, _, manager, _, _) = await CreateTestEnvironmentAsync();

        var request = new CreateUserRequest
        {
            FullName = "New Manager",
            Username = "newmanager",
            Role = "Manager",
            Password = "Password123!",
            ConfirmPassword = "Password123!"
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.CreateUserAsync(request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can create Manager accounts", ex.Message);
    }

    [Fact]
    public async Task NonOwner_CannotAssignPermissionsToNewUser_ThrowsForbiddenException()
    {
        var (_, userService, _, manager, _, _) = await CreateTestEnvironmentAsync();

        var request = new CreateUserRequest
        {
            FullName = "New Staff",
            Username = "newstaff",
            Role = "Staff",
            Password = "Password123!",
            ConfirmPassword = "Password123!",
            PermissionCodes = new List<string> { "settings.business" }
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.CreateUserAsync(request, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can assign permissions", ex.Message);
    }

    // ── Security Regression Tests ───────────────────────────────────────────

    [Fact]
    public async Task Regression_AttackScenario1_ManagerCannotSelfEscalatePermissions()
    {
        // Attack Scenario 1:
        // Login as Manager -> obtain own user ID -> PUT /api/Users/{own-id} with ALL permissions
        var (db, userService, _, manager, _, permissions) = await CreateTestEnvironmentAsync();

        var allPermissionCodes = permissions.Select(p => p.Code).ToList();
        var initialManagerPermissions = await db.UserPermissions
            .Where(up => up.UserId == manager.Id)
            .Select(up => up.Permission.Code)
            .ToListAsync();

        var attackRequest = new UpdateUserRequest
        {
            FullName = manager.FullName,
            Role = "Manager",
            PermissionCodes = allPermissionCodes // Attacker attempts to grant themselves all permissions
        };

        // Execution must fail with ForbiddenException (HTTP 403)
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(manager.Id, attackRequest, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can assign or modify user permissions", ex.Message);

        // Verification: Manager permissions in database MUST remain exactly the original permissions
        var remainingPermissions = await db.UserPermissions
            .Where(up => up.UserId == manager.Id)
            .Select(up => up.Permission.Code)
            .ToListAsync();

        Assert.Equal(initialManagerPermissions.OrderBy(x => x), remainingPermissions.OrderBy(x => x));
        Assert.DoesNotContain("settings.business", remainingPermissions);
        Assert.DoesNotContain("reports.sales", remainingPermissions);
    }

    [Fact]
    public async Task Regression_AttackScenario2_ManagerCannotTakeOverOwnerAccount()
    {
        // Attack Scenario 2:
        // Login as Manager -> PUT /api/Users/{owner-id} with password = attacker_password
        var (db, userService, owner, manager, _, _) = await CreateTestEnvironmentAsync();
        var hasher = new PasswordHasherService();

        var originalPasswordHash = owner.PasswordHash;

        var attackRequest = new UpdateUserRequest
        {
            FullName = "Hacked Owner",
            Password = "AttackerPassword123!",
            ConfirmPassword = "AttackerPassword123!"
        };

        // Execution must fail with ForbiddenException (HTTP 403)
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            userService.UpdateUserAsync(owner.Id, attackRequest, currentUserId: manager.Id, isOwner: false));

        Assert.Contains("Only an Owner can modify an Owner account", ex.Message);

        // Verification: Owner password hash in database MUST remain unchanged
        var refreshedOwner = await db.Users.FirstAsync(u => u.Id == owner.Id);
        Assert.Equal(originalPasswordHash, refreshedOwner.PasswordHash);
        Assert.Equal("Primary Owner", refreshedOwner.FullName);

        // Verify old owner password still verifies
        var verified = hasher.VerifyPassword(refreshedOwner, refreshedOwner.PasswordHash, "OwnerPassword123!");
        Assert.True(verified);

        // Verify attacker password fails
        var attackVerified = hasher.VerifyPassword(refreshedOwner, refreshedOwner.PasswordHash, "AttackerPassword123!");
        Assert.False(attackVerified);
    }
}
