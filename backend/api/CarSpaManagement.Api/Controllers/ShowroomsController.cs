using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
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
    public async Task<IActionResult> GetAll([FromQuery] string? search = null, [FromQuery] bool? isActive = null, CancellationToken ct = default)
    {
        var showrooms = await _service.GetAllAsync(search, isActive, ct);
        return Ok(showrooms);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var showroom = await _service.GetByIdAsync(id, ct);
        if (showroom == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(showroom);
    }

    [HttpPost]
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
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateShowroomRequest request, CancellationToken ct)
    {
        var updated = await _service.UpdateAsync(id, request, ct);
        if (updated == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeleteAsync(id, ct);
        if (!deleted) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return NoContent();
    }

    [HttpPatch("{id:guid}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id, CancellationToken ct)
    {
        var updated = await _service.ToggleActiveAsync(id, ct);
        if (!updated) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return NoContent();
    }

    // ── Daily Staff Assignment Endpoints ─────────────────────────────────────

    [HttpGet("{id:guid}/daily-staff")]
    public async Task<IActionResult> GetDailyStaff(Guid id, [FromQuery] DateTime? date, CancellationToken ct)
    {
        var targetDate = date?.Date ?? DateTime.UtcNow.Date;
        var response = await _service.GetDailyStaffAsync(id, targetDate, ct);
        if (response == null) return NotFound(new { message = $"Showroom with ID '{id}' was not found." });
        return Ok(response);
    }

    [HttpPost("{id:guid}/daily-staff")]
    public async Task<IActionResult> AssignDailyStaff(Guid id, [FromBody] CreateDailyStaffAssignmentRequest request, CancellationToken ct)
    {
        try
        {
            var assignment = await _service.AssignStaffAsync(id, request, ct);
            return Ok(assignment);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
