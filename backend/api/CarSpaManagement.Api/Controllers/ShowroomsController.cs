using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ShowroomsController : ControllerBase
{
    private readonly IShowroomService _service;
    private readonly AppDbContext _db;

    public ShowroomsController(IShowroomService service, AppDbContext db)
    {
        _service = service;
        _db = db;
    }

    [HttpGet]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? search = null, [FromQuery] bool? isActive = null, CancellationToken ct = default)
    {
        var showrooms = await _service.GetAllAsync(search, isActive, ct);
        return Ok(showrooms);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var showroom = await _service.GetByIdAsync(id, ct);
        if (showroom == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(showroom);
    }

    [HttpPost]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> Create([FromBody] CreateShowroomRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Showroom name is required." });

        if (string.IsNullOrWhiteSpace(request.Address))
            return BadRequest(new { message = "Showroom address is required." });

        try
        {
            var created = await _service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateShowroomRequest request, CancellationToken ct)
    {
        try
        {
            var updated = await _service.UpdateAsync(id, request, ct);
            if (updated == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/toggle-active")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> ToggleActive(Guid id, CancellationToken ct)
    {
        var updated = await _service.ToggleActiveAsync(id, ct);
        if (!updated) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return NoContent();
    }

    private async Task<(Guid UserId, bool IsOwner)> GetCallerInfoAsync(CancellationToken ct)
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return (Guid.Empty, false);
        }

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null || !user.IsActive)
        {
            return (userId, false);
        }

        var isOwner = user.Role == UserRole.Owner;
        return (userId, isOwner);
    }

    // ── Daily Staff Assignment Endpoints ─────────────────────────────────────

    [HttpGet("{id:guid}/daily-staff")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetDailyStaff(Guid id, [FromQuery] string? date, CancellationToken ct)
    {
        var targetDate = ShowroomDateHelper.ParseDateOrDefault(date);
        var response = await _service.GetDailyStaffAsync(id, targetDate, ct);
        if (response == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(response);
    }

    [HttpPost("{id:guid}/daily-staff")]
    [RequirePermission("showroom.assign_staff")]
    public async Task<IActionResult> AssignDailyStaff(Guid id, [FromBody] CreateDailyStaffAssignmentRequest request, CancellationToken ct)
    {
        try
        {
            var (_, isOwner) = await GetCallerInfoAsync(ct);
            var assignment = await _service.AssignStaffAsync(id, request, isOwner, ct);
            return Ok(assignment);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (CarSpaManagement.Api.Application.Common.ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (CarSpaManagement.Api.Application.Common.ForbiddenException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (CarSpaManagement.Api.Application.Common.ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/daily-staff/{date}/confirm")]
    [HttpPost("{id:guid}/daily-staff/confirm")]
    [RequirePermission("showroom.confirm_attendance")]
    public async Task<IActionResult> ConfirmAttendance(Guid id, [FromRoute] string? date, [FromQuery(Name = "date")] string? queryDate, CancellationToken ct)
    {
        try
        {
            var targetDate = ShowroomDateHelper.ParseDateOrDefault(date ?? queryDate);
            var (userId, _) = await GetCallerInfoAsync(ct);
            var res = await _service.ConfirmAttendanceAsync(id, targetDate, userId, ct);
            return Ok(res);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/daily-staff/{date}/unlock")]
    [HttpPost("{id:guid}/daily-staff/unlock")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> UnlockAttendance(Guid id, [FromRoute] string? date, [FromQuery(Name = "date")] string? queryDate, CancellationToken ct)
    {
        var (userId, isOwner) = await GetCallerInfoAsync(ct);
        if (!isOwner)
        {
            return StatusCode(403, new { message = "Only the Owner can unlock and correct attendance." });
        }

        try
        {
            var targetDate = ShowroomDateHelper.ParseDateOrDefault(date ?? queryDate);
            var res = await _service.UnlockAttendanceAsync(id, targetDate, userId, isOwner, ct);
            return Ok(res);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ── Daily Showroom Billing & Payment Endpoints ──────────────────────────

    [HttpGet("{id:guid}/daily-bill")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetDailyBill(Guid id, [FromQuery] string? date, CancellationToken ct)
    {
        var targetDate = ShowroomDateHelper.ParseDateOrDefault(date);
        var bill = await _service.GetDailyBillAsync(id, targetDate, ct);
        if (bill == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(bill);
    }

    [HttpPost("{id:guid}/daily-bill")]
    [RequirePermission("showroom.manage_billing")]
    public async Task<IActionResult> SetDailyBill(Guid id, [FromQuery] string? date, [FromBody] SetShowroomDailyBillRequest request, CancellationToken ct)
    {
        try
        {
            var targetDate = ShowroomDateHelper.ParseDateOrDefault(date);
            var bill = await _service.SetDailyBillAsync(id, targetDate, request, ct);
            return Ok(bill);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/daily-bill/payments")]
    [RequirePermission("showroom.record_payment")]
    public async Task<IActionResult> RecordDailyPayment(Guid id, [FromQuery] string? date, [FromBody] RecordShowroomPaymentRequest request, CancellationToken ct)
    {
        try
        {
            var targetDate = ShowroomDateHelper.ParseDateOrDefault(date ?? request.PaymentDate?.ToString("yyyy-MM-dd"));
            var bill = await _service.RecordPaymentAsync(id, targetDate, request, ct);
            return Ok(bill);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── History & Financial Summary Endpoints ───────────────────────────────

    [HttpGet("{id:guid}/summary")]
    [RequirePermission("showroom.view_history")]
    public async Task<IActionResult> GetSummary(Guid id, [FromQuery] string? fromDate, [FromQuery] string? toDate, CancellationToken ct)
    {
        var start = ShowroomDateHelper.ParseDateOrNull(fromDate) ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = ShowroomDateHelper.ParseDateOrNull(toDate) ?? start.AddMonths(1).AddDays(-1);
        var summary = await _service.GetShowroomSummaryAsync(id, start, end, ct);
        if (summary == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(summary);
    }

    [HttpGet("outstanding")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetOutstanding([FromQuery] string? fromDate, [FromQuery] string? toDate, CancellationToken ct)
    {
        var start = ShowroomDateHelper.ParseDateOrNull(fromDate);
        var end = ShowroomDateHelper.ParseDateOrNull(toDate);
        var list = await _service.GetOutstandingOverviewAsync(start, end, ct);
        return Ok(list);
    }

    // ── Staff Swap Traceability Endpoints ────────────────────────────────────

    [HttpPost("swap-staff")]
    [HttpPost("{id:guid}/swap-staff")]
    [RequirePermission("showroom.assign_staff")]
    public async Task<IActionResult> SwapStaff([FromBody] CreateStaffSwapRequest request, CancellationToken ct)
    {
        try
        {
            var (userId, isOwner) = await GetCallerInfoAsync(ct);
            var result = await _service.SwapStaffAsync(request, userId, isOwner, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (CarSpaManagement.Api.Application.Common.ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (CarSpaManagement.Api.Application.Common.ForbiddenException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    [HttpGet("swaps")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetSwaps([FromQuery] Guid? showroomId, [FromQuery] Guid? staffId, [FromQuery] string? date, CancellationToken ct)
    {
        var targetDate = ShowroomDateHelper.ParseDateOrNull(date);
        var result = await _service.GetSwapHistoryAsync(showroomId, staffId, targetDate, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/swap-history")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetShowroomSwapHistory(Guid id, [FromQuery] string? date, CancellationToken ct)
    {
        var targetDate = ShowroomDateHelper.ParseDateOrNull(date);
        var result = await _service.GetSwapHistoryAsync(id, null, targetDate, ct);
        return Ok(result);
    }

    [HttpGet("swaps/{swapId}")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetSwapById(string swapId, CancellationToken ct)
    {
        var result = await _service.GetSwapByIdAsync(swapId, ct);
        if (result == null) return NotFound(new { message = $"Staff swap with ID '{swapId}' was not found." });
        return Ok(result);
    }

    [HttpPost("swaps/{swapId}/reverse")]
    [RequirePermission("showroom.assign_staff")]
    public async Task<IActionResult> ReverseSwap(string swapId, [FromBody] ReverseStaffSwapRequest? request, CancellationToken ct)
    {
        try
        {
            var (userId, isOwner) = await GetCallerInfoAsync(ct);
            var result = await _service.ReverseSwapAsync(swapId, request, userId, isOwner, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (CarSpaManagement.Api.Application.Common.ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (CarSpaManagement.Api.Application.Common.ForbiddenException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }
}
