using System.Globalization;
using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.StaffAttendance;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/staff-attendance")]
[Authorize]
public class StaffAttendanceController : ControllerBase
{
    private readonly IStaffAttendanceService _service;
    private readonly AppDbContext _db;

    public StaffAttendanceController(IStaffAttendanceService service, AppDbContext db)
    {
        _service = service;
        _db = db;
    }

    private async Task<(Guid UserId, bool IsOwner)> GetCallerInfoAsync(CancellationToken ct)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
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

    [HttpGet]
    [RequirePermission("staff_attendance.view")]
    public async Task<IActionResult> GetDaily([FromQuery] string? date, CancellationToken ct)
    {
        DateTime parsedDate = DateTime.UtcNow.Date;
        if (!string.IsNullOrWhiteSpace(date))
        {
            if (!DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out parsedDate))
            {
                return BadRequest(new { message = "Invalid date format. Expected YYYY-MM-DD." });
            }
        }

        var response = await _service.GetDailyAttendanceAsync(parsedDate, ct);
        return Ok(response);
    }

    [HttpGet("range")]
    [RequirePermission("staff_attendance.view")]
    public async Task<IActionResult> GetRange(
        [FromQuery] string fromDate,
        [FromQuery] string toDate,
        [FromQuery] Guid? staffId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(fromDate) || string.IsNullOrWhiteSpace(toDate))
        {
            return BadRequest(new { message = "Both fromDate and toDate are required in format YYYY-MM-DD." });
        }

        if (!DateTime.TryParseExact(fromDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var from))
        {
            return BadRequest(new { message = "Invalid fromDate format. Expected YYYY-MM-DD." });
        }

        if (!DateTime.TryParseExact(toDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var to))
        {
            return BadRequest(new { message = "Invalid toDate format. Expected YYYY-MM-DD." });
        }

        if (to < from)
        {
            return BadRequest(new { message = "To Date cannot be earlier than From Date." });
        }

        try
        {
            var response = await _service.GetDateRangeAttendanceAsync(from, to, staffId, status, search, ct);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("monthly-report")]
    [RequirePermission("staff_attendance.view")]
    public async Task<IActionResult> GetMonthlyReport(
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] Guid? staffId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (year < 2000 || year > 2100)
        {
            return BadRequest(new { message = "Invalid year. Expected between 2000 and 2100." });
        }

        if (month < 1 || month > 12)
        {
            return BadRequest(new { message = "Invalid month. Expected between 1 and 12." });
        }

        try
        {
            var response = await _service.GetMonthlyAttendanceReportAsync(year, month, staffId, status, search, ct);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost]
    [RequirePermission("staff_attendance.manage")]
    public async Task<IActionResult> Upsert([FromBody] UpsertStaffAttendanceRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var (userId, isOwner) = await GetCallerInfoAsync(ct);
        try
        {
            var dto = await _service.UpsertAttendanceAsync(request, userId, isOwner, ct);
            return Ok(dto);
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("staff_attendance.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertStaffAttendanceRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var (userId, isOwner) = await GetCallerInfoAsync(ct);
        try
        {
            var dto = await _service.UpsertAttendanceAsync(request, userId, isOwner, ct);
            return Ok(dto);
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("staff_attendance.manage")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var (userId, isOwner) = await GetCallerInfoAsync(ct);
        try
        {
            var deleted = await _service.DeleteAttendanceAsync(id, userId, isOwner, ct);
            if (!deleted) return NotFound(new { message = $"Attendance record with ID '{id}' was not found." });
            return NoContent();
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("confirm")]
    [RequirePermission("staff_attendance.confirm")]
    public async Task<IActionResult> ConfirmAttendance([FromQuery] string? date, CancellationToken ct)
    {
        DateTime parsedDate = DateTime.UtcNow.Date;
        if (!string.IsNullOrWhiteSpace(date))
        {
            if (!DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out parsedDate))
            {
                return BadRequest(new { message = "Invalid date format. Expected YYYY-MM-DD." });
            }
        }

        try
        {
            var (userId, _) = await GetCallerInfoAsync(ct);
            var res = await _service.ConfirmAttendanceAsync(parsedDate, userId, ct);
            return Ok(res);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("unlock")]
    [Authorize]
    public async Task<IActionResult> UnlockAttendance([FromQuery] string? date, CancellationToken ct)
    {
        var (userId, isOwner) = await GetCallerInfoAsync(ct);
        if (!isOwner)
        {
            return StatusCode(403, new { message = "Only the Owner can unlock and correct attendance." });
        }

        DateTime parsedDate = DateTime.UtcNow.Date;
        if (!string.IsNullOrWhiteSpace(date))
        {
            if (!DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out parsedDate))
            {
                return BadRequest(new { message = "Invalid date format. Expected YYYY-MM-DD." });
            }
        }

        var res = await _service.UnlockAttendanceAsync(parsedDate, userId, isOwner, ct);
        return Ok(res);
    }
}
