using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Common;

namespace CarSpaManagement.Api.Domain.Entities;

/// <summary>
/// One company that uses the platform. Every business record belongs to exactly one organization.
/// This is a platform table: it is not itself owned by an organization.
/// </summary>
public class Organization : BaseEntity
{
    /// <summary>
    /// The code people type at sign-in, for example "0001": a running number, unique across the platform.
    /// It identifies the company; it is not a secret (the username and password protect the account).
    /// </summary>
    [Required, MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    /// <summary>The company's name as known to the platform (the full details live in its business profile).</summary>
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Whether this company has the Franchise add-on, which lets it act as a franchisor (invite companies, see their
    /// approved figures). Switched on by the platform until subscriptions exist. A franchisee never needs it.
    /// </summary>
    public bool FranchiseAddOnEnabled { get; set; }

    /// <summary>An inactive organization cannot sign in.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Builds a company code from its running number: 1 becomes "0001", 42 becomes "0042".</summary>
    public static string FormatCode(int number) => number.ToString("0000");
}
