using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Invoices;

public record InvoiceItemDto(
 Guid Id,
 Guid? ServiceId,
 Guid? OutsideJobId,
 string Description,
 int Quantity,
 decimal UnitPrice,
 decimal Discount,
 decimal TaxableAmount,
 decimal TaxAmount,
 decimal TotalAmount,
 decimal? TaxRatePercent = null,
 decimal CgstAmount = 0m,
 decimal SgstAmount = 0m);

/// <summary>Taxable value and tax of all invoice lines at one GST rate (null rate = legacy line with unknown rate).</summary>
public record TaxBreakdownDto(
 decimal? RatePercent,
 decimal TaxableAmount,
 decimal CgstAmount,
 decimal SgstAmount,
 decimal TaxAmount);

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
 IReadOnlyList<PaymentDto> Payments,
 DateTime CreatedAt,
 DateTime? UpdatedAt,
 decimal CgstAmount = 0m,
 decimal SgstAmount = 0m,
 IReadOnlyList<TaxBreakdownDto>? TaxBreakdown = null);

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
