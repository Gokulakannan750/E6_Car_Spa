using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

/// <summary>Invoice Configuration: GST and non-GST numbering series.</summary>
[ApiController]
[Route("api/settings/invoice-series")]
public class InvoiceSeriesSettingsController(IInvoiceSeriesService service) : ControllerBase
{
    [HttpGet]
    [RequirePermission("settings.view")]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await service.GetAsync(ct));

    /// <summary>Owner only (enforced by the service against the database). Counters cannot be changed.</summary>
    [HttpPut]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> UpdatePrefixes([FromBody] UpdateInvoiceSeriesRequest request, CancellationToken ct)
    {
        try
        {
            return Ok(await service.UpdatePrefixesAsync(request, ct));
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
