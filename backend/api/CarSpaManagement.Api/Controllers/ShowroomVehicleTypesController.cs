using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/showroom-vehicle-types")]
[Authorize]
public class ShowroomVehicleTypesController : ControllerBase
{
    private readonly IShowroomOperationsService _service;

    public ShowroomVehicleTypesController(IShowroomOperationsService service)
    {
        _service = service;
    }

    private bool IsCallerOwner()
    {
        return User.IsInRole("Owner") || string.Equals(User.FindFirst("isOwner")?.Value, "true", StringComparison.OrdinalIgnoreCase);
    }

    [HttpGet]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetAll([FromQuery] bool? isActive = null, [FromQuery] bool? includeInactive = null, CancellationToken ct = default)
    {
        bool? filterIsActive = isActive;
        if (!filterIsActive.HasValue && includeInactive.HasValue)
        {
            filterIsActive = includeInactive.Value ? null : true;
        }

        var types = await _service.GetVehicleTypesAsync(filterIsActive, ct);
        return Ok(types);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var item = await _service.GetVehicleTypeByIdAsync(id, ct);
        if (item == null) return NotFound(new { message = $"Vehicle type with ID '{id}' was not found." });
        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "Owner")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> Create([FromBody] CreateShowroomVehicleTypeRequest request, CancellationToken ct = default)
    {
        if (!IsCallerOwner())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Owner can manage showroom vehicle types." });
        }

        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var created = await _service.CreateVehicleTypeAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
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

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Owner")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateShowroomVehicleTypeRequest request, CancellationToken ct = default)
    {
        if (!IsCallerOwner())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Owner can manage showroom vehicle types." });
        }

        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var updated = await _service.UpdateVehicleTypeAsync(id, request, ct);
            if (updated == null) return NotFound(new { message = $"Vehicle type with ID '{id}' was not found." });
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

    [HttpPatch("{id:guid}/toggle-active")]
    [Authorize(Roles = "Owner")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> ToggleActive(Guid id, CancellationToken ct = default)
    {
        if (!IsCallerOwner())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Owner can manage showroom vehicle types." });
        }

        var toggled = await _service.ToggleVehicleTypeActiveAsync(id, ct);
        if (!toggled) return NotFound(new { message = $"Vehicle type with ID '{id}' was not found." });
        return NoContent();
    }
}
