using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using ValidationException = CarSpaManagement.Api.Application.Common.ValidationException;

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

    public static (string StartTime, string EndTime) ResolveSessionTimes(ShowroomStaffSessionType sessionType, string? startTime, string? endTime)
    {
        var s = !string.IsNullOrWhiteSpace(startTime)
            ? startTime.Trim()
            : sessionType switch
            {
                ShowroomStaffSessionType.Morning => "09:00",
                ShowroomStaffSessionType.Afternoon => "14:00",
                ShowroomStaffSessionType.Evening => "18:00",
                _ => "09:00"
            };

        var e = !string.IsNullOrWhiteSpace(endTime)
            ? endTime.Trim()
            : sessionType switch
            {
                ShowroomStaffSessionType.Morning => "13:00",
                ShowroomStaffSessionType.Afternoon => "18:00",
                ShowroomStaffSessionType.Evening => "21:00",
                _ => "18:00"
            };

        return (s, e);
    }

    public static async Task ValidateNoSessionOverlapAsync(
        AppDbContext db,
        Guid staffId,
        string staffName,
        DateTime date,
        string startTime,
        string endTime,
        Guid? excludeSessionId = null,
        CancellationToken ct = default)
    {
        var targetDate = ShowroomDateHelper.ToUtcDate(date);

        if (!TimeSpan.TryParse(startTime, out var inTime) || !TimeSpan.TryParse(endTime, out var outTime))
        {
            throw new ValidationException("Start Time and End Time must be in valid 24-hour format (HH:mm).");
        }

        if (outTime <= inTime)
        {
            throw new ValidationException("End Time must be later than Start Time.");
        }

        var existingSessions = await db.ShowroomStaffWorkSessions
            .AsNoTracking()
            .Include(s => s.WorkingShowroom)
            .Where(s => s.StaffId == staffId
                     && s.Date == targetDate
                     && !s.IsDeleted
                     && (excludeSessionId == null || s.Id != excludeSessionId.Value))
            .ToListAsync(ct);

        foreach (var s in existingSessions)
        {
            var (existStartStr, existEndStr) = ResolveSessionTimes(s.SessionType, s.StartTime, s.EndTime);
            if (TimeSpan.TryParse(existStartStr, out var existIn) && TimeSpan.TryParse(existEndStr, out var existOut))
            {
                // Overlap exists if inTime < existOut && existIn < outTime
                if (inTime < existOut && existIn < outTime)
                {
                    var existingShowroomName = s.WorkingShowroom?.Name ?? "another showroom";
                    throw new ValidationException($"Staff member '{staffName}' already has an active assignment at '{existingShowroomName}' from {existStartStr} to {existEndStr} on {targetDate:dd-MMM-yyyy}. Overlapping assignments are not allowed.");
                }
            }
        }
    }
}

