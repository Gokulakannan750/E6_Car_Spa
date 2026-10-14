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
    IOptions<PlatformOptions> options,
    IEntitlementService entitlements)
{
    private const string InvalidCodes = "Invalid company code or registration code.";

    /// <summary>The Owner takes the best licence the company bought: both apps, else Windows, else Android.</summary>
    private async Task<AppAccess> OwnerAccessAsync(Guid companyId, CancellationToken cancellationToken)
    {
        var current = await entitlements.GetForCompanyAsync(companyId, cancellationToken);
        if (current.Licences is not { } licences || licences.Both > 0) return AppAccess.Both;
        return licences.Windows > 0 ? AppAccess.Windows : AppAccess.Android;
    }

    /// <summary>
    /// Starts Company Settings with what the company gave when it signed up (name, city and state, phone, email,
    /// GSTIN), so the Owner does not begin with an empty form and the sign-in page shows the company's name. The
    /// Owner completes the address and PIN code.
    /// </summary>
    private async Task PrefillBusinessProfileAsync(PlatformCompany company, DateTime now, CancellationToken cancellationToken)
    {
        var account = await catalog.BillingAccounts.AsNoTracking().FirstOrDefaultAsync(b => b.CompanyId == company.Id, cancellationToken);
        static string Cut(string? value, int max)
        {
            var v = (value ?? string.Empty).Trim();
            return v.Length > max ? v[..max] : v;
        }

        var profile = await db.BusinessProfiles.FirstOrDefaultAsync(cancellationToken);
        if (profile is null)
        {
            profile = new BusinessProfile { Id = Guid.NewGuid(), OrganizationId = company.Id, CreatedAt = now };
            db.BusinessProfiles.Add(profile);
        }

        // Only empty fields are filled; anything already set is kept.
        var place = (account?.BillingAddress ?? string.Empty).Split(',', 2, StringSplitOptions.TrimEntries);
        var phoneDigits = new string((account?.BillingPhone ?? string.Empty).Where(char.IsDigit).ToArray());
        if (phoneDigits.Length == 12 && phoneDigits.StartsWith("91")) phoneDigits = phoneDigits[2..];
        if (string.IsNullOrWhiteSpace(profile.BusinessName))
            profile.BusinessName = Cut(string.IsNullOrWhiteSpace(account?.BillingName) ? company.Name : account!.BillingName, 150);
        if (string.IsNullOrWhiteSpace(profile.City)) profile.City = Cut(place.Length > 0 ? place[0] : null, 100);
        if (string.IsNullOrWhiteSpace(profile.State)) profile.State = Cut(place.Length > 1 ? place[1] : null, 100);
        if (string.IsNullOrWhiteSpace(profile.Phone)) profile.Phone = Cut(phoneDigits, 10);
        if (string.IsNullOrWhiteSpace(profile.Email)) profile.Email = Cut(account?.BillingEmail, 150);
        if (string.IsNullOrWhiteSpace(profile.Gstin) && !string.IsNullOrWhiteSpace(account?.Gstin)) profile.Gstin = Cut(account!.Gstin, 20);
    }

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
            AppAccess = await OwnerAccessAsync(company.Id, cancellationToken),
            CreatedAt = now
        };
        owner.PasswordHash = passwordHasher.HashPassword(owner, request.Password);
        db.Users.Add(owner);
        await PrefillBusinessProfileAsync(company, now, cancellationToken);
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
