using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Vehicles;

public record VehicleDto(Guid Id, string RegistrationNumber, string Make, string Model, string? Variant, string? Color, Guid CustomerId, string CustomerName, DateTime CreatedAt);

public record CreateVehicleRequest
{
 [Required, MaxLength(20)] public string RegistrationNumber { get; init; } = string.Empty;
 [Required, MaxLength(50)] public string Make { get; init; } = string.Empty;
 [Required, MaxLength(50)] public string Model { get; init; } = string.Empty;
 [MaxLength(50)] public string? Variant { get; init; }
 [MaxLength(30)] public string? Color { get; init; }
 [Required] public Guid CustomerId { get; init; }
}

public record UpdateVehicleRequest
{
 [Required, MaxLength(20)] public string RegistrationNumber { get; init; } = string.Empty;
 [Required, MaxLength(50)] public string Make { get; init; } = string.Empty;
 [Required, MaxLength(50)] public string Model { get; init; } = string.Empty;
 [MaxLength(50)] public string? Variant { get; init; }
 [MaxLength(30)] public string? Color { get; init; }
}

public record VehicleListResponse(IReadOnlyList<VehicleDto> Items, int TotalCount, int Page, int PageSize);
