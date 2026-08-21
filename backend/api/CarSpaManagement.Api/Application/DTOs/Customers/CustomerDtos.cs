using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Customers;

public record CustomerDto(Guid Id, string Name, string PhoneNumber, string? Email, string? Address, DateTime CreatedAt, int VehicleCount, int JobCardCount, decimal TotalRevenue);

public record CreateCustomerRequest
{
 [Required, MaxLength(100)] public string Name { get; init; } = string.Empty;
 [Required, MaxLength(20)] public string PhoneNumber { get; init; } = string.Empty;
 [EmailAddress, MaxLength(100)] public string? Email { get; init; }
 [MaxLength(500)] public string? Address { get; init; }
}

public record UpdateCustomerRequest
{
 [Required, MaxLength(100)] public string Name { get; init; } = string.Empty;
 [Required, MaxLength(20)] public string PhoneNumber { get; init; } = string.Empty;
 [EmailAddress, MaxLength(100)] public string? Email { get; init; }
 [MaxLength(500)] public string? Address { get; init; }
}

public record CustomerListResponse(IReadOnlyList<CustomerDto> Items, int TotalCount, int Page, int PageSize);

// ── Customer History ──────────────────────────────────────────────────────────

public record CustomerJobCardHistoryItemDto(
 Guid JobCardId,
 string JobCardNumber,
 DateTime CreatedAt,
 string Status,
 string? VehicleNumber,
 string? VehicleModel,
 decimal Subtotal,
 decimal TaxAmount,
 decimal DiscountAmount,
 decimal TotalAmount,
 IReadOnlyList<CustomerVehicleSummaryDto> Vehicles
);

public record CustomerVehicleSummaryDto(
 Guid VehicleId,
 string VehicleNumber,
 string? Model,
 string? Color
);

public record CustomerHistoryResponse(
 Guid CustomerId,
 string CustomerName,
 string PhoneNumber,
 int TotalJobCards,
 int TotalVehicles,
 IReadOnlyList<CustomerJobCardHistoryItemDto> JobCards
);
