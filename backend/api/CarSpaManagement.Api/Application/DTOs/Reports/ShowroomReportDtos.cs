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

// ── Monthly Showroom Report DTOs ────────────────────────────────────────────

public record MonthlyShowroomServiceItemDto(
    Guid WorkTypeId,
    string WorkTypeCode,
    string WorkTypeName,
    int Quantity,
    string? Notes
);

public record MonthlyShowroomVehicleWorkRowDto(
    Guid Id,
    DateTime Date,
    Guid ShowroomId,
    string ShowroomMasterId,
    string ShowroomName,
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    string? StaffPhone,
    string? StaffRole,
    string? HomeShowroomName,
    string? HomeShowroomMasterId,
    string? AssignmentType,
    string? SessionType,
    string? StartTime,
    string? EndTime,
    decimal? WorkingHours,
    Guid VehicleTypeId,
    string VehicleTypeCode,
    string VehicleTypeName,
    int VehicleQuantity,
    string ServicesSummary,
    IReadOnlyList<MonthlyShowroomServiceItemDto> ServiceItems,
    string? TimeRecorded,
    string? Notes,
    decimal? DailyBilledAmount,
    decimal? DailyCollectedAmount,
    string PaymentStatus
);

public record MonthlyShowroomDailyBillDto(
    Guid Id,
    DateTime Date,
    decimal Amount,
    decimal PaidAmount,
    decimal BalanceAmount,
    string Status,
    int PaymentCount,
    string? Notes
);

public record MonthlyShowroomSummaryDto(
    int TotalVehiclesServiced,
    int TotalWorkEntries,
    int TotalServicesPerformed,
    int TotalActiveStaff,
    decimal TotalBilledAmount,
    decimal TotalCollectedAmount,
    decimal TotalOutstandingAmount,
    int TotalBillingDays,
    int PaidDaysCount,
    int PartiallyPaidDaysCount,
    int UnpaidDaysCount
);

public record MonthlyShowroomDetailDto(
    Guid ShowroomId,
    string ShowroomMasterId,
    string ShowroomName,
    string ShowroomAddress,
    string? ShowroomPhone,
    string? ShowroomGstin,
    MonthlyShowroomSummaryDto Summary,
    IReadOnlyList<MonthlyShowroomVehicleWorkRowDto> VehicleWorks,
    IReadOnlyList<MonthlyShowroomDailyBillDto> DailyBills
);

public record MonthlyShowroomReportOverallSummaryDto(
    int TotalShowrooms,
    int TotalVehiclesServiced,
    int TotalWorkEntries,
    int TotalServicesPerformed,
    decimal TotalBilledAmount,
    decimal TotalCollectedAmount,
    decimal TotalOutstandingAmount
);

public record MonthlyShowroomReportResponse(
    int Year,
    int Month,
    string MonthName,
    DateTime FromDate,
    DateTime ToDate,
    MonthlyShowroomReportOverallSummaryDto OverallSummary,
    IReadOnlyList<MonthlyShowroomDetailDto> Showrooms
);
