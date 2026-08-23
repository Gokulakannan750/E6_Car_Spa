using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Invoices;

public record CreateInvoiceFromJobCardRequest(
 Guid JobCardId);

public record UpdateInvoiceRequest(
 decimal? Discount,
 string? Notes,
 InvoiceStatus? Status,
 bool? IsGstEnabled = null);
