using CarSpaManagement.Api.Application.DTOs.Franchise;

namespace CarSpaManagement.Api.Application.Interfaces;

/// <summary>
/// Whether the current company may act as a franchisor. Franchise is an add-on to the subscription; until billing
/// exists every company has it.
/// </summary>
public interface IFranchiseEntitlement
{
    Task<bool> IsEnabledAsync(CancellationToken cancellationToken = default);
}

/// <summary>Reads a franchisee's approved financial figures. The database function behind it checks the link itself.</summary>
public interface IFranchiseFigures
{
    Task<FranchiseFinancialTotalsDto> GetFinancialTotalsAsync(Guid franchiseeOrganizationId, DateOnly from, DateOnly to,
        CancellationToken cancellationToken = default);
}

/// <summary>The reports a franchisor may download about a franchisee, within what the franchisee has allowed.</summary>
public interface IFranchiseReports
{
    /// <summary>The franchisee's monthly billing report (the same one the franchisee sees). Needs the "invoice list" to be allowed.</summary>
    Task<CarSpaManagement.Api.Application.DTOs.Reports.MonthlyBillingReportResponse> GetMonthlyBillingReportAsync(
        Guid linkId, int year, int month, CancellationToken cancellationToken = default);
}

public interface IFranchiseService
{
    /// <summary>The franchisor's dashboard: the approved financial totals of every active franchisee, and the network total.</summary>
    Task<FranchiseDashboardDto> GetDashboardAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken = default);

    Task<FranchiseNetworkDto> GetNetworkAsync(CancellationToken cancellationToken = default);

    /// <summary>What this company can do in the franchise network (act as a franchisor, or be a franchisee).</summary>
    Task<FranchiseAccessDto> GetAccessAsync(CancellationToken cancellationToken = default);

    /// <summary>The franchisor makes a fresh link for the franchisee to answer through (the old one stops working).</summary>
    Task<FranchiseLinkAccessDto> CreateLinkAsync(Guid linkId, CancellationToken cancellationToken = default);

    /// <summary>The invited company's Owner opens the link: what is being asked. Works only for that company.</summary>
    Task<FranchiseLinkDto> GetByTokenAsync(string token, CancellationToken cancellationToken = default);

    /// <summary>The invited company's Owner answers through the link; the link is then used up.</summary>
    Task<FranchiseLinkDto> RespondByTokenAsync(string token, RespondToFranchiseInviteRequest request, CancellationToken cancellationToken = default);

    /// <summary>The franchisor invites another company, by its code.</summary>
    Task<SendFranchiseInviteResponse> SendInviteAsync(SendFranchiseInviteRequest request, CancellationToken cancellationToken = default);

    /// <summary>The franchisor withdraws an invitation that has not been answered.</summary>
    Task<FranchiseLinkDto> CancelInviteAsync(Guid linkId, CancellationToken cancellationToken = default);

    /// <summary>The invited company accepts (granting some of what was asked) or declines.</summary>
    Task<FranchiseLinkDto> RespondAsync(Guid linkId, RespondToFranchiseInviteRequest request, CancellationToken cancellationToken = default);

    /// <summary>Either company ends an active link; the franchisor's access stops at once.</summary>
    Task<FranchiseLinkDto> EndLinkAsync(Guid linkId, CancellationToken cancellationToken = default);

    /// <summary>The franchisor asks to see more.</summary>
    Task<FranchiseLinkAccessDto> RequestScopesAsync(Guid linkId, RequestFranchiseScopesRequest request, CancellationToken cancellationToken = default);

    /// <summary>The franchisee allows or switches off one item.</summary>
    Task<FranchiseLinkDto> DecideScopeAsync(Guid linkId, string scope, DecideFranchiseScopeRequest request, CancellationToken cancellationToken = default);
}
