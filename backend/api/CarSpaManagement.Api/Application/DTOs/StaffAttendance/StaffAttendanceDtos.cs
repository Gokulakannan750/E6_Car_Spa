using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.StaffAttendance;

public record StaffAttendanceDto(
    Guid Id,
    Guid StaffId,
    string StaffName,
    string? StaffRole,
    string StaffPhoneNumber,
    string AttendanceDate,
    string Status,
    string? CheckInTime,
    string? CheckOutTime,
    double? WorkingHours,
    string? WorkingHoursFormatted,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    string? CreatedByUserName,
    string? UpdatedByUserName
);

public record DailyStaffAttendanceItemDto(
    Guid StaffId,
    string StaffName,
    string? StaffRole,
    string StaffPhoneNumber,
    bool IsActive,
    Guid? AttendanceId,
    string Status,
    string? CheckInTime,
    string? CheckOutTime,
    double? WorkingHours,
    string? WorkingHoursFormatted,
    string? Notes,
    string AttendanceDate
);

public record DailyAttendanceSummaryDto(
    int TotalActiveStaff,
    int PresentCount,
    int HalfDayCount,
    int LeaveCount,
    int UnmarkedCount
);

public record DailyAttendanceResponse(
    string Date,
    bool IsAttendanceConfirmed,
    DateTime? AttendanceConfirmedAt,
    Guid? AttendanceConfirmedByUserId,
    string? AttendanceConfirmedByName,
    DailyAttendanceSummaryDto Summary,
    List<DailyStaffAttendanceItemDto> StaffMembers
);

public record DateRangeAttendanceResponse(
    string FromDate,
    string ToDate,
    int TotalRecords,
    int PresentCount,
    int HalfDayCount,
    int LeaveCount,
    List<StaffAttendanceDto> Records
);

public record MonthlyStaffDailyRecordDto(
    string Date,
    int Day,
    string DayOfWeek,
    string Status,
    string? CheckInTime,
    string? CheckOutTime,
    double? WorkingHours,
    string? WorkingHoursFormatted,
    string? Notes
);

public record MonthlyStaffAttendanceItemDto(
    Guid StaffId,
    string Name,
    string? Role,
    string PhoneNumber,
    int PresentDays,
    int HalfDays,
    int LeaveDays,
    int UnmarkedDays,
    int AttendanceDays,
    List<MonthlyStaffDailyRecordDto> DailyRecords
);

public record MonthlyAttendanceSummaryDto(
    int Present,
    int HalfDay,
    int Leave,
    int Unmarked
);

public record MonthlyAttendanceReportResponse(
    int Year,
    int Month,
    string FromDate,
    string ToDate,
    int TotalCalendarDays,
    int StaffCount,
    MonthlyAttendanceSummaryDto Summary,
    List<MonthlyStaffAttendanceItemDto> Staff
);

public class UpsertStaffAttendanceRequest
{
    [Required]
    public Guid StaffId { get; set; }

    [Required]
    [RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = "AttendanceDate must be in format YYYY-MM-DD.")]
    public string AttendanceDate { get; set; } = string.Empty;

    [Required]
    public string Status { get; set; } = "Present";

    [RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "CheckInTime must be in 24-hour format HH:mm.")]
    public string? CheckInTime { get; set; }

    [RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "CheckOutTime must be in 24-hour format HH:mm.")]
    public string? CheckOutTime { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}

public static class AttendanceTimeHelper
{
    public static (double? Hours, string? Formatted) CalculateWorkingHours(string? checkIn, string? checkOut)
    {
        if (string.IsNullOrWhiteSpace(checkIn) || string.IsNullOrWhiteSpace(checkOut))
            return (null, null);

        if (TimeSpan.TryParse(checkIn, out var inTime) && TimeSpan.TryParse(checkOut, out var outTime))
        {
            if (outTime >= inTime)
            {
                var diff = outTime - inTime;
                var totalHours = Math.Round(diff.TotalHours, 2);
                var hrs = (int)diff.TotalHours;
                var mins = diff.Minutes;
                var formatted = mins > 0 ? $"{hrs}h {mins}m" : $"{hrs}h";
                return (totalHours, formatted);
            }
        }
        return (null, null);
    }
}
