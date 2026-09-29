using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.OutsideJobs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
public class OutsideJobsController : ControllerBase
{
    private readonly IOutsideJobService _service;

    public OutsideJobsController(IOutsideJobService service)
    {
        _service = service;
    }

    /// <summary>
    /// Gets all outside jobs for a specific job card.
    /// </summary>
    [HttpGet("api/job-cards/{jobCardId:guid}/outside-jobs")]
    [RequirePermission("jobcards.view")]
    public async Task<IActionResult> GetByJobCard(Guid jobCardId, CancellationToken ct)
    {
        var list = await _service.GetByJobCardIdAsync(jobCardId, ct);
        return Ok(list);
    }

    /// <summary>
    /// Creates and sends a vehicle outside for a specific job card.
    /// </summary>
    [HttpPost("api/job-cards/{jobCardId:guid}/outside-jobs")]
    [RequirePermission("jobcards.edit")]
    public async Task<IActionResult> Create(Guid jobCardId, [FromBody] CreateOutsideJobRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var (userId, userName) = GetCurrentUser();

        try
        {
            var dto = await _service.CreateOutsideJobAsync(jobCardId, request, userId, userName, ct);
            return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
        }
        catch (ConflictException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Gets a single outside job by ID.
    /// </summary>
    [HttpGet("api/outside-jobs/{id:guid}")]
    [RequirePermission("jobcards.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetByIdAsync(id, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    /// <summary>
    /// Lists all outside jobs across the system with filtering.
    /// </summary>
    [HttpGet("api/outside-jobs")]
    [RequirePermission("jobcards.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] OutsideJobStatus? status = null,
        [FromQuery] bool? isOverdue = null,
        [FromQuery] Guid? vendorId = null,
        [FromQuery] Guid? vehicleId = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var result = await _service.GetAllAsync(page, pageSize, status, isOverdue, vendorId, vehicleId, search, fromDate, toDate, ct);
        return Ok(result);
    }

    /// <summary>
    /// Updates details of an active outside job.
    /// </summary>
    [HttpPut("api/outside-jobs/{id:guid}")]
    [RequirePermission("jobcards.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOutsideJobRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var dto = await _service.UpdateAsync(id, request, ct);
            if (dto == null) return NotFound();
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Marks an active outside job as returned.
    /// </summary>
    [HttpPost("api/outside-jobs/{id:guid}/return")]
    [RequirePermission("jobcards.edit")]
    public async Task<IActionResult> MarkReturned(Guid id, [FromBody] MarkOutsideJobReturnedRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var (userId, userName) = GetCurrentUser();

        try
        {
            var dto = await _service.MarkReturnedAsync(id, request, userId, userName, ct);
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Cancels an outside job.
    /// </summary>
    [HttpPost("api/outside-jobs/{id:guid}/cancel")]
    [RequirePermission("jobcards.edit")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelOutsideJobRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var (userId, userName) = GetCurrentUser();

        try
        {
            var dto = await _service.CancelAsync(id, request, userId, userName, ct);
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Gets current location of the vehicle associated with a job card.
    /// </summary>
    [HttpGet("api/job-cards/{jobCardId:guid}/location")]
    [RequirePermission("jobcards.view")]
    public async Task<IActionResult> GetJobCardLocation(Guid jobCardId, CancellationToken ct)
    {
        var location = await _service.GetVehicleLocationByJobCardIdAsync(jobCardId, ct);
        return Ok(location);
    }

    /// <summary>
    /// Gets current location of a vehicle by vehicle ID.
    /// </summary>
    [HttpGet("api/vehicles/{vehicleId:guid}/location")]
    [RequirePermission("jobcards.view")]
    public async Task<IActionResult> GetVehicleLocation(Guid vehicleId, CancellationToken ct)
    {
        var location = await _service.GetVehicleLocationByVehicleIdAsync(vehicleId, ct);
        return Ok(location);
    }

    private (Guid? userId, string? userName) GetCurrentUser()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        Guid? userId = Guid.TryParse(userIdStr, out var parsed) ? parsed : null;
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.Identity?.Name;
        return (userId, userName);
    }
}
