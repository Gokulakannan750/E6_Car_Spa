using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class BusinessProfile : BaseEntity
{
    /// <summary>
    /// Database singleton key ensuring only ONE active business profile record exists in the system.
    /// </summary>
    public int SingletonKey { get; set; } = 1;

    [Required]
    [MaxLength(150)]
    public string BusinessName { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string AddressLine1 { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? AddressLine2 { get; set; }

    [Required]
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string State { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PostalCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(10)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Gstin { get; set; }

    [MaxLength(500)]
    public string? LogoPath { get; set; }

    [Required]
    [MaxLength(10)]
    public string InvoicePrefix { get; set; } = "INV";

    /// <summary>Short line printed under the business name on documents. Optional.</summary>
    [MaxLength(150)]
    public string? Tagline { get; set; }

    /// <summary>Accent colour for documents as #RRGGBB. Optional; documents use a neutral colour when empty.</summary>
    [MaxLength(7)]
    public string? BrandColor { get; set; }

    /// <summary>Accent colour of the app itself (buttons, links, highlights) as #RRGGBB. Optional; a neutral blue is used when empty.</summary>
    [MaxLength(7)]
    public string? AppColor { get; set; }

    /// <summary>Colour of the sidebar menu and the login page as #RRGGBB. Optional; a neutral dark slate is used when empty.</summary>
    [MaxLength(7)]
    public string? SidebarColor { get; set; }

    /// <summary>The company's own picture for the login page (relative upload URL). Optional; the page is plain colour when empty.</summary>
    [MaxLength(500)]
    public string? LoginImagePath { get; set; }

    [MaxLength(2000)]
    public string? TermsAndConditions { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }
}
