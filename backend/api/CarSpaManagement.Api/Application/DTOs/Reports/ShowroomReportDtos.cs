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

// ── Monthly / Date-Range Showroom Report DTOs ───────────────────────────────

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
    string PaymentStatus,
    string? SwapId = null,
    string? OriginalStaffName = null,
    string? ReplacementStaffName = null,
    string? ServiceCategory = null
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

public record ShowroomAttendanceReportRowDto(
    DateTime Date,
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    string? Role,
    string HomeShowroomName,
    string WorkingShowroomName,
    string AttendanceStatus,
    string? ScheduledStart,
    string? ScheduledEnd,
    decimal ScheduledHours,
    decimal ActualHours,
    string ConfirmationStatus,
    string? ConfirmedByName,
    DateTime? ConfirmedAt
);

public record ShowroomStaffSwapReportRowDto(
    string SwapId,
    DateTime Date,
    string ShowroomName,
    Guid StaffAId,
    string StaffAMasterId,
    string StaffAName,
    Guid StaffBId,
    string StaffBMasterId,
    string StaffBName,
    string? OriginalWorkingTime,
    string? ReplacementWorkingTime,
    string? SwapStartTime,
    string? SwapEndTime,
    decimal SwapHours,
    string? Reason,
    string? Notes,
    string? CreatedByName,
    DateTime CreatedAt,
    string Status,
    string? ReversedByName,
    DateTime? ReversedAt,
    string? ReversalReason
);

public record ShowroomVehicleTypeSummaryRowDto(
    Guid VehicleTypeId,
    string VehicleTypeCode,
    string VehicleTypeName,
    int TotalVehicles,
    int TotalServices,
    decimal TotalStaffHours,
    decimal SharePercentage
);

public record ShowroomServiceSummaryRowDto(
    Guid WorkTypeId,
    string ServiceCategory,
    string ServiceCode,
    string ServiceName,
    int TotalVehicles,
    int TotalQuantity,
    decimal TotalStaffHours,
    decimal SharePercentage
);

public record ShowroomStaffSummaryRowDto(
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    string? Role,
    string HomeShowroom,
    string AssignmentType,
    int TotalVehicles,
    int TotalServices,
    decimal TotalHours,
    int AttendanceDays,
    decimal WorkloadSharePercent
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
    int UnpaidDaysCount,
    decimal TotalStaffHours = 0m,
    int TotalAttendanceDays = 0,
    int TotalSwaps = 0
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
    IReadOnlyList<MonthlyShowroomDailyBillDto> DailyBills,
    IReadOnlyList<ShowroomAttendanceReportRowDto> AttendanceRecords,
    IReadOnlyList<ShowroomStaffSwapReportRowDto> Swaps,
    IReadOnlyList<ShowroomVehicleTypeSummaryRowDto> VehicleTypeSummary,
    IReadOnlyList<ShowroomServiceSummaryRowDto> ServiceSummary,
    IReadOnlyList<ShowroomStaffSummaryRowDto> StaffSummary
);

public record MonthlyShowroomReportOverallSummaryDto(
    int TotalShowrooms,
    int TotalVehiclesServiced,
    int TotalWorkEntries,
    int TotalServicesPerformed,
    decimal TotalBilledAmount,
    decimal TotalCollectedAmount,
    decimal TotalOutstandingAmount,
    decimal TotalStaffHours = 0m,
    int TotalAttendanceDays = 0,
    int TotalSwaps = 0
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
