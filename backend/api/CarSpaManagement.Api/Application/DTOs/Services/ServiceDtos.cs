using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Services;

public record ServiceDto(Guid Id, string Name, string? Description, string? Category, decimal Price, decimal TaxPercentage, int? DurationMinutes, bool IsActive, DateTime CreatedAt);

public record CreateServiceRequest
{
 [Required, MaxLength(100)] public string Name { get; init; } = string.Empty;
 [MaxLength(500)] public string? Description { get; init; }
 [MaxLength(50)] public string? Category { get; init; }
 [Required, Range(0, 999999.99)] public decimal Price { get; init; }
 [Required, Range(0, 100)] public decimal TaxPercentage { get; init; }
 [Range(1, 1440)] public int? DurationMinutes { get; init; }
 public bool IsActive { get; init; } = true;
}

public record UpdateServiceRequest
{
 [Required, MaxLength(100)] public string Name { get; init; } = string.Empty;
 [MaxLength(500)] public string? Description { get; init; }
 [MaxLength(50)] public string? Category { get; init; }
 [Required, Range(0, 999999.99)] public decimal Price { get; init; }
 [Required, Range(0, 100)] public decimal TaxPercentage { get; init; }
 [Range(1, 1440)] public int? DurationMinutes { get; init; }
 public bool IsActive { get; init; } = true;
}

public record ServiceListResponse(IReadOnlyList<ServiceDto> Items, int TotalCount, int Page, int PageSize);
