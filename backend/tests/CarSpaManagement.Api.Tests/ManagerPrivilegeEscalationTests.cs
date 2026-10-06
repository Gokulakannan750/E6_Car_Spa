using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Phase 0 (P0-5): a Manager holding users.edit / users.deactivate must not be able to take over or lock out
/// another Manager. Existing hierarchy: Owner &gt; Manager &gt; Staff (only an Owner can create Managers).
/// </summary>
public class ManagerPrivilegeEscalationTests
{
    private const string NewPassword = "N3w-Secure!Pass2026";

    private sealed record Env(AppDbContext Db, UserService Users, RecordingAuditLogService Audit, User Owner, User ManagerA, User ManagerB, User Staff);

    private static async Task<Env> CreateAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var hasher = new PasswordHasherService();
        var audit = new RecordingAuditLogService();

        var perms = new[] { "users.view", "users.create", "users.edit", "users.deactivate" }
            .Select(c => new Permission { Id = Guid.NewGuid(), Code = c, Name = c, Module = "Users" }).ToList();
        db.Permissions.AddRange(perms);

        User Make(string username, UserRole role, bool allUserPerms)
        {
            var u = new User { Id = Guid.NewGuid(), FullName = username, Username = username, Role = role, IsActive = true };
            u.PasswordHash = hasher.HashPassword(u, "Original-Pass123!");
            if (allUserPerms)
                foreach (var p in perms) u.UserPermissions.Add(new UserPermission { Id = Guid.NewGuid(), UserId = u.Id, PermissionId = p.Id });
            db.Users.Add(u);
            return u;
        }

        var owner = Make("owner", UserRole.Owner, false);
        var managerA = Make("manager.a", UserRole.Manager, true);
        var managerB = Make("manager.b", UserRole.Manager, true);
        var staff = Make("staff.one", UserRole.Staff, false);
        await db.SaveChangesAsync();
        return new Env(db, new UserService(db, hasher, audit), audit, owner, managerA, managerB, staff);
    }

    private static UpdateUserRequest PasswordReset(User target) => new()
    {
        FullName = target.FullName,
        Email = target.Email,
        Password = NewPassword,
        ConfirmPassword = NewPassword,
    };

    private static async Task<string> HashOf(AppDbContext db, Guid id) =>
        (await db.Users.AsNoTracking().SingleAsync(u => u.Id == id)).PasswordHash;

    [Fact]
    public async Task Owner_CanResetManagerPassword_AndItIsAudited()
    {
        var env = await CreateAsync();
        var before = await HashOf(env.Db, env.ManagerB.Id);

        await env.Users.UpdateUserAsync(env.ManagerB.Id, PasswordReset(env.ManagerB), env.Owner.Id, isOwner: true);

        Assert.NotEqual(before, await HashOf(env.Db, env.ManagerB.Id));
        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.PasswordReset && e.EntityId == env.ManagerB.Id && e.Outcome == "Success");
    }

    [Fact]
    public async Task Manager_CannotResetAnotherManagersPassword()
    {
        var env = await CreateAsync();
        var before = await HashOf(env.Db, env.ManagerB.Id);

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(env.ManagerB.Id, PasswordReset(env.ManagerB), env.ManagerA.Id, isOwner: false));

        Assert.Contains("Only an Owner", ex.Message);
        Assert.Equal(before, await HashOf(env.Db, env.ManagerB.Id));
        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.UserManagementDenied && e.EntityId == env.ManagerB.Id && e.Outcome == "Denied");
    }

    [Fact]
    public async Task Manager_CannotEditAnotherManagersProfile()
    {
        var env = await CreateAsync();
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(env.ManagerB.Id, new UpdateUserRequest { FullName = "Hijacked" }, env.ManagerA.Id, isOwner: false));
        Assert.Equal("manager.b", (await env.Db.Users.AsNoTracking().SingleAsync(u => u.Id == env.ManagerB.Id)).FullName);
    }

    [Fact]
    public async Task Manager_CannotModifyOwner()
    {
        var env = await CreateAsync();
        var before = await HashOf(env.Db, env.Owner.Id);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(env.Owner.Id, PasswordReset(env.Owner), env.ManagerA.Id, isOwner: false));
        Assert.Equal(before, await HashOf(env.Db, env.Owner.Id));
    }

    [Fact]
    public async Task Manager_CannotEscalateOwnRoleOrPermissions()
    {
        var env = await CreateAsync();
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(env.ManagerA.Id, new UpdateUserRequest { FullName = "manager.a", Role = "Owner" }, env.ManagerA.Id, isOwner: false));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(env.Staff.Id, new UpdateUserRequest { FullName = "staff.one", PermissionCodes = ["users.edit"] }, env.ManagerA.Id, isOwner: false));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.CreateUserAsync(new CreateUserRequest { FullName = "x", Username = "new.manager", Password = NewPassword, ConfirmPassword = NewPassword, Role = "Manager" }, env.ManagerA.Id, isOwner: false));
    }

    [Fact]
    public async Task ForgedOwnerFlag_FromNonOwnerCaller_IsIgnored()
    {
        // Even if a caller presents isOwner=true (e.g. a stale or tampered claim), the database decides.
        var env = await CreateAsync();
        var before = await HashOf(env.Db, env.ManagerB.Id);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(env.ManagerB.Id, PasswordReset(env.ManagerB), env.ManagerA.Id, isOwner: true));
        Assert.Equal(before, await HashOf(env.Db, env.ManagerB.Id));
    }

    [Fact]
    public async Task Manager_CanStillManageStaffProfile_AndOwnProfile()
    {
        // Updated for RBAC P1-1: a Manager may still edit a Staff user's profile and their own profile and password,
        // but may no longer set a Staff user's password (see Manager_CannotResetStaffPassword).
        var env = await CreateAsync();
        var managerBefore = await HashOf(env.Db, env.ManagerA.Id);

        await env.Users.UpdateUserAsync(env.Staff.Id, new UpdateUserRequest { FullName = "Staff One Renamed" }, env.ManagerA.Id, isOwner: false);
        await env.Users.UpdateUserAsync(env.ManagerA.Id, new UpdateUserRequest { FullName = "Manager A Renamed", Password = NewPassword, ConfirmPassword = NewPassword }, env.ManagerA.Id, isOwner: false);

        Assert.Equal("Staff One Renamed", (await env.Db.Users.AsNoTracking().SingleAsync(u => u.Id == env.Staff.Id)).FullName);
        Assert.Equal("Manager A Renamed", (await env.Db.Users.AsNoTracking().SingleAsync(u => u.Id == env.ManagerA.Id)).FullName);
        Assert.NotEqual(managerBefore, await HashOf(env.Db, env.ManagerA.Id));
    }

    // ── RBAC P1-1: only the Owner may reset another user's password ─────────

    [Fact]
    public async Task Manager_CannotResetStaffPassword()
    {
        var env = await CreateAsync();
        var before = await HashOf(env.Db, env.Staff.Id);

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(env.Staff.Id, PasswordReset(env.Staff), env.ManagerA.Id, isOwner: false));

        Assert.Contains("Only the Owner can reset another user's password", ex.Message);
        Assert.Equal(before, await HashOf(env.Db, env.Staff.Id));
        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.UserManagementDenied && e.EntityId == env.Staff.Id && e.Outcome == "Denied");
        Assert.DoesNotContain(env.Audit.Entries, e => e.Action == AuditActions.PasswordReset && e.EntityId == env.Staff.Id);
    }

    [Fact]
    public async Task Manager_CannotResetStaffPassword_EvenWithAProfileChangeInTheSameRequest()
    {
        var env = await CreateAsync();
        var before = await HashOf(env.Db, env.Staff.Id);

        await Assert.ThrowsAsync<ForbiddenException>(() => env.Users.UpdateUserAsync(env.Staff.Id,
            new UpdateUserRequest { FullName = "Renamed", Password = NewPassword, ConfirmPassword = NewPassword }, env.ManagerA.Id, isOwner: false));

        var staff = await env.Db.Users.AsNoTracking().SingleAsync(u => u.Id == env.Staff.Id);
        Assert.Equal(before, staff.PasswordHash);
        Assert.Equal("staff.one", staff.FullName); // nothing in the request is applied
    }

    [Fact]
    public async Task Staff_CannotResetAnotherStaffPassword_ButCanChangeOwn()
    {
        var env = await CreateAsync();
        var otherStaff = new User { Id = Guid.NewGuid(), FullName = "staff.two", Username = "staff.two", Role = UserRole.Staff, IsActive = true };
        otherStaff.PasswordHash = new PasswordHasherService().HashPassword(otherStaff, "Original-Pass123!");
        env.Db.Users.Add(otherStaff);
        await env.Db.SaveChangesAsync();
        var otherBefore = await HashOf(env.Db, otherStaff.Id);
        var ownBefore = await HashOf(env.Db, env.Staff.Id);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(otherStaff.Id, PasswordReset(otherStaff), env.Staff.Id, isOwner: false));
        await env.Users.UpdateUserAsync(env.Staff.Id, PasswordReset(env.Staff), env.Staff.Id, isOwner: false);

        Assert.Equal(otherBefore, await HashOf(env.Db, otherStaff.Id));
        Assert.NotEqual(ownBefore, await HashOf(env.Db, env.Staff.Id));
    }

    [Fact]
    public async Task Owner_CanResetStaffPassword_AndItIsAudited()
    {
        var env = await CreateAsync();
        var before = await HashOf(env.Db, env.Staff.Id);

        await env.Users.UpdateUserAsync(env.Staff.Id, PasswordReset(env.Staff), env.Owner.Id, isOwner: true);

        Assert.NotEqual(before, await HashOf(env.Db, env.Staff.Id));
        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.PasswordReset && e.EntityId == env.Staff.Id && e.Outcome == "Success");
    }

    [Fact]
    public async Task ForgedOwnerFlag_CannotResetStaffPassword()
    {
        var env = await CreateAsync();
        var before = await HashOf(env.Db, env.Staff.Id);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.Users.UpdateUserAsync(env.Staff.Id, PasswordReset(env.Staff), env.ManagerA.Id, isOwner: true));
        Assert.Equal(before, await HashOf(env.Db, env.Staff.Id));
    }

    [Fact]
    public async Task Manager_CannotDeactivateAnotherManager_ButOwnerCan()
    {
        var env = await CreateAsync();

        await Assert.ThrowsAsync<ForbiddenException>(() => env.Users.ToggleUserStatusAsync(env.ManagerB.Id, env.ManagerA.Id));
        Assert.True((await env.Db.Users.AsNoTracking().SingleAsync(u => u.Id == env.ManagerB.Id)).IsActive);

        var result = await env.Users.ToggleUserStatusAsync(env.ManagerB.Id, env.Owner.Id);
        Assert.False(result.IsActive);
    }

    [Fact]
    public async Task Manager_CanDeactivateStaff()
    {
        var env = await CreateAsync();
        var result = await env.Users.ToggleUserStatusAsync(env.Staff.Id, env.ManagerA.Id);
        Assert.False(result.IsActive);
        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.UserDeactivated && e.EntityId == env.Staff.Id);
    }
}
