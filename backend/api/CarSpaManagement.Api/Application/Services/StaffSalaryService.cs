using System.Globalization;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.StaffSalary;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class StaffSalaryService : IStaffSalaryService
{
    private readonly AppDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public StaffSalaryService(AppDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    public async Task<StaffSalaryRosterResponse> GetSalaryRosterAsync(
        DateTime fromDate,
        DateTime toDate,
        Guid? staffId = null,
        string? status = null,
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        var from = fromDate.Date;
        var to = toDate.Date;

        if (to < from)
        {
            throw new ValidationException("To Date cannot be earlier than From Date.");
        }

        // Fetch staff members
        var staffQuery = _db.Staff.Where(s => !s.IsDeleted);
        if (staffId.HasValue && staffId.Value != Guid.Empty)
        {
            staffQuery = staffQuery.Where(s => s.Id == staffId.Value);
        }

        var staffList = await staffQuery.OrderBy(s => s.Name).ToListAsync(cancellationToken);
        var staffIds = staffList.Select(s => s.Id).ToList();

        // Fetch settlements for the exact selected period
        var settlements = await _db.StaffSalarySettlements
            .Include(s => s.SettledByUser)
            .Where(s => !s.IsDeleted && s.PeriodFrom == from && s.PeriodTo == to && staffIds.Contains(s.StaffId))
            .ToDictionaryAsync(s => s.StaffId, cancellationToken);

        // Fetch current active outstanding advance balances applicable to the selected period (AdvanceDate <= to)
        var activeAdvances = await _db.StaffAdvances
            .Where(a => !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding && a.AdvanceDate <= to && staffIds.Contains(a.StaffId))
            .GroupBy(a => a.StaffId)
            .Select(g => new { StaffId = g.Key, Total = g.Sum(x => x.BalanceAmount ?? x.Amount) })
            .ToDictionaryAsync(x => x.StaffId, cancellationToken);

        var fromStr = from.ToString("yyyy-MM-dd");
        var toStr = to.ToString("yyyy-MM-dd");

        var items = new List<StaffSalaryItemDto>();

        foreach (var staff in staffList)
        {
            settlements.TryGetValue(staff.Id, out var settlement);
            var currentOutstandingAdvance = activeAdvances.TryGetValue(staff.Id, out var adv) ? Math.Round(adv.Total, 2) : 0m;

            if (settlement != null && settlement.Status == StaffSalaryStatus.Settled)
            {
                // CRITICAL RULE: Settled salary records use the historical financial snapshot
                items.Add(new StaffSalaryItemDto(
                    StaffId: staff.Id,
                    StaffName: staff.Name,
                    StaffRole: staff.Role,
                    StaffPhoneNumber: staff.PhoneNumber,
                    IsActive: staff.IsActive,
                    PeriodFrom: fromStr,
                    PeriodTo: toStr,
                    EnteredSalary: settlement.EnteredSalary,
                    OutstandingAdvance: settlement.OutstandingAdvanceBeforeSettlement,
                    AdvanceDeduction: settlement.AdvanceDeduction,
                    FinalSalary: settlement.FinalSalary,
                    RemainingAdvance: settlement.RemainingAdvanceAfterSettlement,
                    Status: "Settled",
                    SettledAt: settlement.SettledAt,
                    SettledByName: settlement.SettledByUser?.FullName ?? settlement.SettledByUser?.Username,
                    Notes: settlement.Notes,
                    SettlementId: settlement.Id
                ));
            }
            else if (settlement != null && settlement.Status == StaffSalaryStatus.Ready)
            {
                // Ready salary: Entered salary saved, deduction calculated against live outstanding advance
                var advanceDeduction = Math.Min(currentOutstandingAdvance, settlement.EnteredSalary);
                var finalSalary = Math.Max(0m, settlement.EnteredSalary - advanceDeduction);
                var remainingAdvance = Math.Max(0m, currentOutstandingAdvance - advanceDeduction);

                items.Add(new StaffSalaryItemDto(
                    StaffId: staff.Id,
                    StaffName: staff.Name,
                    StaffRole: staff.Role,
                    StaffPhoneNumber: staff.PhoneNumber,
                    IsActive: staff.IsActive,
                    PeriodFrom: fromStr,
                    PeriodTo: toStr,
                    EnteredSalary: settlement.EnteredSalary,
                    OutstandingAdvance: currentOutstandingAdvance,
                    AdvanceDeduction: advanceDeduction,
                    FinalSalary: finalSalary,
                    RemainingAdvance: remainingAdvance,
                    Status: "Ready",
                    SettledAt: null,
                    SettledByName: null,
                    Notes: settlement.Notes,
                    SettlementId: settlement.Id
                ));
            }
            else
            {
                // Not entered
                items.Add(new StaffSalaryItemDto(
                    StaffId: staff.Id,
                    StaffName: staff.Name,
                    StaffRole: staff.Role,
                    StaffPhoneNumber: staff.PhoneNumber,
                    IsActive: staff.IsActive,
                    PeriodFrom: fromStr,
                    PeriodTo: toStr,
                    EnteredSalary: null,
                    OutstandingAdvance: currentOutstandingAdvance,
                    AdvanceDeduction: null,
                    FinalSalary: null,
                    RemainingAdvance: null,
                    Status: "NotEntered",
                    SettledAt: null,
                    SettledByName: null,
                    Notes: null,
                    SettlementId: null
                ));
            }
        }

        // Apply filters
        var filtered = items.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            filtered = filtered.Where(x => x.Status.ToLowerInvariant() == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            filtered = filtered.Where(x =>
                x.StaffName.ToLowerInvariant().Contains(term) ||
                (x.StaffRole != null && x.StaffRole.ToLowerInvariant().Contains(term)) ||
                x.StaffPhoneNumber.Contains(term));
        }

        var resultList = filtered.ToList();

        var totalEntered = resultList.Where(x => x.EnteredSalary.HasValue).Sum(x => x.EnteredSalary!.Value);
        var totalDeductions = resultList.Where(x => x.AdvanceDeduction.HasValue).Sum(x => x.AdvanceDeduction!.Value);
        var totalFinal = resultList.Where(x => x.FinalSalary.HasValue).Sum(x => x.FinalSalary!.Value);

        return new StaffSalaryRosterResponse(
            PeriodFrom: fromStr,
            PeriodTo: toStr,
            TotalStaffCount: resultList.Count,
            NotEnteredCount: resultList.Count(x => x.Status == "NotEntered"),
            ReadyCount: resultList.Count(x => x.Status == "Ready"),
            SettledCount: resultList.Count(x => x.Status == "Settled"),
            TotalEnteredSalary: Math.Round(totalEntered, 2),
            TotalAdvanceDeductions: Math.Round(totalDeductions, 2),
            TotalFinalSalary: Math.Round(totalFinal, 2),
            Items: resultList
        );
    }

    public async Task<StaffSalaryPreviewResponse> GetSalaryPreviewAsync(
        Guid staffId,
        DateTime fromDate,
        DateTime toDate,
        decimal enteredSalary,
        CancellationToken cancellationToken = default)
    {
        var from = fromDate.Date;
        var to = toDate.Date;

        if (to < from)
        {
            throw new ValidationException("To Date cannot be earlier than From Date.");
        }

        if (enteredSalary < 0)
        {
            throw new ValidationException("Entered salary cannot be negative.");
        }

        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken)
            ?? throw new KeyNotFoundException($"Staff member with ID '{staffId}' was not found.");

        // Check if existing settlement is already settled
        var existingSettlement = await _db.StaffSalarySettlements
            .FirstOrDefaultAsync(s => s.StaffId == staffId && s.PeriodFrom == from && s.PeriodTo == to && !s.IsDeleted, cancellationToken);

        if (existingSettlement != null && existingSettlement.Status == StaffSalaryStatus.Settled)
        {
            return new StaffSalaryPreviewResponse(
                StaffId: staff.Id,
                StaffName: staff.Name,
                StaffRole: staff.Role,
                PeriodFrom: from.ToString("yyyy-MM-dd"),
                PeriodTo: to.ToString("yyyy-MM-dd"),
                EnteredSalary: existingSettlement.EnteredSalary,
                OutstandingAdvance: existingSettlement.OutstandingAdvanceBeforeSettlement,
                AdvanceDeduction: existingSettlement.AdvanceDeduction,
                FinalSalary: existingSettlement.FinalSalary,
                RemainingAdvance: existingSettlement.RemainingAdvanceAfterSettlement,
                Status: "Settled"
            );
        }

        // Live preview calculation against current active outstanding advances applicable to this period (AdvanceDate <= to)
        var outstandingAdvance = await _db.StaffAdvances
            .Where(a => a.StaffId == staffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding && a.AdvanceDate <= to)
            .SumAsync(a => (decimal?)(a.BalanceAmount ?? a.Amount), cancellationToken) ?? 0m;

        outstandingAdvance = Math.Round(outstandingAdvance, 2);
        var advanceDeduction = Math.Min(outstandingAdvance, enteredSalary);
        var finalSalary = Math.Max(0m, enteredSalary - advanceDeduction);
        var remainingAdvance = Math.Max(0m, outstandingAdvance - advanceDeduction);

        return new StaffSalaryPreviewResponse(
            StaffId: staff.Id,
            StaffName: staff.Name,
            StaffRole: staff.Role,
            PeriodFrom: from.ToString("yyyy-MM-dd"),
            PeriodTo: to.ToString("yyyy-MM-dd"),
            EnteredSalary: Math.Round(enteredSalary, 2),
            OutstandingAdvance: outstandingAdvance,
            AdvanceDeduction: Math.Round(advanceDeduction, 2),
            FinalSalary: Math.Round(finalSalary, 2),
            RemainingAdvance: Math.Round(remainingAdvance, 2),
            Status: existingSettlement != null ? "Ready" : "NotEntered"
        );
    }

    public async Task<StaffSalaryItemDto> SaveEnteredSalaryAsync(
        SaveEnteredSalaryRequest request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        if (request.EnteredSalary < 0)
        {
            throw new ValidationException("Entered salary cannot be negative.");
        }

        if (!DateTime.TryParseExact(request.PeriodFrom, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fromDate))
        {
            throw new ValidationException("Invalid PeriodFrom format. Expected YYYY-MM-DD.");
        }

        if (!DateTime.TryParseExact(request.PeriodTo, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var toDate))
        {
            throw new ValidationException("Invalid PeriodTo format. Expected YYYY-MM-DD.");
        }

        var from = fromDate.Date;
        var to = toDate.Date;

        if (to < from)
        {
            throw new ValidationException("To Date cannot be earlier than From Date.");
        }

        var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == request.StaffId && !s.IsDeleted, cancellationToken)
            ?? throw new KeyNotFoundException($"Staff member with ID '{request.StaffId}' was not found.");

        // Check if salary for this exact period is already settled
        var settled = await _db.StaffSalarySettlements
            .FirstOrDefaultAsync(s => s.StaffId == request.StaffId && s.PeriodFrom == from && s.PeriodTo == to && s.Status == StaffSalaryStatus.Settled && !s.IsDeleted, cancellationToken);

        if (settled != null)
        {
            throw new ConflictException("Salary for this staff member and period has already been settled and cannot be edited.");
        }

        // Live advance calculation for preview applicable to this period (AdvanceDate <= to)
        var currentOutstandingAdvance = await _db.StaffAdvances
            .Where(a => a.StaffId == request.StaffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding && a.AdvanceDate <= to)
            .SumAsync(a => (decimal?)(a.BalanceAmount ?? a.Amount), cancellationToken) ?? 0m;

        currentOutstandingAdvance = Math.Round(currentOutstandingAdvance, 2);
        var roundedEntered = Math.Round(request.EnteredSalary, 2);
        var advanceDeduction = Math.Min(currentOutstandingAdvance, roundedEntered);
        var finalSalary = Math.Max(0m, roundedEntered - advanceDeduction);
        var remainingAdvance = Math.Max(0m, currentOutstandingAdvance - advanceDeduction);

        // Find existing Ready settlement for this staff member for this period start
        var existing = await _db.StaffSalarySettlements
            .FirstOrDefaultAsync(s => s.StaffId == request.StaffId && !s.IsDeleted && s.Status == StaffSalaryStatus.Ready && s.PeriodFrom == from, cancellationToken);

        if (existing != null)
        {
            existing.PeriodFrom = from;
            existing.PeriodTo = to;
            existing.EnteredSalary = roundedEntered;
            existing.OutstandingAdvanceBeforeSettlement = currentOutstandingAdvance;
            existing.AdvanceDeduction = advanceDeduction;
            existing.FinalSalary = finalSalary;
            existing.RemainingAdvanceAfterSettlement = remainingAdvance;
            existing.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
            existing.Status = StaffSalaryStatus.Ready;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            existing = new StaffSalarySettlement
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                PeriodFrom = from,
                PeriodTo = to,
                EnteredSalary = roundedEntered,
                OutstandingAdvanceBeforeSettlement = currentOutstandingAdvance,
                AdvanceDeduction = advanceDeduction,
                RemainingAdvanceAfterSettlement = remainingAdvance,
                FinalSalary = finalSalary,
                Status = StaffSalaryStatus.Ready,
                Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                CreatedAt = DateTime.UtcNow
            };
            await _db.StaffSalarySettlements.AddAsync(existing, cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "staff_salary.entered",
            module: "Staff Salary",
            description: $"Salary amount ₹{roundedEntered:N2} entered for staff '{staff.Name}' for period {request.PeriodFrom} to {request.PeriodTo}.",
            userId: userId,
            entityType: "StaffSalarySettlement",
            entityId: existing.Id,
            entityReference: staff.Name,
            newValues: System.Text.Json.JsonSerializer.Serialize(new
            {
                staffId = staff.Id,
                staffName = staff.Name,
                periodFrom = request.PeriodFrom,
                periodTo = request.PeriodTo,
                enteredSalary = roundedEntered
            }),
            outcome: "Success",
            cancellationToken: cancellationToken);

        return new StaffSalaryItemDto(
            StaffId: staff.Id,
            StaffName: staff.Name,
            StaffRole: staff.Role,
            StaffPhoneNumber: staff.PhoneNumber,
            IsActive: staff.IsActive,
            PeriodFrom: request.PeriodFrom,
            PeriodTo: request.PeriodTo,
            EnteredSalary: roundedEntered,
            OutstandingAdvance: currentOutstandingAdvance,
            AdvanceDeduction: advanceDeduction,
            FinalSalary: finalSalary,
            RemainingAdvance: remainingAdvance,
            Status: "Ready",
            SettledAt: null,
            SettledByName: null,
            Notes: existing.Notes,
            SettlementId: existing.Id
        );
    }

    public async Task<StaffSalarySettlementDto> SettleSalaryAsync(
        SettleStaffSalaryRequest request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        if (request.EnteredSalary < 0)
        {
            throw new ValidationException("Entered salary cannot be negative.");
        }

        if (!DateTime.TryParseExact(request.PeriodFrom, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fromDate))
        {
            throw new ValidationException("Invalid PeriodFrom format. Expected YYYY-MM-DD.");
        }

        if (!DateTime.TryParseExact(request.PeriodTo, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var toDate))
        {
            throw new ValidationException("Invalid PeriodTo format. Expected YYYY-MM-DD.");
        }

        var from = fromDate.Date;
        var to = toDate.Date;

        if (to < from)
        {
            throw new ValidationException("To Date cannot be earlier than From Date.");
        }

        // Execute settlement in an atomic database transaction
        using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == request.StaffId && !s.IsDeleted, cancellationToken)
                ?? throw new KeyNotFoundException($"Staff member with ID '{request.StaffId}' was not found.");

            // Check if already settled
            var settled = await _db.StaffSalarySettlements
                .FirstOrDefaultAsync(s => s.StaffId == request.StaffId && s.PeriodFrom == from && s.PeriodTo == to && s.Status == StaffSalaryStatus.Settled && !s.IsDeleted, cancellationToken);

            if (settled != null)
            {
                throw new ConflictException("Salary for this staff member and period has already been settled.");
            }

            // Find existing Ready settlement for this staff member for this period start
            var existing = await _db.StaffSalarySettlements
                .FirstOrDefaultAsync(s => s.StaffId == request.StaffId && !s.IsDeleted && s.Status == StaffSalaryStatus.Ready && s.PeriodFrom == from, cancellationToken);

            // Retrieve all current active outstanding advances applicable to this period (AdvanceDate <= to) in strict FIFO order: AdvanceDate ASC, CreatedAt ASC, Id ASC
            var advances = await _db.StaffAdvances
                .Where(a => a.StaffId == request.StaffId && !a.IsDeleted && a.Status == StaffAdvanceStatus.Outstanding && a.AdvanceDate <= to)
                .OrderBy(a => a.AdvanceDate)
                .ThenBy(a => a.CreatedAt)
                .ThenBy(a => a.Id)
                .ToListAsync(cancellationToken);

            var outstandingBefore = Math.Round(advances.Sum(a => a.BalanceAmount ?? a.Amount), 2);
            var roundedEntered = Math.Round(request.EnteredSalary, 2);

            // Mandatory capped formula: MIN(outstandingAdvance, enteredSalary)
            var advanceDeduction = Math.Min(outstandingBefore, roundedEntered);
            var finalSalary = Math.Max(0m, roundedEntered - advanceDeduction);
            var remainingAdvance = Math.Max(0m, outstandingBefore - advanceDeduction);

            Guid settlementId;

            if (existing != null)
            {
                settlementId = existing.Id;
                existing.PeriodFrom = from;
                existing.PeriodTo = to;
                existing.EnteredSalary = roundedEntered;
                existing.OutstandingAdvanceBeforeSettlement = outstandingBefore;
                existing.AdvanceDeduction = advanceDeduction;
                existing.RemainingAdvanceAfterSettlement = remainingAdvance;
                existing.FinalSalary = finalSalary;
                existing.Status = StaffSalaryStatus.Settled;
                existing.SettledAt = DateTime.UtcNow;
                existing.SettledByUserId = userId;
                existing.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                settlementId = Guid.NewGuid();
                existing = new StaffSalarySettlement
                {
                    Id = settlementId,
                    StaffId = staff.Id,
                    PeriodFrom = from,
                    PeriodTo = to,
                    EnteredSalary = roundedEntered,
                    OutstandingAdvanceBeforeSettlement = outstandingBefore,
                    AdvanceDeduction = advanceDeduction,
                    RemainingAdvanceAfterSettlement = remainingAdvance,
                    FinalSalary = finalSalary,
                    Status = StaffSalaryStatus.Settled,
                    SettledAt = DateTime.UtcNow,
                    SettledByUserId = userId,
                    Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                    CreatedAt = DateTime.UtcNow
                };
                await _db.StaffSalarySettlements.AddAsync(existing, cancellationToken);
            }

            // Apply FIFO advance recovery
            var remainingDeductionToApply = advanceDeduction;

            foreach (var adv in advances)
            {
                var currentBal = adv.BalanceAmount ?? adv.Amount;
                if (currentBal <= 0) continue;

                if (remainingDeductionToApply <= 0)
                {
                    break;
                }

                if (remainingDeductionToApply >= currentBal)
                {
                    // Full recovery of this individual advance
                    adv.BalanceAmount = 0m;
                    adv.Status = StaffAdvanceStatus.Settled;
                    adv.SettledAt = DateTime.UtcNow;
                    adv.SettledByUserId = userId;
                    adv.StaffSalarySettlementId = settlementId;
                    adv.UpdatedAt = DateTime.UtcNow;
                    remainingDeductionToApply -= currentBal;
                }
                else
                {
                    // Partial recovery: preserve advance record with updated balance
                    adv.BalanceAmount = Math.Round(currentBal - remainingDeductionToApply, 2);
                    adv.StaffSalarySettlementId = settlementId;
                    adv.UpdatedAt = DateTime.UtcNow;
                    remainingDeductionToApply = 0m;
                }
            }

            await _db.SaveChangesAsync(cancellationToken);

            // Fetch settler user name
            var settlerUser = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
            var settlerName = settlerUser?.FullName ?? settlerUser?.Username;

            // Audit record for salary settlement
            await _auditLogService.RecordAsync(
                action: "staff_salary.settled",
                module: "Staff Salary",
                description: $"Salary settled for '{staff.Name}' for period {request.PeriodFrom} to {request.PeriodTo}. Entered: ₹{roundedEntered:N2}, Advance Deduction: ₹{advanceDeduction:N2}, Final Salary: ₹{finalSalary:N2}, Remaining Advance: ₹{remainingAdvance:N2}.",
                userId: userId,
                entityType: "StaffSalarySettlement",
                entityId: settlementId,
                entityReference: staff.Name,
                newValues: System.Text.Json.JsonSerializer.Serialize(new
                {
                    staffId = staff.Id,
                    staffName = staff.Name,
                    periodFrom = request.PeriodFrom,
                    periodTo = request.PeriodTo,
                    enteredSalary = roundedEntered,
                    advanceDeduction = advanceDeduction,
                    finalSalary = finalSalary,
                    remainingAdvance = remainingAdvance
                }),
                outcome: "Success",
                cancellationToken: cancellationToken);

            if (advanceDeduction > 0)
            {
                await _auditLogService.RecordAsync(
                    action: "staff_advances.recovered",
                    module: "Staff Advances",
                    description: $"Advance deduction of ₹{advanceDeduction:N2} recovered via salary settlement for '{staff.Name}'.",
                    userId: userId,
                    entityType: "StaffAdvance",
                    entityId: settlementId,
                    entityReference: staff.Name,
                    newValues: System.Text.Json.JsonSerializer.Serialize(new
                    {
                        staffId = staff.Id,
                        amountRecovered = advanceDeduction,
                        settlementId = settlementId
                    }),
                    outcome: "Success",
                    cancellationToken: cancellationToken);
            }

            await tx.CommitAsync(cancellationToken);

            return new StaffSalarySettlementDto(
                Id: settlementId,
                StaffId: staff.Id,
                StaffName: staff.Name,
                StaffRole: staff.Role,
                PeriodFrom: request.PeriodFrom,
                PeriodTo: request.PeriodTo,
                EnteredSalary: roundedEntered,
                OutstandingAdvanceBeforeSettlement: outstandingBefore,
                AdvanceDeduction: advanceDeduction,
                RemainingAdvanceAfterSettlement: remainingAdvance,
                FinalSalary: finalSalary,
                Status: "Settled",
                SettledAt: existing.SettledAt,
                SettledByUserId: userId,
                SettledByName: settlerName,
                Notes: existing.Notes,
                CreatedAt: existing.CreatedAt,
                UpdatedAt: existing.UpdatedAt
            );
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyList<StaffSalarySettlementDto>> GetSettlementHistoryAsync(
        Guid staffId,
        CancellationToken cancellationToken = default)
    {
        var list = await _db.StaffSalarySettlements
            .Include(s => s.Staff)
            .Include(s => s.SettledByUser)
            .Where(s => s.StaffId == staffId && !s.IsDeleted && s.Status == StaffSalaryStatus.Settled)
            .OrderByDescending(s => s.PeriodTo)
            .ThenByDescending(s => s.PeriodFrom)
            .ToListAsync(cancellationToken);

        return list.Select(s => new StaffSalarySettlementDto(
            Id: s.Id,
            StaffId: s.StaffId,
            StaffName: s.Staff?.Name ?? "Unknown",
            StaffRole: s.Staff?.Role,
            PeriodFrom: s.PeriodFrom.ToString("yyyy-MM-dd"),
            PeriodTo: s.PeriodTo.ToString("yyyy-MM-dd"),
            EnteredSalary: s.EnteredSalary,
            OutstandingAdvanceBeforeSettlement: s.OutstandingAdvanceBeforeSettlement,
            AdvanceDeduction: s.AdvanceDeduction,
            RemainingAdvanceAfterSettlement: s.RemainingAdvanceAfterSettlement,
            FinalSalary: s.FinalSalary,
            Status: "Settled",
            SettledAt: s.SettledAt,
            SettledByUserId: s.SettledByUserId,
            SettledByName: s.SettledByUser?.FullName ?? s.SettledByUser?.Username,
            Notes: s.Notes,
            CreatedAt: s.CreatedAt,
            UpdatedAt: s.UpdatedAt
        )).ToList();
    }
}
