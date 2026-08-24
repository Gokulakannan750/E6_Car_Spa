using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record OutstandingInvoiceRowDto(
    Guid InvoiceId,
    string? InvoiceNumber,
    DateTime InvoiceDate,
    string CustomerName,
    string CustomerPhone,
    string VehicleRegistration,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal BalanceAmount,
    InvoiceStatus Status,
    int AgeInDays
);

public record OutstandingInvoiceSummaryDto(
    decimal TotalOutstandingAmount,
    decimal TotalInvoiceAmount,
    decimal TotalPaidAmount,
    int InvoiceCount
);

public record OutstandingInvoiceReportResponse(
    IReadOnlyList<OutstandingInvoiceRowDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    OutstandingInvoiceSummaryDto Summary
);
