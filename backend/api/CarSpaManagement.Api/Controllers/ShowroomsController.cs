using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ShowroomsController : ControllerBase
{
    private readonly IShowroomService _service;

    public ShowroomsController(IShowroomService service)
    {
        _service = service;
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

        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateShowroomRequest request, CancellationToken ct)
    {
        var updated = await _service.UpdateAsync(id, request, ct);
        if (updated == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeleteAsync(id, ct);
        if (!deleted) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return NoContent();
    }

    [HttpPatch("{id:guid}/toggle-active")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> ToggleActive(Guid id, CancellationToken ct)
    {
        var updated = await _service.ToggleActiveAsync(id, ct);
        if (!updated) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return NoContent();
    }

    private (Guid UserId, bool IsOwner) GetCallerInfo()
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        Guid.TryParse(userIdStr, out var userId);

        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
            ?? User.FindFirst("role")?.Value;
        var isOwnerClaim = User.FindFirst("isOwner")?.Value;

        var isOwner = string.Equals(role, "Owner", StringComparison.OrdinalIgnoreCase)
            || string.Equals(isOwnerClaim, "true", StringComparison.OrdinalIgnoreCase);

        return (userId, isOwner);
    }

    // ── Daily Staff Assignment Endpoints ─────────────────────────────────────

    [HttpGet("{id:guid}/daily-staff")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetDailyStaff(Guid id, [FromQuery] DateTime? date, CancellationToken ct)
    {
        var targetDate = date?.Date ?? DateTime.UtcNow.Date;
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
            var (_, isOwner) = GetCallerInfo();
            var assignment = await _service.AssignStaffAsync(id, request, isOwner, ct);
            return Ok(assignment);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
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

    [HttpPost("{id:guid}/daily-staff/{date:datetime}/confirm")]
    [HttpPost("{id:guid}/daily-staff/confirm")]
    [RequirePermission("showroom.confirm_attendance")]
    public async Task<IActionResult> ConfirmAttendance(Guid id, [FromRoute] DateTime? date, [FromQuery(Name = "date")] DateTime? queryDate, CancellationToken ct)
    {
        try
        {
            var targetDate = date ?? queryDate ?? DateTime.UtcNow.Date;
            var (userId, _) = GetCallerInfo();
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

    [HttpPost("{id:guid}/daily-staff/{date:datetime}/unlock")]
    [HttpPost("{id:guid}/daily-staff/unlock")]
    public async Task<IActionResult> UnlockAttendance(Guid id, [FromRoute] DateTime? date, [FromQuery(Name = "date")] DateTime? queryDate, CancellationToken ct)
    {
        var (userId, isOwner) = GetCallerInfo();
        if (!isOwner)
        {
            return StatusCode(403, new { message = "Only the Owner can unlock and correct attendance." });
        }

        try
        {
            var targetDate = date ?? queryDate ?? DateTime.UtcNow.Date;
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
    public async Task<IActionResult> GetDailyBill(Guid id, [FromQuery] DateTime? date, CancellationToken ct)
    {
        var targetDate = date?.Date ?? DateTime.UtcNow.Date;
        var bill = await _service.GetDailyBillAsync(id, targetDate, ct);
        if (bill == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(bill);
    }

    [HttpPost("{id:guid}/daily-bill")]
    [RequirePermission("showroom.manage_billing")]
    public async Task<IActionResult> SetDailyBill(Guid id, [FromQuery] DateTime? date, [FromBody] SetShowroomDailyBillRequest request, CancellationToken ct)
    {
        try
        {
            var targetDate = date?.Date ?? DateTime.UtcNow.Date;
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
    public async Task<IActionResult> RecordDailyPayment(Guid id, [FromQuery] DateTime? date, [FromBody] RecordShowroomPaymentRequest request, CancellationToken ct)
    {
        try
        {
            var targetDate = date?.Date ?? request.PaymentDate?.Date ?? DateTime.UtcNow.Date;
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
    public async Task<IActionResult> GetSummary(Guid id, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var start = fromDate?.Date ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var end = toDate?.Date ?? start.AddMonths(1).AddDays(-1);
        var summary = await _service.GetShowroomSummaryAsync(id, start, end, ct);
        if (summary == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(summary);
    }

    [HttpGet("outstanding")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetOutstanding([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var list = await _service.GetOutstandingOverviewAsync(fromDate, toDate, ct);
        return Ok(list);
    }
}
