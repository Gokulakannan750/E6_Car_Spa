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

    [HttpPut("{id:guid}")]
    [RequirePermission("showroom.edit_attendance")]
    public async Task<IActionResult> UpdateVehicles(Guid id, [FromBody] UpdateDailyStaffAssignmentRequest request, CancellationToken ct)
    {
        var updated = await _service.UpdateAssignmentVehiclesAsync(id, request.VehiclesAttended, ct);
        if (updated == null) return NotFound(new { message = $"Assignment with ID '{id}' was not found." });
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("showroom.assign_staff")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var removed = await _service.RemoveAssignmentAsync(id, ct);
        if (!removed) return NotFound(new { message = $"Assignment with ID '{id}' was not found." });
        return NoContent();
    }
}
