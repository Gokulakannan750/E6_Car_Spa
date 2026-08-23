using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.JobCards;

public record JobCardServiceDto(
 Guid Id,
 Guid ServiceId,
 string ServiceName,
 decimal UnitPrice,
 int Quantity,
 decimal TaxPercentage,
 decimal DiscountAmount,
 decimal LineTotal);

public record CustomerSummaryDto(Guid Id, string Name, string PhoneNumber);

public record VehicleSummaryDto(Guid Id, string RegistrationNumber, string Make, string Model, string? Variant, string? Color);

public record JobCardDto(
 Guid Id,
 string JobCardNumber,
 CustomerSummaryDto Customer,
 VehicleSummaryDto Vehicle,
 JobCardStatus Status,
 string? Notes,
 IReadOnlyList<JobCardServiceDto> Services,
 decimal Subtotal,
 decimal TaxAmount,
 decimal DiscountAmount,
 decimal TotalAmount,
 Guid? InvoiceId,
 string? InvoiceNumber,
 string? InvoiceStatus,
 DateTime CreatedAt,
 DateTime? UpdatedAt);

public record JobCardListDto(
 Guid Id,
 string JobCardNumber,
 string CustomerName,
 string CustomerPhone,
 string RegistrationNumber,
 string Make,
 string Model,
 JobCardStatus Status,
 decimal TotalAmount,
 Guid? InvoiceId,
 string? InvoiceNumber,
 string? InvoiceStatus,
 DateTime CreatedAt);

public record JobCardListResponse(IReadOnlyList<JobCardListDto> Items, int TotalCount, int Page, int PageSize);
