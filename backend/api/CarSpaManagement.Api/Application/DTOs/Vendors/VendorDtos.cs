using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Vendors;

public record VendorDto(
    Guid Id,
    string Name,
    string? Phone,
    string? ContactPerson,
    string? Address,
    string? ServiceSpecialty,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateVendorRequest(
    [Required]
    [MaxLength(150)]
    string Name,
    [RegularExpression(@"^[0-9]{10}$", ErrorMessage = "Phone number must be exactly 10 digits.")]
    string? Phone,
    [MaxLength(100)]
    string? ContactPerson,
    [MaxLength(500)]
    string? Address,
    [MaxLength(100)]
    string? ServiceSpecialty);

public record UpdateVendorRequest(
    [Required]
    [MaxLength(150)]
    string Name,
    [RegularExpression(@"^[0-9]{10}$", ErrorMessage = "Phone number must be exactly 10 digits.")]
    string? Phone,
    [MaxLength(100)]
    string? ContactPerson,
    [MaxLength(500)]
    string? Address,
    [MaxLength(100)]
    string? ServiceSpecialty,
    bool IsActive);
