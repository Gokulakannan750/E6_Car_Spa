using System.Globalization;
using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.StaffSalary;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/staff-salary")]
[Authorize]
public class StaffSalaryController : ControllerBase
{
    private readonly IStaffSalaryService _service;

    public StaffSalaryController(IStaffSalaryService service)
    {
        _service = service;
    }

    private Guid GetUserId()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        Guid.TryParse(userIdStr, out var userId);
        return userId;
    }

    [HttpGet]
    [RequirePermission("staff_salary.view")]
    public async Task<IActionResult> GetRoster(
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
            var response = await _service.GetSalaryRosterAsync(from, to, staffId, status, search, ct);
            return Ok(response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("preview")]
    [RequirePermission("staff_salary.view")]
    public async Task<IActionResult> GetPreview(
        [FromQuery] Guid staffId,
        [FromQuery] string fromDate,
        [FromQuery] string toDate,
        [FromQuery] decimal enteredSalary,
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

        if (enteredSalary < 0)
        {
            return BadRequest(new { message = "Entered salary cannot be negative." });
        }

        try
        {
            var preview = await _service.GetSalaryPreviewAsync(staffId, from, to, enteredSalary, ct);
            return Ok(preview);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("enter")]
    [RequirePermission("staff_salary.manage")]
    public async Task<IActionResult> EnterSalary(
        [FromBody] SaveEnteredSalaryRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var userId = GetUserId();
        try
        {
            var result = await _service.SaveEnteredSalaryAsync(request, userId, ct);
            return Ok(result);
        }
        catch (ConflictException ex)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("settle")]
    [RequirePermission("staff_salary.settle")]
    public async Task<IActionResult> SettleSalary(
        [FromBody] SettleStaffSalaryRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var userId = GetUserId();
        try
        {
            var result = await _service.SettleSalaryAsync(request, userId, ct);
            return Ok(result);
        }
        catch (ConflictException ex)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("settlements/{staffId:guid}")]
    [RequirePermission("staff_salary.view")]
    public async Task<IActionResult> GetSettlementHistory(Guid staffId, CancellationToken ct = default)
    {
        try
        {
            var history = await _service.GetSettlementHistoryAsync(staffId, ct);
            return Ok(history);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
