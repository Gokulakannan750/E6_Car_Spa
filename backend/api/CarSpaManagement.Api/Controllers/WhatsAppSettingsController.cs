using System.Security.Claims;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/settings/whatsapp")]
public class WhatsAppSettingsController : ControllerBase
{
	private readonly IWhatsAppService _whatsAppService;

	public WhatsAppSettingsController(IWhatsAppService whatsAppService)
	{
		_whatsAppService = whatsAppService;
	}

	[HttpGet]
	[RequirePermission("settings.view")]
	public async Task<IActionResult> GetSettings(CancellationToken ct)
	{
		var config = await _whatsAppService.GetConfigurationAsync(ct);
		return Ok(config);
	}

	[HttpPut]
	[RequirePermission("settings.business")]
	public async Task<IActionResult> UpdateSettings([FromBody] UpdateWhatsAppConfigRequest request, CancellationToken ct)
	{
		Guid? userId = null;
		var sub = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (Guid.TryParse(sub, out var uid)) userId = uid;

		var config = await _whatsAppService.UpdateConfigurationAsync(request, userId, ct);
		return Ok(config);
	}

	[HttpPost("test")]
	[RequirePermission("settings.business")]
	[EnableRateLimiting("whatsapp-test")]
	public async Task<IActionResult> TestConnection([FromBody] TestWhatsAppConnectionRequest? request, CancellationToken ct)
	{
		var result = await _whatsAppService.TestConnectionAsync(request, ct);
		return Ok(result);
	}

	[HttpGet("/api/invoices/{id:guid}/whatsapp-status")]
	[RequirePermission("invoices.view")]
	public async Task<IActionResult> GetInvoiceWhatsAppStatus(Guid id, CancellationToken ct)
	{
		var statuses = await _whatsAppService.GetInvoiceWhatsAppStatusAsync(id, ct);
		return Ok(statuses);
	}
}
