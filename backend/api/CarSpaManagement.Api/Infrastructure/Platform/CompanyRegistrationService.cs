using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// The customer's first registration on Trovo's platform: with the company code and the one-time registration code
/// Trovo gave them, they create the company's Owner account. After that the code is used up and the company is open
/// for sign-in.
/// </summary>
public sealed class CompanyRegistrationService(
    PlatformDbContext catalog,
    AppDbContext db,
    TenantContext tenant,
    IPasswordHasherService passwordHasher,
    IAuditLogService auditLogService,
    IAesEncryptionService encryption,
    IConfiguration configuration,
    IMemoryCache cache,
    IOptions<PlatformOptions> options)
{
    private const string InvalidCodes = "Invalid company code or registration code.";

    public async Task<BootstrapOwnerResponse> RegisterAsync(RegisterCompanyRequest request, CancellationToken cancellationToken = default)
    {
        var settings = options.Value;
        var code = request.CompanyCode?.Trim().ToUpperInvariant() ?? string.Empty;

        // Lock the company's catalog row for the whole registration, so two registrations cannot race.
        await using var transaction = await catalog.Database.BeginTransactionAsync(cancellationToken);

        var company = await catalog.Companies
            .FromSqlInterpolated($"""
                SELECT c.* FROM "Companies" c
                JOIN "Products" p ON p."Id" = c."ProductId"
                WHERE p."Key" = {settings.ProductKey} AND c."Code" = {code}
                FOR UPDATE OF c
                """)
            .FirstOrDefaultAsync(cancellationToken);

        if (company is null)
        {
            Log.Warning("Registration rejected: unknown company code '{CompanyCode}'", code);
            throw new ValidationException(InvalidCodes);
        }

        if (company.Status != PlatformCompanyStatus.AwaitingRegistration)
        {
            throw new ConflictException("This company is already registered. Please sign in instead.");
        }

        var now = DateTime.UtcNow;
        var registration = await catalog.RegistrationCodes
            .Where(r => r.CompanyId == company.Id && r.UsedAt == null && r.RevokedAt == null)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (registration is null || registration.ExpiresAt <= now)
        {
            Log.Warning("Registration rejected for company {CompanyCode}: no valid registration code", code);
            throw new ValidationException("This registration code has expired. Please ask Trovo for a new one.");
        }

        if (registration.FailedAttempts >= settings.RegistrationCodeMaxAttempts)
        {
            throw new ValidationException("Too many wrong attempts. Please ask Trovo for a new registration code.");
        }

        if (!RegistrationCodes.Matches(company.Id, request.RegistrationCode, registration.CodeHash))
        {
            registration.FailedAttempts++;
            await catalog.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            Log.Warning("Registration rejected for company {CompanyCode}: wrong registration code (attempt {Attempt})", code, registration.FailedAttempts);
            throw new ValidationException(InvalidCodes);
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

        // Work in the company's own database, through the company's own login.
        tenant.Set(company.Id, CompanyConnectionStrings.ForCompanyLogin(configuration, company, encryption));

        if (await db.Users.AnyAsync(cancellationToken))
        {
            throw new ConflictException("This company already has an Owner. Please sign in instead.");
        }

        var owner = new User
        {
            Id = Guid.NewGuid(),
            OrganizationId = company.Id,
            FullName = request.FullName.Trim(),
            Username = request.Username.Trim().ToLowerInvariant(),
            Role = UserRole.Owner,
            IsActive = true,
            CreatedAt = now
        };
        owner.PasswordHash = passwordHasher.HashPassword(owner, request.Password);
        db.Users.Add(owner);
        await db.SaveChangesAsync(cancellationToken);

        await auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.UserCreated,
            module: Domain.Constants.AuditModules.Users,
            description: "Company registered with its registration code; Owner account created.",
            userId: owner.Id,
            userName: owner.FullName,
            userRole: owner.Role.ToString(),
            entityType: "User",
            entityId: owner.Id,
            entityReference: owner.Username,
            outcome: "Success",
            cancellationToken: cancellationToken);

        registration.UsedAt = now;
        company.Status = PlatformCompanyStatus.Active;
        company.RegisteredAt = now;
        await catalog.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        // The directory may have remembered that this company was not open yet.
        cache.Remove($"platform-company:{company.Id}");

        Log.Information("Company {CompanyCode} registered; Owner '{Username}' created", company.Code, owner.Username);

        return new BootstrapOwnerResponse
        {
            Id = owner.Id,
            FullName = owner.FullName,
            Username = owner.Username,
            Email = owner.Email,
            Role = owner.Role.ToString(),
            IsOwner = true,
            Permissions = [],
            CompanyCode = company.Code
        };
    }
}
