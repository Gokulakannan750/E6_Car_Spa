using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Invoices;

public record InvoiceItemDto(
 Guid Id,
 Guid? ServiceId,
 string Description,
 int Quantity,
 decimal UnitPrice,
 decimal Discount,
 decimal TaxableAmount,
 decimal TaxAmount,
 decimal TotalAmount);

public record InvoiceDto(
 Guid Id,
 string? InvoiceNumber,
 Guid JobCardId,
 string JobCardNumber,
 Guid CustomerId,
 string CustomerName,
 string CustomerPhone,
 Guid VehicleId,
 string RegistrationNumber,
 string VehicleMake,
 string VehicleModel,
 string? VehicleVariant,
 string? VehicleColor,
 DateTime InvoiceDate,
 decimal Subtotal,
 decimal Discount,
 decimal TaxableAmount,
 decimal GstAmount,
 decimal TotalAmount,
 decimal PaidAmount,
 decimal BalanceAmount,
 InvoiceStatus Status,
 string? Notes,
 bool IsGstEnabled,
 IReadOnlyList<InvoiceItemDto> Items,
 DateTime CreatedAt,
 DateTime? UpdatedAt);

public record InvoiceListDto(
 Guid Id,
 string? InvoiceNumber,
 string JobCardNumber,
 string CustomerName,
 string CustomerPhone,
 string RegistrationNumber,
 string Vehicle,
 DateTime InvoiceDate,
 decimal TotalAmount,
 decimal PaidAmount,
 decimal BalanceAmount,
 InvoiceStatus Status,
 DateTime CreatedAt);

public record InvoiceListResponse(IReadOnlyList<InvoiceListDto> Items, int TotalCount, int Page, int PageSize);
