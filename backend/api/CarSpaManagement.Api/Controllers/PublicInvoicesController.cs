using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/public/invoices")]
[AllowAnonymous]
[EnableRateLimiting("public-invoice")]
public class PublicInvoicesController : ControllerBase
{
    private readonly IInvoiceService _service;
    private readonly ICompanyDirectory? _directory;
    private readonly TenantContext? _tenant;
    private readonly PlatformOptions _platform;

    public PublicInvoicesController(
        IInvoiceService service,
        ICompanyDirectory? directory = null,
        TenantContext? tenant = null,
        IOptions<PlatformOptions>? platform = null)
    {
        _service = service;
        _directory = directory;
        _tenant = tenant;
        _platform = platform?.Value ?? new PlatformOptions();
    }

    /// <summary>
    /// Opens a shared invoice. On the platform the link is "&lt;company code&gt;-&lt;token&gt;"; older links (the token
    /// alone) belong to <see cref="PlatformOptions.LegacyPublicLinkCompanyCode"/>.
    /// </summary>
    [HttpGet("{token}")]
    public async Task<IActionResult> GetPublicInvoice(string token, CancellationToken ct)
    {
        if (_platform.Enabled)
        {
            var separator = token.LastIndexOf('-');
            var companyCode = separator > 0 ? token[..separator] : _platform.LegacyPublicLinkCompanyCode;
            var rawToken = separator > 0 ? token[(separator + 1)..] : token;

            var company = _directory is null ? null : await _directory.FindActiveByCodeAsync(companyCode, ct);
            if (company is null || _tenant is null)
            {
                return NotFound();
            }

            _tenant.Set(company.Id);
            token = rawToken;
        }

        var dto = await _service.GetPublicInvoiceByTokenAsync(token, ct);
        if (dto is null)
        {
            return NotFound();
        }

        return Ok(dto);
    }
}
