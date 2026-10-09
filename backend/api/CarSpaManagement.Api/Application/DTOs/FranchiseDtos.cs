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

public record FranchiseDailyPointDto(string Date, decimal Invoiced, decimal Collected);

/// <summary>A franchisee's approved financial figures for a period: totals and a daily series, never individual records.</summary>
public record FranchiseFinancialTotalsDto(
    int InvoiceCount,
    decimal InvoicedAmount,
    decimal CollectedAmount,
    decimal OutstandingAmount,
    int JobCardCount,
    IReadOnlyList<FranchiseDailyPointDto> Daily);

/// <summary>One franchisee on the dashboard. <c>Totals</c> is null when the franchisee has not allowed the financial totals.</summary>
public record FranchiseeFinancialsDto(
    Guid LinkId,
    string PartnerCodeHint,
    string PartnerName,
    bool FinancialTotalsAllowed,
    IReadOnlyList<string> AllowedItems,
    FranchiseFinancialTotalsDto? Totals);

public record FranchiseDashboardDto(
    string From,
    string To,
    FranchiseFinancialTotalsDto Network,
    IReadOnlyList<FranchiseeFinancialsDto> Franchisees);
