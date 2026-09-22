using System.Globalization;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.StaffAttendance;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class StaffAttendanceService : IStaffAttendanceService
{
    private readonly AppDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public StaffAttendanceService(AppDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    private async Task EnsureAttendanceNotLockedAsync(DateTime date, bool isOwner, CancellationToken ct)
    {
        var targetDate = date.Date;
        var isConfirmed = await _db.StaffDailyAttendanceConfirmations
            .AnyAsync(a => a.Date == targetDate && a.IsAttendanceConfirmed && !a.IsDeleted, ct);

        if (isConfirmed)
        {
            if (!isOwner)
            {
                throw new ForbiddenException("Staff attendance is confirmed and locked for this date.");
            }
            throw new ConflictException("Staff attendance is confirmed and locked for this date. Please unlock attendance to make corrections.");
        }
    }

    public async Task<DailyAttendanceResponse> GetDailyAttendanceAsync(DateTime date, CancellationToken ct = default)
    {
        var targetDate = date.Date;

        // Fetch all active staff members
        var activeStaff = await _db.Staff
            .Where(s => !s.IsDeleted && s.IsActive)
            .OrderBy(s => s.Name)
            .ToListAsync(ct);

        // Fetch attendance records for this date
        var attendances = await _db.StaffAttendances
            .Include(a => a.CreatedByUser)
            .Include(a => a.UpdatedByUser)
            .Where(a => !a.IsDeleted && a.AttendanceDate == targetDate)
            .ToListAsync(ct);

        var attendanceMap = attendances.ToDictionary(a => a.StaffId);

        var items = new List<DailyStaffAttendanceItemDto>();
        int presentCount = 0;
        int halfDayCount = 0;
        int leaveCount = 0;

        foreach (var staff in activeStaff)
        {
            if (attendanceMap.TryGetValue(staff.Id, out var att))
            {
                var (hours, hoursFormatted) = AttendanceTimeHelper.CalculateWorkingHours(att.CheckInTime, att.CheckOutTime);

                switch (att.Status)
                {
                    case StaffAttendanceStatus.Present:
                        presentCount++;
                        break;
                    case StaffAttendanceStatus.HalfDay:
                        halfDayCount++;
                        break;
                    case StaffAttendanceStatus.Leave:
                        leaveCount++;
                        break;
                }

                items.Add(new DailyStaffAttendanceItemDto(
                    StaffId: staff.Id,
                    StaffName: staff.Name,
                    StaffRole: staff.Role,
                    StaffPhoneNumber: staff.PhoneNumber,
                    IsActive: staff.IsActive,
                    AttendanceId: att.Id,
                    Status: att.Status.ToString(),
                    CheckInTime: att.CheckInTime,
                    CheckOutTime: att.CheckOutTime,
                    WorkingHours: hours,
                    WorkingHoursFormatted: hoursFormatted,
                    Notes: att.Notes,
                    AttendanceDate: targetDate.ToString("yyyy-MM-dd")
                ));
            }
            else
            {
                items.Add(new DailyStaffAttendanceItemDto(
                    StaffId: staff.Id,
                    StaffName: staff.Name,
                    StaffRole: staff.Role,
                    StaffPhoneNumber: staff.PhoneNumber,
                    IsActive: staff.IsActive,
                    AttendanceId: null,
                    Status: "Unmarked",
                    CheckInTime: null,
                    CheckOutTime: null,
                    WorkingHours: null,
                    WorkingHoursFormatted: null,
                    Notes: null,
                    AttendanceDate: targetDate.ToString("yyyy-MM-dd")
                ));
            }
        }

        int totalActive = activeStaff.Count;
        int unmarkedCount = totalActive - (presentCount + halfDayCount + leaveCount);

        var summary = new DailyAttendanceSummaryDto(
            TotalActiveStaff: totalActive,
            PresentCount: presentCount,
            HalfDayCount: halfDayCount,
            LeaveCount: leaveCount,
            UnmarkedCount: Math.Max(0, unmarkedCount)
        );

        // Fetch confirmation status
        var confirmation = await _db.StaffDailyAttendanceConfirmations
            .Include(c => c.AttendanceConfirmedByUser)
            .FirstOrDefaultAsync(c => c.Date == targetDate && !c.IsDeleted, ct);

        var isConfirmed = confirmation?.IsAttendanceConfirmed ?? false;
        var confirmedAt = confirmation?.AttendanceConfirmedAt;
        var confirmedByUserId = confirmation?.AttendanceConfirmedByUserId;
        var confirmedByName = confirmation?.AttendanceConfirmedByUser?.FullName ?? confirmation?.AttendanceConfirmedByUser?.Username;

        return new DailyAttendanceResponse(
            Date: targetDate.ToString("yyyy-MM-dd"),
            IsAttendanceConfirmed: isConfirmed,
            AttendanceConfirmedAt: confirmedAt,
            AttendanceConfirmedByUserId: confirmedByUserId,
            AttendanceConfirmedByName: confirmedByName,
            Summary: summary,
            StaffMembers: items
        );
    }

    public async Task<DateRangeAttendanceResponse> GetDateRangeAttendanceAsync(
        DateTime fromDate,
        DateTime toDate,
        Guid? staffId = null,
        string? status = null,
        string? search = null,
        CancellationToken ct = default)
    {
        var from = fromDate.Date;
        var to = toDate.Date;

        if (to < from)
        {
            throw new ValidationException("To Date cannot be earlier than From Date.");
        }

        var query = _db.StaffAttendances
            .Include(a => a.Staff)
            .Include(a => a.CreatedByUser)
            .Include(a => a.UpdatedByUser)
            .Where(a => !a.IsDeleted && a.Staff != null && !a.Staff.IsDeleted && a.Staff.IsActive && a.AttendanceDate >= from && a.AttendanceDate <= to);

        if (staffId.HasValue && staffId.Value != Guid.Empty)
        {
            query = query.Where(a => a.StaffId == staffId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            if (Enum.TryParse<StaffAttendanceStatus>(status, true, out var parsedStatus))
            {
                query = query.Where(a => a.Status == parsedStatus);
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(a =>
                (a.Staff != null && a.Staff.Name.ToLower().Contains(term)) ||
                (a.Staff != null && a.Staff.PhoneNumber.Contains(term)) ||
                (a.Staff != null && a.Staff.Role != null && a.Staff.Role.ToLower().Contains(term)) ||
                (!string.IsNullOrEmpty(a.Notes) && a.Notes.ToLower().Contains(term)));
        }

        var list = await query
            .OrderByDescending(a => a.AttendanceDate)
            .ThenBy(a => a.Staff.Name)
            .ToListAsync(ct);

        int presentCount = 0;
        int halfDayCount = 0;
        int leaveCount = 0;

        var dtos = new List<StaffAttendanceDto>();

        foreach (var att in list)
        {
            var (hours, hoursFormatted) = AttendanceTimeHelper.CalculateWorkingHours(att.CheckInTime, att.CheckOutTime);

            switch (att.Status)
            {
                case StaffAttendanceStatus.Present:
                    presentCount++;
                    break;
                case StaffAttendanceStatus.HalfDay:
                    halfDayCount++;
                    break;
                case StaffAttendanceStatus.Leave:
                    leaveCount++;
                    break;
            }

            dtos.Add(new StaffAttendanceDto(
                Id: att.Id,
                StaffId: att.StaffId,
                StaffName: att.Staff?.Name ?? "Unknown",
                StaffRole: att.Staff?.Role,
                StaffPhoneNumber: att.Staff?.PhoneNumber ?? string.Empty,
                AttendanceDate: att.AttendanceDate.ToString("yyyy-MM-dd"),
                Status: att.Status.ToString(),
                CheckInTime: att.CheckInTime,
                CheckOutTime: att.CheckOutTime,
                WorkingHours: hours,
                WorkingHoursFormatted: hoursFormatted,
                Notes: att.Notes,
                CreatedAt: att.CreatedAt,
                UpdatedAt: att.UpdatedAt,
                CreatedByUserName: att.CreatedByUser?.FullName ?? att.CreatedByUser?.Username,
                UpdatedByUserName: att.UpdatedByUser?.FullName ?? att.UpdatedByUser?.Username
            ));
        }

        return new DateRangeAttendanceResponse(
            FromDate: from.ToString("yyyy-MM-dd"),
            ToDate: to.ToString("yyyy-MM-dd"),
            TotalRecords: dtos.Count,
            PresentCount: presentCount,
            HalfDayCount: halfDayCount,
            LeaveCount: leaveCount,
            Records: dtos
        );
    }

    public async Task<MonthlyAttendanceReportResponse> GetMonthlyAttendanceReportAsync(
        int year,
        int month,
        Guid? staffId = null,
        string? status = null,
        string? search = null,
        CancellationToken ct = default)
    {
        if (year < 2000 || year > 2100)
        {
            throw new ValidationException("Invalid year. Expected between 2000 and 2100.");
        }

        if (month < 1 || month > 12)
        {
            throw new ValidationException("Invalid month. Expected between 1 and 12.");
        }

        var daysInMonth = DateTime.DaysInMonth(year, month);
        var fromDate = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var toDate = new DateTime(year, month, daysInMonth, 0, 0, 0, DateTimeKind.Utc);

        var staffQuery = _db.Staff.Where(s => !s.IsDeleted && s.IsActive);

        if (staffId.HasValue && staffId.Value != Guid.Empty)
        {
            staffQuery = staffQuery.Where(s => s.Id == staffId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            staffQuery = staffQuery.Where(s =>
                s.Name.ToLower().Contains(term) ||
                (s.Role != null && s.Role.ToLower().Contains(term)) ||
                s.PhoneNumber.Contains(term));
        }

        var staffList = await staffQuery.OrderBy(s => s.Name).ToListAsync(ct);
        var staffIds = staffList.Select(s => s.Id).ToList();

        // Single optimized query for all attendance records of matching staff within the month
        var attendances = await _db.StaffAttendances
            .Where(a => !a.IsDeleted && staffIds.Contains(a.StaffId) && a.AttendanceDate >= fromDate && a.AttendanceDate <= toDate)
            .ToListAsync(ct);

        // Group attendances by staff member and date
        var attByStaff = attendances
            .GroupBy(a => a.StaffId)
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(a => a.AttendanceDate.Date).ToDictionary(d => d.Key, d => d.First())
            );

        var staffItems = new List<MonthlyStaffAttendanceItemDto>();

        foreach (var staff in staffList)
        {
            attByStaff.TryGetValue(staff.Id, out var dateMap);
            dateMap ??= new Dictionary<DateTime, StaffAttendance>();

            int presentDays = 0;
            int halfDays = 0;
            int leaveDays = 0;
            var dailyRecords = new List<MonthlyStaffDailyRecordDto>(daysInMonth);

            for (int day = 1; day <= daysInMonth; day++)
            {
                var dayDate = new DateTime(year, month, day, 0, 0, 0, DateTimeKind.Utc);
                var dateStr = dayDate.ToString("yyyy-MM-dd");
                var dayOfWeek = dayDate.ToString("ddd");

                if (dateMap.TryGetValue(dayDate, out var att))
                {
                    var (hours, hoursFormatted) = AttendanceTimeHelper.CalculateWorkingHours(att.CheckInTime, att.CheckOutTime);
                    string statusStr = att.Status switch
                    {
                        StaffAttendanceStatus.Present => "Present",
                        StaffAttendanceStatus.HalfDay => "HalfDay",
                        StaffAttendanceStatus.Leave => "Leave",
                        _ => att.Status.ToString()
                    };

                    switch (att.Status)
                    {
                        case StaffAttendanceStatus.Present:
                            presentDays++;
                            break;
                        case StaffAttendanceStatus.HalfDay:
                            halfDays++;
                            break;
                        case StaffAttendanceStatus.Leave:
                            leaveDays++;
                            break;
                    }

                    dailyRecords.Add(new MonthlyStaffDailyRecordDto(
                        Date: dateStr,
                        Day: day,
                        DayOfWeek: dayOfWeek,
                        Status: statusStr,
                        CheckInTime: att.CheckInTime,
                        CheckOutTime: att.CheckOutTime,
                        WorkingHours: hours,
                        WorkingHoursFormatted: hoursFormatted,
                        Notes: att.Notes
                    ));
                }
                else
                {
                    dailyRecords.Add(new MonthlyStaffDailyRecordDto(
                        Date: dateStr,
                        Day: day,
                        DayOfWeek: dayOfWeek,
                        Status: "Unmarked",
                        CheckInTime: null,
                        CheckOutTime: null,
                        WorkingHours: null,
                        WorkingHoursFormatted: null,
                        Notes: null
                    ));
                }
            }

            int recordedDays = presentDays + halfDays + leaveDays;
            int unmarkedDays = Math.Max(0, daysInMonth - recordedDays);
            int attendanceDays = presentDays + halfDays;

            staffItems.Add(new MonthlyStaffAttendanceItemDto(
                StaffId: staff.Id,
                Name: staff.Name,
                Role: staff.Role,
                PhoneNumber: staff.PhoneNumber,
                PresentDays: presentDays,
                HalfDays: halfDays,
                LeaveDays: leaveDays,
                UnmarkedDays: unmarkedDays,
                AttendanceDays: attendanceDays,
                DailyRecords: dailyRecords
            ));
        }

        // Overall monthly summary across matching staff
        int totalPresent = staffItems.Sum(s => s.PresentDays);
        int totalHalfDay = staffItems.Sum(s => s.HalfDays);
        int totalLeave = staffItems.Sum(s => s.LeaveDays);
        int totalUnmarked = staffItems.Sum(s => s.UnmarkedDays);

        var summary = new MonthlyAttendanceSummaryDto(
            Present: totalPresent,
            HalfDay: totalHalfDay,
            Leave: totalLeave,
            Unmarked: totalUnmarked
        );

        // Apply status filter if specified
        var filteredStaff = staffItems;
        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (status.Equals("Unmarked", StringComparison.OrdinalIgnoreCase))
            {
                filteredStaff = filteredStaff.Where(s => s.UnmarkedDays > 0).ToList();
            }
            else if (status.Equals("Present", StringComparison.OrdinalIgnoreCase))
            {
                filteredStaff = filteredStaff.Where(s => s.PresentDays > 0).ToList();
            }
            else if (status.Equals("HalfDay", StringComparison.OrdinalIgnoreCase))
            {
                filteredStaff = filteredStaff.Where(s => s.HalfDays > 0).ToList();
            }
            else if (status.Equals("Leave", StringComparison.OrdinalIgnoreCase))
            {
                filteredStaff = filteredStaff.Where(s => s.LeaveDays > 0).ToList();
            }
        }

        return new MonthlyAttendanceReportResponse(
            Year: year,
            Month: month,
            FromDate: fromDate.ToString("yyyy-MM-dd"),
            ToDate: toDate.ToString("yyyy-MM-dd"),
            TotalCalendarDays: daysInMonth,
            StaffCount: staffItems.Count,
            Summary: summary,
            Staff: filteredStaff
        );
    }

    public async Task<StaffAttendanceDto> UpsertAttendanceAsync(UpsertStaffAttendanceRequest request, Guid userId, bool isOwner = false, CancellationToken ct = default)
    {
        if (request.StaffId == Guid.Empty)
        {
            throw new ValidationException("Staff member is required.");
        }

        if (!DateTime.TryParseExact(request.AttendanceDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
        {
            throw new ValidationException("Invalid attendance date format. Expected YYYY-MM-DD.");
        }
        var attDate = parsedDate.Date;

        await EnsureAttendanceNotLockedAsync(attDate, isOwner, ct);

        if (!Enum.TryParse<StaffAttendanceStatus>(request.Status, true, out var parsedStatus))
        {
            throw new ValidationException($"Invalid attendance status '{request.Status}'. Valid statuses are: Present, HalfDay, Leave.");
        }

        // Validate time ordering
        if (!string.IsNullOrWhiteSpace(request.CheckInTime) && !string.IsNullOrWhiteSpace(request.CheckOutTime))
        {
            if (TimeSpan.TryParse(request.CheckInTime, out var inTime) && TimeSpan.TryParse(request.CheckOutTime, out var outTime))
            {
                if (outTime < inTime)
                {
                    throw new ValidationException("Check-out time cannot be earlier than check-in time.");
                }
            }
        }

        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == request.StaffId && !s.IsDeleted && s.IsActive, ct);
        if (staff is null)
        {
            throw new KeyNotFoundException($"Active staff member with ID '{request.StaffId}' was not found.");
        }

        var existing = await _db.StaffAttendances
            .Include(a => a.CreatedByUser)
            .Include(a => a.UpdatedByUser)
            .FirstOrDefaultAsync(a => a.StaffId == request.StaffId && a.AttendanceDate == attDate && !a.IsDeleted, ct);

        StaffAttendance record;
        string action;

        if (existing is not null)
        {
            record = existing;
            action = "staff_attendance.updated";

            record.Status = parsedStatus;
            record.CheckInTime = parsedStatus is StaffAttendanceStatus.Leave ? null : request.CheckInTime;
            record.CheckOutTime = parsedStatus is StaffAttendanceStatus.Leave ? null : request.CheckOutTime;
            record.Notes = request.Notes;
            record.UpdatedByUserId = userId != Guid.Empty ? userId : null;
            record.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            record = new StaffAttendance
            {
                Id = Guid.NewGuid(),
                StaffId = request.StaffId,
                AttendanceDate = attDate,
                Status = parsedStatus,
                CheckInTime = parsedStatus is StaffAttendanceStatus.Leave ? null : request.CheckInTime,
                CheckOutTime = parsedStatus is StaffAttendanceStatus.Leave ? null : request.CheckOutTime,
                Notes = request.Notes,
                CreatedByUserId = userId != Guid.Empty ? userId : null,
                CreatedAt = DateTime.UtcNow
            };
            action = "staff_attendance.created";
            await _db.StaffAttendances.AddAsync(record, ct);
        }

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: action,
            module: "Staff Attendance",
            description: $"Attendance marked as '{parsedStatus}' for staff '{staff.Name}' on {attDate:yyyy-MM-dd}.",
            userId: userId != Guid.Empty ? userId : null,
            entityType: "StaffAttendance",
            entityId: record.Id,
            entityReference: $"{staff.Name} ({attDate:yyyy-MM-dd})",
            outcome: "Success",
            cancellationToken: ct);

        var (hours, hoursFormatted) = AttendanceTimeHelper.CalculateWorkingHours(record.CheckInTime, record.CheckOutTime);

        return new StaffAttendanceDto(
            Id: record.Id,
            StaffId: record.StaffId,
            StaffName: staff.Name,
            StaffRole: staff.Role,
            StaffPhoneNumber: staff.PhoneNumber,
            AttendanceDate: attDate.ToString("yyyy-MM-dd"),
            Status: record.Status.ToString(),
            CheckInTime: record.CheckInTime,
            CheckOutTime: record.CheckOutTime,
            WorkingHours: hours,
            WorkingHoursFormatted: hoursFormatted,
            Notes: record.Notes,
            CreatedAt: record.CreatedAt,
            UpdatedAt: record.UpdatedAt,
            CreatedByUserName: record.CreatedByUser?.FullName ?? record.CreatedByUser?.Username,
            UpdatedByUserName: record.UpdatedByUser?.FullName ?? record.UpdatedByUser?.Username
        );
    }

    public async Task<bool> DeleteAttendanceAsync(Guid id, Guid userId, bool isOwner = false, CancellationToken ct = default)
    {
        var record = await _db.StaffAttendances
            .Include(a => a.Staff)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted, ct);

        if (record is null) return false;

        await EnsureAttendanceNotLockedAsync(record.AttendanceDate, isOwner, ct);

        record.IsDeleted = true;
        record.UpdatedAt = DateTime.UtcNow;
        record.UpdatedByUserId = userId != Guid.Empty ? userId : null;

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "staff_attendance.deleted",
            module: "Staff Attendance",
            description: $"Attendance record deleted for staff '{record.Staff?.Name}' on {record.AttendanceDate:yyyy-MM-dd}.",
            userId: userId != Guid.Empty ? userId : null,
            entityType: "StaffAttendance",
            entityId: record.Id,
            entityReference: $"{record.Staff?.Name} ({record.AttendanceDate:yyyy-MM-dd})",
            outcome: "Success",
            cancellationToken: ct);

        return true;
    }

    public async Task<DailyAttendanceResponse> ConfirmAttendanceAsync(DateTime date, Guid userId, CancellationToken ct = default)
    {
        var targetDate = date.Date;

        // Validate that at least one active staff member has attendance marked for this date
        var markedAttendances = await _db.StaffAttendances
            .Include(a => a.Staff)
            .Where(a => a.AttendanceDate == targetDate && !a.IsDeleted && a.Staff != null && !a.Staff.IsDeleted && a.Staff.IsActive)
            .ToListAsync(ct);

        if (markedAttendances.Count == 0)
        {
            throw new InvalidOperationException("Please mark attendance for at least one staff member before confirming attendance.");
        }

        var confirmation = await _db.StaffDailyAttendanceConfirmations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Date == targetDate, ct);

        var isCorrection = confirmation != null && confirmation.AttendanceConfirmedAt.HasValue;
        var staffCount = markedAttendances.Count;

        if (confirmation == null)
        {
            confirmation = new StaffDailyAttendanceConfirmation
            {
                Date = targetDate,
                IsAttendanceConfirmed = true,
                AttendanceConfirmedAt = DateTime.UtcNow,
                AttendanceConfirmedByUserId = userId
            };
            _db.StaffDailyAttendanceConfirmations.Add(confirmation);
        }
        else
        {
            confirmation.IsDeleted = false;
            confirmation.IsAttendanceConfirmed = true;
            confirmation.AttendanceConfirmedAt = DateTime.UtcNow;
            confirmation.AttendanceConfirmedByUserId = userId;
            confirmation.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var action = isCorrection ? Domain.Constants.AuditActions.AttendanceCorrected : Domain.Constants.AuditActions.AttendanceConfirmed;
        var desc = isCorrection
            ? $"Staff attendance corrected for {targetDate:dd-MMM-yyyy}. Staff marked: {staffCount}."
            : $"Staff attendance confirmed for {targetDate:dd-MMM-yyyy}. Staff marked: {staffCount}.";

        await _auditLogService.RecordAsync(
            action: action,
            module: "Staff Attendance",
            description: desc,
            entityType: "StaffAttendance",
            entityId: confirmation.Id,
            entityReference: $"Staff Attendance - {targetDate:yyyy-MM-dd}",
            newValues: System.Text.Json.JsonSerializer.Serialize(new {
                date = targetDate,
                staffMarkedCount = staffCount
            }),
            outcome: "Success",
            cancellationToken: ct);

        return await GetDailyAttendanceAsync(targetDate, ct);
    }

    public async Task<DailyAttendanceResponse> UnlockAttendanceAsync(DateTime date, Guid userId, bool isOwner, CancellationToken ct = default)
    {
        if (!isOwner)
        {
            throw new ForbiddenException("Only the Owner can unlock and correct attendance.");
        }

        var targetDate = date.Date;

        var confirmation = await _db.StaffDailyAttendanceConfirmations
            .FirstOrDefaultAsync(a => a.Date == targetDate && !a.IsDeleted, ct);

        if (confirmation != null && confirmation.IsAttendanceConfirmed)
        {
            confirmation.IsAttendanceConfirmed = false;
            confirmation.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            await _auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.AttendanceUnlocked,
                module: "Staff Attendance",
                description: $"Staff attendance unlocked for administrative correction for date ({targetDate:dd-MMM-yyyy}).",
                entityType: "StaffAttendance",
                entityId: confirmation.Id,
                entityReference: $"Staff Attendance - {targetDate:yyyy-MM-dd}",
                outcome: "Success",
                cancellationToken: ct);
        }

        return await GetDailyAttendanceAsync(targetDate, ct);
    }
}
