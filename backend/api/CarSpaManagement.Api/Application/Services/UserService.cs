using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Application.Services;

public class UserService(
    AppDbContext db,
    IPasswordHasherService passwordHasher,
    IAuditLogService auditLogService) : IUserService
{
    public async Task<List<UserDto>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        var users = await db.Users
            .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission)
            .OrderBy(u => u.Role)
            .ThenBy(u => u.FullName)
            .ToListAsync(cancellationToken);

        return users.Select(MapToUserDto).ToList();
    }

    public async Task<UserDto> GetUserByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await db.Users
            .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException($"User with ID '{id}' was not found.");
        }

        return MapToUserDto(user);
    }

    public async Task<UserDto> CreateUserAsync(CreateUserRequest request, Guid currentUserId, bool isOwner, CancellationToken cancellationToken = default)
    {
        // 1. Role validation - only Manager and Staff can be created here
        if (!Enum.TryParse<UserRole>(request.Role, true, out var role) || role == UserRole.Owner)
        {
            throw new ValidationException("Invalid role. Only 'Manager' and 'Staff' accounts can be created.");
        }

        // 2. Hierarchy validation: Only Owner may assign permissions or create Manager accounts
        if (!isOwner)
        {
            if (role == UserRole.Manager)
            {
                throw new ForbiddenException("Only an Owner can create Manager accounts.");
            }

            if (request.PermissionCodes != null && request.PermissionCodes.Count > 0)
            {
                throw new ForbiddenException("Only an Owner can assign permissions to user accounts.");
            }
        }

        // 3. Validate unique username
        var normalizedUsername = request.Username.Trim().ToLowerInvariant();
        var existingUser = await db.Users.AnyAsync(u => u.Username.ToLower() == normalizedUsername, cancellationToken);
        if (existingUser)
        {
            throw new ConflictException($"A user with username '{request.Username}' already exists.");
        }

        // 4. Validate password policy
        var (isValid, errorMessage) = PasswordPolicyValidator.Validate(request.Password, request.ConfirmPassword, request.Username);
        if (!isValid)
        {
            throw new ValidationException(errorMessage ?? "Invalid password.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName.Trim(),
            Username = normalizedUsername,
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        // 5. Assign permissions (Only allowed when isOwner == true)
        if (isOwner && request.PermissionCodes != null && request.PermissionCodes.Count > 0)
        {
            var validPermissions = await db.Permissions
                .Where(p => request.PermissionCodes.Contains(p.Code))
                .ToListAsync(cancellationToken);

            foreach (var permission in validPermissions)
            {
                user.UserPermissions.Add(new UserPermission
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    PermissionId = permission.Id,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await db.Users.AddAsync(user, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        await auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.UserCreated,
            module: Domain.Constants.AuditModules.Users,
            description: $"User account '{user.Username}' with role '{user.Role}' created.",
            entityType: "User",
            entityId: user.Id,
            entityReference: user.Username,
            newValues: System.Text.Json.JsonSerializer.Serialize(new { role = user.Role.ToString(), fullName = user.FullName, permissions = request.PermissionCodes }),
            outcome: "Success",
            cancellationToken: cancellationToken);

        Log.Information("User '{Username}' with role {Role} created successfully", user.Username, user.Role);

        return await GetUserByIdAsync(user.Id, cancellationToken);
    }

    public async Task<UserDto> UpdateUserAsync(Guid id, UpdateUserRequest request, Guid currentUserId, bool isOwner, CancellationToken cancellationToken = default)
    {
        var user = await db.Users
            .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException($"User with ID '{id}' was not found.");
        }

        // P0-2: Protect Owner Account from Non-Owners
        if (user.Role == UserRole.Owner && !isOwner)
        {
            throw new ForbiddenException("Only an Owner can modify an Owner account.");
        }

        // P0-1: Non-Owner cannot change any user's role or permissions (including self)
        if (!isOwner)
        {
            // Verify role is not being modified
            if (!string.IsNullOrWhiteSpace(request.Role) && !request.Role.Equals(user.Role.ToString(), StringComparison.OrdinalIgnoreCase))
            {
                throw new ForbiddenException("Only an Owner can change user roles.");
            }

            // Verify permissions are not being modified
            if (request.PermissionCodes != null)
            {
                var currentPermissionCodes = user.UserPermissions
                    .Select(up => up.Permission.Code)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var requestedPermissionCodes = request.PermissionCodes
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                if (!currentPermissionCodes.SetEquals(requestedPermissionCodes))
                {
                    throw new ForbiddenException("Only an Owner can assign or modify user permissions.");
                }
            }
        }

        var oldRole = user.Role.ToString();
        var oldFullName = user.FullName;
        var oldPermissions = user.UserPermissions.Select(up => up.Permission?.Code).Where(c => c != null).ToList();

        // Update FullName and Email
        user.FullName = request.FullName.Trim();
        user.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();

        // Role update logic (Only reaches here if caller is Owner, or if non-Owner provided matching role)
        if (isOwner && !string.IsNullOrWhiteSpace(request.Role))
        {
            if (user.Role == UserRole.Owner)
            {
                // Owner cannot change their role away from Owner
                if (!request.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase))
                {
                    throw new ValidationException("Owner role cannot be changed.");
                }
            }
            else
            {
                if (!Enum.TryParse<UserRole>(request.Role, true, out var newRole) || newRole == UserRole.Owner)
                {
                    throw new ValidationException("Invalid role. Role can only be 'Manager' or 'Staff'.");
                }
                user.Role = newRole;
            }
        }

        // Password update
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            var (isValid, errorMessage) = PasswordPolicyValidator.Validate(request.Password, request.ConfirmPassword, user.Username);
            if (!isValid)
            {
                throw new ValidationException(errorMessage ?? "Invalid password.");
            }

            user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
            Log.Information("Password updated for user '{Username}'", user.Username);
        }

        var isPermissionChange = false;
        // Permission updates (Only allowed for Owner editing Manager/Staff; Owner permissions are not managed in DB)
        if (isOwner && user.Role != UserRole.Owner && request.PermissionCodes != null)
        {
            isPermissionChange = true;
            // Remove existing permissions
            db.UserPermissions.RemoveRange(user.UserPermissions);

            // Add new permissions
            var validPermissions = await db.Permissions
                .Where(p => request.PermissionCodes.Contains(p.Code))
                .ToListAsync(cancellationToken);

            foreach (var permission in validPermissions)
            {
                user.UserPermissions.Add(new UserPermission
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    PermissionId = permission.Id,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        if (isPermissionChange)
        {
            await auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.PermissionChanged,
                module: Domain.Constants.AuditModules.Users,
                description: $"Permissions updated for user '{user.Username}'.",
                entityType: "User",
                entityId: user.Id,
                entityReference: user.Username,
                oldValues: System.Text.Json.JsonSerializer.Serialize(new { permissions = oldPermissions }),
                newValues: System.Text.Json.JsonSerializer.Serialize(new { permissions = request.PermissionCodes }),
                outcome: "Success",
                cancellationToken: cancellationToken);
        }
        else
        {
            await auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.Update,
                module: Domain.Constants.AuditModules.Users,
                description: $"User profile '{user.Username}' updated.",
                entityType: "User",
                entityId: user.Id,
                entityReference: user.Username,
                oldValues: System.Text.Json.JsonSerializer.Serialize(new { role = oldRole, fullName = oldFullName }),
                newValues: System.Text.Json.JsonSerializer.Serialize(new { role = user.Role.ToString(), fullName = user.FullName }),
                outcome: "Success",
                cancellationToken: cancellationToken);
        }

        Log.Information("User '{Username}' updated successfully", user.Username);

        return await GetUserByIdAsync(user.Id, cancellationToken);
    }

    public async Task<UserDto> ToggleUserStatusAsync(Guid id, Guid currentUserId, CancellationToken cancellationToken = default)
    {
        var user = await db.Users
            .Include(u => u.UserPermissions)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException($"User with ID '{id}' was not found.");
        }

        if (user.Role == UserRole.Owner)
        {
            throw new ValidationException("Owner account cannot be deactivated.");
        }

        if (user.Id == currentUserId)
        {
            throw new ValidationException("You cannot deactivate your own account.");
        }

        user.IsActive = !user.IsActive;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var toggleAction = user.IsActive ? Domain.Constants.AuditActions.UserActivated : Domain.Constants.AuditActions.UserDeactivated;
        await auditLogService.RecordAsync(
            action: toggleAction,
            module: Domain.Constants.AuditModules.Users,
            description: $"User '{user.Username}' was {(user.IsActive ? "activated" : "deactivated")}.",
            entityType: "User",
            entityId: user.Id,
            entityReference: user.Username,
            newValues: System.Text.Json.JsonSerializer.Serialize(new { isActive = user.IsActive }),
            outcome: "Success",
            cancellationToken: cancellationToken);

        Log.Information("User '{Username}' status toggled to {Status}", user.Username, user.IsActive ? "Active" : "Inactive");

        return await GetUserByIdAsync(user.Id, cancellationToken);
    }

    public async Task<List<PermissionGroupDto>> GetAvailablePermissionsAsync(CancellationToken cancellationToken = default)
    {
        var permissions = await db.Permissions
            .OrderBy(p => p.Module)
            .ThenBy(p => p.Name)
            .ToListAsync(cancellationToken);

        var groups = permissions
            .GroupBy(p => p.Module)
            .Select(g => new PermissionGroupDto
            {
                Module = g.Key,
                Permissions = g.Select(p => new PermissionDto
                {
                    Id = p.Id,
                    Code = p.Code,
                    Name = p.Name,
                    Module = p.Module,
                    Description = p.Description
                }).ToList()
            })
            .ToList();

        return groups;
    }

    private static UserDto MapToUserDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Username = user.Username,
            Email = user.Email,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            LastLoginAt = user.LastLoginAt,
            CreatedAt = user.CreatedAt,
            Permissions = user.UserPermissions.Select(up => up.Permission.Code).Distinct().ToList()
        };
    }
}
