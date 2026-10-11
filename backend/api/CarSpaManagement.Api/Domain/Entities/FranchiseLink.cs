using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Common;

namespace CarSpaManagement.Api.Domain.Entities;

public enum FranchiseLinkStatus
{
    /// <summary>The franchisor has invited the franchisee; waiting for the franchisee's answer.</summary>
    Pending,

    /// <summary>The franchisee accepted. The franchisor can see what the franchisee has approved.</summary>
    Active,

    Declined,

    /// <summary>The franchisor withdrew the invitation before it was answered.</summary>
    Cancelled,

    /// <summary>The invitation was not answered in time.</summary>
    Expired,

    /// <summary>An active link was ended by either company; the franchisor's access stopped at once.</summary>
    Ended
}

public enum FranchiseScopeStatus
{
    /// <summary>The franchisor has asked for this; the franchisee has not decided.</summary>
    Requested,

    /// <summary>The franchisee allows the franchisor to see this.</summary>
    Granted,

    /// <summary>The franchisee refused, or switched it off again.</summary>
    Denied
}

/// <summary>
/// A consented connection between two companies: the franchisor may see what the franchisee approves.
/// This is a platform table shared by exactly two companies, not owned by one: each of the two sees the link,
/// nobody else does. The franchisor's reading of the franchisee's figures goes only through the approved scopes.
/// </summary>
public class FranchiseLink : BaseEntity
{
    public Guid FranchisorOrganizationId { get; set; }
    public Guid FranchiseeOrganizationId { get; set; }

    public FranchiseLinkStatus Status { get; set; } = FranchiseLinkStatus.Pending;

    /// <summary>The franchisor's user who sent the invitation.</summary>
    public Guid? InvitedByUserId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? RespondedAt { get; set; }
    public Guid? RespondedByUserId { get; set; }

    public DateTime? EndedAt { get; set; }

    /// <summary>The company that ended or declined the link.</summary>
    public Guid? EndedByOrganizationId { get; set; }

    /// <summary>
    /// SHA-256 of the secret in the link sent to the franchisee, or null when there is no open link. The link is for
    /// answering the invitation or a request for more; it is single-use and is useless without the invited company's
    /// Owner signing in.
    /// </summary>
    [MaxLength(64)]
    public string? InviteTokenHash { get; set; }

    public DateTime? InviteTokenExpiresAt { get; set; }

    public List<FranchiseLinkScope> Scopes { get; set; } = [];
}

/// <summary>One kind of information the franchisor may see, and whether the franchisee allows it.</summary>
public class FranchiseLinkScope : BaseEntity
{
    public Guid FranchiseLinkId { get; set; }
    public FranchiseLink? FranchiseLink { get; set; }

    /// <summary>A copy of the link's two companies, so each scope row can be protected on its own.</summary>
    public Guid FranchisorOrganizationId { get; set; }
    public Guid FranchiseeOrganizationId { get; set; }

    [Required, MaxLength(40)]
    public string Scope { get; set; } = string.Empty;

    public FranchiseScopeStatus Status { get; set; } = FranchiseScopeStatus.Requested;

    public DateTime? DecidedAt { get; set; }
}
