using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class ShowroomService : IShowroomService
{
    private readonly AppDbContext _db;

    public ShowroomService(AppDbContext db)
    {
        _db = db;
    }

    private static DateTime ToUtcDate(DateTime dt)
    {
        return DateTime.SpecifyKind(dt.Date, DateTimeKind.Utc);
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
                s.Name,
                s.Address,
                s.Phone,
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
            s.UpdatedAt
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
            showroom.UpdatedAt
        );
    }

    public async Task<ShowroomDto> CreateAsync(CreateShowroomRequest request, CancellationToken ct = default)
    {
        var showroom = new Showroom
        {
            Name = request.Name.Trim(),
            Address = request.Address.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            IsActive = request.IsActive
        };

        _db.Showrooms.Add(showroom);
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
            showroom.UpdatedAt
        );
    }

    public async Task<ShowroomDto?> UpdateAsync(Guid id, UpdateShowroomRequest request, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (showroom == null) return null;

        if (request.Name != null) showroom.Name = request.Name.Trim();
        if (request.Address != null) showroom.Address = request.Address.Trim();
        if (request.Phone != null) showroom.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        if (request.IsActive.HasValue) showroom.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (showroom == null) return false;

        showroom.IsDeleted = true;
        showroom.UpdatedAt = DateTime.UtcNow;

        // Also soft delete associated daily staff assignments
        var assignments = await _db.ShowroomStaffAssignments
            .Where(a => a.ShowroomId == id)
            .ToListAsync(ct);

        foreach (var a in assignments)
        {
            a.IsDeleted = true;
            a.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return true;
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

    public async Task<DailyStaffResponse?> GetDailyStaffAsync(Guid showroomId, DateTime date, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct);
        if (showroom == null) return null;

        var targetDate = ToUtcDate(date);

        var assignments = await _db.ShowroomStaffAssignments
            .Include(a => a.Staff)
            .Include(a => a.Showroom)
            .Where(a => a.ShowroomId == showroomId && a.Date == targetDate && !a.IsDeleted)
            .OrderBy(a => a.Staff.Name)
            .ToListAsync(ct);

        var list = assignments.Select(a => new DailyStaffAssignmentDto(
            a.Id,
            a.ShowroomId,
            showroom.Name,
            a.StaffId,
            a.Staff?.Name ?? "Unknown Staff",
            a.Staff?.PhoneNumber ?? string.Empty,
            a.Staff?.Role,
            a.Date,
            a.VehiclesAttended,
            a.CreatedAt
        )).ToList();

        var totalVehicles = list.Sum(a => a.VehiclesAttended);

        return new DailyStaffResponse(
            showroom.Id,
            showroom.Name,
            targetDate,
            totalVehicles,
            list
        );
    }

    public async Task<DailyStaffAssignmentDto> AssignStaffAsync(Guid showroomId, CreateDailyStaffAssignmentRequest request, CancellationToken ct = default)
    {
        var showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == showroomId, ct)
            ?? throw new KeyNotFoundException($"Showroom with ID '{showroomId}' was not found.");

        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == request.StaffId, ct)
            ?? throw new KeyNotFoundException($"Staff member with ID '{request.StaffId}' was not found.");

        var targetDate = ToUtcDate(request.Date);

        // Check if an assignment already exists for this showroom, staff and date
        var existing = await _db.ShowroomStaffAssignments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.ShowroomId == showroomId && a.StaffId == request.StaffId && a.Date == targetDate, ct);

        if (existing != null)
        {
            if (!existing.IsDeleted)
            {
                throw new InvalidOperationException($"Staff member '{staff.Name}' is already assigned to '{showroom.Name}' on {targetDate:dd-MMM-yyyy}.");
            }

            // Restore previously deleted assignment
            existing.IsDeleted = false;
            existing.VehiclesAttended = Math.Max(0, request.VehiclesAttended);
            existing.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return new DailyStaffAssignmentDto(
                existing.Id,
                showroomId,
                showroom.Name,
                staff.Id,
                staff.Name,
                staff.PhoneNumber,
                staff.Role,
                existing.Date,
                existing.VehiclesAttended,
                existing.CreatedAt
            );
        }

        var newAssignment = new ShowroomStaffAssignment
        {
            ShowroomId = showroomId,
            StaffId = request.StaffId,
            Date = targetDate,
            VehiclesAttended = Math.Max(0, request.VehiclesAttended)
        };

        _db.ShowroomStaffAssignments.Add(newAssignment);
        await _db.SaveChangesAsync(ct);

        return new DailyStaffAssignmentDto(
            newAssignment.Id,
            showroomId,
            showroom.Name,
            staff.Id,
            staff.Name,
            staff.PhoneNumber,
            staff.Role,
            newAssignment.Date,
            newAssignment.VehiclesAttended,
            newAssignment.CreatedAt
        );
    }

    public async Task<DailyStaffAssignmentDto?> UpdateAssignmentVehiclesAsync(Guid assignmentId, int vehiclesAttended, CancellationToken ct = default)
    {
        var assignment = await _db.ShowroomStaffAssignments
            .Include(a => a.Staff)
            .Include(a => a.Showroom)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null) return null;

        assignment.VehiclesAttended = Math.Max(0, vehiclesAttended);
        assignment.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new DailyStaffAssignmentDto(
            assignment.Id,
            assignment.ShowroomId,
            assignment.Showroom?.Name ?? "Showroom",
            assignment.StaffId,
            assignment.Staff?.Name ?? "Staff",
            assignment.Staff?.PhoneNumber ?? string.Empty,
            assignment.Staff?.Role,
            assignment.Date,
            assignment.VehiclesAttended,
            assignment.CreatedAt
        );
    }

    public async Task<bool> RemoveAssignmentAsync(Guid assignmentId, CancellationToken ct = default)
    {
        var assignment = await _db.ShowroomStaffAssignments.FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment == null) return false;

        assignment.IsDeleted = true;
        assignment.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return true;
    }
}
