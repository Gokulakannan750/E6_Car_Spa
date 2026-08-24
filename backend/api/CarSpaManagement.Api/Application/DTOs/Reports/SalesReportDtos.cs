using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record SalesReportRowDto(
    Guid InvoiceId,
    string? InvoiceNumber,
    DateTime InvoiceDate,
    string CustomerName,
    string CustomerPhone,
    string RegistrationNumber,
    decimal Subtotal,
    decimal Discount,
    decimal Gst,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal BalanceAmount,
    InvoiceStatus Status
);

public record SalesReportSummaryDto(
    decimal TotalSubtotal,
    decimal TotalDiscount,
    decimal TotalGst,
    decimal TotalAmount,
    decimal TotalPaid,
    decimal TotalBalance,
    int InvoiceCount
);

public record SalesReportResponse(
    IReadOnlyList<SalesReportRowDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    SalesReportSummaryDto Summary
);
