using CarSpaManagement.Api.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/public/invoices")]
[AllowAnonymous]
[EnableRateLimiting("public-invoice")]
public class PublicInvoicesController : ControllerBase
{
    private readonly IInvoiceService _service;

    public PublicInvoicesController(IInvoiceService service)
    {
        _service = service;
    }

    [HttpGet("{token}")]
    public async Task<IActionResult> GetPublicInvoice(string token, CancellationToken ct)
    {
        var dto = await _service.GetPublicInvoiceByTokenAsync(token, ct);
        if (dto is null)
        {
            return NotFound();
        }

        return Ok(dto);
    }
}
