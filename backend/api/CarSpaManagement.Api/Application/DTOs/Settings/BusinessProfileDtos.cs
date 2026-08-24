using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Settings;

public record BusinessProfileDto(
    Guid Id,
    string BusinessName,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string State,
    string PostalCode,
    string Phone,
    string Email,
    string? Gstin,
    string? LogoPath,
    string InvoicePrefix,
    string? TermsAndConditions,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public class UpdateBusinessProfileRequest
{
    [Required(ErrorMessage = "Business name is required.")]
    [MaxLength(150, ErrorMessage = "Business name cannot exceed 150 characters.")]
    public string BusinessName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Address Line 1 is required.")]
    [MaxLength(200, ErrorMessage = "Address Line 1 cannot exceed 200 characters.")]
    public string AddressLine1 { get; set; } = string.Empty;

    [MaxLength(200, ErrorMessage = "Address Line 2 cannot exceed 200 characters.")]
    public string? AddressLine2 { get; set; }

    [Required(ErrorMessage = "City is required.")]
    [MaxLength(100, ErrorMessage = "City cannot exceed 100 characters.")]
    public string City { get; set; } = string.Empty;

    [Required(ErrorMessage = "State is required.")]
    [MaxLength(100, ErrorMessage = "State cannot exceed 100 characters.")]
    public string State { get; set; } = string.Empty;

    [Required(ErrorMessage = "PIN code is required.")]
    [MaxLength(20, ErrorMessage = "PIN code cannot exceed 20 characters.")]
    public string PostalCode { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required.")]
    [MaxLength(30, ErrorMessage = "Phone number cannot exceed 30 characters.")]
    public string Phone { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email address is required.")]
    [EmailAddress(ErrorMessage = "Please provide a valid email address.")]
    [MaxLength(150, ErrorMessage = "Email cannot exceed 150 characters.")]
    public string Email { get; set; } = string.Empty;

    [MaxLength(20, ErrorMessage = "GSTIN cannot exceed 20 characters.")]
    public string? Gstin { get; set; }

    [MaxLength(500, ErrorMessage = "Logo path cannot exceed 500 characters.")]
    public string? LogoPath { get; set; }

    [MaxLength(10, ErrorMessage = "Invoice prefix cannot exceed 10 characters.")]
    public string? InvoicePrefix { get; set; }

    [MaxLength(2000, ErrorMessage = "Terms & conditions cannot exceed 2000 characters.")]
    public string? TermsAndConditions { get; set; }
}

public record LogoUploadResponse(
    string LogoUrl,
    BusinessProfileDto Profile
);
