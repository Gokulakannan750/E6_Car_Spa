using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Franchise;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>A single-company server has no sign-up website, so there are no franchise sign-up codes.</summary>
public sealed class UnavailableFranchiseSignupCodeService : IFranchiseSignupCodeService
{
    private const string Message = "Franchise sign-up codes are only available on Trovo's online service.";

    public Task<FranchiseSignupCodesDto> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(new FranchiseSignupCodesDto(false, 0, []));

    public Task<CreatedFranchiseSignupCodeDto> CreateAsync(CreateFranchiseSignupCodeRequest request, CancellationToken cancellationToken = default) =>
        throw new ConflictException(Message);

    public Task<FranchiseSignupCodeDto> CancelAsync(Guid id, CancellationToken cancellationToken = default) =>
        throw new ConflictException(Message);
}

/// <summary>Shared rules for franchise sign-up codes.</summary>
public static class FranchiseSignupCodeRules
{
    public const int MaxPerDay = 20;

    /// <summary>The same answer for an unknown, expired, used, withdrawn or reserved code, so codes cannot be probed.</summary>
    public const string NotValidMessage = "This franchise code is not valid. It may have expired or been used. Ask your franchisor for a new code.";

    /// <summary>The code is normalised like registration codes ("k7qm 4rtx 9pwd" = "K7QM-4RTX-9PWD") before hashing.</summary>
    public static string Hash(string? code) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"franchise:{RegistrationCodes.Normalize(code)}"))).ToLowerInvariant();

    public static IReadOnlyList<string> ScopesOf(FranchiseSignupCode code) =>
        code.Scopes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public static IReadOnlyList<FranchiseScopeDto> ScopeDtos(FranchiseSignupCode code, string status) =>
        ScopesOf(code).Select(s => new FranchiseScopeDto(s, FranchiseScopes.Labels.GetValueOrDefault(s, s), status)).ToList();

    /// <summary>
    /// Why the franchisor cannot take a new franchisee now, or null when it can: the company must be active, with full
    /// access and the Franchise network add-on, and a free franchise branch (open codes count when <paramref name="countOpenCodes"/>).
    /// </summary>
    public static async Task<string?> FranchisorProblemAsync(PlatformDbContext catalog, IEntitlementService entitlements, Guid franchisorId,
        bool countOpenCodes, Guid? exceptCodeId, CancellationToken cancellationToken)
    {
        var active = await catalog.Companies.AnyAsync(c => c.Id == franchisorId && c.Status == PlatformCompanyStatus.Active && c.MigrationError == null,
            cancellationToken);
        var rights = await entitlements.GetForCompanyAsync(franchisorId, cancellationToken);
        if (!active || rights.Access != CompanyAccessLevel.Full || !rights.Has(FeatureKeys.FranchiseNetwork))
        {
            return "The franchisor's Franchise network is not active.";
        }

        if (rights.Number(FeatureKeys.FranchiseNetworkBranches) is not { } max) return null;
        var now = DateTime.UtcNow;
        var used = await catalog.FranchiseLinks.CountAsync(l => l.FranchisorOrganizationId == franchisorId
            && (l.Status == FranchiseLinkStatus.Pending || l.Status == FranchiseLinkStatus.Active), cancellationToken);
        if (countOpenCodes)
        {
            used += await catalog.FranchiseSignupCodes.CountAsync(c => c.FranchisorCompanyId == franchisorId && c.Id != exceptCodeId
                && c.CancelledAt == null && c.UsedAt == null && (c.ExpiresAt > now || c.ReservedUntil > now), cancellationToken);
        }
        return used >= max ? $"The franchisor's plan covers {max} franchise branches and all are in use." : null;
    }
}

/// <summary>The franchisor's side: create, list and withdraw codes (company users with franchise.manage / view).</summary>
public sealed class FranchiseSignupCodeService(
    PlatformDbContext catalog,
    ITenantContext tenant,
    IEntitlementService entitlements,
    PlatformSettingsService settings,
    IAuditLogService auditLogService,
    IHttpContextAccessor httpContextAccessor) : IFranchiseSignupCodeService
{
    private Guid CurrentCompany => tenant.OrganizationId is { } id && id != Guid.Empty
        ? id
        : throw new ForbiddenException("No company is signed in.");

    public async Task<FranchiseSignupCodesDto> ListAsync(CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        var codes = await catalog.FranchiseSignupCodes.AsNoTracking()
            .Where(c => c.FranchisorCompanyId == me)
            .OrderByDescending(c => c.CreatedAt).Take(30)
            .ToListAsync(cancellationToken);
        var companyIds = codes.Where(c => c.UsedByCompanyId != null).Select(c => c.UsedByCompanyId!.Value).ToList();
        var names = await catalog.Companies.AsNoTracking().Where(c => companyIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);
        var now = DateTime.UtcNow;
        return new FranchiseSignupCodesDto(true, (await settings.GetAsync(cancellationToken)).FranchiseCodeMinutes,
            codes.Select(c => Dto(c, now, c.UsedByCompanyId is { } id ? names.GetValueOrDefault(id) : null)).ToList());
    }

    public async Task<CreatedFranchiseSignupCodeDto> CreateAsync(CreateFranchiseSignupCodeRequest request, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        var scopes = NormalizeScopes(request.Scopes);
        var label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim();
        if (label is { Length: > 80 }) throw new ValidationException("The note can be at most 80 characters.");

        var since = DateTime.UtcNow.AddDays(-1);
        if (await catalog.FranchiseSignupCodes.CountAsync(c => c.FranchisorCompanyId == me && c.CreatedAt > since, cancellationToken)
            >= FranchiseSignupCodeRules.MaxPerDay)
        {
            throw new ConflictException("Too many franchise codes made today. Please try again tomorrow.");
        }
        if (await FranchiseSignupCodeRules.FranchisorProblemAsync(catalog, entitlements, me, countOpenCodes: true, null, cancellationToken) is { } problem)
        {
            throw new ConflictException(problem.Replace("The franchisor's", "Your") + " Ask Trovo for more franchise branches, or withdraw an unused code.");
        }

        var now = DateTime.UtcNow;
        var lifetime = (await settings.GetAsync(cancellationToken)).FranchiseCodeMinutes;
        var plain = RegistrationCodes.Generate();
        var code = new FranchiseSignupCode
        {
            Id = Guid.NewGuid(),
            FranchisorCompanyId = me,
            CodeHash = FranchiseSignupCodeRules.Hash(plain),
            Scopes = string.Join(',', scopes),
            Label = label,
            CreatedByUserId = Guid.TryParse(httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(lifetime)
        };
        catalog.FranchiseSignupCodes.Add(code);
        await catalog.SaveChangesAsync(cancellationToken);

        await auditLogService.RecordAsync(
            action: "franchise.signup_code_created",
            module: AuditModules.Franchise,
            description: $"Franchise sign-up code made{(label is null ? "" : $" ({label})")}, asking for: {string.Join(", ", scopes)}; valid until {code.ExpiresAt:yyyy-MM-dd HH:mm} UTC.",
            entityType: nameof(FranchiseSignupCode),
            entityId: code.Id,
            cancellationToken: cancellationToken);
        return new CreatedFranchiseSignupCodeDto(plain, Dto(code, now, null));
    }

    public async Task<FranchiseSignupCodeDto> CancelAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        var code = await catalog.FranchiseSignupCodes.FirstOrDefaultAsync(c => c.Id == id && c.FranchisorCompanyId == me, cancellationToken)
            ?? throw new NotFoundException("Franchise code not found.");
        var now = DateTime.UtcNow;
        var status = code.StatusAt(now);
        if (status is FranchiseSignupCodeStatus.Used or FranchiseSignupCodeStatus.Cancelled)
        {
            throw new ConflictException(status == FranchiseSignupCodeStatus.Used ? "This code has already been used." : "This code was already withdrawn.");
        }

        code.CancelledAt = now;
        await catalog.SaveChangesAsync(cancellationToken);
        await auditLogService.RecordAsync(
            action: "franchise.signup_code_cancelled",
            module: AuditModules.Franchise,
            description: "Franchise sign-up code withdrawn.",
            entityType: nameof(FranchiseSignupCode),
            entityId: code.Id,
            cancellationToken: cancellationToken);
        return Dto(code, now, null);
    }

    private static FranchiseSignupCodeDto Dto(FranchiseSignupCode code, DateTime now, string? usedBy) =>
        new(code.Id, code.Label, FranchiseSignupCodeRules.ScopeDtos(code, nameof(FranchiseScopeStatus.Requested)), code.StatusAt(now).ToString(),
            code.CreatedAt, code.ExpiresAt, code.UsedAt, usedBy);

    private static List<string> NormalizeScopes(List<string>? scopes)
    {
        var list = (scopes ?? []).Select(s => (s ?? string.Empty).Trim().ToLowerInvariant()).Where(s => s.Length > 0).Distinct().ToList();
        if (list.Count == 0) list.Add(FranchiseScopes.FinancialTotals);
        if (list.FirstOrDefault(s => !FranchiseScopes.IsKnown(s)) is { } unknown) throw new ValidationException($"Unknown item '{unknown}'.");
        return list;
    }
}

/// <summary>What the sign-up website shows for a valid code: who the franchisor is and what they ask to see.</summary>
public sealed record FranchiseCodeCheck(string FranchisorName, IReadOnlyList<FranchiseScopeDto> Scopes, DateTime ExpiresAt);

/// <summary>The sign-up side: check a code, reserve it for an order, and link the new company when it is created.</summary>
public sealed class FranchiseSignupCodeRedemption(PlatformDbContext catalog, IEntitlementService entitlements)
{
    /// <summary>A valid, open code with a franchisor that can take a franchisee, or <see cref="NotFoundException"/>.</summary>
    public async Task<(FranchiseSignupCode Code, FranchiseCodeCheck Check)> CheckAsync(string? code, CancellationToken cancellationToken = default)
    {
        if (RegistrationCodes.Normalize(code).Length != 12) throw new NotFoundException(FranchiseSignupCodeRules.NotValidMessage);
        var hash = FranchiseSignupCodeRules.Hash(code);
        var row = await catalog.FranchiseSignupCodes.AsNoTracking().FirstOrDefaultAsync(c => c.CodeHash == hash, cancellationToken);
        if (row is null || row.StatusAt(DateTime.UtcNow) != FranchiseSignupCodeStatus.Open
            || await FranchiseSignupCodeRules.FranchisorProblemAsync(catalog, entitlements, row.FranchisorCompanyId, countOpenCodes: true, row.Id, cancellationToken) is not null)
        {
            throw new NotFoundException(FranchiseSignupCodeRules.NotValidMessage);
        }

        var name = await catalog.Companies.Where(c => c.Id == row.FranchisorCompanyId).Select(c => c.Name).FirstAsync(cancellationToken);
        return (row, new FranchiseCodeCheck(name, FranchiseSignupCodeRules.ScopeDtos(row, nameof(FranchiseScopeStatus.Requested)), row.ExpiresAt));
    }

    /// <summary>
    /// Reserves the code for this order until <paramref name="until"/>, atomically: of two sign-ups racing for one code
    /// only one gets it.
    /// </summary>
    public async Task<Guid> ReserveAsync(string? code, Guid orderId, DateTime until, CancellationToken cancellationToken = default)
    {
        var (row, _) = await CheckAsync(code, cancellationToken);
        var now = DateTime.UtcNow;
        var reserved = await catalog.FranchiseSignupCodes
            .Where(c => c.Id == row.Id && c.CancelledAt == null && c.UsedAt == null && c.ExpiresAt > now
                        && (c.ReservedUntil == null || c.ReservedUntil <= now))
            .ExecuteUpdateAsync(set => set
                .SetProperty(c => c.ReservedBySignupOrderId, orderId)
                .SetProperty(c => c.ReservedUntil, until), cancellationToken);
        if (reserved == 0) throw new NotFoundException(FranchiseSignupCodeRules.NotValidMessage);
        return row.Id;
    }

    /// <summary>
    /// Links the order's new company to the franchisor, with the consented items allowed. Never throws: if the link
    /// cannot be made the company stays independent, and the reason is returned (and shown on the website).
    /// </summary>
    public async Task<(Guid? LinkId, string? Problem)> LinkAsync(SignupOrder order, Guid companyId, CancellationToken cancellationToken = default)
    {
        if (order.FranchiseSignupCodeId is not { } codeId) return (null, null);
        try
        {
            var code = await catalog.FranchiseSignupCodes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == codeId, cancellationToken);
            if (code is null || code.ReservedBySignupOrderId != order.Id || code.CancelledAt is not null || code.UsedAt is not null)
            {
                return (null, "The franchisor withdrew the franchise code before your company was created.");
            }
            if (await FranchiseSignupCodeRules.FranchisorProblemAsync(catalog, entitlements, code.FranchisorCompanyId, countOpenCodes: false, null, cancellationToken)
                is { } problem)
            {
                return (null, problem);
            }

            var now = DateTime.UtcNow;
            var claimed = await catalog.FranchiseSignupCodes
                .Where(c => c.Id == codeId && c.ReservedBySignupOrderId == order.Id && c.UsedAt == null && c.CancelledAt == null)
                .ExecuteUpdateAsync(set => set.SetProperty(c => c.UsedAt, now).SetProperty(c => c.UsedByCompanyId, companyId), cancellationToken);
            if (claimed == 0) return (null, "The franchisor withdrew the franchise code before your company was created.");

            var link = new FranchiseLink
            {
                Id = Guid.NewGuid(),
                FranchisorOrganizationId = code.FranchisorCompanyId,
                FranchiseeOrganizationId = companyId,
                Status = FranchiseLinkStatus.Active,
                InvitedByUserId = code.CreatedByUserId,
                CreatedAt = now,
                ExpiresAt = now,
                RespondedAt = now
            };
            catalog.FranchiseLinks.Add(link);
            foreach (var scope in FranchiseSignupCodeRules.ScopesOf(code))
            {
                catalog.FranchiseLinkScopes.Add(new FranchiseLinkScope
                {
                    Id = Guid.NewGuid(),
                    FranchiseLinkId = link.Id,
                    FranchisorOrganizationId = link.FranchisorOrganizationId,
                    FranchiseeOrganizationId = companyId,
                    Scope = scope,
                    Status = FranchiseScopeStatus.Granted,
                    DecidedAt = now,
                    CreatedAt = now
                });
            }
            await catalog.SaveChangesAsync(cancellationToken);
            Log.Information("Sign-up order {OrderId}: company {CompanyId} linked to franchisor {Franchisor} by sign-up code", order.Id, companyId, code.FranchisorCompanyId);
            return (link.Id, null);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Sign-up order {OrderId}: the franchise link could not be made", order.Id);
            catalog.ChangeTracker.Clear();
            return (null, "The franchise link could not be made because of an error on our side.");
        }
    }
}
