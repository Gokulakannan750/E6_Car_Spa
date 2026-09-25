using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.IO;
using System.Text.RegularExpressions;

namespace CarSpaManagement.Api.Application.Services;

public class StaffAdvanceService : IStaffAdvanceService
{
    private readonly AppDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private readonly IAesEncryptionService _encryptionService;

    public StaffAdvanceService(
        AppDbContext db,
        IAuditLogService auditLogService,
        IAesEncryptionService encryptionService)
    {
        _db = db;
        _auditLogService = auditLogService;
        _encryptionService = encryptionService;
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

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (Enum.TryParse<StaffAdvanceStatus>(status, true, out var parsedStatus))
            {
                baseQuery = baseQuery.Where(a => a.Status == parsedStatus);
            }
        }

        // Summary KPI calculation across all active records matching the current staff / date / search scope
        // CRITICAL: Obsolete records are strictly EXCLUDED from active KPI calculations
        var activeForSummary = baseQuery.Where(a => a.Status != StaffAdvanceStatus.Obsolete);

        var outstandingRecords = await activeForSummary
            .Where(a => a.Status == StaffAdvanceStatus.Outstanding)
            .Select(a => a.BalanceAmount ?? a.Amount)
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
            BalanceAmount = Math.Round(request.Amount, 2),
            AdvanceDate = request.AdvanceDate.Date,
            Reason = request.Reason.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Status = StaffAdvanceStatus.Outstanding,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        await _db.StaffAdvances.AddAsync(advance, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.AdvanceCreated,
            module: Domain.Constants.AuditModules.StaffAdvances,
            description: $"Staff advance of ₹{advance.Amount:F2} issued to '{advance.StaffName}'. Reason: {advance.Reason}.",
            entityType: "StaffAdvance",
            entityId: advance.Id,
            entityReference: advance.StaffName,
            newValues: System.Text.Json.JsonSerializer.Serialize(new {
                staffName = advance.StaffName,
                amount = advance.Amount,
                advanceDate = advance.AdvanceDate,
                reason = advance.Reason
            }),
            outcome: "Success",
            cancellationToken: cancellationToken);

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
        advance.BalanceAmount = 0m;
        advance.SettledAt = DateTime.UtcNow;
        advance.SettledByUserId = userId;
        advance.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.AdvanceSettled,
            module: Domain.Constants.AuditModules.StaffAdvances,
            description: $"Staff advance of ₹{advance.Amount:F2} for '{advance.StaffName}' marked as settled.",
            entityType: "StaffAdvance",
            entityId: advance.Id,
            entityReference: advance.StaffName,
            newValues: System.Text.Json.JsonSerializer.Serialize(new {
                status = "Settled",
                amount = advance.Amount,
                settledAt = advance.SettledAt
            }),
            outcome: "Success",
            cancellationToken: cancellationToken);

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

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.AdvanceObsoleted,
            module: Domain.Constants.AuditModules.StaffAdvances,
            description: $"Staff advance of ₹{advance.Amount:F2} for '{advance.StaffName}' marked obsolete. Reason: {advance.ObsoleteReason}.",
            entityType: "StaffAdvance",
            entityId: advance.Id,
            entityReference: advance.StaffName,
            oldValues: System.Text.Json.JsonSerializer.Serialize(new {
                status = "Outstanding",
                amount = advance.Amount
            }),
            newValues: System.Text.Json.JsonSerializer.Serialize(new {
                status = "Obsolete",
                reason = advance.ObsoleteReason,
                obsoletedAt = advance.ObsoletedAt
            }),
            outcome: "Success",
            cancellationToken: cancellationToken);

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
        var outstandingAmount = activeAdvances.Where(a => a.Status == StaffAdvanceStatus.Outstanding).Sum(a => a.BalanceAmount ?? a.Amount);
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
            .Include(s => s.DefaultShowroom)
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.Name)
            .ToListAsync(cancellationToken);

        var staffIds = staffList.Select(s => s.Id).ToList();

        // Calculate active outstanding advances for staff badges
        var advancesStats = await _db.StaffAdvances
            .Where(a => !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding && staffIds.Contains(a.StaffId))
            .GroupBy(a => a.StaffId)
            .Select(g => new { StaffId = g.Key, Count = g.Count(), Total = g.Sum(x => x.BalanceAmount ?? x.Amount) })
            .ToDictionaryAsync(x => x.StaffId, cancellationToken);

        return staffList.Select(s =>
        {
            var hasStats = advancesStats.TryGetValue(s.Id, out var st);
            var totalCount = hasStats && st != null ? st.Count : 0;
            var totalAmt = hasStats && st != null ? Math.Round(st.Total, 2) : 0m;
            return ToStaffDto(s, totalCount, totalAmt);
        }).ToList();
    }

    public async Task<StaffDto?> GetStaffByIdAsync(Guid staffId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff
            .Include(s => s.DefaultShowroom)
            .FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return null;

        var advancesQuery = _db.StaffAdvances.Where(a => a.StaffId == staffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding);
        var totalAdvances = await advancesQuery.CountAsync(cancellationToken);
        var totalAmount = await advancesQuery.SumAsync(a => (decimal?)(a.BalanceAmount ?? a.Amount), cancellationToken) ?? 0m;

        return ToStaffDto(staff, totalAdvances, Math.Round(totalAmount, 2));
    }

    public async Task<StaffDto> CreateStaffMemberAsync(CreateStaffRequest request, CancellationToken cancellationToken = default)
    {
        var normalizedAadhaar = NormalizeAndValidateAadhaar(request.AadhaarNumber, isRequired: true);
        var encryptedAadhaar = _encryptionService.Encrypt(normalizedAadhaar);

        var trimmedName = request.Name.Trim();
        var staffMasterId = await GenerateStaffMasterIdAsync(trimmedName, cancellationToken);

        var staff = new Staff
        {
            Id = Guid.NewGuid(),
            StaffMasterId = staffMasterId,
            Name = trimmedName,
            PhoneNumber = request.PhoneNumber.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            Role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim(),
            IsActive = request.IsActive,
            AadhaarNumberEncrypted = encryptedAadhaar,
            CreatedAt = DateTime.UtcNow
        };

        if (request.AadhaarFile != null)
        {
            ValidateAadhaarFile(request.AadhaarFile);
            var dir = GetStaffDocumentDirectory(staff.Id);
            var ext = Path.GetExtension(request.AadhaarFile.FileName).ToLowerInvariant();
            var physicalFileName = $"{Guid.NewGuid()}{ext}";
            var physicalPath = Path.Combine(dir, physicalFileName);

            using (var stream = new FileStream(physicalPath, FileMode.Create))
            {
                await request.AadhaarFile.CopyToAsync(stream, cancellationToken);
            }

            staff.AadhaarDocumentPath = physicalPath;
            staff.AadhaarDocumentFileName = Path.GetFileName(request.AadhaarFile.FileName);
            staff.AadhaarDocumentContentType = request.AadhaarFile.ContentType;
            staff.AadhaarDocumentSize = request.AadhaarFile.Length;
        }

        await _db.Staff.AddAsync(staff, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "staff.create",
            module: "Staff",
            description: $"Staff member '{staff.Name}' created with role '{staff.Role}'.",
            entityType: "Staff",
            entityId: staff.Id,
            entityReference: staff.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        if (staff.AadhaarDocumentPath != null)
        {
            await _auditLogService.RecordAsync(
                action: "staff.aadhaar_document_uploaded",
                module: "Staff",
                description: $"Aadhaar document uploaded for staff member '{staff.Name}'.",
                entityType: "Staff",
                entityId: staff.Id,
                entityReference: staff.Name,
                outcome: "Success",
                cancellationToken: cancellationToken);
        }

        return ToStaffDto(staff, 0, 0m);
    }

    public async Task<StaffDto?> UpdateStaffMemberAsync(Guid staffId, UpdateStaffRequest request, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff
            .Include(s => s.DefaultShowroom)
            .FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return null;

        if (request.Name is not null) staff.Name = request.Name.Trim();
        if (request.PhoneNumber is not null) staff.PhoneNumber = request.PhoneNumber.Trim();
        if (request.Email is not null) staff.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        if (request.Address is not null) staff.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        if (request.Role is not null) staff.Role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim();
        if (request.IsActive.HasValue) staff.IsActive = request.IsActive.Value;

        if (!string.IsNullOrWhiteSpace(request.AadhaarNumber))
        {
            var normalizedAadhaar = NormalizeAndValidateAadhaar(request.AadhaarNumber, isRequired: true);
            staff.AadhaarNumberEncrypted = _encryptionService.Encrypt(normalizedAadhaar);

            await _auditLogService.RecordAsync(
                action: "staff.aadhaar_updated",
                module: "Staff",
                description: $"Aadhaar number updated for staff member '{staff.Name}'.",
                entityType: "Staff",
                entityId: staff.Id,
                entityReference: staff.Name,
                outcome: "Success",
                cancellationToken: cancellationToken);
        }

        if (request.RemoveAadhaarDocument == true)
        {
            TryDeletePhysicalFile(staff.AadhaarDocumentPath);
            staff.AadhaarDocumentPath = null;
            staff.AadhaarDocumentFileName = null;
            staff.AadhaarDocumentContentType = null;
            staff.AadhaarDocumentSize = null;

            await _auditLogService.RecordAsync(
                action: "staff.aadhaar_document_deleted",
                module: "Staff",
                description: $"Aadhaar document deleted for staff member '{staff.Name}'.",
                entityType: "Staff",
                entityId: staff.Id,
                entityReference: staff.Name,
                outcome: "Success",
                cancellationToken: cancellationToken);
        }
        else if (request.AadhaarFile != null)
        {
            ValidateAadhaarFile(request.AadhaarFile);
            TryDeletePhysicalFile(staff.AadhaarDocumentPath);

            var dir = GetStaffDocumentDirectory(staff.Id);
            var ext = Path.GetExtension(request.AadhaarFile.FileName).ToLowerInvariant();
            var physicalFileName = $"{Guid.NewGuid()}{ext}";
            var physicalPath = Path.Combine(dir, physicalFileName);

            using (var stream = new FileStream(physicalPath, FileMode.Create))
            {
                await request.AadhaarFile.CopyToAsync(stream, cancellationToken);
            }

            staff.AadhaarDocumentPath = physicalPath;
            staff.AadhaarDocumentFileName = Path.GetFileName(request.AadhaarFile.FileName);
            staff.AadhaarDocumentContentType = request.AadhaarFile.ContentType;
            staff.AadhaarDocumentSize = request.AadhaarFile.Length;

            await _auditLogService.RecordAsync(
                action: "staff.aadhaar_document_uploaded",
                module: "Staff",
                description: $"Aadhaar document updated for staff member '{staff.Name}'.",
                entityType: "Staff",
                entityId: staff.Id,
                entityReference: staff.Name,
                outcome: "Success",
                cancellationToken: cancellationToken);
        }

        staff.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "staff.edit",
            module: "Staff",
            description: $"Staff member '{staff.Name}' updated.",
            entityType: "Staff",
            entityId: staff.Id,
            entityReference: staff.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        var advancesQuery = _db.StaffAdvances.Where(a => a.StaffId == staffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding);
        var totalAdvances = await advancesQuery.CountAsync(cancellationToken);
        var totalAmount = await advancesQuery.SumAsync(a => (decimal?)(a.BalanceAmount ?? a.Amount), cancellationToken) ?? 0m;

        return ToStaffDto(staff, totalAdvances, Math.Round(totalAmount, 2));
    }

    public async Task<bool> DeleteStaffMemberAsync(Guid staffId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return false;

        staff.IsDeleted = true;
        staff.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "staff.delete",
            module: "Staff",
            description: $"Staff member '{staff.Name}' deleted.",
            entityType: "Staff",
            entityId: staff.Id,
            entityReference: staff.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return true;
    }

    public async Task<StaffAadhaarRevealDto?> RevealStaffAadhaarAsync(Guid staffId, Guid requestingUserId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return null;

        if (string.IsNullOrWhiteSpace(staff.AadhaarNumberEncrypted))
        {
            throw new ValidationException("Staff member does not have an Aadhaar number recorded.");
        }

        var decrypted = _encryptionService.Decrypt(staff.AadhaarNumberEncrypted);
        if (string.IsNullOrWhiteSpace(decrypted))
        {
            throw new InvalidOperationException("Failed to decrypt Aadhaar number.");
        }

        await _auditLogService.RecordAsync(
            action: "staff.aadhaar_viewed",
            module: "Staff",
            description: $"Sensitive Aadhaar number viewed for staff member '{staff.Name}'.",
            entityType: "Staff",
            entityId: staff.Id,
            entityReference: staff.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return new StaffAadhaarRevealDto(staff.Id, decrypted);
    }

    public async Task<(byte[] Bytes, string ContentType, string FileName)?> GetStaffAadhaarDocumentAsync(Guid staffId, Guid requestingUserId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null || string.IsNullOrWhiteSpace(staff.AadhaarDocumentPath) || !File.Exists(staff.AadhaarDocumentPath))
        {
            return null;
        }

        var bytes = await File.ReadAllBytesAsync(staff.AadhaarDocumentPath, cancellationToken);
        var contentType = staff.AadhaarDocumentContentType ?? "application/octet-stream";
        var fileName = staff.AadhaarDocumentFileName ?? Path.GetFileName(staff.AadhaarDocumentPath);

        await _auditLogService.RecordAsync(
            action: "staff.aadhaar_document_viewed",
            module: "Staff",
            description: $"Aadhaar document viewed/downloaded for staff member '{staff.Name}'.",
            entityType: "Staff",
            entityId: staff.Id,
            entityReference: staff.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return (bytes, contentType, fileName);
    }

    public async Task<StaffDto?> UploadStaffAadhaarDocumentAsync(Guid staffId, IFormFile file, Guid requestingUserId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return null;

        ValidateAadhaarFile(file);
        TryDeletePhysicalFile(staff.AadhaarDocumentPath);

        var dir = GetStaffDocumentDirectory(staff.Id);
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var physicalFileName = $"{Guid.NewGuid()}{ext}";
        var physicalPath = Path.Combine(dir, physicalFileName);

        using (var stream = new FileStream(physicalPath, FileMode.Create))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        staff.AadhaarDocumentPath = physicalPath;
        staff.AadhaarDocumentFileName = Path.GetFileName(file.FileName);
        staff.AadhaarDocumentContentType = file.ContentType;
        staff.AadhaarDocumentSize = file.Length;
        staff.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "staff.aadhaar_document_uploaded",
            module: "Staff",
            description: $"Aadhaar document uploaded for staff member '{staff.Name}'.",
            entityType: "Staff",
            entityId: staff.Id,
            entityReference: staff.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        var advancesQuery = _db.StaffAdvances.Where(a => a.StaffId == staffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding);
        var totalAdvances = await advancesQuery.CountAsync(cancellationToken);
        var totalAmount = await advancesQuery.SumAsync(a => (decimal?)(a.BalanceAmount ?? a.Amount), cancellationToken) ?? 0m;

        return ToStaffDto(staff, totalAdvances, Math.Round(totalAmount, 2));
    }

    public async Task<StaffDto?> DeleteStaffAadhaarDocumentAsync(Guid staffId, Guid requestingUserId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
        if (staff is null) return null;

        TryDeletePhysicalFile(staff.AadhaarDocumentPath);
        staff.AadhaarDocumentPath = null;
        staff.AadhaarDocumentFileName = null;
        staff.AadhaarDocumentContentType = null;
        staff.AadhaarDocumentSize = null;
        staff.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "staff.aadhaar_document_deleted",
            module: "Staff",
            description: $"Aadhaar document deleted for staff member '{staff.Name}'.",
            entityType: "Staff",
            entityId: staff.Id,
            entityReference: staff.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        var advancesQuery = _db.StaffAdvances.Where(a => a.StaffId == staffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding);
        var totalAdvances = await advancesQuery.CountAsync(cancellationToken);
        var totalAmount = await advancesQuery.SumAsync(a => (decimal?)(a.BalanceAmount ?? a.Amount), cancellationToken) ?? 0m;

        return ToStaffDto(staff, totalAdvances, Math.Round(totalAmount, 2));
    }

    // ── Helper ──────────────────────────────────────────────────────────────

    private StaffDto ToStaffDto(Staff s, int totalAdvances, decimal totalAmount)
    {
        string? masked = null;
        if (!string.IsNullOrWhiteSpace(s.AadhaarNumberEncrypted))
        {
            var decrypted = _encryptionService?.Decrypt(s.AadhaarNumberEncrypted);
            masked = MaskAadhaar(decrypted);
        }

        return new StaffDto(
            Id: s.Id,
            StaffMasterId: s.StaffMasterId,
            Name: s.Name,
            PhoneNumber: s.PhoneNumber,
            Email: s.Email,
            Address: s.Address,
            Role: s.Role,
            IsActive: s.IsActive,
            TotalAdvances: totalAdvances,
            TotalAdvanceAmount: totalAmount,
            AadhaarMasked: masked,
            HasAadhaarDocument: !string.IsNullOrWhiteSpace(s.AadhaarDocumentPath),
            AadhaarDocumentFileName: s.AadhaarDocumentFileName,
            AadhaarDocumentContentType: s.AadhaarDocumentContentType,
            AadhaarDocumentSize: s.AadhaarDocumentSize,
            DefaultShowroomId: s.DefaultShowroomId,
            DefaultShowroomMasterId: s.DefaultShowroom?.MasterId,
            DefaultShowroomName: s.DefaultShowroom?.Name
        );
    }

    public async Task<CarSpaManagement.Api.Application.DTOs.Showrooms.StaffDefaultShowroomDto?> GetDefaultShowroomAsync(Guid staffId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff
            .AsNoTracking()
            .Include(s => s.DefaultShowroom)
            .FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);

        if (staff == null) return null;

        return new CarSpaManagement.Api.Application.DTOs.Showrooms.StaffDefaultShowroomDto(
            staff.Id,
            staff.StaffMasterId,
            staff.Name,
            staff.DefaultShowroomId,
            staff.DefaultShowroom?.MasterId,
            staff.DefaultShowroom?.Name);
    }

    public async Task<CarSpaManagement.Api.Application.DTOs.Showrooms.StaffDefaultShowroomDto> SetDefaultShowroomAsync(Guid staffId, Guid? defaultShowroomId, CancellationToken cancellationToken = default)
    {
        var staff = await _db.Staff
            .Include(s => s.DefaultShowroom)
            .FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);

        if (staff == null)
        {
            throw new KeyNotFoundException($"Staff member with ID '{staffId}' was not found.");
        }

        Showroom? showroom = null;
        if (defaultShowroomId.HasValue)
        {
            showroom = await _db.Showrooms.FirstOrDefaultAsync(s => s.Id == defaultShowroomId.Value, cancellationToken);
            if (showroom == null)
            {
                throw new KeyNotFoundException($"Showroom with ID '{defaultShowroomId.Value}' was not found.");
            }
        }

        staff.DefaultShowroomId = defaultShowroomId;
        staff.DefaultShowroom = showroom;
        staff.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

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
            cancellationToken: cancellationToken);

        return new CarSpaManagement.Api.Application.DTOs.Showrooms.StaffDefaultShowroomDto(
            staff.Id,
            staff.StaffMasterId,
            staff.Name,
            staff.DefaultShowroomId,
            showroom?.MasterId,
            showroom?.Name);
    }

    /// <summary>
    /// Derives the 2-character prefix and 1-character suffix for Staff Master ID generation from a name.
    /// </summary>
    public static (string Prefix, string Suffix) DerivePrefixAndSuffix(string name)
    {
        var alphaChars = new string((name ?? string.Empty).Where(char.IsLetter).ToArray()).ToUpperInvariant();

        string prefix;
        if (alphaChars.Length >= 2)
            prefix = alphaChars[..2];
        else if (alphaChars.Length == 1)
            prefix = alphaChars + "X";
        else
            prefix = "XX";

        string suffix;
        if (alphaChars.Length >= 1)
            suffix = alphaChars[^1].ToString();
        else
            suffix = "X";

        return (prefix, suffix);
    }

    /// <summary>
    /// Generates a unique 6-character Staff Master ID in the format [A-Z]{2}[0-9]{3}[A-Z].
    /// Characters 1-2: First two alphabetic characters of the name (uppercase).
    /// Characters 3-5: Three-digit unique sequence (001-999).
    /// Character 6: Last alphabetic character of the name (uppercase).
    /// </summary>
    private async Task<string> GenerateStaffMasterIdAsync(string name, CancellationToken ct)
    {
        var (prefix, suffix) = DerivePrefixAndSuffix(name);

        // Query existing IDs that match this prefix+suffix pattern
        var existing = await _db.Staff
            .IgnoreQueryFilters()
            .Where(s => s.StaffMasterId.StartsWith(prefix) && s.StaffMasterId.EndsWith(suffix) && s.StaffMasterId.Length == 6)
            .Select(s => s.StaffMasterId)
            .ToListAsync(ct);

        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        for (var seq = 1; seq <= 999; seq++)
        {
            var candidate = $"{prefix}{seq:D3}{suffix}";
            if (!existingSet.Contains(candidate))
                return candidate;
        }

        throw new InvalidOperationException(
            $"All 999 Staff Master IDs for pattern '{prefix}####{suffix}' are exhausted.");
    }

    private static string NormalizeAndValidateAadhaar(string? rawAadhaar, bool isRequired)
    {
        if (string.IsNullOrWhiteSpace(rawAadhaar))
        {
            if (isRequired)
                throw new ValidationException("Aadhaar number is required.");
            return string.Empty;
        }

        // Allow spaces and hyphens for convenience, strip them out
        var normalized = rawAadhaar.Replace(" ", "").Replace("-", "").Trim();

        if (normalized.Length != 12 || !Regex.IsMatch(normalized, @"^\d{12}$"))
        {
            throw new ValidationException("Aadhaar number must be exactly 12 numeric digits.");
        }

        return normalized;
    }

    private static string? MaskAadhaar(string? rawAadhaar)
    {
        if (string.IsNullOrWhiteSpace(rawAadhaar) || rawAadhaar.Length != 12)
            return null;

        // Mask first 8 digits, display last 4 digits: XXXX XXXX 1234
        var last4 = rawAadhaar.Substring(8, 4);
        return $"XXXX XXXX {last4}";
    }

    private static readonly HashSet<string> AllowedDocumentExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".jpg", ".jpeg", ".png"
    };

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf", "image/jpeg", "image/png"
    };

    private const long MaxDocumentSizeBytes = 5 * 1024 * 1024; // 5 MB

    private static void ValidateAadhaarFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            throw new ValidationException("Uploaded file is empty.");
        }

        if (file.Length > MaxDocumentSizeBytes)
        {
            throw new ValidationException("Document size must not exceed 5 MB.");
        }

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedDocumentExtensions.Contains(ext))
        {
            throw new ValidationException("Unsupported file type. Allowed formats: PDF, JPG, JPEG, PNG.");
        }

        if (!AllowedMimeTypes.Contains(file.ContentType))
        {
            throw new ValidationException("Invalid content type. Allowed formats: PDF, JPG, JPEG, PNG.");
        }

        // Validate magic bytes
        using var stream = file.OpenReadStream();
        var header = new byte[8];
        var read = stream.Read(header, 0, header.Length);
        if (read < 4)
        {
            throw new ValidationException("Invalid or corrupted file.");
        }

        var normalizedExt = ext.ToLowerInvariant();
        if (normalizedExt == ".pdf")
        {
            // %PDF -> 0x25, 0x50, 0x44, 0x46
            if (header[0] != 0x25 || header[1] != 0x50 || header[2] != 0x44 || header[3] != 0x46)
                throw new ValidationException("Invalid PDF document file signature.");
        }
        else if (normalizedExt == ".png")
        {
            // 89 50 4E 47
            if (header[0] != 0x89 || header[1] != 0x50 || header[2] != 0x4E || header[3] != 0x47)
                throw new ValidationException("Invalid PNG image file signature.");
        }
        else if (normalizedExt == ".jpg" || normalizedExt == ".jpeg")
        {
            // FF D8 FF
            if (header[0] != 0xFF || header[1] != 0xD8 || header[2] != 0xFF)
                throw new ValidationException("Invalid JPEG image file signature.");
        }
    }

    private static string GetStaffDocumentDirectory(Guid staffId)
    {
        var basePath = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "uploads", "aadhaar_documents", staffId.ToString());
        if (!Directory.Exists(basePath))
        {
            Directory.CreateDirectory(basePath);
        }
        return basePath;
    }

    private static void TryDeletePhysicalFile(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch (Exception)
        {
            // Do not crash on file delete failure
        }
    }

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
        UpdatedAt: a.UpdatedAt,
        BalanceAmount: a.BalanceAmount ?? (a.Status == StaffAdvanceStatus.Settled ? 0m : a.Amount),
        StaffSalarySettlementId: a.StaffSalarySettlementId);
}
