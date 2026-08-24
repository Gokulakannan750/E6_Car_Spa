namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record ShowroomReportRowDto(
    Guid ShowroomId,
    string ShowroomName,
    DateTime Date,
    int StaffCount,
    int VehiclesAttended,
    decimal BilledAmount,
    decimal ReceivedAmount,
    decimal BalanceAmount,
    string PaymentStatus,
    bool AttendanceConfirmed,
    DateTime? AttendanceConfirmedAt
);

public record ShowroomReportSummaryDto(
    decimal TotalBilled,
    decimal TotalReceived,
    decimal TotalOutstanding,
    int TotalVehiclesAttended,
    int TotalAssignments,
    int PaidDaysCount,
    int PartiallyPaidDaysCount,
    int UnpaidDaysCount
);

public record ShowroomReportResponse(
    IReadOnlyList<ShowroomReportRowDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    ShowroomReportSummaryDto Summary
);
