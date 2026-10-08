using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Domain.Entities;

/// <summary>
/// One company that uses the platform. Every business record belongs to exactly one organization.
/// This is a platform table: it is not itself owned by an organization.
/// </summary>
public class Organization : BaseEntity
{
    /// <summary>
    /// The code people type at sign-in, for example "01-0001": the business type (two digits), a dash, and a
    /// running number for that type. Unique across the platform.
    /// </summary>
    [Required, MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    public BusinessType BusinessType { get; set; } = BusinessType.CarSpa;

    /// <summary>The company's name as known to the platform (the full details live in its business profile).</summary>
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    /// <summary>An inactive organization cannot sign in.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Builds a company code from a business type and that type's running number.</summary>
    public static string FormatCode(BusinessType type, int number) => $"{(int)type:00}-{number:0000}";
}
