using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Showrooms;

public record ShowroomDto(
    Guid Id,
    string Name,
    string Address,
    string? Phone,
    bool IsActive,
    int ActiveStaffCountToday,
    int TotalVehiclesToday,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateShowroomRequest
{
    [Required, MaxLength(150)]
    public string Name { get; init; } = string.Empty;

    [Required, MaxLength(500)]
    public string Address { get; init; } = string.Empty;

    [MaxLength(20)]
    public string? Phone { get; init; }

    public bool IsActive { get; init; } = true;
}

public record UpdateShowroomRequest
{
    [MaxLength(150)]
    public string? Name { get; init; }

    [MaxLength(500)]
    public string? Address { get; init; }

    [MaxLength(20)]
    public string? Phone { get; init; }

    public bool? IsActive { get; init; }
}

public record DailyStaffAssignmentDto(
    Guid Id,
    Guid ShowroomId,
    string ShowroomName,
    Guid StaffId,
    string StaffName,
    string StaffPhone,
    string? StaffRole,
    DateTime Date,
    int VehiclesAttended,
    DateTime CreatedAt);

public record DailyStaffResponse(
    Guid ShowroomId,
    string ShowroomName,
    DateTime Date,
    int TotalVehiclesAttended,
    bool IsAttendanceConfirmed,
    DateTime? AttendanceConfirmedAt,
    Guid? AttendanceConfirmedByUserId,
    string? AttendanceConfirmedByName,
    IReadOnlyList<DailyStaffAssignmentDto> StaffAssignments);

public record CreateDailyStaffAssignmentRequest
{
    [Required]
    public Guid StaffId { get; init; }

    [Required]
    public DateTime Date { get; init; }

    [Range(0, 99999)]
    public int VehiclesAttended { get; init; } = 0;
}

public record UpdateDailyStaffAssignmentRequest
{
    [Range(0, 99999)]
    public int VehiclesAttended { get; init; }
}

public record ShowroomPaymentDto(
    Guid Id,
    Guid ShowroomDailyBillId,
    decimal Amount,
    string PaymentMethod,
    string? Reference,
    DateTime PaymentDate,
    string? Notes,
    DateTime CreatedAt);

public record ShowroomDailyBillDto(
    Guid Id,
    Guid ShowroomId,
    string ShowroomName,
    DateTime Date,
    decimal Amount,
    decimal AmountReceived,
    decimal BalanceAmount,
    string Status,
    string? Notes,
    IReadOnlyList<ShowroomPaymentDto> Payments,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record SetShowroomDailyBillRequest
{
    [Range(0, 999999999.99)]
    public decimal Amount { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record RecordShowroomPaymentRequest
{
    [Required]
    [Range(0.01, 999999999.99)]
    public decimal Amount { get; init; }

    [Required]
    public string PaymentMethod { get; init; } = "Cash";

    [MaxLength(100)]
    public string? Reference { get; init; }

    public DateTime? PaymentDate { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record ShowroomDailyHistoryRowDto(
    DateTime Date,
    int StaffCount,
    int TotalVehicles,
    decimal BilledAmount,
    decimal ReceivedAmount,
    decimal BalanceAmount,
    string Status,
    bool HasBill);

public record ShowroomStaffProductivityDto(
    Guid StaffId,
    string StaffName,
    string StaffPhone,
    string? StaffRole,
    int DaysAssigned,
    int TotalVehiclesAttended,
    decimal AverageVehiclesPerDay);

public record ShowroomSummaryDto(
    Guid ShowroomId,
    string ShowroomName,
    DateTime FromDate,
    DateTime ToDate,
    int TotalDaysWithActivity,
    int TotalStaffAssignments,
    int TotalVehiclesAttended,
    decimal AverageVehiclesPerDay,
    decimal TotalBilled,
    decimal TotalReceived,
    decimal OutstandingAmount,
    int PaidDaysCount,
    int PartiallyPaidDaysCount,
    int UnpaidDaysCount,
    IReadOnlyList<ShowroomDailyHistoryRowDto> DailyHistory,
    IReadOnlyList<ShowroomStaffProductivityDto> StaffProductivity);

public record ShowroomOutstandingOverviewDto(
    Guid ShowroomId,
    string ShowroomName,
    string Address,
    string? Phone,
    bool IsActive,
    decimal TotalBilled,
    decimal TotalReceived,
    decimal OutstandingAmount,
    int UnpaidDaysCount);

