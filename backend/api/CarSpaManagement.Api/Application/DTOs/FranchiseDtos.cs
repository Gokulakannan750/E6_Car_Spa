using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Franchise;

public record FranchiseScopeDto(string Scope, string Label, string Status);

/// <summary>One link as seen by one of its two companies. <c>Role</c> is the viewer's own role in the link.</summary>
public record FranchiseLinkDto(
    Guid Id,
    string Role,
    string PartnerCodeHint,
    string PartnerName,
    string Status,
    DateTime InvitedAt,
    DateTime ExpiresAt,
    DateTime? RespondedAt,
    DateTime? EndedAt,
    IReadOnlyList<FranchiseScopeDto> Scopes);

public record FranchiseNetworkDto(
    bool FranchiseEnabled,
    IReadOnlyList<FranchiseLinkDto> Franchisees,
    IReadOnlyList<FranchiseLinkDto> Franchisors,
    int PendingInvitations);

public class SendFranchiseInviteRequest
{
    /// <summary>The code of the company being invited.</summary>
    [Required, StringLength(20)]
    public string FranchiseeCode { get; set; } = string.Empty;

    /// <summary>What the franchisor asks to see. Defaults to the financial totals.</summary>
    public List<string>? Scopes { get; set; }
}

public class SendFranchiseInviteResponse
{
    /// <summary>The same answer whether or not the code belongs to a company, so codes cannot be probed.</summary>
    public string Message { get; set; } = string.Empty;
}

public class RespondToFranchiseInviteRequest
{
    public bool Accept { get; set; }

    /// <summary>The requested items the franchisee allows. Required (at least one) when accepting.</summary>
    public List<string>? GrantedScopes { get; set; }
}

public class RequestFranchiseScopesRequest
{
    [Required, MinLength(1)]
    public List<string> Scopes { get; set; } = [];
}

public class DecideFranchiseScopeRequest
{
    public bool Grant { get; set; }
}
