using System.Data;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Application.Services;

public class AuthService(
    AppDbContext db,
    IPasswordHasherService passwordHasher,
    IJwtTokenService jwtTokenService,
    IAuditLogService auditLogService) : IAuthService
{
    public async Task<AuthStatusDto> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        var hasUsers = await db.Users.AnyAsync(cancellationToken);
        return new AuthStatusDto { Initialized = hasUsers };
    }

    public async Task<AuthUserDto> BootstrapOwnerAsync(BootstrapOwnerRequest request, CancellationToken cancellationToken = default)
    {
        // Concurrency-safe owner bootstrap using database transaction with Serializable isolation
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            var alreadyInitialized = await db.Users.AnyAsync(cancellationToken);
            if (alreadyInitialized)
            {
                throw new ConflictException("Application is already initialized with an Owner.");
            }

            var (isValid, errorMessage) = PasswordPolicyValidator.Validate(request.Password, request.ConfirmPassword, request.Username);
            if (!isValid)
            {
                throw new ValidationException(errorMessage ?? "Invalid password.");
            }

            if (string.IsNullOrWhiteSpace(request.FullName))
            {
                throw new ValidationException("Full name is required.");
            }

            if (string.IsNullOrWhiteSpace(request.Username))
            {
                throw new ValidationException("Username is required.");
            }

            var normalizedUsername = request.Username.Trim().ToLowerInvariant();

            var owner = new User
            {
                Id = Guid.NewGuid(),
                FullName = request.FullName.Trim(),
                Username = normalizedUsername,
                Role = UserRole.Owner,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            owner.PasswordHash = passwordHasher.HashPassword(owner, request.Password);

            await db.Users.AddAsync(owner, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);

            await auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.UserCreated,
                module: Domain.Constants.AuditModules.Users,
                description: "Initial Owner account created via bootstrap.",
                userId: owner.Id,
                userName: owner.FullName,
                userRole: owner.Role.ToString(),
                entityType: "User",
                entityId: owner.Id,
                entityReference: owner.Username,
                outcome: "Success",
                cancellationToken: cancellationToken);

            await tx.CommitAsync(cancellationToken);

            Log.Information("Initial Owner account successfully bootstrapped with username '{Username}'", owner.Username);

            return MapToAuthUserDto(owner, []);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            await auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.LoginFailed,
                module: Domain.Constants.AuditModules.Authentication,
                description: "Login attempt failed.",
                outcome: "Failure",
                cancellationToken: cancellationToken);

            throw new UnauthorizedException("Invalid username or password.");
        }

        var normalizedUsername = request.Username.Trim().ToLowerInvariant();

        var user = await db.Users
            .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == normalizedUsername, cancellationToken);

        // Security rule: reject inactive or non-existent user with generic message
        if (user == null || !user.IsActive)
        {
            Log.Warning("Login failed for username '{Username}' (user missing or inactive)", request.Username);

            await auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.LoginFailed,
                module: Domain.Constants.AuditModules.Authentication,
                description: "Login attempt failed.",
                outcome: "Failure",
                cancellationToken: cancellationToken);

            throw new UnauthorizedException("Invalid username or password.");
        }

        var isPasswordValid = passwordHasher.VerifyPassword(user, user.PasswordHash, request.Password);
        if (!isPasswordValid)
        {
            Log.Warning("Login failed for username '{Username}' (invalid password)", request.Username);

            await auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.LoginFailed,
                module: Domain.Constants.AuditModules.Authentication,
                description: "Login attempt failed.",
                outcome: "Failure",
                cancellationToken: cancellationToken);

            throw new UnauthorizedException("Invalid username or password.");
        }

        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        await auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.LoginSuccess,
            module: Domain.Constants.AuditModules.Authentication,
            description: "User signed in successfully.",
            userId: user.Id,
            userName: user.FullName,
            userRole: user.Role.ToString(),
            entityType: "User",
            entityId: user.Id,
            entityReference: user.Username,
            outcome: "Success",
            cancellationToken: cancellationToken);

        var token = jwtTokenService.GenerateToken(user);
        var permissions = user.Role == UserRole.Owner
            ? new List<string>() // Owner permissions are handled via isOwner = true
            : user.UserPermissions.Select(up => up.Permission.Code).Distinct().ToList();

        Log.Information("User '{Username}' ({Role}) logged in successfully", user.Username, user.Role);

        return new LoginResponse
        {
            Token = token,
            User = MapToAuthUserDto(user, permissions)
        };
    }

    public async Task<AuthUserDto> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await db.Users
            .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null || !user.IsActive)
        {
            throw new UnauthorizedException("User not found or inactive.");
        }

        var permissions = user.Role == UserRole.Owner
            ? new List<string>()
            : user.UserPermissions.Select(up => up.Permission.Code).Distinct().ToList();

        return MapToAuthUserDto(user, permissions);
    }

    private static AuthUserDto MapToAuthUserDto(User user, List<string> permissions)
    {
        return new AuthUserDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Username = user.Username,
            Email = user.Email,
            Role = user.Role.ToString(),
            IsOwner = user.Role == UserRole.Owner,
            Permissions = permissions
        };
    }
}
