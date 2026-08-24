using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    /// <summary>
    /// Aggregated Dashboard KPIs, vehicle activity, sales, payments, showroom, staff advances, and recent activity.
    /// </summary>
    [HttpGet("dashboard")]
    [RequirePermission("reports.view")]
    public async Task<IActionResult> GetDashboardSummary(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetDashboardSummaryAsync(fromDate, toDate, ct);
        return Ok(result);
    }

    /// <summary>
    /// Finalized sales revenue report with subtotal, discount, GST, and collection breakdowns.
    /// </summary>
    [HttpGet("sales")]
    [RequirePermission("reports.sales")]
    public async Task<IActionResult> GetSalesReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetSalesReportAsync(fromDate, toDate, customerId, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Payment collection report with method breakdown. Voided payments excluded by default.
    /// </summary>
    [HttpGet("payments")]
    [RequirePermission("reports.payments")]
    public async Task<IActionResult> GetPaymentCollectionReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] PaymentMethod? paymentMethod = null,
        [FromQuery] Guid? invoiceId = null,
        [FromQuery] bool includeVoided = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetPaymentCollectionReportAsync(fromDate, toDate, paymentMethod, invoiceId, includeVoided, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Outstanding invoices report with balance amount and ageing in days.
    /// </summary>
    [HttpGet("invoices/outstanding")]
    [RequirePermission("reports.invoices")]
    public async Task<IActionResult> GetOutstandingInvoicesReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetOutstandingInvoicesReportAsync(fromDate, toDate, customerId, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Tax and GST summary report detailing taxable base, CGST, SGST, and total GST.
    /// </summary>
    [HttpGet("gst")]
    [RequirePermission("reports.gst")]
    public async Task<IActionResult> GetGstReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetGstReportAsync(fromDate, toDate, ct);
        return Ok(result);
    }

    /// <summary>
    /// Job card operational report with status, customer, vehicle, and converted invoice details.
    /// </summary>
    [HttpGet("job-cards")]
    [RequirePermission("reports.job_cards")]
    public async Task<IActionResult> GetJobCardReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] JobCardStatus? status = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetJobCardReportAsync(fromDate, toDate, status, customerId, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Showroom daily report combining billing, payments, staff count, vehicle attendance, and status.
    /// </summary>
    [HttpGet("showrooms")]
    [RequirePermission("reports.showrooms")]
    public async Task<IActionResult> GetShowroomReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? showroomId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetShowroomReportAsync(fromDate, toDate, showroomId, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Staff productivity report detailing days assigned, vehicles attended, and daily averages.
    /// </summary>
    [HttpGet("staff-productivity")]
    [RequirePermission("reports.staff_productivity")]
    public async Task<IActionResult> GetStaffProductivityReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? staffId = null,
        [FromQuery] Guid? showroomId = null,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetStaffProductivityReportAsync(fromDate, toDate, staffId, showroomId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Staff advances report with status, recovery history, and obsolete exclusion.
    /// </summary>
    [HttpGet("staff-advances")]
    [RequirePermission("reports.staff_advances")]
    public async Task<IActionResult> GetStaffAdvancesReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? staffId = null,
        [FromQuery] StaffAdvanceStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _reportService.GetStaffAdvancesReportAsync(fromDate, toDate, staffId, status, page, pageSize, ct);
        return Ok(result);
    }
}
