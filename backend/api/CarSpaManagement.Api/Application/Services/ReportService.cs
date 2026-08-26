using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Reports;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class ReportService : IReportService
{
    private readonly AppDbContext _db;

    public ReportService(AppDbContext db)
    {
        _db = db;
    }

    private static DateTime ToUtcDate(DateTime dt) => ShowroomDateHelper.ToUtcDate(dt);

    // ── 1. Dashboard Summary ────────────────────────────────────────────────
    public async Task<DashboardSummaryDto> GetDashboardSummaryAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default)
    {
        var startUtc = ToUtcDate(fromDate ?? DateTime.UtcNow);
        var endUtc = ToUtcDate(toDate ?? DateTime.UtcNow);

        if (startUtc > endUtc)
        {
            (startUtc, endUtc) = (endUtc, startUtc);
        }

        var endOfDayExclusive = endUtc.AddDays(1);
        var showroomStart = startUtc;
        var showroomEnd = endUtc;

        // 1. Job Card KPIs
        var jobCardsQuery = _db.JobCards.AsNoTracking().Where(j => !j.IsDeleted && j.CreatedAt >= startUtc && j.CreatedAt < endOfDayExclusive);
        var jobCards = await jobCardsQuery.Select(j => new { j.Id, j.Status, j.VehicleId, j.TotalAmount }).ToListAsync(ct);

        var totalJobCards = jobCards.Count;
        var newJobCards = jobCards.Count(j => j.Status == JobCardStatus.Draft);
        var inProgressJobCards = jobCards.Count(j => j.Status == JobCardStatus.InProgress || j.Status == JobCardStatus.QualityCheck);
        var completedJobCards = jobCards.Count(j => j.Status == JobCardStatus.Ready || j.Status == JobCardStatus.Invoiced || j.Status == JobCardStatus.Paid || j.Status == JobCardStatus.Delivered);
        var cancelledJobCards = jobCards.Count(j => j.Status == JobCardStatus.Cancelled);
        var invoicedJobCards = jobCards.Count(j => j.Status == JobCardStatus.Invoiced || j.Status == JobCardStatus.Paid);

        // 2. Vehicle Activity
        var completedJobCardIds = jobCards
            .Where(j => j.Status == JobCardStatus.Ready || j.Status == JobCardStatus.Invoiced || j.Status == JobCardStatus.Paid || j.Status == JobCardStatus.Delivered)
            .Select(j => j.Id)
            .ToList();

        var totalServicesCompleted = 0;
        if (completedJobCardIds.Count > 0)
        {
            totalServicesCompleted = await _db.JobCardServices
                .AsNoTracking()
                .Where(s => completedJobCardIds.Contains(s.JobCardId) && !s.IsDeleted)
                .CountAsync(ct);
        }

        var uniqueVehicles = jobCards
            .Where(j => j.Status == JobCardStatus.Ready || j.Status == JobCardStatus.Invoiced || j.Status == JobCardStatus.Paid || j.Status == JobCardStatus.Delivered)
            .Select(j => j.VehicleId)
            .Distinct()
            .Count();

        // 3. Invoice KPIs (Invoices finalized or created in period)
        var invoicesInPeriod = await _db.Invoices
            .AsNoTracking()
            .Where(i => !i.IsDeleted && i.InvoiceDate >= startUtc && i.InvoiceDate <= endUtc)
            .Select(i => new
            {
                i.Id,
                i.Status,
                i.Subtotal,
                i.Discount,
                i.TaxableAmount,
                i.GstAmount,
                i.TotalAmount,
                i.PaidAmount,
                i.BalanceAmount,
                i.IsGstEnabled
            })
            .ToListAsync(ct);

        var draftCount = invoicesInPeriod.Count(i => i.Status == InvoiceStatus.Draft);
        var generatedCount = invoicesInPeriod.Count(i => i.Status == InvoiceStatus.Generated);
        var partiallyPaidCount = invoicesInPeriod.Count(i => i.Status == InvoiceStatus.PartiallyPaid);
        var paidCount = invoicesInPeriod.Count(i => i.Status == InvoiceStatus.Paid);
        var cancelledCount = invoicesInPeriod.Count(i => i.Status == InvoiceStatus.Cancelled);

        var finalizedInvoices = invoicesInPeriod.Where(i => i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled).ToList();
        var totalInvoicedAmount = finalizedInvoices.Sum(i => i.TotalAmount);
        var totalPaidAmount = finalizedInvoices.Sum(i => i.PaidAmount);
        var totalInvoiceOutstanding = finalizedInvoices.Where(i => i.BalanceAmount > 0).Sum(i => i.BalanceAmount);

        // 4. Sales Summary
        var grossSubtotal = finalizedInvoices.Sum(i => i.Subtotal);
        var totalDiscount = finalizedInvoices.Sum(i => i.Discount);
        var gstAmount = finalizedInvoices.Sum(i => i.GstAmount);
        var netSales = finalizedInvoices.Sum(i => i.TotalAmount);

        // 5. Payment Collection in period
        var paymentsInPeriod = await _db.Payments
            .AsNoTracking()
            .Where(p => !p.IsDeleted && p.PaymentDate >= startUtc && p.PaymentDate < endOfDayExclusive)
            .Select(p => new { p.Id, p.Amount, p.PaymentMethod })
            .ToListAsync(ct);

        var totalPaymentsReceived = paymentsInPeriod.Sum(p => p.Amount);
        var paymentTransactionCount = paymentsInPeriod.Count;

        var allPaymentMethods = Enum.GetValues<PaymentMethod>();
        var paymentBreakdown = allPaymentMethods.Select(m =>
        {
            var matching = paymentsInPeriod.Where(p => p.PaymentMethod == m).ToList();
            return new PaymentMethodBreakdownDto(
                Method: m.ToString(),
                TransactionCount: matching.Count,
                Amount: Math.Round(matching.Sum(p => p.Amount), 2)
            );
        }).ToList();

        // 6. Showroom Summary
        var activeShowroomsCount = await _db.Showrooms.AsNoTracking().CountAsync(s => s.IsActive && !s.IsDeleted, ct);

        var showroomAssignments = await _db.ShowroomStaffAssignments
            .AsNoTracking()
            .Where(a => !a.IsDeleted && a.Date >= showroomStart && a.Date <= showroomEnd)
            .Select(a => new { a.Date, a.VehiclesAttended, a.StaffId })
            .ToListAsync(ct);

        var staffAssignmentsCount = showroomAssignments.Count;
        var vehiclesAttended = showroomAssignments.Sum(a => a.VehiclesAttended);

        var showroomBills = await _db.ShowroomDailyBills
            .AsNoTracking()
            .Include(b => b.Payments)
            .Where(b => !b.IsDeleted && b.Date >= showroomStart && b.Date <= showroomEnd)
            .ToListAsync(ct);

        var totalShowroomBilled = showroomBills.Sum(b => b.Amount);
        var totalShowroomReceived = showroomBills
            .SelectMany(b => b.Payments.Where(p => !p.IsDeleted))
            .Sum(p => p.Amount);
        var totalShowroomOutstanding = Math.Max(0m, totalShowroomBilled - totalShowroomReceived);

        var paidDaysCount = showroomBills.Count(b =>
        {
            var rec = b.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount);
            return b.Amount > 0 && rec >= b.Amount;
        });

        var partiallyPaidDaysCount = showroomBills.Count(b =>
        {
            var rec = b.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount);
            return rec > 0 && rec < b.Amount;
        });

        var unpaidDaysCount = showroomBills.Count(b =>
        {
            var rec = b.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount);
            return b.Amount > 0 && rec == 0;
        });

        // 7. Staff Advances (Current Active Outstanding Scope + Period advances)
        var allAdvances = await _db.StaffAdvances
            .AsNoTracking()
            .Where(a => !a.IsDeleted)
            .Select(a => new { a.Id, a.Amount, a.Status, a.AdvanceDate })
            .ToListAsync(ct);

        var outstandingAdvances = allAdvances.Where(a => a.Status == StaffAdvanceStatus.Outstanding).ToList();
        var settledAdvances = allAdvances.Where(a => a.Status == StaffAdvanceStatus.Settled).ToList();
        var obsoleteAdvances = allAdvances.Where(a => a.Status == StaffAdvanceStatus.Obsolete).ToList();

        var staffAdvanceOutstandingAmount = Math.Round(outstandingAdvances.Sum(a => a.Amount), 2);
        var staffAdvanceSettledAmount = Math.Round(settledAdvances.Sum(a => a.Amount), 2);

        // 8. Outstanding Summary (Separate Financial Concepts)
        var totalOutstandingCombined = Math.Round(totalInvoiceOutstanding + totalShowroomOutstanding + staffAdvanceOutstandingAmount, 2);

        // 9. Recent Activity (Latest 10 activities)
        var recentActivities = new List<RecentActivityItemDto>();

        // Recent finalized invoices
        var recentInvoices = await _db.Invoices
            .AsNoTracking()
            .Include(i => i.Customer)
            .Where(i => !i.IsDeleted && i.Status != InvoiceStatus.Draft)
            .OrderByDescending(i => i.CreatedAt)
            .Take(4)
            .Select(i => new RecentActivityItemDto(
                "Invoice",
                i.InvoiceNumber ?? "Invoice Generated",
                $"Invoice for {i.Customer.Name}",
                i.TotalAmount,
                i.CreatedAt,
                i.Id,
                i.Status.ToString()
            ))
            .ToListAsync(ct);
        recentActivities.AddRange(recentInvoices);

        // Recent payments
        var recentPayments = await _db.Payments
            .AsNoTracking()
            .Include(p => p.Invoice)
                .ThenInclude(inv => inv.Customer)
            .Where(p => !p.IsDeleted)
            .OrderByDescending(p => p.PaymentDate)
            .Take(4)
            .Select(p => new RecentActivityItemDto(
                "Payment",
                $"Payment received ({p.PaymentMethod})",
                $"Received from {p.Invoice.Customer.Name} for {p.Invoice.InvoiceNumber}",
                p.Amount,
                p.PaymentDate,
                p.Id,
                p.PaymentMethod.ToString()
            ))
            .ToListAsync(ct);
        recentActivities.AddRange(recentPayments);

        // Recent job cards
        var recentJobCards = await _db.JobCards
            .AsNoTracking()
            .Include(j => j.Customer)
            .Where(j => !j.IsDeleted)
            .OrderByDescending(j => j.CreatedAt)
            .Take(4)
            .Select(j => new RecentActivityItemDto(
                "JobCard",
                j.JobCardNumber,
                $"Job card for {j.Customer.Name}",
                j.TotalAmount,
                j.CreatedAt,
                j.Id,
                j.Status.ToString()
            ))
            .ToListAsync(ct);
        recentActivities.AddRange(recentJobCards);

        var sortedRecentActivity = recentActivities
            .OrderByDescending(a => a.Timestamp)
            .Take(10)
            .ToList();

        return new DashboardSummaryDto(
            DateRange: new DateRangeDto(startUtc, endUtc),
            JobCardKpis: new JobCardKpisDto(totalJobCards, newJobCards, inProgressJobCards, completedJobCards, cancelledJobCards, invoicedJobCards),
            VehicleActivity: new VehicleActivityDto(completedJobCards, totalServicesCompleted, uniqueVehicles),
            InvoiceKpis: new InvoiceKpisDto(draftCount, generatedCount, partiallyPaidCount, paidCount, cancelledCount, Math.Round(totalInvoicedAmount, 2), Math.Round(totalPaidAmount, 2), Math.Round(totalInvoiceOutstanding, 2)),
            Sales: new DashboardSalesDto(Math.Round(grossSubtotal, 2), Math.Round(totalDiscount, 2), Math.Round(gstAmount, 2), Math.Round(netSales, 2), Math.Round(totalPaymentsReceived, 2), Math.Round(totalInvoiceOutstanding, 2)),
            PaymentCollection: new DashboardPaymentCollectionDto(Math.Round(totalPaymentsReceived, 2), paymentTransactionCount, paymentBreakdown),
            Showroom: new DashboardShowroomDto(activeShowroomsCount, staffAssignmentsCount, vehiclesAttended, Math.Round(totalShowroomBilled, 2), Math.Round(totalShowroomReceived, 2), Math.Round(totalShowroomOutstanding, 2), paidDaysCount, partiallyPaidDaysCount, unpaidDaysCount),
            StaffAdvances: new DashboardStaffAdvanceDto(outstandingAdvances.Count, staffAdvanceOutstandingAmount, settledAdvances.Count, staffAdvanceSettledAmount, obsoleteAdvances.Count),
            Outstanding: new DashboardOutstandingDto(Math.Round(totalInvoiceOutstanding, 2), Math.Round(totalShowroomOutstanding, 2), staffAdvanceOutstandingAmount, totalOutstandingCombined),
            RecentActivity: sortedRecentActivity
        );
    }

    // ── 2. Sales Report ─────────────────────────────────────────────────────
    public async Task<SalesReportResponse> GetSalesReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? customerId = null, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _db.Invoices
            .AsNoTracking()
            .Include(i => i.Customer)
            .Include(i => i.Vehicle)
            .Where(i => !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled);

        if (fromDate.HasValue)
        {
            var from = fromDate.Value.Date;
            query = query.Where(i => i.InvoiceDate >= from);
        }

        if (toDate.HasValue)
        {
            var to = toDate.Value.Date;
            query = query.Where(i => i.InvoiceDate <= to);
        }

        if (customerId.HasValue)
        {
            query = query.Where(i => i.CustomerId == customerId.Value);
        }

        var totalCount = await query.CountAsync(ct);

        // Overall summary across all matching invoices
        var summaryAggregates = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TotalSubtotal = g.Sum(i => i.Subtotal),
                TotalDiscount = g.Sum(i => i.Discount),
                TotalGst = g.Sum(i => i.GstAmount),
                TotalAmount = g.Sum(i => i.TotalAmount),
                TotalPaid = g.Sum(i => i.PaidAmount),
                TotalBalance = g.Sum(i => i.BalanceAmount),
                Count = g.Count()
            })
            .FirstOrDefaultAsync(ct);

        var summary = new SalesReportSummaryDto(
            TotalSubtotal: Math.Round(summaryAggregates?.TotalSubtotal ?? 0m, 2),
            TotalDiscount: Math.Round(summaryAggregates?.TotalDiscount ?? 0m, 2),
            TotalGst: Math.Round(summaryAggregates?.TotalGst ?? 0m, 2),
            TotalAmount: Math.Round(summaryAggregates?.TotalAmount ?? 0m, 2),
            TotalPaid: Math.Round(summaryAggregates?.TotalPaid ?? 0m, 2),
            TotalBalance: Math.Round(summaryAggregates?.TotalBalance ?? 0m, 2),
            InvoiceCount: summaryAggregates?.Count ?? 0
        );

        var items = await query
            .OrderByDescending(i => i.InvoiceDate)
            .ThenByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new SalesReportRowDto(
                i.Id,
                i.InvoiceNumber,
                i.InvoiceDate,
                i.Customer.Name,
                i.Customer.PhoneNumber,
                i.Vehicle.RegistrationNumber,
                Math.Round(i.Subtotal, 2),
                Math.Round(i.Discount, 2),
                Math.Round(i.GstAmount, 2),
                Math.Round(i.TotalAmount, 2),
                Math.Round(i.PaidAmount, 2),
                Math.Round(i.BalanceAmount, 2),
                i.Status
            ))
            .ToListAsync(ct);

        return new SalesReportResponse(items, totalCount, page, pageSize, summary);
    }

    // ── 3. Payment Collection Report ────────────────────────────────────────
    public async Task<PaymentReportResponse> GetPaymentCollectionReportAsync(DateTime? fromDate = null, DateTime? toDate = null, PaymentMethod? paymentMethod = null, Guid? invoiceId = null, bool includeVoided = false, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _db.Payments
            .AsNoTracking()
            .Include(p => p.Invoice)
                .ThenInclude(inv => inv.Customer)
            .AsQueryable();

        if (!includeVoided)
        {
            query = query.Where(p => !p.IsDeleted);
        }

        if (fromDate.HasValue)
        {
            var from = ToUtcDate(fromDate.Value);
            query = query.Where(p => p.PaymentDate >= from);
        }

        if (toDate.HasValue)
        {
            var toExclusive = ToUtcDate(toDate.Value).AddDays(1);
            query = query.Where(p => p.PaymentDate < toExclusive);
        }

        if (paymentMethod.HasValue)
        {
            query = query.Where(p => p.PaymentMethod == paymentMethod.Value);
        }

        if (invoiceId.HasValue)
        {
            query = query.Where(p => p.InvoiceId == invoiceId.Value);
        }

        var totalCount = await query.CountAsync(ct);

        // Summaries: CRITICAL - Voided payments must NEVER contribute to TotalCollected
        var activePayments = query.Where(p => !p.IsDeleted);

        var activeBreakdowns = await activePayments
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Sum(p => p.Amount),
                Count = g.Count(),
                Cash = g.Where(p => p.PaymentMethod == PaymentMethod.Cash).Sum(p => p.Amount),
                Upi = g.Where(p => p.PaymentMethod == PaymentMethod.UPI).Sum(p => p.Amount),
                Card = g.Where(p => p.PaymentMethod == PaymentMethod.Card).Sum(p => p.Amount),
                BankTransfer = g.Where(p => p.PaymentMethod == PaymentMethod.BankTransfer).Sum(p => p.Amount)
            })
            .FirstOrDefaultAsync(ct);

        var voidedQuery = query.Where(p => p.IsDeleted);
        var voidedCount = await voidedQuery.CountAsync(ct);
        var voidedAmount = await voidedQuery.SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;

        var summary = new PaymentReportSummaryDto(
            TotalCollected: Math.Round(activeBreakdowns?.Total ?? 0m, 2),
            TransactionCount: activeBreakdowns?.Count ?? 0,
            CashAmount: Math.Round(activeBreakdowns?.Cash ?? 0m, 2),
            UpiAmount: Math.Round(activeBreakdowns?.Upi ?? 0m, 2),
            CardAmount: Math.Round(activeBreakdowns?.Card ?? 0m, 2),
            BankTransferAmount: Math.Round(activeBreakdowns?.BankTransfer ?? 0m, 2),
            VoidedTransactionCount: voidedCount,
            VoidedAmount: Math.Round(voidedAmount, 2)
        );

        var items = await query
            .OrderByDescending(p => p.PaymentDate)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PaymentReportRowDto(
                p.Id,
                p.InvoiceId,
                p.Invoice.InvoiceNumber,
                p.Invoice.Customer.Name,
                p.PaymentDate,
                p.PaymentMethod.ToString(),
                p.Reference,
                Math.Round(p.Amount, 2),
                p.IsDeleted,
                p.IsDeleted ? p.UpdatedAt : null
            ))
            .ToListAsync(ct);

        return new PaymentReportResponse(items, totalCount, page, pageSize, summary);
    }

    // ── 4. Outstanding Invoices Report ───────────────────────────────────────
    public async Task<OutstandingInvoiceReportResponse> GetOutstandingInvoicesReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? customerId = null, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _db.Invoices
            .AsNoTracking()
            .Include(i => i.Customer)
            .Include(i => i.Vehicle)
            .Where(i => !i.IsDeleted &&
                        i.Status != InvoiceStatus.Draft &&
                        i.Status != InvoiceStatus.Paid &&
                        i.Status != InvoiceStatus.Cancelled &&
                        i.BalanceAmount > 0);

        if (fromDate.HasValue)
        {
            var from = fromDate.Value.Date;
            query = query.Where(i => i.InvoiceDate >= from);
        }

        if (toDate.HasValue)
        {
            var to = toDate.Value.Date;
            query = query.Where(i => i.InvoiceDate <= to);
        }

        if (customerId.HasValue)
        {
            query = query.Where(i => i.CustomerId == customerId.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var summaryAggregates = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TotalOutstanding = g.Sum(i => i.BalanceAmount),
                TotalInvoice = g.Sum(i => i.TotalAmount),
                TotalPaid = g.Sum(i => i.PaidAmount),
                Count = g.Count()
            })
            .FirstOrDefaultAsync(ct);

        var summary = new OutstandingInvoiceSummaryDto(
            TotalOutstandingAmount: Math.Round(summaryAggregates?.TotalOutstanding ?? 0m, 2),
            TotalInvoiceAmount: Math.Round(summaryAggregates?.TotalInvoice ?? 0m, 2),
            TotalPaidAmount: Math.Round(summaryAggregates?.TotalPaid ?? 0m, 2),
            InvoiceCount: summaryAggregates?.Count ?? 0
        );

        var today = DateTime.UtcNow.Date;

        var invoices = await query
            .OrderByDescending(i => i.InvoiceDate)
            .ThenByDescending(i => i.BalanceAmount)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new
            {
                i.Id,
                i.InvoiceNumber,
                i.InvoiceDate,
                CustomerName = i.Customer.Name,
                CustomerPhone = i.Customer.PhoneNumber,
                VehicleRegistration = i.Vehicle.RegistrationNumber,
                i.TotalAmount,
                i.PaidAmount,
                i.BalanceAmount,
                i.Status
            })
            .ToListAsync(ct);

        var items = invoices.Select(i => new OutstandingInvoiceRowDto(
            InvoiceId: i.Id,
            InvoiceNumber: i.InvoiceNumber,
            InvoiceDate: i.InvoiceDate,
            CustomerName: i.CustomerName,
            CustomerPhone: i.CustomerPhone,
            VehicleRegistration: i.VehicleRegistration,
            TotalAmount: Math.Round(i.TotalAmount, 2),
            PaidAmount: Math.Round(i.PaidAmount, 2),
            BalanceAmount: Math.Round(i.BalanceAmount, 2),
            Status: i.Status,
            AgeInDays: Math.Max(0, (today - i.InvoiceDate.Date).Days)
        )).ToList();

        return new OutstandingInvoiceReportResponse(items, totalCount, page, pageSize, summary);
    }

    // ── 5. GST Report ───────────────────────────────────────────────────────
    public async Task<GstReportDto> GetGstReportAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default)
    {
        var query = _db.Invoices
            .AsNoTracking()
            .Include(i => i.Customer)
            .Include(i => i.Vehicle)
            .Where(i => !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled);

        if (fromDate.HasValue)
        {
            var from = fromDate.Value.Date;
            query = query.Where(i => i.InvoiceDate >= from);
        }

        if (toDate.HasValue)
        {
            var to = toDate.Value.Date;
            query = query.Where(i => i.InvoiceDate <= to);
        }

        var invoices = await query
            .OrderByDescending(i => i.InvoiceDate)
            .ThenByDescending(i => i.CreatedAt)
            .Select(i => new GstReportRowDto(
                i.Id,
                i.InvoiceNumber,
                i.InvoiceDate,
                i.Customer.Name,
                i.Vehicle.RegistrationNumber,
                i.IsGstEnabled,
                Math.Round(i.TaxableAmount, 2),
                Math.Round(i.IsGstEnabled ? i.GstAmount : 0m, 2),
                Math.Round(i.TotalAmount, 2)
            ))
            .ToListAsync(ct);

        var invoiceCount = invoices.Count;
        var grossSubtotal = await query.SumAsync(i => (decimal?)i.Subtotal, ct) ?? 0m;
        var totalDiscount = await query.SumAsync(i => (decimal?)i.Discount, ct) ?? 0m;
        var taxableBase = invoices.Sum(i => i.TaxableAmount);
        var totalGst = invoices.Sum(i => i.GstAmount);
        var cgst = Math.Round(totalGst / 2m, 2);
        var sgst = Math.Round(totalGst - cgst, 2);
        var totalAmount = invoices.Sum(i => i.TotalAmount);

        return new GstReportDto(
            InvoiceCount: invoiceCount,
            GrossSubtotal: Math.Round(grossSubtotal, 2),
            TotalDiscount: Math.Round(totalDiscount, 2),
            TaxableBase: Math.Round(taxableBase, 2),
            CgstAmount: cgst,
            SgstAmount: sgst,
            TotalGstAmount: Math.Round(totalGst, 2),
            TotalAmount: Math.Round(totalAmount, 2),
            Invoices: invoices
        );
    }

    // ── 6. Job Card Report ──────────────────────────────────────────────────
    public async Task<JobCardReportResponse> GetJobCardReportAsync(DateTime? fromDate = null, DateTime? toDate = null, JobCardStatus? status = null, Guid? customerId = null, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _db.JobCards
            .AsNoTracking()
            .Include(j => j.Customer)
            .Include(j => j.Vehicle)
            .Where(j => !j.IsDeleted);

        if (fromDate.HasValue)
        {
            var from = ToUtcDate(fromDate.Value);
            query = query.Where(j => j.CreatedAt >= from);
        }

        if (toDate.HasValue)
        {
            var toExclusive = ToUtcDate(toDate.Value).AddDays(1);
            query = query.Where(j => j.CreatedAt < toExclusive);
        }

        if (status.HasValue)
        {
            query = query.Where(j => j.Status == status.Value);
        }

        if (customerId.HasValue)
        {
            query = query.Where(j => j.CustomerId == customerId.Value);
        }

        var totalCount = await query.CountAsync(ct);

        // Status summary calculation
        var statusCounts = await query
            .GroupBy(j => j.Status)
            .Select(g => new { Status = g.Key, Count = g.Count(), Total = g.Sum(j => j.TotalAmount) })
            .ToListAsync(ct);

        var draftCount = statusCounts.FirstOrDefault(s => s.Status == JobCardStatus.Draft)?.Count ?? 0;
        var inProgressCount = statusCounts.Where(s => s.Status == JobCardStatus.InProgress || s.Status == JobCardStatus.QualityCheck).Sum(s => s.Count);
        var completedCount = statusCounts.Where(s => s.Status == JobCardStatus.Ready || s.Status == JobCardStatus.Invoiced || s.Status == JobCardStatus.Paid || s.Status == JobCardStatus.Delivered).Sum(s => s.Count);
        var cancelledCount = statusCounts.FirstOrDefault(s => s.Status == JobCardStatus.Cancelled)?.Count ?? 0;
        var invoicedCount = statusCounts.Where(s => s.Status == JobCardStatus.Invoiced || s.Status == JobCardStatus.Paid).Sum(s => s.Count);
        var totalRevenue = statusCounts.Sum(s => s.Total);

        var summary = new JobCardReportSummaryDto(
            TotalCount: totalCount,
            DraftCount: draftCount,
            InProgressCount: inProgressCount,
            CompletedCount: completedCount,
            CancelledCount: cancelledCount,
            InvoicedCount: invoicedCount,
            TotalRevenue: Math.Round(totalRevenue, 2)
        );

        // Get matching job cards with pagination
        var jobCards = await query
            .OrderByDescending(j => j.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(j => new
            {
                j.Id,
                j.JobCardNumber,
                j.CreatedAt,
                CustomerName = j.Customer.Name,
                CustomerPhone = j.Customer.PhoneNumber,
                VehicleRegistration = j.Vehicle.RegistrationNumber,
                VehicleDetails = $"{j.Vehicle.Make} {j.Vehicle.Model}".Trim(),
                j.Status,
                j.TotalAmount
            })
            .ToListAsync(ct);

        var jcIds = jobCards.Select(j => j.Id).ToList();

        var invoicesByJc = await _db.Invoices
            .AsNoTracking()
            .Where(i => jcIds.Contains(i.JobCardId) && !i.IsDeleted)
            .Select(i => new { i.JobCardId, i.Id, i.InvoiceNumber, i.Status })
            .ToDictionaryAsync(i => i.JobCardId, ct);

        var items = jobCards.Select(j =>
        {
            var inv = invoicesByJc.GetValueOrDefault(j.Id);
            return new JobCardReportRowDto(
                j.Id,
                j.JobCardNumber,
                j.CreatedAt,
                j.CustomerName,
                j.CustomerPhone,
                j.VehicleRegistration,
                j.VehicleDetails,
                j.Status,
                Math.Round(j.TotalAmount, 2),
                inv?.Id,
                inv?.InvoiceNumber,
                inv?.Status
            );
        }).ToList();

        return new JobCardReportResponse(items, totalCount, page, pageSize, summary);
    }

    // ── 7. Showroom Report ──────────────────────────────────────────────────
    public async Task<ShowroomReportResponse> GetShowroomReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? showroomId = null, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var startUtc = fromDate.HasValue ? ToUtcDate(fromDate.Value) : ToUtcDate(DateTime.UtcNow.AddDays(-30));
        var endUtc = toDate.HasValue ? ToUtcDate(toDate.Value) : ToUtcDate(DateTime.UtcNow);

        if (startUtc > endUtc)
        {
            (startUtc, endUtc) = (endUtc, startUtc);
        }

        var showroomsQuery = _db.Showrooms.AsNoTracking().Where(s => !s.IsDeleted);
        if (showroomId.HasValue)
        {
            showroomsQuery = showroomsQuery.Where(s => s.Id == showroomId.Value);
        }

        var showrooms = await showroomsQuery.OrderBy(s => s.Name).ToListAsync(ct);
        var showroomIds = showrooms.Select(s => s.Id).ToList();

        // Staff Assignments
        var assignments = await _db.ShowroomStaffAssignments
            .AsNoTracking()
            .Where(a => !a.IsDeleted && showroomIds.Contains(a.ShowroomId) && a.Date >= startUtc && a.Date <= endUtc)
            .ToListAsync(ct);

        // Daily Bills with payments
        var bills = await _db.ShowroomDailyBills
            .AsNoTracking()
            .Include(b => b.Payments)
            .Where(b => !b.IsDeleted && showroomIds.Contains(b.ShowroomId) && b.Date >= startUtc && b.Date <= endUtc)
            .ToListAsync(ct);

        // Attendance confirmations
        var attendances = await _db.ShowroomDailyAttendances
            .AsNoTracking()
            .Where(a => !a.IsDeleted && showroomIds.Contains(a.ShowroomId) && a.Date >= startUtc && a.Date <= endUtc)
            .ToListAsync(ct);

        // Aggregate per Showroom + Date
        var assignmentsGroup = assignments
            .GroupBy(a => (a.ShowroomId, a.Date))
            .ToDictionary(g => g.Key, g => new { StaffCount = g.Count(), Vehicles = g.Sum(x => x.VehiclesAttended) });

        var billsMap = bills.ToDictionary(b => (b.ShowroomId, b.Date), b => b);
        var attendancesMap = attendances.ToDictionary(a => (a.ShowroomId, a.Date), a => a);

        var distinctKeys = assignments.Select(a => (a.ShowroomId, a.Date))
            .Union(bills.Select(b => (b.ShowroomId, b.Date)))
            .Union(attendances.Select(a => (a.ShowroomId, a.Date)))
            .Distinct()
            .OrderByDescending(k => k.Date)
            .ToList();

        var allRows = new List<ShowroomReportRowDto>();
        var showroomDict = showrooms.ToDictionary(s => s.Id, s => s.Name);

        foreach (var (srId, date) in distinctKeys)
        {
            var srName = showroomDict.GetValueOrDefault(srId, "Unknown Showroom");
            var assign = assignmentsGroup.GetValueOrDefault((srId, date));
            var bill = billsMap.GetValueOrDefault((srId, date));
            var att = attendancesMap.GetValueOrDefault((srId, date));

            var staffCount = assign?.StaffCount ?? 0;
            var vehicles = assign?.Vehicles ?? 0;
            var billed = bill?.Amount ?? 0m;
            var received = bill?.Payments.Where(p => !p.IsDeleted).Sum(p => p.Amount) ?? 0m;
            var balance = Math.Max(0m, billed - received);

            string status;
            if (received == 0m) status = "Unpaid";
            else if (received < billed) status = "PartiallyPaid";
            else status = "Paid";

            var isConfirmed = att?.IsAttendanceConfirmed ?? false;
            var confirmedAt = att?.AttendanceConfirmedAt;

            allRows.Add(new ShowroomReportRowDto(
                srId,
                srName,
                date,
                staffCount,
                vehicles,
                Math.Round(billed, 2),
                Math.Round(received, 2),
                Math.Round(balance, 2),
                status,
                isConfirmed,
                confirmedAt
            ));
        }

        var totalBilled = allRows.Sum(r => r.BilledAmount);
        var totalReceived = allRows.Sum(r => r.ReceivedAmount);
        var totalOutstanding = Math.Max(0m, totalBilled - totalReceived);
        var totalVehicles = allRows.Sum(r => r.VehiclesAttended);
        var totalAssignments = allRows.Sum(r => r.StaffCount);
        var paidDays = allRows.Count(r => r.BilledAmount > 0 && r.PaymentStatus == "Paid");
        var partialDays = allRows.Count(r => r.PaymentStatus == "PartiallyPaid");
        var unpaidDays = allRows.Count(r => r.BilledAmount > 0 && r.PaymentStatus == "Unpaid");

        var summary = new ShowroomReportSummaryDto(
            TotalBilled: Math.Round(totalBilled, 2),
            TotalReceived: Math.Round(totalReceived, 2),
            TotalOutstanding: Math.Round(totalOutstanding, 2),
            TotalVehiclesAttended: totalVehicles,
            TotalAssignments: totalAssignments,
            PaidDaysCount: paidDays,
            PartiallyPaidDaysCount: partialDays,
            UnpaidDaysCount: unpaidDays
        );

        var totalCount = allRows.Count;
        var pagedItems = allRows
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new ShowroomReportResponse(pagedItems, totalCount, page, pageSize, summary);
    }

    // ── 8. Staff Productivity Report ────────────────────────────────────────
    public async Task<StaffProductivityReportResponse> GetStaffProductivityReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? staffId = null, Guid? showroomId = null, CancellationToken ct = default)
    {
        var startUtc = fromDate.HasValue ? ToUtcDate(fromDate.Value) : ToUtcDate(DateTime.UtcNow.AddDays(-30));
        var endUtc = toDate.HasValue ? ToUtcDate(toDate.Value) : ToUtcDate(DateTime.UtcNow);

        if (startUtc > endUtc)
        {
            (startUtc, endUtc) = (endUtc, startUtc);
        }

        var query = _db.ShowroomStaffAssignments
            .AsNoTracking()
            .Include(a => a.Staff)
            .Where(a => !a.IsDeleted && a.Date >= startUtc && a.Date <= endUtc);

        if (staffId.HasValue)
        {
            query = query.Where(a => a.StaffId == staffId.Value);
        }

        if (showroomId.HasValue)
        {
            query = query.Where(a => a.ShowroomId == showroomId.Value);
        }

        var assignments = await query.ToListAsync(ct);

        var staffGroups = assignments
            .GroupBy(a => a.StaffId)
            .Select(g =>
            {
                var first = g.First();
                var totalVehicles = g.Sum(a => a.VehiclesAttended);
                var daysAssigned = g.Select(a => a.Date).Distinct().Count();
                var avg = daysAssigned > 0 ? Math.Round((decimal)totalVehicles / daysAssigned, 1) : 0m;

                return new StaffProductivityRowDto(
                    g.Key,
                    first.Staff?.Name ?? "Unknown Staff",
                    first.Staff?.PhoneNumber ?? string.Empty,
                    first.Staff?.Role,
                    daysAssigned,
                    totalVehicles,
                    avg
                );
            })
            .OrderByDescending(p => p.TotalVehiclesAttended)
            .ToList();

        var totalStaff = staffGroups.Count;
        var totalDaysAssigned = staffGroups.Sum(p => p.DaysAssigned);
        var totalVehiclesAttended = staffGroups.Sum(p => p.TotalVehiclesAttended);
        var overallDailyAvg = totalDaysAssigned > 0 ? Math.Round((decimal)totalVehiclesAttended / totalDaysAssigned, 1) : 0m;

        return new StaffProductivityReportResponse(
            Items: staffGroups,
            TotalStaff: totalStaff,
            TotalDaysAssigned: totalDaysAssigned,
            TotalVehiclesAttended: totalVehiclesAttended,
            OverallDailyAverage: overallDailyAvg
        );
    }

    // ── 9. Staff Advances Report ────────────────────────────────────────────
    public async Task<StaffAdvanceReportResponse> GetStaffAdvancesReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? staffId = null, StaffAdvanceStatus? status = null, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var baseQuery = _db.StaffAdvances
            .AsNoTracking()
            .Include(a => a.Staff)
            .Include(a => a.SettledByUser)
            .Include(a => a.ObsoletedByUser)
            .Where(a => !a.IsDeleted);

        if (fromDate.HasValue)
        {
            var from = ToUtcDate(fromDate.Value);
            baseQuery = baseQuery.Where(a => a.AdvanceDate >= from);
        }

        if (toDate.HasValue)
        {
            var to = ToUtcDate(toDate.Value);
            baseQuery = baseQuery.Where(a => a.AdvanceDate <= to);
        }

        if (staffId.HasValue)
        {
            baseQuery = baseQuery.Where(a => a.StaffId == staffId.Value);
        }

        // Summary calculations
        var allMatching = await baseQuery
            .Select(a => new { a.Amount, a.Status })
            .ToListAsync(ct);

        var outstandingList = allMatching.Where(a => a.Status == StaffAdvanceStatus.Outstanding).ToList();
        var settledList = allMatching.Where(a => a.Status == StaffAdvanceStatus.Settled).ToList();
        var obsoleteList = allMatching.Where(a => a.Status == StaffAdvanceStatus.Obsolete).ToList();

        var summary = new StaffAdvanceReportSummaryDto(
            OutstandingAmount: Math.Round(outstandingList.Sum(a => a.Amount), 2),
            SettledAmount: Math.Round(settledList.Sum(a => a.Amount), 2),
            ObsoleteAmount: Math.Round(obsoleteList.Sum(a => a.Amount), 2),
            OutstandingCount: outstandingList.Count,
            SettledCount: settledList.Count,
            ObsoleteCount: obsoleteList.Count
        );

        // Filter for rows
        var listQuery = baseQuery;
        if (status.HasValue)
        {
            listQuery = listQuery.Where(a => a.Status == status.Value);
        }

        var totalCount = await listQuery.CountAsync(ct);

        var items = await listQuery
            .OrderByDescending(a => a.AdvanceDate)
            .ThenByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new StaffAdvanceReportRowDto(
                a.Id,
                a.StaffId,
                a.Staff.Name ?? a.StaffName ?? "Unknown Staff",
                a.Staff.PhoneNumber,
                a.Staff.Role ?? a.StaffRole,
                a.AdvanceDate,
                Math.Round(a.Amount, 2),
                !string.IsNullOrWhiteSpace(a.Reason) ? a.Reason : (!string.IsNullOrWhiteSpace(a.Description) ? a.Description : "Staff Advance"),
                a.Notes,
                a.Status.ToString(),
                a.SettledAt,
                a.SettledByUser != null ? a.SettledByUser.FullName : null,
                a.ObsoletedAt,
                a.ObsoletedByUser != null ? a.ObsoletedByUser.FullName : null,
                a.ObsoleteReason
            ))
            .ToListAsync(ct);

        return new StaffAdvanceReportResponse(items, totalCount, page, pageSize, summary);
    }
}
