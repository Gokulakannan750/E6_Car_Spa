using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/showrooms/{showroomId:guid}")]
[Authorize]
public class ShowroomOperationsController : ControllerBase
{
    private readonly IShowroomOperationsService _service;

    public ShowroomOperationsController(IShowroomOperationsService service)
    {
        _service = service;
    }

    // ── Staff Work Sessions ─────────────────────────────────────────────────

    [HttpGet("work-sessions")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetWorkSessions(
        Guid showroomId,
        [FromQuery] DateTime? date = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? staffId = null,
        CancellationToken ct = default)
    {
        try
        {
            var sessions = await _service.GetWorkSessionsAsync(showroomId, date, fromDate, toDate, staffId, ct);
            return Ok(sessions);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("work-sessions/{sessionId:guid}")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetWorkSessionById(Guid showroomId, Guid sessionId, CancellationToken ct = default)
    {
        var session = await _service.GetWorkSessionByIdAsync(showroomId, sessionId, ct);
        if (session == null)
        {
            return NotFound(new { message = $"Work session with ID '{sessionId}' was not found for this showroom." });
        }
        return Ok(session);
    }

    [HttpPost("work-sessions")]
    [RequirePermission("showroom.manage_transfers")]
    public async Task<IActionResult> CreateWorkSession(
        Guid showroomId,
        [FromBody] CreateShowroomStaffWorkSessionRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var created = await _service.CreateWorkSessionAsync(showroomId, request, ct);
            return CreatedAtAction(nameof(GetWorkSessionById), new { showroomId, sessionId = created.Id }, created);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("work-sessions/{sessionId:guid}")]
    [RequirePermission("showroom.manage_transfers")]
    public async Task<IActionResult> UpdateWorkSession(
        Guid showroomId,
        Guid sessionId,
        [FromBody] UpdateShowroomStaffWorkSessionRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var updated = await _service.UpdateWorkSessionAsync(showroomId, sessionId, request, ct);
            if (updated == null)
            {
                return NotFound(new { message = $"Work session with ID '{sessionId}' was not found for this showroom." });
            }
            return Ok(updated);
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("work-sessions/{sessionId:guid}/close")]
    [RequirePermission("showroom.manage_transfers")]
    public async Task<IActionResult> CloseWorkSession(
        Guid showroomId,
        Guid sessionId,
        [FromBody] CloseShowroomStaffWorkSessionRequest? request = null,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var closed = await _service.CloseWorkSessionAsync(showroomId, sessionId, request, ct);
            if (closed == null)
            {
                return NotFound(new { message = $"Work session with ID '{sessionId}' was not found for this showroom." });
            }
            return Ok(closed);
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Vehicle Work & Work Items ───────────────────────────────────────────

    [HttpGet("vehicle-works")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetVehicleWorks(
        Guid showroomId,
        [FromQuery] DateTime? date = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? staffId = null,
        [FromQuery] Guid? vehicleTypeId = null,
        CancellationToken ct = default)
    {
        try
        {
            var works = await _service.GetVehicleWorksAsync(showroomId, date, fromDate, toDate, staffId, vehicleTypeId, ct);
            return Ok(works);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("vehicle-works/{id:guid}")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetVehicleWorkById(Guid showroomId, Guid id, CancellationToken ct = default)
    {
        var work = await _service.GetVehicleWorkByIdAsync(showroomId, id, ct);
        if (work == null)
        {
            return NotFound(new { message = $"Vehicle work with ID '{id}' was not found for this showroom." });
        }
        return Ok(work);
    }

    [HttpPost("vehicle-works")]
    [RequirePermission("showroom.record_work")]
    public async Task<IActionResult> CreateVehicleWork(
        Guid showroomId,
        [FromBody] CreateShowroomVehicleWorkRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var created = await _service.CreateVehicleWorkAsync(showroomId, request, ct);
            return CreatedAtAction(nameof(GetVehicleWorkById), new { showroomId, id = created.Id }, created);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("vehicle-works/batch")]
    [RequirePermission("showroom.record_work")]
    public async Task<IActionResult> CreateBatchVehicleWork(
        Guid showroomId,
        [FromBody] CreateBatchShowroomVehicleWorkRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var created = await _service.CreateBatchVehicleWorkAsync(showroomId, request, ct);
            return Ok(created);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("vehicle-works/{id:guid}")]
    [RequirePermission("showroom.edit_work")]
    public async Task<IActionResult> UpdateVehicleWork(
        Guid showroomId,
        Guid id,
        [FromBody] UpdateShowroomVehicleWorkRequest request,
        CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var updated = await _service.UpdateVehicleWorkAsync(showroomId, id, request, ct);
            if (updated == null)
            {
                return NotFound(new { message = $"Vehicle work with ID '{id}' was not found for this showroom." });
            }
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Operations Summary ──────────────────────────────────────────────────

    [HttpGet("operations-summary")]
    [RequirePermission("showroom.view_history")]
    public async Task<IActionResult> GetOperationsSummary(
        Guid showroomId,
        [FromQuery] DateTime? date = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        try
        {
            DateTime start;
            DateTime end;

            if (date.HasValue)
            {
                start = date.Value.Date;
                end = date.Value.Date;
            }
            else
            {
                start = fromDate?.Date ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
                end = toDate?.Date ?? start.AddMonths(1).AddDays(-1);
            }

            var summary = await _service.GetOperationsSummaryAsync(showroomId, start, end, ct);
            return Ok(summary);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
