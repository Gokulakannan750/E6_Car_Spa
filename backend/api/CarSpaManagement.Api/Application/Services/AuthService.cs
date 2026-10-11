using System.Data;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Application.Services;

public class AuthService(
    AppDbContext db,
    IPasswordHasherService passwordHasher,
    IJwtTokenService jwtTokenService,
    IAuditLogService auditLogService,
    IAccountLockoutService accountLockoutService,
    TenantContext? tenantContext = null,
    OrganizationProvisioner? provisioner = null) : IAuthService
{
    public async Task<AuthStatusDto> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        // "Initialized" means the server already has a company; the company list itself is not company-owned data.
        var initialized = await db.Organizations.AnyAsync(cancellationToken) || await db.Users.AnyAsync(cancellationToken);
        return new AuthStatusDto { Initialized = initialized };
    }

    /// <summary>
    /// Finds the company a sign-in is for. A code is always accepted; with no code, sign-in works only while the
    /// server has exactly one company. Unknown or inactive companies get the same answer as a wrong password, so
    /// codes can't be probed.
    /// </summary>
    private async Task<Organization?> ResolveOrganizationAsync(string? companyCode, CancellationToken cancellationToken)
    {
        if (tenantContext is null)
        {
            return null; // single-company callers (older tools and tests) run in the default company
        }

        var code = companyCode?.Trim().ToUpperInvariant();
        var organization = await OrganizationLookup.FindActiveAsync(db, companyCode, cancellationToken);

        if (organization is null)
        {
            Log.Warning("Login rejected: company code '{CompanyCode}' is missing, unknown or inactive", companyCode);
            throw new UnauthorizedException(string.IsNullOrEmpty(code)
                ? "Company code is required."
                : "Invalid company code, username or password.");
        }

        tenantContext.Set(organization.Id);
        return organization;
    }

    public async Task<BootstrapOwnerResponse> BootstrapOwnerAsync(BootstrapOwnerRequest request, CancellationToken cancellationToken = default)
    {
        // Concurrency-safe owner bootstrap using database transaction with Serializable isolation
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            var alreadyInitialized = await db.Organizations.AnyAsync(cancellationToken) || await db.Users.AnyAsync(cancellationToken);
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

            // First-time setup creates the first company and its Owner. The first company always has the well-known
            // default id (and code "0001"); later companies are created by the platform, not by this endpoint.
            var organization = new Organization
            {
                Id = DefaultOrganization.Id,
                Code = DefaultOrganization.Code,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            db.Organizations.Add(organization);
            tenantContext?.Set(organization.Id);

            var owner = new User
            {
                Id = Guid.NewGuid(),
                OrganizationId = organization.Id,
                FullName = request.FullName.Trim(),
                Username = normalizedUsername,
                Role = UserRole.Owner,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            owner.PasswordHash = passwordHasher.HashPassword(owner, request.Password);

            await db.Users.AddAsync(owner, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);

            // A new company starts with its business profile, preferences and standard lists in place.
            if (provisioner is not null)
            {
                await provisioner.SeedDefaultsAsync(includeDevelopmentDemoData: false, cancellationToken);
            }

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

            var dto = MapToAuthUserDto(owner, []);
            return new BootstrapOwnerResponse
            {
                Id = dto.Id,
                FullName = dto.FullName,
                Username = dto.Username,
                Email = dto.Email,
                Role = dto.Role,
                IsOwner = dto.IsOwner,
                Permissions = dto.Permissions,
                CompanyCode = organization.Code
            };
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var organization = await ResolveOrganizationAsync(request.CompanyCode, cancellationToken);
        var companyCode = organization?.Code ?? DefaultOrganization.Code;

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

        // Failed attempts are counted per company, so one company's lockouts never affect another's users.
        var lockoutKey = AccountLockoutKey.For(companyCode, normalizedUsername);

        // 1. Account Lockout Check
        var (isLocked, remainingSeconds) = accountLockoutService.CheckLockout(lockoutKey);
        if (isLocked)
        {
            Log.Warning("Login rejected for username '{Username}' (account temporarily locked, {RemainingSeconds}s remaining)", request.Username, remainingSeconds);

            await auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.LoginFailed,
                module: Domain.Constants.AuditModules.Authentication,
                description: $"Login rejected for locked account. Remaining lockout: {remainingSeconds}s.",
                outcome: "Failure",
                cancellationToken: cancellationToken);

            throw new AccountLockedException("Too many failed login attempts. Please try again later.", remainingSeconds);
        }

        var user = await db.Users
            .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == normalizedUsername, cancellationToken);

        // Security rule: reject inactive or non-existent user with generic message & track failure
        if (user == null || !user.IsActive)
        {
            Log.Warning("Login failed for username '{Username}' (user missing or inactive)", request.Username);

            await auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.LoginFailed,
                module: Domain.Constants.AuditModules.Authentication,
                description: "Login attempt failed.",
                outcome: "Failure",
                cancellationToken: cancellationToken);

            var (newlyLocked, lockRemaining) = accountLockoutService.RecordFailedAttempt(lockoutKey);
            if (newlyLocked)
            {
                throw new AccountLockedException("Too many failed login attempts. Please try again later.", lockRemaining);
            }

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

            var (newlyLocked, lockRemaining) = accountLockoutService.RecordFailedAttempt(lockoutKey);
            if (newlyLocked)
            {
                throw new AccountLockedException("Too many failed login attempts. Please try again later.", lockRemaining);
            }

            throw new UnauthorizedException("Invalid username or password.");
        }

        // Reset failed attempts upon successful login
        accountLockoutService.RecordSuccessfulLogin(lockoutKey);

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
            User = MapToAuthUserDto(user, permissions),
            CompanyCode = companyCode
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
