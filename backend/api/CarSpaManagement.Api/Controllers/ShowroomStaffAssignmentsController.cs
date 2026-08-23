using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/showroom-staff-assignments")]
public class ShowroomStaffAssignmentsController : ControllerBase
{
    private readonly IShowroomService _service;

    public ShowroomStaffAssignmentsController(IShowroomService service)
    {
        _service = service;
    }

    private bool GetIsOwner()
    {
        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
            ?? User.FindFirst("role")?.Value;
        var isOwnerClaim = User.FindFirst("isOwner")?.Value;

        return string.Equals(role, "Owner", StringComparison.OrdinalIgnoreCase)
            || string.Equals(isOwnerClaim, "true", StringComparison.OrdinalIgnoreCase);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("showroom.edit_attendance")]
    public async Task<IActionResult> UpdateVehicles(Guid id, [FromBody] UpdateDailyStaffAssignmentRequest request, CancellationToken ct)
    {
        try
        {
            var isOwner = GetIsOwner();
            var updated = await _service.UpdateAssignmentVehiclesAsync(id, request.VehiclesAttended, isOwner, ct);
            if (updated == null) return NotFound(new { message = $"Assignment with ID '{id}' was not found." });
            return Ok(updated);
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
            var isOwner = GetIsOwner();
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
