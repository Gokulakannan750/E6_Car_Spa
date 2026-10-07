using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/showroom-staff-assignments")]
public class ShowroomStaffAssignmentsController : ControllerBase
{
    private readonly IShowroomService _service;
    private readonly AppDbContext _db;

    public ShowroomStaffAssignmentsController(IShowroomService service, AppDbContext db)
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

    [HttpPut("{id:guid}")]
    [RequirePermission("showroom.edit_attendance")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDailyStaffAssignmentRequest request, CancellationToken ct)
    {
        try
        {
            var (_, isOwner) = await GetCallerInfoAsync(ct);
            var updated = await _service.UpdateAssignmentAsync(id, request, isOwner, ct);
            if (updated == null) return NotFound(new { message = $"Assignment with ID '{id}' was not found." });
            return Ok(updated);
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
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("showroom.assign_staff")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var (_, isOwner) = await GetCallerInfoAsync(ct);
            var removed = await _service.RemoveAssignmentAsync(id, isOwner, ct);
            if (!removed) return NotFound(new { message = $"Assignment with ID '{id}' was not found." });
            return NoContent();
        }
        catch (CarSpaManagement.Api.Application.Common.ForbiddenException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (CarSpaManagement.Api.Application.Common.ConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
