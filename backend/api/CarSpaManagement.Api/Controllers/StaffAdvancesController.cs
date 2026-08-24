using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/staff-advances")]
public class StaffAdvancesController : ControllerBase
{
    private readonly IStaffAdvanceService _service;

    public StaffAdvancesController(IStaffAdvanceService service)
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

    // ── Staff Advances Endpoints ────────────────────────────────────────────

    [HttpGet]
    [RequirePermission("staff_advances.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? staffId = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var response = await _service.GetAllAsync(page, pageSize, staffId, status, fromDate, toDate, search, ct);
        return Ok(response);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("staff_advances.view")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetByIdAsync(id, ct);
        if (dto is null) return NotFound(new { message = $"Staff advance with ID '{id}' was not found." });
        return Ok(dto);
    }

    [HttpPost]
    [RequirePermission("staff_advances.create")]
    public async Task<IActionResult> Create([FromBody] CreateStaffAdvanceRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        try
        {
            var dto = await _service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
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

    [HttpPost("{id:guid}/settle")]
    [RequirePermission("staff_advances.settle")]
    public async Task<IActionResult> Settle(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        try
        {
            var dto = await _service.SettleAsync(id, userId, ct);
            return Ok(dto);
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

    [HttpPost("{id:guid}/obsolete")]
    [RequirePermission("staff_advances.obsolete")]
    public async Task<IActionResult> Obsolete(Guid id, [FromBody] ObsoleteStaffAdvanceRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var userId = GetUserId();
        try
        {
            var dto = await _service.ObsoleteAsync(id, request, userId, ct);
            return Ok(dto);
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

    [HttpGet("staff/{staffId:guid}/history")]
    [RequirePermission("staff_advances.view")]
    public async Task<IActionResult> GetStaffHistory(Guid staffId, CancellationToken ct)
    {
        try
        {
            var history = await _service.GetStaffAdvanceHistoryAsync(staffId, ct);
            return Ok(history);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ── Staff Directory Endpoints ───────────────────────────────────────────

    [HttpGet("staff")]
    [RequirePermission("staff.view")]
    public async Task<IActionResult> GetStaff(CancellationToken ct)
    {
        var staff = await _service.GetStaffAsync(ct);
        return Ok(staff);
    }

    [HttpGet("staff/{staffId:guid}")]
    [RequirePermission("staff.view")]
    public async Task<IActionResult> GetStaffById(Guid staffId, CancellationToken ct)
    {
        var staff = await _service.GetStaffByIdAsync(staffId, ct);
        if (staff is null) return NotFound(new { message = $"Staff member with ID '{staffId}' was not found." });
        return Ok(staff);
    }

    [HttpGet("staff/{staffId:guid}/advances")]
    [RequirePermission("staff_advances.view")]
    public async Task<IActionResult> GetByStaffIdLegacy(Guid staffId, CancellationToken ct)
    {
        try
        {
            var history = await _service.GetStaffAdvanceHistoryAsync(staffId, ct);
            return Ok(history.Advances);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("staff")]
    [RequirePermission("staff.create")]
    public async Task<IActionResult> CreateStaff([FromBody] CreateStaffRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var dto = await _service.CreateStaffMemberAsync(request, ct);
        return CreatedAtAction(nameof(GetStaffById), new { staffId = dto.Id }, dto);
    }

    [HttpPut("staff/{staffId:guid}")]
    [RequirePermission("staff.edit")]
    public async Task<IActionResult> UpdateStaff(Guid staffId, [FromBody] UpdateStaffRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var dto = await _service.UpdateStaffMemberAsync(staffId, request, ct);
        if (dto is null) return NotFound(new { message = $"Staff member with ID '{staffId}' was not found." });
        return Ok(dto);
    }

    [HttpDelete("staff/{staffId:guid}")]
    [RequirePermission("staff.edit")]
    public async Task<IActionResult> DeleteStaff(Guid staffId, CancellationToken ct)
    {
        var deleted = await _service.DeleteStaffMemberAsync(staffId, ct);
        if (!deleted) return NotFound(new { message = $"Staff member with ID '{staffId}' was not found." });
        return NoContent();
    }
}
