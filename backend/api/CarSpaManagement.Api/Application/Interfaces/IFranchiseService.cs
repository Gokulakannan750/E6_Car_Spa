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

public interface IFranchiseService
{
    Task<FranchiseNetworkDto> GetNetworkAsync(CancellationToken cancellationToken = default);

    /// <summary>The franchisor invites another company, by its code.</summary>
    Task<SendFranchiseInviteResponse> SendInviteAsync(SendFranchiseInviteRequest request, CancellationToken cancellationToken = default);

    /// <summary>The franchisor withdraws an invitation that has not been answered.</summary>
    Task<FranchiseLinkDto> CancelInviteAsync(Guid linkId, CancellationToken cancellationToken = default);

    /// <summary>The invited company accepts (granting some of what was asked) or declines.</summary>
    Task<FranchiseLinkDto> RespondAsync(Guid linkId, RespondToFranchiseInviteRequest request, CancellationToken cancellationToken = default);

    /// <summary>Either company ends an active link; the franchisor's access stops at once.</summary>
    Task<FranchiseLinkDto> EndLinkAsync(Guid linkId, CancellationToken cancellationToken = default);

    /// <summary>The franchisor asks to see more.</summary>
    Task<FranchiseLinkDto> RequestScopesAsync(Guid linkId, RequestFranchiseScopesRequest request, CancellationToken cancellationToken = default);

    /// <summary>The franchisee allows or switches off one item.</summary>
    Task<FranchiseLinkDto> DecideScopeAsync(Guid linkId, string scope, DecideFranchiseScopeRequest request, CancellationToken cancellationToken = default);
}
