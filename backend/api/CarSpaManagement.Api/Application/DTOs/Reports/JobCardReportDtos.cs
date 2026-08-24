using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record JobCardReportRowDto(
    Guid JobCardId,
    string JobCardNumber,
    DateTime Date,
    string CustomerName,
    string CustomerPhone,
    string VehicleRegistration,
    string VehicleDetails,
    JobCardStatus Status,
    decimal TotalAmount,
    Guid? InvoiceId,
    string? InvoiceNumber,
    InvoiceStatus? InvoiceStatus
);

public record JobCardReportSummaryDto(
    int TotalCount,
    int DraftCount,
    int InProgressCount,
    int CompletedCount,
    int CancelledCount,
    int InvoicedCount,
    decimal TotalRevenue
);

public record JobCardReportResponse(
    IReadOnlyList<JobCardReportRowDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    JobCardReportSummaryDto Summary
);
