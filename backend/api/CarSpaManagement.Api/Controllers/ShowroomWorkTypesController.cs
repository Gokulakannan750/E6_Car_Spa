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
[Route("api/showroom-work-types")]
[Authorize]
public class ShowroomWorkTypesController : ControllerBase
{
    private readonly IShowroomOperationsService _service;
    private readonly AppDbContext _db;

    public ShowroomWorkTypesController(IShowroomOperationsService service, AppDbContext db)
    {
        _service = service;
        _db = db;
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

    [HttpGet]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetAll([FromQuery] bool? isActive = null, [FromQuery] bool? includeInactive = null, CancellationToken ct = default)
    {
        bool? filterIsActive = isActive;
        if (!filterIsActive.HasValue && includeInactive.HasValue)
        {
            filterIsActive = includeInactive.Value ? null : true;
        }

        var types = await _service.GetWorkTypesAsync(filterIsActive, ct);
        return Ok(types);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("showroom.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var item = await _service.GetWorkTypeByIdAsync(id, ct);
        if (item == null) return NotFound(new { message = $"Work type with ID '{id}' was not found." });
        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "Owner")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> Create([FromBody] CreateShowroomWorkTypeRequest request, CancellationToken ct = default)
    {
        var (_, isOwner) = await GetCallerInfoAsync(ct);
        if (!isOwner)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Owner can manage showroom work types." });
        }

        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var created = await _service.CreateWorkTypeAsync(request, ct);
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
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateShowroomWorkTypeRequest request, CancellationToken ct = default)
    {
        var (_, isOwner) = await GetCallerInfoAsync(ct);
        if (!isOwner)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Owner can manage showroom work types." });
        }

        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var updated = await _service.UpdateWorkTypeAsync(id, request, ct);
            if (updated == null) return NotFound(new { message = $"Work type with ID '{id}' was not found." });
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
        var (_, isOwner) = await GetCallerInfoAsync(ct);
        if (!isOwner)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Owner can manage showroom work types." });
        }

        var toggled = await _service.ToggleWorkTypeActiveAsync(id, ct);
        if (!toggled) return NotFound(new { message = $"Work type with ID '{id}' was not found." });
        return NoContent();
    }
}
