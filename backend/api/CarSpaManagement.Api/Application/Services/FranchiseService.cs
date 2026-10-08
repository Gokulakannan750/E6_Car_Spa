using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Franchise;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Application.Services;

/// <summary>Always on, until the subscription add-ons exist and decide this per company.</summary>
/// <summary>Reads the figures through the database function that enforces the franchise link itself.</summary>
public sealed class PostgresFranchiseFigures(AppDbContext db) : IFranchiseFigures
{
    private sealed class Payload
    {
        public int InvoiceCount { get; set; }
        public decimal InvoicedAmount { get; set; }
        public decimal CollectedAmount { get; set; }
        public decimal OutstandingAmount { get; set; }
        public int JobCardCount { get; set; }
        public List<DailyPayload> Daily { get; set; } = [];
    }

    private sealed class DailyPayload
    {
        public string Date { get; set; } = string.Empty;
        public decimal Invoiced { get; set; }
        public decimal Collected { get; set; }
    }

    public async Task<FranchiseFinancialTotalsDto> GetFinancialTotalsAsync(Guid franchiseeOrganizationId, DateOnly from, DateOnly to,
        CancellationToken cancellationToken = default)
    {
        var json = await db.Database
            .SqlQuery<string>($"SELECT franchise_financial_totals({franchiseeOrganizationId}, {from}, {to})::text AS \"Value\"")
            .SingleAsync(cancellationToken);

        var payload = System.Text.Json.JsonSerializer.Deserialize<Payload>(json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("The franchise figures were empty.");

        return new FranchiseFinancialTotalsDto(
            payload.InvoiceCount, payload.InvoicedAmount, payload.CollectedAmount, payload.OutstandingAmount, payload.JobCardCount,
            payload.Daily.Select(d => new FranchiseDailyPointDto(d.Date, d.Invoiced, d.Collected)).ToList());
    }
}

public sealed class AlwaysOnFranchiseEntitlement : IFranchiseEntitlement
{
    public Task<bool> IsEnabledAsync(CancellationToken cancellationToken = default) => Task.FromResult(true);
}

/// <summary>
/// The franchise link between two companies. The franchisor invites by company code; the invited company decides,
/// item by item, what the franchisor may see; either company can end the link at any time. Every step is recorded
/// in the acting company's audit log.
/// </summary>
public class FranchiseService(
    AppDbContext db,
    IAuditLogService auditLogService,
    IFranchiseEntitlement entitlement,
    IHttpContextAccessor httpContextAccessor,
    IFranchiseFigures figures) : IFranchiseService
{
    public static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(7);
    public const int MaxInvitesPerDay = 20;

    private Guid CurrentCompany =>
        db.CurrentOrganizationId != Guid.Empty
            ? db.CurrentOrganizationId
            : throw new ForbiddenException("No company is signed in.");

    private Guid? CurrentUserId() =>
        Guid.TryParse(httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    // ── Reading ─────────────────────────────────────────────────────────────────────────────────────────────

    public async Task<FranchiseNetworkDto> GetNetworkAsync(CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        await ExpireStaleInvitesAsync(cancellationToken);

        var links = await db.FranchiseLinks.Include(l => l.Scopes)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

        var dtos = await ToDtosAsync(links, me, cancellationToken);
        return new FranchiseNetworkDto(
            await entitlement.IsEnabledAsync(cancellationToken),
            dtos.Where(d => d.Role == "Franchisor").ToList(),
            dtos.Where(d => d.Role == "Franchisee").ToList(),
            dtos.Count(d => d.Role == "Franchisee" && d.Status == nameof(FranchiseLinkStatus.Pending)));
    }

    private async Task<List<FranchiseLinkDto>> ToDtosAsync(List<FranchiseLink> links, Guid me, CancellationToken cancellationToken)
    {
        var partnerIds = links
            .Select(l => l.FranchisorOrganizationId == me ? l.FranchiseeOrganizationId : l.FranchisorOrganizationId)
            .Distinct().ToList();
        var partners = await db.Organizations.AsNoTracking()
            .Where(o => partnerIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, cancellationToken);

        return links.Select(l =>
        {
            var iAmFranchisor = l.FranchisorOrganizationId == me;
            partners.TryGetValue(iAmFranchisor ? l.FranchiseeOrganizationId : l.FranchisorOrganizationId, out var partner);
            return new FranchiseLinkDto(
                l.Id,
                iAmFranchisor ? "Franchisor" : "Franchisee",
                MaskCode(partner?.Code),
                string.IsNullOrWhiteSpace(partner?.Name) ? MaskCode(partner?.Code) : partner!.Name,
                l.Status.ToString(),
                l.CreatedAt,
                l.ExpiresAt,
                l.RespondedAt,
                l.EndedAt,
                l.Scopes.OrderBy(s => s.CreatedAt).ThenBy(s => s.Scope)
                    .Select(s => new FranchiseScopeDto(s.Scope, FranchiseScopes.Labels.GetValueOrDefault(s.Scope, s.Scope), s.Status.ToString()))
                    .ToList());
        }).ToList();
    }

    /// <summary>
    /// The other company's code is not shown in full: only enough to recognise it (first and last character), so
    /// one company never learns another's complete sign-in code from the franchise screens.
    /// </summary>
    public static string MaskCode(string? code)
    {
        if (string.IsNullOrEmpty(code))
        {
            return string.Empty;
        }
        return code.Length <= 2 ? new string('•', code.Length) : $"{code[0]}{new string('•', code.Length - 2)}{code[^1]}";
    }

    /// <summary>Invitations nobody answered in time stop being open, so the same pair can be invited again.</summary>
    private async Task ExpireStaleInvitesAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var stale = await db.FranchiseLinks
            .Where(l => l.Status == FranchiseLinkStatus.Pending && l.ExpiresAt < now)
            .ToListAsync(cancellationToken);
        if (stale.Count == 0)
        {
            return;
        }

        foreach (var link in stale)
        {
            link.Status = FranchiseLinkStatus.Expired;
            link.EndedAt = now;
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<FranchiseLink> LoadAsync(Guid linkId, CancellationToken cancellationToken)
    {
        await ExpireStaleInvitesAsync(cancellationToken);
        return await db.FranchiseLinks.Include(l => l.Scopes).FirstOrDefaultAsync(l => l.Id == linkId, cancellationToken)
            ?? throw new NotFoundException("Franchise link not found.");
    }

    private async Task<FranchiseLinkDto> DtoAsync(FranchiseLink link, CancellationToken cancellationToken) =>
        (await ToDtosAsync([link], CurrentCompany, cancellationToken))[0];

    // ── The franchisor's dashboard ──────────────────────────────────────────────────────────────────────────

    public async Task<FranchiseDashboardDto> GetDashboardAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        await RequireFranchiseAddOnAsync(cancellationToken);

        var toDate = to ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var fromDate = from ?? toDate.AddDays(-29);
        if (fromDate > toDate)
        {
            throw new ValidationException("The start date must not be after the end date.");
        }
        if (toDate.DayNumber - fromDate.DayNumber > 366)
        {
            throw new ValidationException("Choose a period of at most one year.");
        }

        var links = await db.FranchiseLinks.Include(l => l.Scopes)
            .Where(l => l.FranchisorOrganizationId == me && l.Status == FranchiseLinkStatus.Active)
            .OrderBy(l => l.CreatedAt)
            .ToListAsync(cancellationToken);
        var named = await ToDtosAsync(links, me, cancellationToken);

        var franchisees = new List<FranchiseeFinancialsDto>();
        foreach (var (link, dto) in links.Zip(named))
        {
            var allowed = link.Scopes.Any(s => s.Scope == FranchiseScopes.FinancialTotals && s.Status == FranchiseScopeStatus.Granted);
            var totals = allowed
                ? await figures.GetFinancialTotalsAsync(link.FranchiseeOrganizationId, fromDate, toDate, cancellationToken)
                : null;
            franchisees.Add(new FranchiseeFinancialsDto(link.Id, dto.PartnerCodeHint, dto.PartnerName, allowed, totals));
        }

        var shared = franchisees.Where(f => f.Totals is not null).Select(f => f.Totals!).ToList();
        var network = new FranchiseFinancialTotalsDto(
            shared.Sum(t => t.InvoiceCount),
            shared.Sum(t => t.InvoicedAmount),
            shared.Sum(t => t.CollectedAmount),
            shared.Sum(t => t.OutstandingAmount),
            shared.Sum(t => t.JobCardCount),
            shared.SelectMany(t => t.Daily)
                .GroupBy(d => d.Date)
                .OrderBy(g => g.Key)
                .Select(g => new FranchiseDailyPointDto(g.Key, g.Sum(d => d.Invoiced), g.Sum(d => d.Collected)))
                .ToList());

        await auditLogService.RecordAsync(
            action: "franchise.dashboard_viewed",
            module: AuditModules.Franchise,
            description: $"Viewed franchise figures for {shared.Count} company(ies), {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}.",
            entityType: nameof(FranchiseLink),
            cancellationToken: cancellationToken);

        return new FranchiseDashboardDto(fromDate.ToString("yyyy-MM-dd"), toDate.ToString("yyyy-MM-dd"), network, franchisees);
    }

    // ── Inviting ────────────────────────────────────────────────────────────────────────────────────────────

    public async Task<SendFranchiseInviteResponse> SendInviteAsync(SendFranchiseInviteRequest request, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        await RequireFranchiseAddOnAsync(cancellationToken);

        var scopes = NormalizeScopes(request.Scopes, defaultToFinancialTotals: true);

        var since = DateTime.UtcNow.AddDays(-1);
        if (await db.FranchiseLinks.CountAsync(l => l.FranchisorOrganizationId == me && l.CreatedAt > since, cancellationToken) >= MaxInvitesPerDay)
        {
            throw new ConflictException("Too many invitations sent today. Please try again tomorrow.");
        }

        // The answer is the same whether or not the code belongs to a company, so codes cannot be probed.
        var response = new SendFranchiseInviteResponse
        {
            Message = "If that code belongs to an active company, your invitation has been sent. " +
                      "They must accept it before you can see anything."
        };

        var code = request.FranchiseeCode.Trim().ToUpperInvariant();
        var franchisee = await db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Code == code && o.IsActive, cancellationToken);
        if (franchisee is null || franchisee.Id == me)
        {
            Log.Warning("Franchise invite from {Company} to unknown, inactive or own code '{Code}' ignored", me, code);
            return response;
        }

        await ExpireStaleInvitesAsync(cancellationToken);
        if (await db.FranchiseLinks.AnyAsync(l => l.FranchisorOrganizationId == me && l.FranchiseeOrganizationId == franchisee.Id
                && (l.Status == FranchiseLinkStatus.Pending || l.Status == FranchiseLinkStatus.Active), cancellationToken))
        {
            return response;
        }

        var now = DateTime.UtcNow;
        var link = new FranchiseLink
        {
            Id = Guid.NewGuid(),
            FranchisorOrganizationId = me,
            FranchiseeOrganizationId = franchisee.Id,
            Status = FranchiseLinkStatus.Pending,
            InvitedByUserId = CurrentUserId(),
            ExpiresAt = now + InviteLifetime
        };
        foreach (var scope in scopes)
        {
            link.Scopes.Add(NewScope(link, scope));
        }
        db.FranchiseLinks.Add(link);
        await db.SaveChangesAsync(cancellationToken);

        await AuditAsync("franchise.invite_sent", $"Franchise invitation sent to company {franchisee.Code}.", link, cancellationToken);
        return response;
    }

    public async Task<FranchiseLinkDto> CancelInviteAsync(Guid linkId, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        var link = await LoadAsync(linkId, cancellationToken);
        if (link.FranchisorOrganizationId != me)
        {
            throw new ForbiddenException("Only the company that sent the invitation can withdraw it.");
        }
        if (link.Status != FranchiseLinkStatus.Pending)
        {
            throw new ConflictException("This invitation has already been answered or has expired.");
        }

        link.Status = FranchiseLinkStatus.Cancelled;
        link.EndedAt = DateTime.UtcNow;
        link.EndedByOrganizationId = me;
        await db.SaveChangesAsync(cancellationToken);

        await AuditAsync("franchise.invite_cancelled", "Franchise invitation withdrawn.", link, cancellationToken);
        return await DtoAsync(link, cancellationToken);
    }

    // ── Answering ───────────────────────────────────────────────────────────────────────────────────────────

    public async Task<FranchiseLinkDto> RespondAsync(Guid linkId, RespondToFranchiseInviteRequest request, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        var link = await LoadAsync(linkId, cancellationToken);
        if (link.FranchiseeOrganizationId != me)
        {
            throw new ForbiddenException("Only the invited company can answer this invitation.");
        }
        if (link.Status != FranchiseLinkStatus.Pending)
        {
            throw new ConflictException(link.Status == FranchiseLinkStatus.Expired
                ? "This invitation has expired. Ask the company to send a new one."
                : "This invitation has already been answered.");
        }

        var now = DateTime.UtcNow;
        link.RespondedAt = now;
        link.RespondedByUserId = CurrentUserId();

        if (!request.Accept)
        {
            link.Status = FranchiseLinkStatus.Declined;
            link.EndedAt = now;
            link.EndedByOrganizationId = me;
            foreach (var scope in link.Scopes)
            {
                scope.Status = FranchiseScopeStatus.Denied;
                scope.DecidedAt = now;
            }
            await db.SaveChangesAsync(cancellationToken);
            await AuditAsync("franchise.invite_declined", "Franchise invitation declined.", link, cancellationToken);
            return await DtoAsync(link, cancellationToken);
        }

        var granted = NormalizeScopes(request.GrantedScopes, defaultToFinancialTotals: false);
        var asked = link.Scopes.Select(s => s.Scope).ToHashSet();
        if (granted.Any(g => !asked.Contains(g)))
        {
            throw new ValidationException("You can only allow items that were asked for.");
        }

        link.Status = FranchiseLinkStatus.Active;
        foreach (var scope in link.Scopes)
        {
            scope.Status = granted.Contains(scope.Scope) ? FranchiseScopeStatus.Granted : FranchiseScopeStatus.Denied;
            scope.DecidedAt = now;
        }
        await db.SaveChangesAsync(cancellationToken);

        await AuditAsync("franchise.invite_accepted",
            $"Franchise invitation accepted; allowed: {string.Join(", ", granted)}.", link, cancellationToken);
        return await DtoAsync(link, cancellationToken);
    }

    public async Task<FranchiseLinkDto> EndLinkAsync(Guid linkId, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        var link = await LoadAsync(linkId, cancellationToken);
        if (link.Status != FranchiseLinkStatus.Active)
        {
            throw new ConflictException("Only an active franchise link can be ended.");
        }

        link.Status = FranchiseLinkStatus.Ended;
        link.EndedAt = DateTime.UtcNow;
        link.EndedByOrganizationId = me;
        await db.SaveChangesAsync(cancellationToken);

        await AuditAsync("franchise.link_ended", "Franchise link ended.", link, cancellationToken);
        return await DtoAsync(link, cancellationToken);
    }

    // ── Permissions ─────────────────────────────────────────────────────────────────────────────────────────

    public async Task<FranchiseLinkDto> RequestScopesAsync(Guid linkId, RequestFranchiseScopesRequest request, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        await RequireFranchiseAddOnAsync(cancellationToken);
        var link = await LoadAsync(linkId, cancellationToken);
        if (link.FranchisorOrganizationId != me)
        {
            throw new ForbiddenException("Only the franchisor can ask to see more.");
        }
        if (link.Status != FranchiseLinkStatus.Active)
        {
            throw new ConflictException("You can ask for more only on an active franchise link.");
        }

        var asked = new List<string>();
        foreach (var scope in NormalizeScopes(request.Scopes, defaultToFinancialTotals: false))
        {
            var existing = link.Scopes.FirstOrDefault(s => s.Scope == scope);
            if (existing is null)
            {
                var row = NewScope(link, scope);
                link.Scopes.Add(row);
                db.FranchiseLinkScopes.Add(row);
                asked.Add(scope);
            }
            else if (existing.Status == FranchiseScopeStatus.Denied)
            {
                existing.Status = FranchiseScopeStatus.Requested;
                existing.DecidedAt = null;
                asked.Add(scope);
            }
        }

        if (asked.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            await AuditAsync("franchise.scopes_requested", $"Asked to see: {string.Join(", ", asked)}.", link, cancellationToken);
        }
        return await DtoAsync(link, cancellationToken);
    }

    public async Task<FranchiseLinkDto> DecideScopeAsync(Guid linkId, string scope, DecideFranchiseScopeRequest request, CancellationToken cancellationToken = default)
    {
        var me = CurrentCompany;
        var link = await LoadAsync(linkId, cancellationToken);
        if (link.FranchiseeOrganizationId != me)
        {
            throw new ForbiddenException("Only the franchisee decides what the franchisor can see.");
        }
        if (link.Status != FranchiseLinkStatus.Active)
        {
            throw new ConflictException("This franchise link is not active.");
        }

        var row = link.Scopes.FirstOrDefault(s => s.Scope == scope.Trim().ToLowerInvariant())
            ?? throw new NotFoundException("That item was never asked for.");
        row.Status = request.Grant ? FranchiseScopeStatus.Granted : FranchiseScopeStatus.Denied;
        row.DecidedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        await AuditAsync(request.Grant ? "franchise.scope_granted" : "franchise.scope_denied",
            $"{(request.Grant ? "Allowed" : "Switched off")}: {row.Scope}.", link, cancellationToken);
        return await DtoAsync(link, cancellationToken);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────────

    private async Task RequireFranchiseAddOnAsync(CancellationToken cancellationToken)
    {
        if (!await entitlement.IsEnabledAsync(cancellationToken))
        {
            throw new ForbiddenException("The Franchise add-on is not active for your company.");
        }
    }

    private static List<string> NormalizeScopes(List<string>? scopes, bool defaultToFinancialTotals)
    {
        var list = (scopes ?? []).Select(s => (s ?? string.Empty).Trim().ToLowerInvariant()).Where(s => s.Length > 0).Distinct().ToList();
        if (list.Count == 0 && defaultToFinancialTotals)
        {
            list.Add(FranchiseScopes.FinancialTotals);
        }
        if (list.Count == 0)
        {
            throw new ValidationException("Choose at least one item.");
        }
        if (list.FirstOrDefault(s => !FranchiseScopes.IsKnown(s)) is { } unknown)
        {
            throw new ValidationException($"Unknown item '{unknown}'.");
        }
        return list;
    }

    private static FranchiseLinkScope NewScope(FranchiseLink link, string scope) => new()
    {
        Id = Guid.NewGuid(),
        FranchiseLinkId = link.Id,
        FranchisorOrganizationId = link.FranchisorOrganizationId,
        FranchiseeOrganizationId = link.FranchiseeOrganizationId,
        Scope = scope,
        Status = FranchiseScopeStatus.Requested
    };

    private Task AuditAsync(string action, string description, FranchiseLink link, CancellationToken cancellationToken) =>
        auditLogService.RecordAsync(
            action: action,
            module: AuditModules.Franchise,
            description: description,
            entityType: nameof(FranchiseLink),
            entityId: link.Id,
            cancellationToken: cancellationToken);
}
