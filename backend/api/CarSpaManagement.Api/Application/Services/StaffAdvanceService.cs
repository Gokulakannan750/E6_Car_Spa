using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class StaffAdvanceService : IStaffAdvanceService
{
    private readonly AppDbContext _db;

    public StaffAdvanceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<StaffAdvanceListResponse> GetAllAsync(
        int page,
        int pageSize,
        Guid? staffId = null,
        string? status = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        var baseQuery = _db.StaffAdvances
            .Include(a => a.Staff)
            .Include(a => a.SettledByUser)
            .Include(a => a.ObsoletedByUser)
            .Where(a => !a.IsDeleted);

        if (staffId.HasValue)
        {
            baseQuery = baseQuery.Where(a => a.StaffId == staffId.Value);
        }

        if (fromDate.HasValue)
        {
            var from = fromDate.Value.Date;
            baseQuery = baseQuery.Where(a => a.AdvanceDate >= from);
        }

        if (toDate.HasValue)
        {
            var to = toDate.Value.Date;
            baseQuery = baseQuery.Where(a => a.AdvanceDate <= to);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            baseQuery = baseQuery.Where(a =>
                (a.Staff != null && a.Staff.Name.ToLower().Contains(term)) ||
                (!string.IsNullOrEmpty(a.StaffName) && a.StaffName.ToLower().Contains(term)) ||
                (!string.IsNullOrEmpty(a.Reason) && a.Reason.ToLower().Contains(term)) ||
                (!string.IsNullOrEmpty(a.Notes) && a.Notes.ToLower().Contains(term)));
        }

        // Summary KPI calculation across all active records matching the current staff / date / search scope
        // CRITICAL: Obsolete records are strictly EXCLUDED from active KPI calculations
        var activeForSummary = baseQuery.Where(a => a.Status != StaffAdvanceStatus.Obsolete);

        var outstandingRecords = await activeForSummary
            .Where(a => a.Status == StaffAdvanceStatus.Outstanding)
            .Select(a => a.Amount)
            .ToListAsync(cancellationToken);

        var settledRecords = await activeForSummary
            .Where(a => a.Status == StaffAdvanceStatus.Settled)
            .Select(a => a.Amount)
            .ToListAsync(cancellationToken);

        var outstandingCount = outstandingRecords.Count;
        var outstandingAmount = outstandingRecords.Sum();
        var settledCount = settledRecords.Count;
        var settledAmount = settledRecords.Sum();

        var summary = new StaffAdvanceSummaryDto(
            OutstandingCount: outstandingCount,
            OutstandingAmount: Math.Round(outstandingAmount, 2),
            SettledCount: settledCount,
            SettledAmount: Math.Round(settledAmount, 2),
            TotalActiveCount: outstandingCount + settledCount,
            TotalActiveAmount: Math.Round(outstandingAmount + settledAmount, 2)
        );

        // Apply Status Filter for listing
        var listQuery = baseQuery;
        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToLowerInvariant();
            if (s == "outstanding")
            {
                listQuery = listQuery.Where(a => a.Status == StaffAdvanceStatus.Outstanding);
            }
            else if (s == "settled")
            {
                listQuery = listQuery.Where(a => a.Status == StaffAdvanceStatus.Settled);
            }
            else if (s == "obsolete")
            {
                listQuery = listQuery.Where(a => a.Status == StaffAdvanceStatus.Obsolete);
            }
            else if (s == "all")
            {
                // Show all including obsolete
            }
            else
            {
                // Default active view: Outstanding and Settled only
                listQuery = listQuery.Where(a => a.Status != StaffAdvanceStatus.Obsolete);
            }
        }
        else
        {
            // Default view: Show active advances (Outstanding and Settled), exclude Obsolete
            listQuery = listQuery.Where(a => a.Status != StaffAdvanceStatus.Obsolete);
        }

        var totalCount = await listQuery.CountAsync(cancellationToken);

        var items = await listQuery
            .OrderByDescending(a => a.AdvanceDate)
            .ThenByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => ToDto(a))
            .ToListAsync(cancellationToken);

        return new StaffAdvanceListResponse(items, totalCount, page, pageSize, summary);
    }

    public async Task<StaffAdvanceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var advance = await _db.StaffAdvances
            .Include(a => a.Staff)
            .Include(a => a.SettledByUser)
            .Include(a => a.ObsoletedByUser)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted, cancellationToken);

        return advance is null ? null : ToDto(advance);
    }

    public async Task<StaffAdvanceDto> CreateAsync(CreateStaffAdvanceRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Amount <= 0)
        {
            throw new ValidationException("Advance amount must be greater than zero.");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new ValidationException("Advance reason is required.");
        }

        var staff = await _db.Staff
            .FirstOrDefaultAsync(s => s.Id == request.StaffId && !s.IsDeleted, cancellationToken)
            ?? throw new KeyNotFoundException($"Staff member with ID '{request.StaffId}' was not found.");

        var advance = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Staff = staff,
            StaffName = staff.Name,
            StaffRole = staff.Role,
            AdvanceType = "Advance",
            Description = request.Reason.Trim(),
            Amount = Math.Round(request.Amount, 2),
            AdvanceDate = request.AdvanceDate.Date,
            Reason = request.Reason.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Status = StaffAdvanceStatus.Outstanding,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        await _db.StaffAdvances.AddAsync(advance, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return ToDto(advance);
    }

    public async Task<StaffAdvanceDto> SettleAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var advance = await _db.StaffAdvances
            .Include(a => a.Staff)
            .Include(a => a.SettledByUser)
            .Include(a => a.ObsoletedByUser)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted, cancellationToken)
            ?? throw new KeyNotFoundException($"Staff advance with ID '{id}' was not found.");

        if (advance.Status == StaffAdvanceStatus.Obsolete)
        {
            throw new ConflictException("Obsolete staff advances cannot be settled.");
        }

        if (advance.Status == StaffAdvanceStatus.Settled)
        {
            throw new ConflictException("Staff advance is already settled.");
        }

        advance.Status = StaffAdvanceStatus.Settled;
        advance.SettledAt = DateTime.UtcNow;
        advance.SettledByUserId = userId;
        advance.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        if (advance.SettledByUser == null && advance.SettledByUserId.HasValue)
        {
            advance.SettledByUser = await _db.Users.FindAsync([advance.SettledByUserId.Value], cancellationToken);
        }

        return ToDto(advance);
    }

    public async Task<StaffAdvanceDto> ObsoleteAsync(Guid id, ObsoleteStaffAdvanceRequest request, Guid userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 3)
        {
            throw new ValidationException("A valid obsolete reason (at least 3 characters) is mandatory.");
        }

        var advance = await _db.StaffAdvances
            .Include(a => a.Staff)
            .Include(a => a.SettledByUser)
            .Include(a => a.ObsoletedByUser)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted, cancellationToken)
            ?? throw new KeyNotFoundException($"Staff advance with ID '{id}' was not found.");

        if (advance.Status == StaffAdvanceStatus.Obsolete)
        {
            throw new ConflictException("Staff advance is already obsolete.");
        }

        if (advance.Status == StaffAdvanceStatus.Settled)
        {
            throw new ConflictException("Settled staff advances cannot be made obsolete.");
        }

        // Marking an advance Obsolete is a business status change, NOT a database deletion.
        // Keep IsDeleted = false; exclude Status = Obsolete from active views and KPI calculations.
        advance.Status = StaffAdvanceStatus.Obsolete;
        advance.ObsoleteReason = request.Reason.Trim();
        advance.ObsoletedAt = DateTime.UtcNow;
        advance.ObsoletedByUserId = userId;
        advance.UpdatedAt = DateTime.UtcNow;
        advance.IsDeleted = false;

        await _db.SaveChangesAsync(cancellationToken);

        if (advance.ObsoletedByUser == null && advance.ObsoletedByUserId.HasValue)
        {
            advance.ObsoletedByUser = await _db.Users.FindAsync([advance.ObsoletedByUserId.Value], cancellationToken);
        }

        return ToDto(advance);
    }

    public async Task<StaffAdvanceHistoryDto> GetStaffAdvanceHistoryAsync(Guid staffId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff
            .FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken)
            ?? throw new KeyNotFoundException($"Staff member with ID '{staffId}' was not found.");

        var advances = await _db.StaffAdvances
            .Include(a => a.Staff)
            .Include(a => a.SettledByUser)
            .Include(a => a.ObsoletedByUser)
            .Where(a => a.StaffId == staffId && !a.IsDeleted)
            .OrderByDescending(a => a.AdvanceDate)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

        var activeAdvances = advances.Where(a => a.Status != StaffAdvanceStatus.Obsolete).ToList();
        var outstandingAmount = activeAdvances.Where(a => a.Status == StaffAdvanceStatus.Outstanding).Sum(a => a.Amount);
        var settledAmount = activeAdvances.Where(a => a.Status == StaffAdvanceStatus.Settled).Sum(a => a.Amount);
        var totalAdvancesAmount = outstandingAmount + settledAmount;

        var dtos = advances.Select(ToDto).ToList();

        return new StaffAdvanceHistoryDto(
            StaffId: staff.Id,
            StaffName: staff.Name,
            StaffPhone: staff.PhoneNumber,
            StaffRole: staff.Role,
            TotalAdvancesAmount: Math.Round(totalAdvancesAmount, 2),
            OutstandingAmount: Math.Round(outstandingAmount, 2),
            SettledAmount: Math.Round(settledAmount, 2),
            Advances: dtos
        );
    }

    // ── Staff Directory Management ──────────────────────────────────────────

    public async Task<IReadOnlyList<StaffDto>> GetStaffAsync(CancellationToken cancellationToken = default)
    {
        var staffList = await _db.Staff
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.Name)
            .ToListAsync(cancellationToken);

        var staffIds = staffList.Select(s => s.Id).ToList();

        // Calculate active outstanding advances for staff badges
        var advancesStats = await _db.StaffAdvances
            .Where(a => !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding && staffIds.Contains(a.StaffId))
            .GroupBy(a => a.StaffId)
            .Select(g => new { StaffId = g.Key, Count = g.Count(), Total = g.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.StaffId, cancellationToken);

        return staffList.Select(s =>
        {
            var hasStats = advancesStats.TryGetValue(s.Id, out var st);
            return new StaffDto(
                s.Id,
                s.Name,
                s.PhoneNumber,
                s.Email,
                s.Address,
                s.Role,
                s.IsActive,
                hasStats && st != null ? st.Count : 0,
                hasStats && st != null ? Math.Round(st.Total, 2) : 0m);
        }).ToList();
    }

    public async Task<StaffDto?> GetStaffByIdAsync(Guid staffId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return null;

        var advancesQuery = _db.StaffAdvances.Where(a => a.StaffId == staffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding);
        var totalAdvances = await advancesQuery.CountAsync(cancellationToken);
        var totalAmount = await advancesQuery.SumAsync(a => (decimal?)a.Amount, cancellationToken) ?? 0m;

        return new StaffDto(
            staff.Id,
            staff.Name,
            staff.PhoneNumber,
            staff.Email,
            staff.Address,
            staff.Role,
            staff.IsActive,
            totalAdvances,
            Math.Round(totalAmount, 2));
    }

    public async Task<StaffDto> CreateStaffMemberAsync(CreateStaffRequest request, CancellationToken cancellationToken = default)
    {
        var staff = new Staff
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            Role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim(),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        await _db.Staff.AddAsync(staff, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return new StaffDto(
            staff.Id,
            staff.Name,
            staff.PhoneNumber,
            staff.Email,
            staff.Address,
            staff.Role,
            staff.IsActive,
            0,
            0m);
    }

    public async Task<StaffDto?> UpdateStaffMemberAsync(Guid staffId, UpdateStaffRequest request, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return null;

        if (request.Name is not null) staff.Name = request.Name.Trim();
        if (request.PhoneNumber is not null) staff.PhoneNumber = request.PhoneNumber.Trim();
        if (request.Email is not null) staff.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        if (request.Address is not null) staff.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        if (request.Role is not null) staff.Role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim();
        if (request.IsActive.HasValue) staff.IsActive = request.IsActive.Value;

        staff.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var advancesQuery = _db.StaffAdvances.Where(a => a.StaffId == staffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding);
        var totalAdvances = await advancesQuery.CountAsync(cancellationToken);
        var totalAmount = await advancesQuery.SumAsync(a => (decimal?)a.Amount, cancellationToken) ?? 0m;

        return new StaffDto(
            staff.Id,
            staff.Name,
            staff.PhoneNumber,
            staff.Email,
            staff.Address,
            staff.Role,
            staff.IsActive,
            totalAdvances,
            Math.Round(totalAmount, 2));
    }

    public async Task<bool> DeleteStaffMemberAsync(Guid staffId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return false;

        staff.IsDeleted = true;
        staff.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    // ── Helper ──────────────────────────────────────────────────────────────

    private static StaffAdvanceDto ToDto(StaffAdvance a) => new(
        Id: a.Id,
        StaffId: a.StaffId,
        StaffName: a.Staff?.Name ?? a.StaffName ?? "Unknown",
        StaffPhone: a.Staff?.PhoneNumber,
        StaffRole: a.Staff?.Role ?? a.StaffRole,
        Amount: Math.Round(a.Amount, 2),
        AdvanceDate: a.AdvanceDate,
        Reason: !string.IsNullOrWhiteSpace(a.Reason) ? a.Reason : (!string.IsNullOrWhiteSpace(a.Description) ? a.Description : (!string.IsNullOrWhiteSpace(a.AdvanceType) ? a.AdvanceType : "Staff Advance")),
        Notes: a.Notes,
        Status: a.Status.ToString(),
        SettledAt: a.SettledAt,
        SettledByUserId: a.SettledByUserId,
        SettledByName: a.SettledByUser?.FullName ?? a.SettledByUser?.Username,
        ObsoletedAt: a.ObsoletedAt,
        ObsoletedByUserId: a.ObsoletedByUserId,
        ObsoletedByName: a.ObsoletedByUser?.FullName ?? a.ObsoletedByUser?.Username,
        ObsoleteReason: a.ObsoleteReason,
        CreatedAt: a.CreatedAt,
        UpdatedAt: a.UpdatedAt);
}
