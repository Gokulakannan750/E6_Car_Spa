namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record StaffAdvanceReportRowDto(
    Guid Id,
    Guid StaffId,
    string StaffName,
    string? StaffPhone,
    string? StaffRole,
    DateTime AdvanceDate,
    decimal Amount,
    string Reason,
    string? Notes,
    string Status,
    DateTime? SettledAt,
    string? SettledByName,
    DateTime? ObsoletedAt,
    string? ObsoletedByName,
    string? ObsoleteReason
);

public record StaffAdvanceReportSummaryDto(
    decimal OutstandingAmount,
    decimal SettledAmount,
    decimal ObsoleteAmount,
    int OutstandingCount,
    int SettledCount,
    int ObsoleteCount
);

public record StaffAdvanceReportResponse(
    IReadOnlyList<StaffAdvanceReportRowDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    StaffAdvanceReportSummaryDto Summary
);
