using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.DTOs.StaffAttendance;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class ShowroomOperationsService : IShowroomOperationsService
{
    private readonly AppDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public ShowroomOperationsService(AppDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    // ── Vehicle Types ───────────────────────────────────────────────────────

    public async Task<IReadOnlyList<ShowroomVehicleTypeDto>> GetVehicleTypesAsync(bool? isActive = null, CancellationToken ct = default)
    {
        var query = _db.ShowroomVehicleTypes.AsNoTracking().AsQueryable();
        if (isActive.HasValue)
        {
            query = query.Where(v => v.IsActive == isActive.Value);
        }

        var list = await query
            .OrderBy(v => v.DisplayOrder)
            .ThenBy(v => v.Name)
            .ToListAsync(ct);

        return list.Select(ToVehicleTypeDto).ToList();
    }

    public async Task<ShowroomVehicleTypeDto?> GetVehicleTypeByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.ShowroomVehicleTypes.AsNoTracking().FirstOrDefaultAsync(v => v.Id == id, ct);
        return entity == null ? null : ToVehicleTypeDto(entity);
    }

    public async Task<ShowroomVehicleTypeDto> CreateVehicleTypeAsync(CreateShowroomVehicleTypeRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var name = request.Name.Trim();

        var existing = await _db.ShowroomVehicleTypes.AnyAsync(v => v.Code.ToLower() == code.ToLower(), ct);
        if (existing)
        {
            throw new ConflictException($"Vehicle type with code '{code}' already exists.");
        }

        var entity = new ShowroomVehicleType
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            DisplayOrder = request.DisplayOrder,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        await _db.ShowroomVehicleTypes.AddAsync(entity, ct);
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_vehicle_type.create",
            module: "ShowroomOperations",
            description: $"Vehicle type '{entity.Name}' ({entity.Code}) created.",
            entityType: "ShowroomVehicleType",
            entityId: entity.Id,
            entityReference: entity.Code,
            outcome: "Success",
            cancellationToken: ct);

        return ToVehicleTypeDto(entity);
    }

    public async Task<ShowroomVehicleTypeDto?> UpdateVehicleTypeAsync(Guid id, UpdateShowroomVehicleTypeRequest request, CancellationToken ct = default)
    {
        var entity = await _db.ShowroomVehicleTypes.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (entity == null) return null;

        if (!string.IsNullOrWhiteSpace(request.Code))
        {
            var code = request.Code.Trim().ToUpperInvariant();
            var conflict = await _db.ShowroomVehicleTypes.AnyAsync(v => v.Id != id && v.Code.ToLower() == code.ToLower(), ct);
            if (conflict)
            {
                throw new ConflictException($"Vehicle type with code '{code}' already exists.");
            }
            entity.Code = code;
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            entity.Name = request.Name.Trim();
        }

        if (request.DisplayOrder.HasValue)
        {
            entity.DisplayOrder = request.DisplayOrder.Value;
        }

        if (request.IsActive.HasValue)
        {
            entity.IsActive = request.IsActive.Value;
        }

        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_vehicle_type.update",
            module: "ShowroomOperations",
            description: $"Vehicle type '{entity.Name}' ({entity.Code}) updated.",
            entityType: "ShowroomVehicleType",
            entityId: entity.Id,
            entityReference: entity.Code,
            outcome: "Success",
            cancellationToken: ct);

        return ToVehicleTypeDto(entity);
    }

    public async Task<bool> ToggleVehicleTypeActiveAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.ShowroomVehicleTypes.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (entity == null) return false;

        entity.IsActive = !entity.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_vehicle_type.toggle_active",
            module: "ShowroomOperations",
            description: $"Vehicle type '{entity.Name}' ({entity.Code}) active status set to {entity.IsActive}.",
            entityType: "ShowroomVehicleType",
            entityId: entity.Id,
            entityReference: entity.Code,
            outcome: "Success",
            cancellationToken: ct);

        return true;
    }

    // ── Work Types ──────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<ShowroomWorkTypeDto>> GetWorkTypesAsync(bool? isActive = null, CancellationToken ct = default)
    {
        var query = _db.ShowroomWorkTypes.AsNoTracking().AsQueryable();
        if (isActive.HasValue)
        {
            query = query.Where(w => w.IsActive == isActive.Value);
        }

        var list = await query
            .OrderBy(w => w.DisplayOrder)
            .ThenBy(w => w.Name)
            .ToListAsync(ct);

        return list.Select(ToWorkTypeDto).ToList();
    }

    public async Task<ShowroomWorkTypeDto?> GetWorkTypeByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.ShowroomWorkTypes.AsNoTracking().FirstOrDefaultAsync(w => w.Id == id, ct);
        return entity == null ? null : ToWorkTypeDto(entity);
    }

    public async Task<ShowroomWorkTypeDto> CreateWorkTypeAsync(CreateShowroomWorkTypeRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var name = request.Name.Trim();

        var existing = await _db.ShowroomWorkTypes.AnyAsync(w => w.Code.ToLower() == code.ToLower(), ct);
        if (existing)
        {
            throw new ConflictException($"Work type with code '{code}' already exists.");
        }

        var entity = new ShowroomWorkType
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            DisplayOrder = request.DisplayOrder,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        await _db.ShowroomWorkTypes.AddAsync(entity, ct);
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_work_type.create",
            module: "ShowroomOperations",
            description: $"Work type '{entity.Name}' ({entity.Code}) created.",
            entityType: "ShowroomWorkType",
            entityId: entity.Id,
            entityReference: entity.Code,
            outcome: "Success",
            cancellationToken: ct);

        return ToWorkTypeDto(entity);
    }

    public async Task<ShowroomWorkTypeDto?> UpdateWorkTypeAsync(Guid id, UpdateShowroomWorkTypeRequest request, CancellationToken ct = default)
    {
        var entity = await _db.ShowroomWorkTypes.FirstOrDefaultAsync(w => w.Id == id, ct);
        if (entity == null) return null;

        if (!string.IsNullOrWhiteSpace(request.Code))
        {
            var code = request.Code.Trim().ToUpperInvariant();
            var conflict = await _db.ShowroomWorkTypes.AnyAsync(w => w.Id != id && w.Code.ToLower() == code.ToLower(), ct);
            if (conflict)
            {
                throw new ConflictException($"Work type with code '{code}' already exists.");
            }
            entity.Code = code;
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            entity.Name = request.Name.Trim();
        }

        if (request.Description != null)
        {
            entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        }

        if (request.DisplayOrder.HasValue)
        {
            entity.DisplayOrder = request.DisplayOrder.Value;
        }

        if (request.IsActive.HasValue)
        {
            entity.IsActive = request.IsActive.Value;
        }

        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_work_type.update",
            module: "ShowroomOperations",
            description: $"Work type '{entity.Name}' ({entity.Code}) updated.",
            entityType: "ShowroomWorkType",
            entityId: entity.Id,
            entityReference: entity.Code,
            outcome: "Success",
            cancellationToken: ct);

        return ToWorkTypeDto(entity);
    }

    public async Task<bool> ToggleWorkTypeActiveAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.ShowroomWorkTypes.FirstOrDefaultAsync(w => w.Id == id, ct);
        if (entity == null) return false;

        entity.IsActive = !entity.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_work_type.toggle_active",
            module: "ShowroomOperations",
            description: $"Work type '{entity.Name}' ({entity.Code}) active status set to {entity.IsActive}.",
            entityType: "ShowroomWorkType",
            entityId: entity.Id,
            entityReference: entity.Code,
            outcome: "Success",
            cancellationToken: ct);

        return true;
    }

    // ── Staff Work Sessions ─────────────────────────────────────────────────

    public async Task<IReadOnlyList<ShowroomStaffWorkSessionDto>> GetWorkSessionsAsync(
        Guid showroomId,
        DateTime? date = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        Guid? staffId = null,
        CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.AsNoTracking().FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null)
        {
            throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");
        }

        var query = _db.ShowroomStaffWorkSessions
            .AsNoTracking()
            .Include(s => s.Staff)
            .Include(s => s.HomeShowroom)
            .Include(s => s.WorkingShowroom)
            .Include(s => s.VehicleWorks)
            .Where(s => s.WorkingShowroomId == showroomId);

        if (date.HasValue)
        {
            var utcDate = ShowroomDateHelper.ToUtcDate(date.Value);
            query = query.Where(s => s.Date == utcDate);
        }
        else
        {
            if (fromDate.HasValue)
            {
                var utcFrom = ShowroomDateHelper.ToUtcDate(fromDate.Value);
                query = query.Where(s => s.Date >= utcFrom);
            }
            if (toDate.HasValue)
            {
                var utcTo = ShowroomDateHelper.ToUtcDate(toDate.Value);
                query = query.Where(s => s.Date <= utcTo);
            }
        }

        if (staffId.HasValue)
        {
            query = query.Where(s => s.StaffId == staffId.Value);
        }

        var list = await query
            .OrderByDescending(s => s.Date)
            .ThenBy(s => s.Staff.Name)
            .ToListAsync(ct);

        return list.Select(ToStaffWorkSessionDto).ToList();
    }

    public async Task<ShowroomStaffWorkSessionDto?> GetWorkSessionByIdAsync(Guid showroomId, Guid sessionId, CancellationToken ct = default)
    {
        var session = await _db.ShowroomStaffWorkSessions
            .AsNoTracking()
            .Include(s => s.Staff)
            .Include(s => s.HomeShowroom)
            .Include(s => s.WorkingShowroom)
            .Include(s => s.VehicleWorks)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.WorkingShowroomId == showroomId, ct);

        return session == null ? null : ToStaffWorkSessionDto(session);
    }

    public async Task<ShowroomStaffWorkSessionDto> CreateWorkSessionAsync(Guid showroomId, CreateShowroomStaffWorkSessionRequest request, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null)
        {
            throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");
        }

        if (!showroom.IsActive)
        {
            throw new ValidationException("Showroom is inactive and cannot accept new work sessions.");
        }

        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == request.StaffId && !s.IsDeleted, ct);
        if (staff == null)
        {
            throw new KeyNotFoundException($"Staff member with ID '{request.StaffId}' was not found.");
        }

        if (!staff.IsActive)
        {
            throw new ValidationException("Staff member is inactive and cannot be assigned to work sessions.");
        }

        var homeShowroomId = request.HomeShowroomId ?? staff.DefaultShowroomId ?? showroomId;
        var homeShowroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == homeShowroomId, ct);
        if (homeShowroom == null)
        {
            throw new KeyNotFoundException($"Home showroom with ID '{homeShowroomId}' was not found.");
        }

        var workDate = ShowroomDateHelper.ToUtcDate(request.Date);
        var (startTime, endTime) = AttendanceTimeHelper.ResolveSessionTimes(request.SessionType, request.StartTime, request.EndTime);

        // Global overlap validation across all showrooms on workDate
        await AttendanceTimeHelper.ValidateNoSessionOverlapAsync(
            _db,
            request.StaffId,
            staff.Name,
            workDate,
            startTime,
            endTime,
            excludeSessionId: null,
            ct: ct);

        var session = new ShowroomStaffWorkSession
        {
            Id = Guid.NewGuid(),
            StaffId = request.StaffId,
            HomeShowroomId = homeShowroomId,
            WorkingShowroomId = showroomId,
            Date = workDate,
            SessionType = request.SessionType,
            AttendanceStatus = request.AttendanceStatus,
            StartTime = startTime,
            EndTime = endTime,
            TransferReason = string.IsNullOrWhiteSpace(request.TransferReason) ? null : request.TransferReason.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        await _db.ShowroomStaffWorkSessions.AddAsync(session, ct);
        await _db.SaveChangesAsync(ct);

        // Load navigations for DTO mapping
        session.Staff = staff;
        session.HomeShowroom = homeShowroom;
        session.WorkingShowroom = showroom;
        session.VehicleWorks = new List<ShowroomVehicleWork>();

        await _auditLogService.RecordAsync(
            action: "showroom_work_session.create",
            module: "ShowroomOperations",
            description: $"Work session created for staff '{staff.Name}' ({staff.StaffMasterId}) at showroom '{showroom.Name}' for {workDate:yyyy-MM-dd}.",
            entityType: "ShowroomStaffWorkSession",
            entityId: session.Id,
            entityReference: staff.StaffMasterId,
            outcome: "Success",
            cancellationToken: ct);

        return ToStaffWorkSessionDto(session);
    }

    public async Task<ShowroomStaffWorkSessionDto?> UpdateWorkSessionAsync(Guid showroomId, Guid sessionId, UpdateShowroomStaffWorkSessionRequest request, CancellationToken ct = default)
    {
        var session = await _db.ShowroomStaffWorkSessions
            .Include(s => s.Staff)
            .Include(s => s.HomeShowroom)
            .Include(s => s.WorkingShowroom)
            .Include(s => s.VehicleWorks)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.WorkingShowroomId == showroomId, ct);

        if (session == null) return null;

        var newSessionType = request.SessionType ?? session.SessionType;
        var newStartTime = request.StartTime != null ? request.StartTime : session.StartTime;
        var newEndTime = request.EndTime != null ? request.EndTime : session.EndTime;
        var (startTime, endTime) = AttendanceTimeHelper.ResolveSessionTimes(newSessionType, newStartTime, newEndTime);

        // Global overlap validation across all showrooms on session.Date
        await AttendanceTimeHelper.ValidateNoSessionOverlapAsync(
            _db,
            session.StaffId,
            session.Staff?.Name ?? "Staff",
            session.Date,
            startTime,
            endTime,
            excludeSessionId: session.Id,
            ct: ct);

        session.SessionType = newSessionType;
        session.StartTime = startTime;
        session.EndTime = endTime;

        if (request.AttendanceStatus.HasValue)
        {
            session.AttendanceStatus = request.AttendanceStatus.Value;
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
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_work_session.update",
            module: "ShowroomOperations",
            description: $"Work session updated for staff '{session.Staff?.Name ?? "Staff"}' ({session.Staff?.StaffMasterId ?? string.Empty}) at showroom '{session.WorkingShowroom?.Name ?? "Showroom"}'.",
            entityType: "ShowroomStaffWorkSession",
            entityId: session.Id,
            entityReference: session.Staff?.StaffMasterId,
            outcome: "Success",
            cancellationToken: ct);

        return ToStaffWorkSessionDto(session);
    }

    public async Task<ShowroomStaffWorkSessionDto?> CloseWorkSessionAsync(Guid showroomId, Guid sessionId, CloseShowroomStaffWorkSessionRequest? request = null, CancellationToken ct = default)
    {
        var updateReq = new UpdateShowroomStaffWorkSessionRequest
        {
            EndTime = request?.EndTime,
            Notes = request?.Notes
        };

        return await UpdateWorkSessionAsync(showroomId, sessionId, updateReq, ct);
    }

    // ── Vehicle Work & Items ────────────────────────────────────────────────

    public async Task<IReadOnlyList<ShowroomVehicleWorkDto>> GetVehicleWorksAsync(
        Guid showroomId,
        DateTime? date = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        Guid? staffId = null,
        Guid? vehicleTypeId = null,
        CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.AsNoTracking().FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null)
        {
            throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");
        }

        var query = _db.ShowroomVehicleWorks
            .AsNoTracking()
            .Include(v => v.Showroom)
            .Include(v => v.Staff)
            .Include(v => v.VehicleType)
            .Include(v => v.ServiceItems)
                .ThenInclude(i => i.WorkType)
            .Where(v => v.ShowroomId == showroomId);

        if (date.HasValue)
        {
            var utcDate = ShowroomDateHelper.ToUtcDate(date.Value);
            query = query.Where(v => v.Date == utcDate);
        }
        else
        {
            if (fromDate.HasValue)
            {
                var utcFrom = ShowroomDateHelper.ToUtcDate(fromDate.Value);
                query = query.Where(v => v.Date >= utcFrom);
            }
            if (toDate.HasValue)
            {
                var utcTo = ShowroomDateHelper.ToUtcDate(toDate.Value);
                query = query.Where(v => v.Date <= utcTo);
            }
        }

        if (staffId.HasValue)
        {
            query = query.Where(v => v.StaffId == staffId.Value);
        }

        if (vehicleTypeId.HasValue)
        {
            query = query.Where(v => v.VehicleTypeId == vehicleTypeId.Value);
        }

        var list = await query
            .OrderByDescending(v => v.Date)
            .ThenByDescending(v => v.CreatedAt)
            .ToListAsync(ct);

        return list.Select(ToVehicleWorkDto).ToList();
    }

    public async Task<ShowroomVehicleWorkDto?> GetVehicleWorkByIdAsync(Guid showroomId, Guid id, CancellationToken ct = default)
    {
        var entity = await _db.ShowroomVehicleWorks
            .AsNoTracking()
            .Include(v => v.Showroom)
            .Include(v => v.Staff)
            .Include(v => v.VehicleType)
            .Include(v => v.ServiceItems)
                .ThenInclude(i => i.WorkType)
            .FirstOrDefaultAsync(v => v.Id == id && v.ShowroomId == showroomId, ct);

        return entity == null ? null : ToVehicleWorkDto(entity);
    }

    public async Task<ShowroomVehicleWorkDto> CreateVehicleWorkAsync(Guid showroomId, CreateShowroomVehicleWorkRequest request, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null)
        {
            throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");
        }

        if (!showroom.IsActive)
        {
            throw new ValidationException("Showroom is inactive and cannot accept new vehicle work.");
        }

        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == request.StaffId && !s.IsDeleted, ct);
        if (staff == null)
        {
            throw new KeyNotFoundException($"Staff member with ID '{request.StaffId}' was not found.");
        }

        if (!staff.IsActive)
        {
            throw new ValidationException("Staff member is inactive and cannot be assigned to vehicle work.");
        }

        var vehicleType = await _db.ShowroomVehicleTypes.FirstOrDefaultAsync(v => v.Id == request.VehicleTypeId, ct);
        if (vehicleType == null)
        {
            throw new KeyNotFoundException($"Vehicle type with ID '{request.VehicleTypeId}' was not found.");
        }

        if (!vehicleType.IsActive)
        {
            throw new ValidationException($"Vehicle type '{vehicleType.Name}' is inactive and cannot be used for new work.");
        }

        if (request.ShowroomStaffWorkSessionId.HasValue)
        {
            var session = await _db.ShowroomStaffWorkSessions.FirstOrDefaultAsync(
                s => s.Id == request.ShowroomStaffWorkSessionId.Value && s.WorkingShowroomId == showroomId, ct);
            if (session == null)
            {
                throw new KeyNotFoundException($"Showroom staff work session with ID '{request.ShowroomStaffWorkSessionId.Value}' was not found for this showroom.");
            }
        }

        var workDate = ShowroomDateHelper.ToUtcDate(request.Date);

        var isAssignedToAttendance = await _db.ShowroomStaffWorkSessions
            .AnyAsync(s => s.WorkingShowroomId == showroomId && s.StaffId == request.StaffId && s.Date == workDate && !s.IsDeleted, ct)
            || await _db.ShowroomStaffAssignments
            .AnyAsync(a => a.ShowroomId == showroomId && a.StaffId == request.StaffId && a.Date == workDate && !a.IsDeleted, ct);

        if (!isAssignedToAttendance)
        {
            throw new ValidationException($"Staff member '{staff.Name}' is not assigned to showroom '{showroom.Name}' on {workDate:yyyy-MM-dd} in daily staff attendance.");
        }

        var workSessionId = await ResolveWorkSessionIdAsync(
            showroomId,
            request.StaffId,
            workDate,
            request.TimeRecorded,
            request.ShowroomStaffWorkSessionId,
            ct);

        var vehicleWork = new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomId,
            StaffId = request.StaffId,
            VehicleTypeId = request.VehicleTypeId,
            ShowroomStaffWorkSessionId = workSessionId,
            VehicleQuantity = request.VehicleQuantity <= 0 ? 1 : request.VehicleQuantity,
            Date = workDate,
            TimeRecorded = string.IsNullOrWhiteSpace(request.TimeRecorded) ? null : request.TimeRecorded.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        if (request.ServiceItems != null && request.ServiceItems.Count > 0)
        {
            var workTypeIds = request.ServiceItems.Select(i => i.WorkTypeId).Distinct().ToList();
            var validWorkTypes = await _db.ShowroomWorkTypes
                .AsNoTracking()
                .Where(w => workTypeIds.Contains(w.Id))
                .ToDictionaryAsync(w => w.Id, ct);

            foreach (var itemReq in request.ServiceItems)
            {
                if (!validWorkTypes.TryGetValue(itemReq.WorkTypeId, out var workType))
                {
                    throw new KeyNotFoundException($"Work type with ID '{itemReq.WorkTypeId}' was not found.");
                }

                if (!workType.IsActive)
                {
                    throw new ValidationException($"Work type '{workType.Name}' is inactive and cannot be used for new work.");
                }

                var item = new ShowroomVehicleWorkItem
                {
                    Id = Guid.NewGuid(),
                    ShowroomVehicleWorkId = vehicleWork.Id,
                    WorkTypeId = itemReq.WorkTypeId,
                    Quantity = itemReq.Quantity <= 0 ? 1 : itemReq.Quantity,
                    Notes = string.IsNullOrWhiteSpace(itemReq.Notes) ? null : itemReq.Notes.Trim(),
                    CreatedAt = DateTime.UtcNow
                };

                vehicleWork.ServiceItems.Add(item);
            }
        }

        await _db.ShowroomVehicleWorks.AddAsync(vehicleWork, ct);
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_vehicle_work.create",
            module: "ShowroomOperations",
            description: $"Vehicle work recorded: {vehicleWork.VehicleQuantity} {vehicleType.Name}(s) by staff '{staff.Name}' at showroom '{showroom.Name}'.",
            entityType: "ShowroomVehicleWork",
            entityId: vehicleWork.Id,
            entityReference: showroom.MasterId,
            outcome: "Success",
            cancellationToken: ct);

        return (await GetVehicleWorkByIdAsync(showroomId, vehicleWork.Id, ct))!;
    }

    public async Task<IReadOnlyList<ShowroomVehicleWorkDto>> CreateBatchVehicleWorkAsync(Guid showroomId, CreateBatchShowroomVehicleWorkRequest request, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null)
        {
            throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");
        }

        if (!showroom.IsActive)
        {
            throw new ValidationException("Showroom is inactive and cannot accept new vehicle work.");
        }

        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == request.StaffId && !s.IsDeleted, ct);
        if (staff == null)
        {
            throw new KeyNotFoundException($"Staff member with ID '{request.StaffId}' was not found.");
        }

        if (!staff.IsActive)
        {
            throw new ValidationException("Staff member is inactive and cannot be assigned to vehicle work.");
        }

        if (request.Vehicles == null || request.Vehicles.Count == 0)
        {
            throw new ValidationException("At least one vehicle entry is required.");
        }

        if (request.ShowroomStaffWorkSessionId.HasValue)
        {
            var session = await _db.ShowroomStaffWorkSessions.FirstOrDefaultAsync(
                s => s.Id == request.ShowroomStaffWorkSessionId.Value && s.WorkingShowroomId == showroomId, ct);
            if (session == null)
            {
                throw new KeyNotFoundException($"Showroom staff work session with ID '{request.ShowroomStaffWorkSessionId.Value}' was not found for this showroom.");
            }
        }

        var workDate = ShowroomDateHelper.ToUtcDate(request.Date);

        var isAssignedToAttendance = await _db.ShowroomStaffWorkSessions
            .AnyAsync(s => s.WorkingShowroomId == showroomId && s.StaffId == request.StaffId && s.Date == workDate && !s.IsDeleted, ct)
            || await _db.ShowroomStaffAssignments
            .AnyAsync(a => a.ShowroomId == showroomId && a.StaffId == request.StaffId && a.Date == workDate && !a.IsDeleted, ct);

        if (!isAssignedToAttendance)
        {
            throw new ValidationException($"Staff member '{staff.Name}' is not assigned to showroom '{showroom.Name}' on {workDate:yyyy-MM-dd} in daily staff attendance.");
        }

        var batchSessionId = await ResolveWorkSessionIdAsync(
            showroomId,
            request.StaffId,
            workDate,
            request.TimeRecorded,
            request.ShowroomStaffWorkSessionId,
            ct);

        // Fetch all distinct vehicle types
        var vehicleTypeIds = request.Vehicles.Select(v => v.VehicleTypeId).Distinct().ToList();
        var validVehicleTypes = await _db.ShowroomVehicleTypes
            .AsNoTracking()
            .Where(v => vehicleTypeIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, ct);

        // Fetch all distinct work types across all vehicles
        var workTypeIds = request.Vehicles.SelectMany(v => v.WorkTypeIds).Distinct().ToList();
        var validWorkTypes = await _db.ShowroomWorkTypes
            .AsNoTracking()
            .Where(w => workTypeIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, ct);

        var createdWorks = new List<ShowroomVehicleWork>();

        for (int i = 0; i < request.Vehicles.Count; i++)
        {
            var vEntry = request.Vehicles[i];
            var vehicleNum = i + 1;

            if (!validVehicleTypes.TryGetValue(vEntry.VehicleTypeId, out var vehicleType))
            {
                throw new KeyNotFoundException($"Vehicle {vehicleNum}: Vehicle type with ID '{vEntry.VehicleTypeId}' was not found.");
            }

            if (!vehicleType.IsActive)
            {
                throw new ValidationException($"Vehicle {vehicleNum}: Vehicle type '{vehicleType.Name}' is inactive and cannot be used for new work.");
            }

            if (vEntry.WorkTypeIds == null || vEntry.WorkTypeIds.Count == 0)
            {
                throw new ValidationException($"Vehicle {vehicleNum}: Select at least one service / work type.");
            }

            var vehicleWork = new ShowroomVehicleWork
            {
                Id = Guid.NewGuid(),
                ShowroomId = showroomId,
                StaffId = request.StaffId,
                VehicleTypeId = vEntry.VehicleTypeId,
                ShowroomStaffWorkSessionId = batchSessionId,
                VehicleQuantity = 1,
                Date = workDate,
                TimeRecorded = string.IsNullOrWhiteSpace(request.TimeRecorded) ? null : request.TimeRecorded.Trim(),
                Notes = string.IsNullOrWhiteSpace(vEntry.Notes)
                    ? (string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim())
                    : vEntry.Notes.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            foreach (var wtId in vEntry.WorkTypeIds)
            {
                if (!validWorkTypes.TryGetValue(wtId, out var workType))
                {
                    throw new KeyNotFoundException($"Vehicle {vehicleNum}: Work type with ID '{wtId}' was not found.");
                }

                if (!workType.IsActive)
                {
                    throw new ValidationException($"Vehicle {vehicleNum}: Work type '{workType.Name}' is inactive and cannot be used for new work.");
                }

                vehicleWork.ServiceItems.Add(new ShowroomVehicleWorkItem
                {
                    Id = Guid.NewGuid(),
                    ShowroomVehicleWorkId = vehicleWork.Id,
                    WorkTypeId = wtId,
                    Quantity = 1,
                    Notes = null,
                    CreatedAt = DateTime.UtcNow
                });
            }

            createdWorks.Add(vehicleWork);
        }

        await _db.ShowroomVehicleWorks.AddRangeAsync(createdWorks, ct);
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_vehicle_work.create_batch",
            module: "ShowroomOperations",
            description: $"Batch vehicle work recorded: {createdWorks.Count} vehicle(s) by staff '{staff.Name}' at showroom '{showroom.Name}'.",
            entityType: "ShowroomVehicleWork",
            entityId: showroom.Id,
            entityReference: showroom.MasterId,
            outcome: "Success",
            cancellationToken: ct);

        var createdIds = createdWorks.Select(w => w.Id).ToList();
        var reloaded = await _db.ShowroomVehicleWorks
            .AsNoTracking()
            .Include(v => v.Showroom)
            .Include(v => v.Staff)
            .Include(v => v.VehicleType)
            .Include(v => v.ServiceItems)
                .ThenInclude(i => i.WorkType)
            .Where(v => createdIds.Contains(v.Id))
            .ToListAsync(ct);

        var reloadedDict = reloaded.ToDictionary(v => v.Id);
        return createdIds
            .Where(id => reloadedDict.ContainsKey(id))
            .Select(id => ToVehicleWorkDto(reloadedDict[id]))
            .ToList();
    }

    public async Task<ShowroomVehicleWorkDto?> UpdateVehicleWorkAsync(Guid showroomId, Guid id, UpdateShowroomVehicleWorkRequest request, CancellationToken ct = default)
    {
        var vehicleWork = await _db.ShowroomVehicleWorks
            .Include(v => v.Showroom)
            .Include(v => v.Staff)
            .Include(v => v.VehicleType)
            .Include(v => v.ServiceItems)
            .FirstOrDefaultAsync(v => v.Id == id && v.ShowroomId == showroomId, ct);

        if (vehicleWork == null) return null;

        if (request.StaffId.HasValue && request.StaffId.Value != vehicleWork.StaffId)
        {
            var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == request.StaffId.Value && !s.IsDeleted, ct);
            if (staff == null)
            {
                throw new KeyNotFoundException($"Staff member with ID '{request.StaffId.Value}' was not found.");
            }
            if (!staff.IsActive)
            {
                throw new ValidationException("Staff member is inactive and cannot be assigned to vehicle work.");
            }
            vehicleWork.StaffId = request.StaffId.Value;
            vehicleWork.Staff = staff;
        }

        if (request.VehicleTypeId.HasValue && request.VehicleTypeId.Value != vehicleWork.VehicleTypeId)
        {
            var vehicleType = await _db.ShowroomVehicleTypes.FirstOrDefaultAsync(v => v.Id == request.VehicleTypeId.Value, ct);
            if (vehicleType == null)
            {
                throw new KeyNotFoundException($"Vehicle type with ID '{request.VehicleTypeId.Value}' was not found.");
            }
            if (!vehicleType.IsActive)
            {
                throw new ValidationException($"Vehicle type '{vehicleType.Name}' is inactive and cannot be used for new work.");
            }
            vehicleWork.VehicleTypeId = request.VehicleTypeId.Value;
            vehicleWork.VehicleType = vehicleType;
        }

        if (request.ShowroomStaffWorkSessionId.HasValue)
        {
            var session = await _db.ShowroomStaffWorkSessions.FirstOrDefaultAsync(
                s => s.Id == request.ShowroomStaffWorkSessionId.Value && s.WorkingShowroomId == showroomId, ct);
            if (session == null)
            {
                throw new KeyNotFoundException($"Showroom staff work session with ID '{request.ShowroomStaffWorkSessionId.Value}' was not found for this showroom.");
            }
            vehicleWork.ShowroomStaffWorkSessionId = request.ShowroomStaffWorkSessionId.Value;
        }

        if (request.VehicleQuantity.HasValue && request.VehicleQuantity.Value > 0)
        {
            vehicleWork.VehicleQuantity = request.VehicleQuantity.Value;
        }

        if (request.Date.HasValue)
        {
            vehicleWork.Date = ShowroomDateHelper.ToUtcDate(request.Date.Value);
        }

        if (request.StaffId.HasValue || request.Date.HasValue)
        {
            var isAssignedToAttendance = await _db.ShowroomStaffWorkSessions
                .AnyAsync(s => s.WorkingShowroomId == showroomId && s.StaffId == vehicleWork.StaffId && s.Date == vehicleWork.Date && !s.IsDeleted, ct)
                || await _db.ShowroomStaffAssignments
                .AnyAsync(a => a.ShowroomId == showroomId && a.StaffId == vehicleWork.StaffId && a.Date == vehicleWork.Date && !a.IsDeleted, ct);

            if (!isAssignedToAttendance)
            {
                var staffName = vehicleWork.Staff?.Name ?? "Selected staff member";
                var showroomName = vehicleWork.Showroom?.Name ?? "selected showroom";
                throw new ValidationException($"Staff member '{staffName}' is not assigned to showroom '{showroomName}' on {vehicleWork.Date:yyyy-MM-dd} in daily staff attendance.");
            }
        }

        if (request.TimeRecorded != null)
        {
            vehicleWork.TimeRecorded = string.IsNullOrWhiteSpace(request.TimeRecorded) ? null : request.TimeRecorded.Trim();
        }

        if (request.Notes != null)
        {
            vehicleWork.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        }

        if (request.ServiceItems != null)
        {
            var workTypeIds = request.ServiceItems.Select(i => i.WorkTypeId).Distinct().ToList();
            var validWorkTypes = await _db.ShowroomWorkTypes
                .AsNoTracking()
                .Where(w => workTypeIds.Contains(w.Id))
                .ToDictionaryAsync(w => w.Id, ct);

            foreach (var itemReq in request.ServiceItems)
            {
                if (!validWorkTypes.TryGetValue(itemReq.WorkTypeId, out var workType))
                {
                    throw new KeyNotFoundException($"Work type with ID '{itemReq.WorkTypeId}' was not found.");
                }

                if (!workType.IsActive)
                {
                    throw new ValidationException($"Work type '{workType.Name}' is inactive and cannot be used for new work.");
                }
            }

            var existingItems = vehicleWork.ServiceItems.ToList();
            foreach (var item in existingItems)
            {
                _db.Entry(item).State = EntityState.Deleted;
            }

            foreach (var itemReq in request.ServiceItems)
            {
                var item = new ShowroomVehicleWorkItem
                {
                    Id = Guid.NewGuid(),
                    ShowroomVehicleWorkId = vehicleWork.Id,
                    WorkTypeId = itemReq.WorkTypeId,
                    Quantity = itemReq.Quantity <= 0 ? 1 : itemReq.Quantity,
                    Notes = string.IsNullOrWhiteSpace(itemReq.Notes) ? null : itemReq.Notes.Trim(),
                    CreatedAt = DateTime.UtcNow
                };
                _db.ShowroomVehicleWorkItems.Add(item);
            }
        }

        vehicleWork.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "showroom_vehicle_work.update",
            module: "ShowroomOperations",
            description: $"Vehicle work updated for showroom '{vehicleWork.Showroom.Name}'.",
            entityType: "ShowroomVehicleWork",
            entityId: vehicleWork.Id,
            entityReference: vehicleWork.Showroom.MasterId,
            outcome: "Success",
            cancellationToken: ct);

        return await GetVehicleWorkByIdAsync(showroomId, id, ct);
    }

    // ── Operations Summary ──────────────────────────────────────────────────

    public async Task<ShowroomOperationsSummaryDto> GetOperationsSummaryAsync(Guid showroomId, DateTime fromDate, DateTime toDate, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.AsNoTracking().FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null)
        {
            throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");
        }

        var utcFrom = ShowroomDateHelper.ToUtcDate(fromDate);
        var utcTo = ShowroomDateHelper.ToUtcDate(toDate);

        var works = await _db.ShowroomVehicleWorks
            .AsNoTracking()
            .Include(v => v.Staff)
            .Include(v => v.VehicleType)
            .Include(v => v.ServiceItems)
                .ThenInclude(i => i.WorkType)
            .Where(v => v.ShowroomId == showroomId && v.Date >= utcFrom && v.Date <= utcTo)
            .ToListAsync(ct);

        var sessions = await _db.ShowroomStaffWorkSessions
            .AsNoTracking()
            .Include(s => s.Staff)
            .Where(s => s.WorkingShowroomId == showroomId && s.Date >= utcFrom && s.Date <= utcTo)
            .ToListAsync(ct);

        var totalVehiclesHandled = works.Sum(w => w.VehicleQuantity);
        var totalServicesPerformed = works.SelectMany(w => w.ServiceItems).Sum(i => i.Quantity);
        var totalActiveSessions = sessions.Count(s => s.AttendanceStatus == StaffAttendanceStatus.Present || s.AttendanceStatus == StaffAttendanceStatus.HalfDay);

        var vehicleTypeBreakdown = works
            .GroupBy(w => new { w.VehicleTypeId, w.VehicleType.Code, w.VehicleType.Name })
            .Select(g => new VehicleTypeWorkSummaryDto(
                g.Key.VehicleTypeId,
                g.Key.Code,
                g.Key.Name,
                g.Sum(x => x.VehicleQuantity)))
            .OrderByDescending(v => v.TotalVehicles)
            .ToList();

        var workTypeBreakdown = works
            .SelectMany(w => w.ServiceItems)
            .GroupBy(i => new { i.WorkTypeId, i.WorkType.Code, i.WorkType.Name })
            .Select(g => new WorkTypeWorkSummaryDto(
                g.Key.WorkTypeId,
                g.Key.Code,
                g.Key.Name,
                g.Sum(x => x.Quantity)))
            .OrderByDescending(w => w.TotalQuantity)
            .ToList();

        var staffProductivityBreakdown = sessions
            .Select(s => s.Staff)
            .Union(works.Select(w => w.Staff))
            .DistinctBy(st => st.Id)
            .Select(st =>
            {
                var staffSessions = sessions.Count(s => s.StaffId == st.Id);
                var staffWorks = works.Where(w => w.StaffId == st.Id).ToList();
                var staffVehicles = staffWorks.Sum(w => w.VehicleQuantity);
                var staffServices = staffWorks.SelectMany(w => w.ServiceItems).Sum(i => i.Quantity);

                return new StaffWorkSummaryDto(
                    st.Id,
                    st.StaffMasterId,
                    st.Name,
                    staffSessions,
                    staffVehicles,
                    staffServices);
            })
            .OrderByDescending(sp => sp.TotalVehiclesHandled)
            .ThenByDescending(sp => sp.TotalServicesPerformed)
            .ToList();

        return new ShowroomOperationsSummaryDto(
            showroom.Id,
            showroom.MasterId,
            showroom.Name,
            utcFrom,
            utcTo,
            totalVehiclesHandled,
            totalServicesPerformed,
            totalActiveSessions,
            vehicleTypeBreakdown,
            workTypeBreakdown,
            staffProductivityBreakdown);
    }

    // ── Staff Default Showroom ──────────────────────────────────────────────

    public async Task<StaffDefaultShowroomDto?> GetStaffDefaultShowroomAsync(Guid staffId, CancellationToken ct = default)
    {
        var staff = await _db.Staff
            .AsNoTracking()
            .Include(s => s.DefaultShowroom)
            .FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, ct);

        if (staff == null) return null;

        return new StaffDefaultShowroomDto(
            staff.Id,
            staff.StaffMasterId,
            staff.Name,
            staff.DefaultShowroomId,
            staff.DefaultShowroom?.MasterId,
            staff.DefaultShowroom?.Name);
    }

    public async Task<StaffDefaultShowroomDto> SetStaffDefaultShowroomAsync(Guid staffId, Guid? defaultShowroomId, CancellationToken ct = default)
    {
        var staff = await _db.Staff
            .Include(s => s.DefaultShowroom)
            .FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, ct);

        if (staff == null)
        {
            throw new KeyNotFoundException($"Staff member with ID '{staffId}' was not found.");
        }

        Showroom? showroom = null;
        if (defaultShowroomId.HasValue)
        {
            showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == defaultShowroomId.Value, ct);
            if (showroom == null)
            {
                throw new KeyNotFoundException($"Showroom with ID '{defaultShowroomId.Value}' was not found.");
            }
        }

        staff.DefaultShowroomId = defaultShowroomId;
        staff.DefaultShowroom = showroom;
        staff.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: "staff.set_default_showroom",
            module: "Staff",
            description: showroom != null
                ? $"Default showroom for staff '{staff.Name}' ({staff.StaffMasterId}) set to '{showroom.Name}' ({showroom.MasterId})."
                : $"Default showroom for staff '{staff.Name}' ({staff.StaffMasterId}) cleared.",
            entityType: "Staff",
            entityId: staff.Id,
            entityReference: staff.StaffMasterId,
            outcome: "Success",
            cancellationToken: ct);

        return new StaffDefaultShowroomDto(
            staff.Id,
            staff.StaffMasterId,
            staff.Name,
            staff.DefaultShowroomId,
            showroom?.MasterId,
            showroom?.Name);
    }

    // ── Mapping Helpers ─────────────────────────────────────────────────────

    private static ShowroomVehicleTypeDto ToVehicleTypeDto(ShowroomVehicleType entity)
    {
        return new ShowroomVehicleTypeDto(
            entity.Id,
            entity.Code,
            entity.Name,
            entity.DisplayOrder,
            entity.IsActive,
            entity.CreatedAt);
    }

    private static ShowroomWorkTypeDto ToWorkTypeDto(ShowroomWorkType entity)
    {
        return new ShowroomWorkTypeDto(
            entity.Id,
            entity.Code,
            entity.Name,
            entity.Description,
            entity.DisplayOrder,
            entity.IsActive,
            entity.CreatedAt);
    }

    private static ShowroomStaffWorkSessionDto ToStaffWorkSessionDto(ShowroomStaffWorkSession entity)
    {
        return new ShowroomStaffWorkSessionDto(
            entity.Id,
            entity.StaffId,
            entity.Staff?.StaffMasterId ?? string.Empty,
            entity.Staff?.Name ?? string.Empty,
            entity.Staff?.PhoneNumber,
            entity.Staff?.Role,
            entity.HomeShowroomId,
            entity.HomeShowroom?.MasterId ?? string.Empty,
            entity.HomeShowroom?.Name ?? string.Empty,
            entity.WorkingShowroomId,
            entity.WorkingShowroom?.MasterId ?? string.Empty,
            entity.WorkingShowroom?.Name ?? string.Empty,
            entity.Date,
            entity.SessionType,
            entity.SessionType.ToString(),
            entity.AttendanceStatus,
            entity.AttendanceStatus.ToString(),
            entity.StartTime,
            entity.EndTime,
            entity.TransferReason,
            entity.Notes,
            entity.VehicleWorks?.Count ?? 0,
            entity.CreatedAt,
            entity.UpdatedAt);
    }

    private static ShowroomVehicleWorkDto ToVehicleWorkDto(ShowroomVehicleWork entity)
    {
        var items = entity.ServiceItems?.Select(ToVehicleWorkItemDto).ToList() ?? new List<ShowroomVehicleWorkItemDto>();

        return new ShowroomVehicleWorkDto(
            entity.Id,
            entity.ShowroomId,
            entity.Showroom?.MasterId ?? string.Empty,
            entity.Showroom?.Name ?? string.Empty,
            entity.StaffId,
            entity.Staff?.StaffMasterId ?? string.Empty,
            entity.Staff?.Name ?? string.Empty,
            entity.VehicleTypeId,
            entity.VehicleType?.Code ?? string.Empty,
            entity.VehicleType?.Name ?? string.Empty,
            entity.ShowroomStaffWorkSessionId,
            entity.VehicleQuantity,
            entity.Date,
            entity.TimeRecorded,
            entity.Notes,
            items,
            entity.CreatedAt,
            entity.UpdatedAt);
    }

    private static ShowroomVehicleWorkItemDto ToVehicleWorkItemDto(ShowroomVehicleWorkItem entity)
    {
        return new ShowroomVehicleWorkItemDto(
            entity.Id,
            entity.ShowroomVehicleWorkId,
            entity.WorkTypeId,
            entity.WorkType?.Code ?? string.Empty,
            entity.WorkType?.Name ?? string.Empty,
            entity.Quantity,
            entity.Notes,
            entity.CreatedAt);
    }

    private async Task<Guid?> ResolveWorkSessionIdAsync(
        Guid showroomId,
        Guid staffId,
        DateTime workDate,
        string? timeRecorded,
        Guid? explicitSessionId,
        CancellationToken ct)
    {
        if (explicitSessionId.HasValue)
        {
            var explicitSession = await _db.ShowroomStaffWorkSessions.FirstOrDefaultAsync(
                s => s.Id == explicitSessionId.Value && s.WorkingShowroomId == showroomId && !s.IsDeleted, ct);
            if (explicitSession != null)
            {
                return explicitSession.Id;
            }
        }

        var sessions = await _db.ShowroomStaffWorkSessions
            .Where(s => s.WorkingShowroomId == showroomId && s.StaffId == staffId && s.Date == workDate && !s.IsDeleted)
            .OrderBy(s => s.StartTime)
            .ToListAsync(ct);

        if (sessions.Count == 0) return null;
        if (sessions.Count == 1) return sessions[0].Id;

        // If timeRecorded is provided, match by time window (startTime <= timeRecorded < endTime)
        if (!string.IsNullOrWhiteSpace(timeRecorded) && TimeSpan.TryParse(timeRecorded.Trim(), out var recordTime))
        {
            foreach (var session in sessions)
            {
                if (TimeSpan.TryParse(session.StartTime, out var sIn) && TimeSpan.TryParse(session.EndTime, out var sOut))
                {
                    if (recordTime >= sIn && recordTime < sOut)
                    {
                        return session.Id;
                    }
                }
            }

            // If not strictly within any window, find the session with the closest start time
            var closest = sessions
                .Select(s => new
                {
                    Session = s,
                    Distance = TimeSpan.TryParse(s.StartTime, out var sIn) ? Math.Abs((recordTime - sIn).TotalMinutes) : double.MaxValue
                })
                .OrderBy(x => x.Distance)
                .FirstOrDefault();

            if (closest != null)
            {
                return closest.Session.Id;
            }
        }

        // Default to the first session ordered by StartTime
        return sessions[0].Id;
    }
}
