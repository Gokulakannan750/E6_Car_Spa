using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/showroom-payments")]
public class ShowroomPaymentsController : ControllerBase
{
    private readonly IShowroomService _service;

    public ShowroomPaymentsController(IShowroomService service)
    {
        _service = service;
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("showroom.record_payment")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeletePaymentAsync(id, ct);
        if (!deleted) return NotFound(new { message = $"Payment transaction with ID '{id}' was not found." });
        return NoContent();
    }
}
