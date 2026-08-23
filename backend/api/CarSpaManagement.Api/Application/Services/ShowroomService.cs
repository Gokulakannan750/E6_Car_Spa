using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
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
        return ToBillDto(bill, showroom.Name);
    }

    public async Task<bool> DeletePaymentAsync(Guid paymentId, CancellationToken ct = default)
    {
        var payment = await _db.ShowroomPayments.FirstOrDefaultAsync(p => p.Id == paymentId, ct);
        if (payment == null) return false;

        payment.IsDeleted = true;
        payment.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
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
