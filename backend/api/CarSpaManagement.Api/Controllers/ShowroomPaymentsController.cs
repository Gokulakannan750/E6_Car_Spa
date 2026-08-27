using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/showroom-payments")]
[Authorize]
public class ShowroomPaymentsController : ControllerBase
{
    private readonly IShowroomService _service;

    public ShowroomPaymentsController(IShowroomService service)
    {
        _service = service;
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("showroom.manage")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeletePaymentAsync(id, ct);
        if (!deleted) return NotFound(new { message = $"Payment transaction with ID '{id}' was not found." });
        return NoContent();
    }
}
