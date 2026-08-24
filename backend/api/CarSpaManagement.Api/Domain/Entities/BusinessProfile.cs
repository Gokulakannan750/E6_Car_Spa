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
    public string BusinessName { get; set; } = "E6 Car Spa";

    [Required]
    [MaxLength(200)]
    public string AddressLine1 { get; set; } = "36, Geetha Nagar Main Road";

    [MaxLength(200)]
    public string? AddressLine2 { get; set; } = "Behind Sakthi Mahal, Perundurai Road";

    [Required]
    [MaxLength(100)]
    public string City { get; set; } = "Erode";

    [Required]
    [MaxLength(100)]
    public string State { get; set; } = "Tamil Nadu";

    [Required]
    [MaxLength(20)]
    public string PostalCode { get; set; } = "638011";

    [Required]
    [MaxLength(30)]
    public string Phone { get; set; } = "+91 9578749449";

    [Required]
    [MaxLength(150)]
    public string Email { get; set; } = "e6carspaerd@gmail.com";

    [MaxLength(20)]
    public string? Gstin { get; set; }

    [MaxLength(500)]
    public string? LogoPath { get; set; } = "/uploads/logos/e6-logo.png";

    [Required]
    [MaxLength(10)]
    public string InvoicePrefix { get; set; } = "INV";

    [MaxLength(2000)]
    public string? TermsAndConditions { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }
}
