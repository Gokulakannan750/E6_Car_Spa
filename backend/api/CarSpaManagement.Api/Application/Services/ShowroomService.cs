using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.DTOs.StaffAttendance;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace CarSpaManagement.Api.Application.Services;

public class ShowroomService : IShowroomService
{
    private readonly AppDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private static readonly Regex GstinRegex = new(@"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", RegexOptions.Compiled);

    public ShowroomService(AppDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    private static DateTime ToUtcDate(DateTime dt) => ShowroomDateHelper.ToUtcDate(dt);

    private static string? NormalizeAndValidateGstin(string? gstin)
    {
        if (string.IsNullOrWhiteSpace(gstin)) return null;
        var normalized = gstin.Trim().ToUpperInvariant();
        if (!GstinRegex.IsMatch(normalized))
        {
            throw new ArgumentException("Invalid Indian GSTIN structure. Expected 15-character format (e.g., 33AAAAA0000A1Z5).");
        }
        return normalized;
    }

    public static string DerivePrefix(string showroomName)
    {
        if (string.IsNullOrWhiteSpace(showroomName))
            return "SR";

        var chars = showroomName.Where(char.IsLetter).ToArray();
        if (chars.Length >= 2)
        {
            return new string(chars, 0, 2).ToUpperInvariant();
        }
        if (chars.Length == 1)
        {
            return (chars[0].ToString() + "X").ToUpperInvariant();
        }
        return "SR";
    }

    private async Task<string> FindNextMasterIdCandidateAsync(string prefix, HashSet<string> attemptedCandidates, CancellationToken ct)
    {
        var existing = await _db.Showrooms
            .IgnoreQueryFilters()
            .Where(s => s.MasterId.StartsWith(prefix))
            .Select(s => s.MasterId)
            .ToListAsync(ct);

        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
        foreach (var attempted in attemptedCandidates)
        {
            existingSet.Add(attempted);
        }

        for (var num = 10001; num <= 99999; num++)
        {
            var candidate = $"{prefix}{num:D5}";
            if (!existingSet.Contains(candidate))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException($"All 5-digit Master IDs for prefix '{prefix}' (10001-99999) are exhausted.");
    }

    public async Task<IReadOnlyList<ShowroomDto>> GetAllAsync(string? search = null, bool? isActive = null, CancellationToken ct = default)
    {
        var query = _db.Showrooms.AsQueryable();

        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s => s.Name.ToLower().Contains(term) ||
                                     s.Address.ToLower().Contains(term) ||
                                     (s.Phone != null && s.Phone.ToLower().Contains(term)));
        }

        var today = ToUtcDate(DateTime.UtcNow);

        var showrooms = await query
            .OrderBy(s => s.Name)
            .Select(s => new
            {
                s.Id,
                s.MasterId,
                s.Name,
                s.Address,
                s.Phone,
                s.Gstin,
                s.IsActive,
                s.CreatedAt,
                s.UpdatedAt,
                ActiveStaffToday = _db.ShowroomStaffAssignments
                    .Count(a => a.ShowroomId == s.Id && a.Date == today && !a.IsDeleted),
                VehiclesToday = _db.ShowroomStaffAssignments
                    .Where(a => a.ShowroomId == s.Id && a.Date == today && !a.IsDeleted)
                    .Sum(a => (int?)a.VehiclesAttended) ?? 0
            })
            .ToListAsync(ct);

        return showrooms.Select(s => new ShowroomDto(
            s.Id,
            s.Name,
            s.Address,
            s.Phone,
            s.IsActive,
            s.ActiveStaffToday,
            s.VehiclesToday,
            s.CreatedAt,
            s.UpdatedAt,
            s.Gstin,
            s.MasterId
        )).ToList();
    }

    public async Task<ShowroomDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (showroom == null) return null;

        var today = ToUtcDate(DateTime.UtcNow);
        var assignmentsToday = await _db.ShowroomStaffAssignments
            .Where(a => a.ShowroomId == id && a.Date == today && !a.IsDeleted)
            .ToListAsync(ct);

        return new ShowroomDto(
            showroom.Id,
            showroom.Name,
            showroom.Address,
            showroom.Phone,
            showroom.IsActive,
            assignmentsToday.Count,
            assignmentsToday.Sum(a => a.VehiclesAttended),
            showroom.CreatedAt,
            showroom.UpdatedAt,
            showroom.Gstin,
            showroom.MasterId
        );
    }

    public async Task<ShowroomDto> CreateAsync(CreateShowroomRequest request, CancellationToken ct = default)
    {
        var prefix = DerivePrefix(request.Name);
        var attempted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        const int maxRetries = 5;

        for (var attempt = 1; attempt <= maxRetries; attempt++)
        {
            var masterId = await FindNextMasterIdCandidateAsync(prefix, attempted, ct);
            attempted.Add(masterId);

            var showroom = new Showroom
            {
                MasterId = masterId,
                Name = request.Name.Trim(),
                Address = request.Address.Trim(),
                Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
                Gstin = NormalizeAndValidateGstin(request.Gstin),
                IsActive = request.IsActive
            };

            _db.Showrooms.Add(showroom);

            try
            {
                await _db.SaveChangesAsync(ct);

                return new ShowroomDto(
                    showroom.Id,
                    showroom.Name,
                    showroom.Address,
                    showroom.Phone,
                    showroom.IsActive,
                    0,
                    0,
                    showroom.CreatedAt,
                    showroom.UpdatedAt,
                    showroom.Gstin,
                    showroom.MasterId
                );
            }
            catch (DbUpdateException ex)
            {
                _db.Entry(showroom).State = EntityState.Detached;

                var isUniqueViolation = ex.InnerException?.Message.Contains("IX_Showrooms_MasterId", StringComparison.OrdinalIgnoreCase) == true
                    || ex.Message.Contains("IX_Showrooms_MasterId", StringComparison.OrdinalIgnoreCase)
                    || ex.InnerException?.Message.Contains("23505", StringComparison.OrdinalIgnoreCase) == true
                    || ex.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true;

                if (!isUniqueViolation && attempt == maxRetries)
                {
                    throw;
                }

                if (attempt == maxRetries)
                {
                    throw new InvalidOperationException("Failed to generate a unique Master ID due to concurrent creation conflicts. Please retry.", ex);
                }
            }
        }

        throw new InvalidOperationException("Failed to create showroom.");
    }

    public async Task<ShowroomDto?> UpdateAsync(Guid id, UpdateShowroomRequest request, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (showroom == null) return null;

        if (request.Name != null) showroom.Name = request.Name.Trim();
        if (request.Address != null) showroom.Address = request.Address.Trim();
        if (request.Phone != null) showroom.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        if (request.Gstin != null) showroom.Gstin = NormalizeAndValidateGstin(request.Gstin);
        if (request.IsActive.HasValue) showroom.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> ToggleActiveAsync(Guid id, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (showroom == null) return false;

        showroom.IsActive = !showroom.IsActive;
        showroom.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ── Daily Staff Assignment & Attendance Confirmation ────────────────────

    private async Task EnsureAttendanceNotLockedAsync(Guid showroomId, DateTime date, bool isOwner, CancellationToken ct)
    {
        var targetDate = ToUtcDate(date);
        var isConfirmed = await _db.ShowroomDailyAttendances
            .AnyAsync(a => a.ShowroomId == showroomId && a.Date == targetDate && a.IsAttendanceConfirmed && !a.IsDeleted, ct);

        if (isConfirmed)
        {
            if (!isOwner)
            {
                throw new ForbiddenException("Showroom attendance is confirmed and locked for this date.");
            }
            throw new ConflictException("Showroom attendance is confirmed and locked for this date. Please unlock attendance to make corrections.");
        }
    }

    public async Task<DailyStaffResponse?> GetDailyStaffAsync(Guid showroomId, DateTime date, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null) return null;

        var targetDate = ToUtcDate(date);

        // 1. Query rich work sessions for this showroom and date
        var sessions = await _db.ShowroomStaffWorkSessions
            .Include(s => s.Staff)
            .Include(s => s.HomeShowroom)
            .Include(s => s.WorkingShowroom)
            .Where(s => s.WorkingShowroomId == showroomId && s.Date == targetDate && !s.IsDeleted)
            .OrderBy(s => s.StartTime)
            .ThenBy(s => s.Staff.Name)
            .ToListAsync(ct);

        // 2. Query legacy assignments for this showroom and date
        var assignments = await _db.ShowroomStaffAssignments
            .Include(a => a.Staff)
                .ThenInclude(st => st.DefaultShowroom)
            .Include(a => a.Showroom)
            .Where(a => a.ShowroomId == showroomId && a.Date == targetDate && !a.IsDeleted)
            .OrderBy(a => a.Staff.Name)
            .ToListAsync(ct);

        var list = new List<DailyStaffAssignmentDto>();
        var mappedStaffIds = new HashSet<Guid>();

        foreach (var s in sessions)
        {
            mappedStaffIds.Add(s.StaffId);
            var (hours, formatted) = AttendanceTimeHelper.CalculateWorkingHours(s.StartTime, s.EndTime);
            var isTransfer = s.HomeShowroomId != showroomId || s.AttendanceStatus == StaffAttendanceStatus.TemporaryTransfer;

            list.Add(new DailyStaffAssignmentDto(
                s.Id,
                s.WorkingShowroomId,
                showroom.Name,
                s.StaffId,
                s.Staff?.StaffMasterId ?? string.Empty,
                s.Staff?.Name ?? "Unknown Staff",
                s.Staff?.PhoneNumber ?? string.Empty,
                s.Staff?.Role,
                s.Date,
                0,
                s.CreatedAt,
                s.StartTime ?? "09:00",
                s.EndTime ?? "18:00",
                hours ?? 9.0,
                formatted ?? "9h",
                s.AttendanceStatus.ToString(),
                isTransfer ? "TemporaryTransfer" : "Regular",
                s.HomeShowroomId,
                s.HomeShowroom?.MasterId,
                s.HomeShowroom?.Name,
                s.TransferReason,
                s.Notes
            ));
        }

        // Query staff IDs with any active work sessions on targetDate to prevent ghost legacy resurrecting
        var allAssignedStaffIdsOnDate = await _db.ShowroomStaffWorkSessions
            .Where(s => s.Date == targetDate && !s.IsDeleted)
            .Select(s => s.StaffId)
            .Distinct()
            .ToListAsync(ct);
        var globalAssignedStaffSet = new HashSet<Guid>(allAssignedStaffIdsOnDate);

        // Add any legacy assignments that do not have a work session anywhere for this date
        foreach (var a in assignments)
        {
            if (!globalAssignedStaffSet.Contains(a.StaffId) && !mappedStaffIds.Contains(a.StaffId))
            {
                var homeShowroom = a.Staff?.DefaultShowroom;
                var isTransfer = homeShowroom != null && homeShowroom.Id != showroomId;

                list.Add(new DailyStaffAssignmentDto(
                    a.Id,
                    a.ShowroomId,
                    showroom.Name,
                    a.StaffId,
                    a.Staff?.StaffMasterId ?? string.Empty,
                    a.Staff?.Name ?? "Unknown Staff",
                    a.Staff?.PhoneNumber ?? string.Empty,
                    a.Staff?.Role,
                    a.Date,
                    a.VehiclesAttended,
                    a.CreatedAt,
                    "09:00",
                    "18:00",
                    9.0,
                    "9h",
                    "Present",
                    isTransfer ? "TemporaryTransfer" : "Regular",
                    homeShowroom?.Id ?? showroomId,
                    homeShowroom?.MasterId ?? showroom.MasterId,
                    homeShowroom?.Name ?? showroom.Name,
                    null,
                    null
                ));
            }
        }

        var totalVehicles = list.Sum(a => a.VehiclesAttended);

        var attendance = await _db.ShowroomDailyAttendances
            .Include(a => a.AttendanceConfirmedByUser)
            .FirstOrDefaultAsync(a => a.ShowroomId == showroomId && a.Date == targetDate && !a.IsDeleted, ct);

        var isConfirmed = attendance?.IsAttendanceConfirmed ?? false;
        var confirmedAt = attendance?.AttendanceConfirmedAt;
        var confirmedByUserId = attendance?.AttendanceConfirmedByUserId;
        var confirmedByName = attendance?.AttendanceConfirmedByUser?.FullName;

        return new DailyStaffResponse(
            showroom.Id,
            showroom.Name,
            targetDate,
            totalVehicles,
            isConfirmed,
            confirmedAt,
            confirmedByUserId,
            confirmedByName,
            list
        );
    }

    public async Task<DailyStaffResponse> ConfirmAttendanceAsync(Guid showroomId, DateTime date, Guid userId, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId && !s.IsDeleted, ct)
            ?? throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");

        var targetDate = ToUtcDate(date);

        // Validate non-negative vehicles attended on existing assignments
        var assignments = await _db.ShowroomStaffAssignments
            .Where(a => a.ShowroomId == showroomId && a.Date == targetDate && !a.IsDeleted)
            .ToListAsync(ct);

        if (assignments.Count == 0)
        {
            throw new InvalidOperationException("Please assign at least one staff member before confirming attendance.");
        }

        if (assignments.Any(a => a.VehiclesAttended < 0))
        {
            throw new InvalidOperationException("Vehicles attended count cannot be negative.");
        }

        var attendance = await _db.ShowroomDailyAttendances
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.ShowroomId == showroomId && a.Date == targetDate, ct);

        var isCorrection = attendance != null && attendance.AttendanceConfirmedAt.HasValue;
        var totalVehicles = assignments.Sum(a => a.VehiclesAttended);
        var staffCount = assignments.Count;

        if (attendance == null)
        {
            attendance = new ShowroomDailyAttendance
            {
                ShowroomId = showroomId,
                Date = targetDate,
                IsAttendanceConfirmed = true,
                AttendanceConfirmedAt = DateTime.UtcNow,
                AttendanceConfirmedByUserId = userId
            };
            _db.ShowroomDailyAttendances.Add(attendance);
        }
        else
        {
            attendance.IsDeleted = false;
            attendance.IsAttendanceConfirmed = true;
            attendance.AttendanceConfirmedAt = DateTime.UtcNow;
            attendance.AttendanceConfirmedByUserId = userId;
            attendance.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var action = isCorrection ? Domain.Constants.AuditActions.AttendanceCorrected : Domain.Constants.AuditActions.AttendanceConfirmed;
        var desc = isCorrection
            ? $"Showroom attendance corrected for {showroom.Name} ({targetDate:dd-MMM-yyyy}). Staff: {staffCount}, Vehicles: {totalVehicles}."
            : $"Showroom attendance confirmed for {showroom.Name} ({targetDate:dd-MMM-yyyy}). Staff: {staffCount}, Vehicles: {totalVehicles}.";

        await _auditLogService.RecordAsync(
            action: action,
            module: Domain.Constants.AuditModules.Showrooms,
            description: desc,
            entityType: "ShowroomAttendance",
            entityId: showroom.Id,
            entityReference: $"{showroom.Name} - {targetDate:yyyy-MM-dd}",
            newValues: System.Text.Json.JsonSerializer.Serialize(new {
                showroomId = showroom.Id,
                showroomName = showroom.Name,
                date = targetDate,
                staffCount = staffCount,
                vehiclesAttended = totalVehicles
            }),
            outcome: "Success",
            cancellationToken: ct);

        return (await GetDailyStaffAsync(showroomId, targetDate, ct))!;
    }

    public async Task<DailyStaffResponse> UnlockAttendanceAsync(Guid showroomId, DateTime date, Guid userId, bool isOwner, CancellationToken ct = default)
    {
        if (!isOwner)
        {
            throw new ForbiddenException("Only the Owner can unlock and correct attendance.");
        }

        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId && !s.IsDeleted, ct)
            ?? throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");

        var targetDate = ToUtcDate(date);

        var attendance = await _db.ShowroomDailyAttendances
            .FirstOrDefaultAsync(a => a.ShowroomId == showroomId && a.Date == targetDate && !a.IsDeleted, ct);

        if (attendance != null && attendance.IsAttendanceConfirmed)
        {
            attendance.IsAttendanceConfirmed = false;
            attendance.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            await _auditLogService.RecordAsync(
                action: Domain.Constants.AuditActions.AttendanceUnlocked,
                module: Domain.Constants.AuditModules.Showrooms,
                description: $"Showroom attendance unlocked for administrative correction: {showroom.Name} ({targetDate:dd-MMM-yyyy}).",
                entityType: "ShowroomAttendance",
                entityId: showroom.Id,
                entityReference: $"{showroom.Name} - {targetDate:yyyy-MM-dd}",
                outcome: "Success",
                cancellationToken: ct);
        }

        return (await GetDailyStaffAsync(showroomId, targetDate, ct))!;
    }

    public async Task<DailyStaffAssignmentDto> AssignStaffAsync(Guid showroomId, CreateDailyStaffAssignmentRequest request, bool isOwner = false, CancellationToken ct = default)
    {
        var targetDate = ToUtcDate(request.Date);
        await EnsureAttendanceNotLockedAsync(showroomId, targetDate, isOwner, ct);

        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct)
            ?? throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");

        var staff = await _db.Staff.Include(st => st.DefaultShowroom).FirstOrDefaultAsync(s => s.Id == request.StaffId, ct)
            ?? throw new KeyNotFoundException($"Staff member with ID '{request.StaffId}' was not found.");

        if (!staff.IsActive)
        {
            throw new ValidationException($"Staff member '{staff.Name}' is inactive and cannot be assigned to showroom attendance.");
        }

        var startTime = string.IsNullOrWhiteSpace(request.StartTime) ? "09:00" : request.StartTime.Trim();
        var endTime = string.IsNullOrWhiteSpace(request.EndTime) ? "18:00" : request.EndTime.Trim();

        // Overlap Validation across all showrooms on targetDate
        await AttendanceTimeHelper.ValidateNoSessionOverlapAsync(
            _db,
            request.StaffId,
            staff.Name,
            targetDate,
            startTime,
            endTime,
            excludeSessionId: null,
            ct: ct);


        var homeShowroomId = staff.DefaultShowroomId ?? showroomId;
        var isTransfer = string.Equals(request.AssignmentType, "TemporaryTransfer", StringComparison.OrdinalIgnoreCase)
            || (homeShowroomId != showroomId && !string.Equals(request.AssignmentType, "Regular", StringComparison.OrdinalIgnoreCase));

        var sessionType = isTransfer ? ShowroomStaffSessionType.Custom : ShowroomStaffSessionType.FullDay;
        var attendanceStatus = isTransfer ? StaffAttendanceStatus.TemporaryTransfer : StaffAttendanceStatus.Present;

        var session = new ShowroomStaffWorkSession
        {
            Id = Guid.NewGuid(),
            StaffId = request.StaffId,
            HomeShowroomId = homeShowroomId,
            WorkingShowroomId = showroomId,
            Date = targetDate,
            SessionType = sessionType,
            AttendanceStatus = attendanceStatus,
            StartTime = startTime,
            EndTime = endTime,
            TransferReason = isTransfer ? (string.IsNullOrWhiteSpace(request.TransferReason) ? null : request.TransferReason.Trim()) : null,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.ShowroomStaffWorkSessions.Add(session);

        // Sync legacy ShowroomStaffAssignments
        var existingAssignment = await _db.ShowroomStaffAssignments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.ShowroomId == showroomId && a.StaffId == request.StaffId && a.Date == targetDate, ct);

        if (existingAssignment == null)
        {
            _db.ShowroomStaffAssignments.Add(new ShowroomStaffAssignment
            {
                Id = Guid.NewGuid(),
                ShowroomId = showroomId,
                StaffId = request.StaffId,
                Date = targetDate,
                VehiclesAttended = Math.Max(0, request.VehiclesAttended),
                CreatedAt = DateTime.UtcNow
            });
        }
        else if (existingAssignment.IsDeleted)
        {
            existingAssignment.IsDeleted = false;
            existingAssignment.VehiclesAttended = Math.Max(0, request.VehiclesAttended);
            existingAssignment.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var homeShowroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == homeShowroomId, ct);
        var (hours, formatted) = AttendanceTimeHelper.CalculateWorkingHours(startTime, endTime);

        return new DailyStaffAssignmentDto(
            session.Id,
            showroomId,
            showroom.Name,
            staff.Id,
            staff.StaffMasterId,
            staff.Name,
            staff.PhoneNumber,
            staff.Role,
            session.Date,
            0,
            session.CreatedAt,
            startTime,
            endTime,
            hours,
            formatted,
            attendanceStatus.ToString(),
            isTransfer ? "TemporaryTransfer" : "Regular",
            homeShowroomId,
            homeShowroom?.MasterId ?? (homeShowroomId == showroomId ? showroom.MasterId : null),
            homeShowroom?.Name ?? (homeShowroomId == showroomId ? showroom.Name : null),
            session.TransferReason,
            session.Notes
        );
    }

    public async Task<DailyStaffAssignmentDto?> UpdateAssignmentVehiclesAsync(Guid assignmentId, int vehiclesAttended, bool isOwner = false, CancellationToken ct = default)
    {
        return await UpdateAssignmentAsync(assignmentId, new UpdateDailyStaffAssignmentRequest { VehiclesAttended = vehiclesAttended }, isOwner, ct);
    }

    public async Task<DailyStaffAssignmentDto?> UpdateAssignmentAsync(Guid assignmentId, UpdateDailyStaffAssignmentRequest request, bool isOwner = false, CancellationToken ct = default)
    {
        var session = await _db.ShowroomStaffWorkSessions
            .Include(s => s.Staff)
            .Include(s => s.HomeShowroom)
            .Include(s => s.WorkingShowroom)
            .FirstOrDefaultAsync(s => s.Id == assignmentId, ct);

        if (session != null)
        {
            await EnsureAttendanceNotLockedAsync(session.WorkingShowroomId, session.Date, isOwner, ct);

            var startTime = string.IsNullOrWhiteSpace(request.StartTime) ? (session.StartTime ?? "09:00") : request.StartTime.Trim();
            var endTime = string.IsNullOrWhiteSpace(request.EndTime) ? (session.EndTime ?? "18:00") : request.EndTime.Trim();

            // Overlap Validation across all other active sessions for this staff member on targetDate
            await AttendanceTimeHelper.ValidateNoSessionOverlapAsync(
                _db,
                session.StaffId,
                session.Staff?.Name ?? "Staff",
                session.Date,
                startTime,
                endTime,
                excludeSessionId: session.Id,
                ct: ct);

            session.StartTime = startTime;
            session.EndTime = endTime;

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                if (Enum.TryParse<StaffAttendanceStatus>(request.Status, true, out var parsedStatus))
                {
                    session.AttendanceStatus = parsedStatus;
                }
            }

            if (request.TransferReason != null)
            {
                session.TransferReason = string.IsNullOrWhiteSpace(request.TransferReason) ? null : request.TransferReason.Trim();
            }

            if (request.Notes != null)
            {
                session.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
            }

            session.UpdatedAt = DateTime.UtcNow;

            // Sync legacy ShowroomStaffAssignment
            var assignment = await _db.ShowroomStaffAssignments
                .FirstOrDefaultAsync(a => a.ShowroomId == session.WorkingShowroomId && a.StaffId == session.StaffId && a.Date == session.Date && !a.IsDeleted, ct);

            if (assignment != null)
            {
                if (request.VehiclesAttended.HasValue)
                {
                    assignment.VehiclesAttended = Math.Max(0, request.VehiclesAttended.Value);
                }
                assignment.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);

            var (hours, formatted) = AttendanceTimeHelper.CalculateWorkingHours(session.StartTime, session.EndTime);
            var isTransfer = session.HomeShowroomId != session.WorkingShowroomId || session.AttendanceStatus == StaffAttendanceStatus.TemporaryTransfer;

            return new DailyStaffAssignmentDto(
                session.Id,
                session.WorkingShowroomId,
                session.WorkingShowroom?.Name ?? "Showroom",
                session.StaffId,
                session.Staff?.StaffMasterId ?? string.Empty,
                session.Staff?.Name ?? "Staff",
                session.Staff?.PhoneNumber ?? string.Empty,
                session.Staff?.Role,
                session.Date,
                assignment?.VehiclesAttended ?? (request.VehiclesAttended.HasValue ? Math.Max(0, request.VehiclesAttended.Value) : 0),
                session.CreatedAt,
                session.StartTime ?? "09:00",
                session.EndTime ?? "18:00",
                hours,
                formatted,
                session.AttendanceStatus.ToString(),
                isTransfer ? "TemporaryTransfer" : "Regular",
                session.HomeShowroomId,
                session.HomeShowroom?.MasterId,
                session.HomeShowroom?.Name,
                session.TransferReason,
                session.Notes
            );
        }

        var legacyAssignment = await _db.ShowroomStaffAssignments
            .Include(a => a.Staff)
            .Include(a => a.Showroom)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (legacyAssignment == null) return null;

        await EnsureAttendanceNotLockedAsync(legacyAssignment.ShowroomId, legacyAssignment.Date, isOwner, ct);

        if (request.VehiclesAttended.HasValue)
        {
            legacyAssignment.VehiclesAttended = Math.Max(0, request.VehiclesAttended.Value);
        }
        legacyAssignment.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new DailyStaffAssignmentDto(
            legacyAssignment.Id,
            legacyAssignment.ShowroomId,
            legacyAssignment.Showroom?.Name ?? "Showroom",
            legacyAssignment.StaffId,
            legacyAssignment.Staff?.StaffMasterId ?? string.Empty,
            legacyAssignment.Staff?.Name ?? "Staff",
            legacyAssignment.Staff?.PhoneNumber ?? string.Empty,
            legacyAssignment.Staff?.Role,
            legacyAssignment.Date,
            legacyAssignment.VehiclesAttended,
            legacyAssignment.CreatedAt
        );
    }

    public async Task<bool> RemoveAssignmentAsync(Guid assignmentId, bool isOwner = false, CancellationToken ct = default)
    {
        var session = await _db.ShowroomStaffWorkSessions.FirstOrDefaultAsync(s => s.Id == assignmentId, ct);
        if (session != null)
        {
            await EnsureAttendanceNotLockedAsync(session.WorkingShowroomId, session.Date, isOwner, ct);

            session.IsDeleted = true;
            session.UpdatedAt = DateTime.UtcNow;

            var otherSessions = await _db.ShowroomStaffWorkSessions
                .AnyAsync(s => s.Id != assignmentId && s.WorkingShowroomId == session.WorkingShowroomId && s.StaffId == session.StaffId && s.Date == session.Date && !s.IsDeleted, ct);

            if (!otherSessions)
            {
                var assignment = await _db.ShowroomStaffAssignments
                    .FirstOrDefaultAsync(a => a.ShowroomId == session.WorkingShowroomId && a.StaffId == session.StaffId && a.Date == session.Date && !a.IsDeleted, ct);

                if (assignment != null)
                {
                    assignment.IsDeleted = true;
                    assignment.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _db.SaveChangesAsync(ct);
            return true;
        }

        var legAssignment = await _db.ShowroomStaffAssignments.FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (legAssignment != null)
        {
            await EnsureAttendanceNotLockedAsync(legAssignment.ShowroomId, legAssignment.Date, isOwner, ct);

            legAssignment.IsDeleted = true;
            legAssignment.UpdatedAt = DateTime.UtcNow;

            var matchingSession = await _db.ShowroomStaffWorkSessions
                .FirstOrDefaultAsync(s => s.WorkingShowroomId == legAssignment.ShowroomId && s.StaffId == legAssignment.StaffId && s.Date == legAssignment.Date && !s.IsDeleted, ct);

            if (matchingSession != null)
            {
                matchingSession.IsDeleted = true;
                matchingSession.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);
            return true;
        }

        return false;
    }

    // ── Daily Showroom Billing & Payments ───────────────────────────────────

    private static PaymentMethod ParsePaymentMethod(string method)
    {
        if (string.IsNullOrWhiteSpace(method)) return PaymentMethod.Cash;
        var s = method.Trim().ToLower();
        if (s == "upi" || s == "1") return PaymentMethod.UPI;
        if (s == "card" || s == "2") return PaymentMethod.Card;
        if (s == "banktransfer" || s == "bank transfer" || s == "bank_transfer" || s == "3") return PaymentMethod.BankTransfer;
        return PaymentMethod.Cash;
    }

    private static ShowroomDailyBillDto ToBillDto(ShowroomDailyBill bill, string showroomName)
    {
        var validPayments = bill.Payments
            .Where(p => !p.IsDeleted)
            .OrderByDescending(p => p.PaymentDate)
            .Select(p => new ShowroomPaymentDto(
                p.Id,
                p.ShowroomDailyBillId,
                p.Amount,
                p.PaymentMethod.ToString(),
                p.Reference,
                p.PaymentDate,
                p.Notes,
                p.CreatedAt
            ))
            .ToList();

        var received = validPayments.Sum(p => p.Amount);
        var balance = Math.Max(0m, bill.Amount - received);

        string status;
        if (received == 0m)
        {
            status = "Unpaid";
        }
        else if (received < bill.Amount)
        {
            status = "PartiallyPaid";
        }
        else
        {
            status = "Paid";
        }

        return new ShowroomDailyBillDto(
            bill.Id,
            bill.ShowroomId,
            showroomName,
            bill.Date,
            bill.Amount,
            received,
            balance,
            status,
            bill.Notes,
            validPayments,
            bill.CreatedAt,
            bill.UpdatedAt
        );
    }

    public async Task<ShowroomDailyBillDto?> GetDailyBillAsync(Guid showroomId, DateTime date, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null) return null;

        var targetDate = ToUtcDate(date);

        var bill = await _db.ShowroomDailyBills
            .Include(b => b.Payments)
            .Include(b => b.Showroom)
            .FirstOrDefaultAsync(b => b.ShowroomId == showroomId && b.Date == targetDate && !b.IsDeleted, ct);

        if (bill != null)
        {
            return ToBillDto(bill, showroom.Name);
        }

        // Return empty bill template for UI
        return new ShowroomDailyBillDto(
            Guid.Empty,
            showroom.Id,
            showroom.Name,
            targetDate,
            0m,
            0m,
            0m,
            "Unpaid",
            null,
            new List<ShowroomPaymentDto>(),
            DateTime.UtcNow,
            null
        );
    }

    public async Task<ShowroomDailyBillDto> SetDailyBillAsync(Guid showroomId, DateTime date, SetShowroomDailyBillRequest request, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct)
            ?? throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");

        if (request.Amount < 0m)
            throw new ArgumentOutOfRangeException(nameof(request.Amount), "Showroom bill amount cannot be negative.");

        var targetDate = ToUtcDate(date);

        var bill = await _db.ShowroomDailyBills
            .Include(b => b.Payments)
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.ShowroomId == showroomId && b.Date == targetDate, ct);

        if (bill != null)
        {
            var received = bill.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount);
            if (request.Amount < received)
            {
                throw new InvalidOperationException($"Bill amount ₹{request.Amount:N2} cannot be less than already received payments ₹{received:N2}.");
            }

            bill.IsDeleted = false;
            bill.Amount = request.Amount;
            bill.Notes = request.Notes?.Trim();
            bill.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            bill = new ShowroomDailyBill
            {
                ShowroomId = showroomId,
                Date = targetDate,
                Amount = request.Amount,
                Notes = request.Notes?.Trim()
            };
            _db.ShowroomDailyBills.Add(bill);
        }

        await _db.SaveChangesAsync(ct);
        return ToBillDto(bill, showroom.Name);
    }

    public async Task<ShowroomDailyBillDto> RecordPaymentAsync(Guid showroomId, DateTime date, RecordShowroomPaymentRequest request, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct)
            ?? throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");

        if (request.Amount <= 0m)
            throw new ArgumentOutOfRangeException(nameof(request.Amount), "Payment amount must be greater than zero.");

        var targetDate = ToUtcDate(date);

        var bill = await _db.ShowroomDailyBills
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.ShowroomId == showroomId && b.Date == targetDate && !b.IsDeleted, ct);

        if (bill == null || bill.Amount <= 0m)
        {
            throw new InvalidOperationException("Please set the showroom bill amount before recording a payment.");
        }

        var currentReceived = bill.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount);
        var remainingBalance = Math.Max(0m, bill.Amount - currentReceived);

        if (request.Amount > remainingBalance)
        {
            throw new InvalidOperationException($"Payment amount ₹{request.Amount:N2} exceeds the remaining balance of ₹{remainingBalance:N2}.");
        }

        var payment = new ShowroomPayment
        {
            ShowroomDailyBillId = bill.Id,
            Amount = request.Amount,
            PaymentMethod = ParsePaymentMethod(request.PaymentMethod),
            Reference = string.IsNullOrWhiteSpace(request.Reference) ? null : request.Reference.Trim(),
            PaymentDate = request.PaymentDate ?? DateTime.UtcNow,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim()
        };

        _db.ShowroomPayments.Add(payment);
        bill.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom.record_payment",
            module: Domain.Constants.AuditModules.Showrooms,
            description: $"Showroom payment of ₹{payment.Amount:F2} ({payment.PaymentMethod}) recorded for {showroom.Name} ({targetDate:dd-MMM-yyyy}).",
            entityType: "ShowroomPayment",
            entityId: payment.Id,
            entityReference: showroom.Name,
            outcome: "Success",
            cancellationToken: ct);

        return ToBillDto(bill, showroom.Name);
    }

    public async Task<bool> DeletePaymentAsync(Guid paymentId, CancellationToken ct = default)
    {
        var payment = await _db.ShowroomPayments
            .Include(p => p.ShowroomDailyBill)
            .ThenInclude(b => b.Showroom)
            .FirstOrDefaultAsync(p => p.Id == paymentId, ct);
        if (payment == null) return false;

        payment.IsDeleted = true;
        payment.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom.delete_payment",
            module: Domain.Constants.AuditModules.Showrooms,
            description: $"Showroom payment of ₹{payment.Amount:F2} for {payment.ShowroomDailyBill?.Showroom?.Name ?? "Showroom"} deleted.",
            entityType: "ShowroomPayment",
            entityId: payment.Id,
            entityReference: payment.ShowroomDailyBill?.Showroom?.Name,
            outcome: "Success",
            cancellationToken: ct);

        return true;
    }

    // ── History & Financial Summary Aggregations ────────────────────────────

    public async Task<ShowroomSummaryDto?> GetShowroomSummaryAsync(Guid showroomId, DateTime fromDate, DateTime toDate, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId && !s.IsDeleted, ct);
        if (showroom == null) return null;

        var startUtc = ToUtcDate(fromDate);
        var endUtc = ToUtcDate(toDate);
        if (startUtc > endUtc)
        {
            (startUtc, endUtc) = (endUtc, startUtc);
        }

        // Fetch staff assignments in date range
        var assignments = await _db.ShowroomStaffAssignments
            .Include(a => a.Staff)
            .Where(a => a.ShowroomId == showroomId && a.Date >= startUtc && a.Date <= endUtc && !a.IsDeleted)
            .ToListAsync(ct);

        // Fetch daily bills with non-deleted payments in date range
        var bills = await _db.ShowroomDailyBills
            .Include(b => b.Payments)
            .Where(b => b.ShowroomId == showroomId && b.Date >= startUtc && b.Date <= endUtc && !b.IsDeleted)
            .ToListAsync(ct);

        // Date maps
        var staffCountByDate = assignments
            .GroupBy(a => a.Date)
            .ToDictionary(g => g.Key, g => g.Count());

        var vehiclesByDate = assignments
            .GroupBy(a => a.Date)
            .ToDictionary(g => g.Key, g => g.Sum(a => a.VehiclesAttended));

        var billsByDate = bills.ToDictionary(b => b.Date, b => b);

        var allDistinctDates = assignments.Select(a => a.Date)
            .Union(bills.Select(b => b.Date))
            .Distinct()
            .OrderByDescending(d => d)
            .ToList();

        var dailyHistoryRows = new List<ShowroomDailyHistoryRowDto>();

        foreach (var date in allDistinctDates)
        {
            var staffCount = staffCountByDate.GetValueOrDefault(date, 0);
            var vehicles = vehiclesByDate.GetValueOrDefault(date, 0);
            var bill = billsByDate.GetValueOrDefault(date);

            var billed = bill?.Amount ?? 0m;
            var received = bill?.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount) ?? 0m;
            var balance = Math.Max(0m, billed - received);

            string status;
            if (received == 0m) status = "Unpaid";
            else if (received < billed) status = "PartiallyPaid";
            else status = "Paid";

            var hasBill = bill != null && bill.Amount > 0;

            dailyHistoryRows.Add(new ShowroomDailyHistoryRowDto(
                date,
                staffCount,
                vehicles,
                billed,
                received,
                balance,
                status,
                hasBill
            ));
        }

        // Staff Productivity Map
        var staffProductivity = assignments
            .GroupBy(a => a.StaffId)
            .Select(g =>
            {
                var first = g.First();
                var totalVehicles = g.Sum(a => a.VehiclesAttended);
                var daysAssigned = g.Select(a => a.Date).Distinct().Count();
                var avg = daysAssigned > 0 ? Math.Round((decimal)totalVehicles / daysAssigned, 1) : 0m;

                return new ShowroomStaffProductivityDto(
                    g.Key,
                    first.Staff?.Name ?? "Staff Member",
                    first.Staff?.PhoneNumber ?? string.Empty,
                    first.Staff?.Role,
                    daysAssigned,
                    totalVehicles,
                    avg
                );
            })
            .OrderByDescending(p => p.TotalVehiclesAttended)
            .ToList();

        var totalDays = allDistinctDates.Count;
        var totalAssignments = assignments.Count;
        var totalVehiclesAttended = assignments.Sum(a => a.VehiclesAttended);
        var avgVehiclesPerDay = totalDays > 0 ? Math.Round((decimal)totalVehiclesAttended / totalDays, 1) : 0m;
        var totalBilled = bills.Sum(b => b.Amount);
        var totalReceived = bills.SelectMany(b => b.Payments.Where(p => !p.IsDeleted)).Sum(p => p.Amount);
        var outstanding = Math.Max(0m, totalBilled - totalReceived);

        var paidDays = dailyHistoryRows.Count(r => r.HasBill && r.Status == "Paid");
        var partialDays = dailyHistoryRows.Count(r => r.Status == "PartiallyPaid");
        var unpaidDays = dailyHistoryRows.Count(r => r.HasBill && r.Status == "Unpaid");

        return new ShowroomSummaryDto(
            showroom.Id,
            showroom.Name,
            startUtc,
            endUtc,
            totalDays,
            totalAssignments,
            totalVehiclesAttended,
            avgVehiclesPerDay,
            totalBilled,
            totalReceived,
            outstanding,
            paidDays,
            partialDays,
            unpaidDays,
            dailyHistoryRows,
            staffProductivity
        );
    }

    public async Task<IReadOnlyList<ShowroomOutstandingOverviewDto>> GetOutstandingOverviewAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default)
    {
        var showrooms = await _db.Showrooms
            .Where(s => !s.IsDeleted && s.IsActive)
            .OrderBy(s => s.Name)
            .ToListAsync(ct);

        var billsQuery = _db.ShowroomDailyBills
            .Include(b => b.Payments)
            .Where(b => !b.IsDeleted);

        if (fromDate.HasValue)
        {
            var startUtc = ToUtcDate(fromDate.Value);
            billsQuery = billsQuery.Where(b => b.Date >= startUtc);
        }

        if (toDate.HasValue)
        {
            var endUtc = ToUtcDate(toDate.Value);
            billsQuery = billsQuery.Where(b => b.Date <= endUtc);
        }

        var allBills = await billsQuery.ToListAsync(ct);
        var billsByShowroom = allBills.GroupBy(b => b.ShowroomId).ToDictionary(g => g.Key, g => g.ToList());

        var list = new List<ShowroomOutstandingOverviewDto>();

        foreach (var sr in showrooms)
        {
            var showroomBills = billsByShowroom.GetValueOrDefault(sr.Id, new List<ShowroomDailyBill>());
            var totalBilled = showroomBills.Sum(b => b.Amount);
            var totalReceived = showroomBills.SelectMany(b => b.Payments.Where(p => !p.IsDeleted)).Sum(p => p.Amount);
            var outstanding = Math.Max(0m, totalBilled - totalReceived);
            var unpaidDays = showroomBills.Count(b =>
            {
                var rec = b.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount);
                return b.Amount > rec;
            });

            list.Add(new ShowroomOutstandingOverviewDto(
                sr.Id,
                sr.Name,
                sr.Address,
                sr.Phone,
                sr.IsActive,
                totalBilled,
                totalReceived,
                outstanding,
                unpaidDays
            ));
        }

        return list;
    }
}
