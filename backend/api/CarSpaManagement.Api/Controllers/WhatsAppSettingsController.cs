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
	private readonly IWhatsAppTemplateProvisioningService _templateProvisioning;

	public WhatsAppSettingsController(IWhatsAppService whatsAppService, IWhatsAppTemplateProvisioningService templateProvisioning)
	{
		_whatsAppService = whatsAppService;
		_templateProvisioning = templateProvisioning;
	}

	[HttpGet]
	[RequirePermission("settings.view")]
	public async Task<IActionResult> GetSettings(CancellationToken ct)
	{
		var config = await _whatsAppService.GetConfigurationAsync(ct);
		return Ok(config);
	}

	[HttpGet("health")]
	[RequirePermission("settings.view")]
	public async Task<IActionResult> GetHealth([FromQuery] bool probe = false, CancellationToken ct = default)
	{
		var health = await _whatsAppService.GetHealthStatusAsync(probe, ct);
		return Ok(health);
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

	[HttpGet("usage")]
	[RequirePermission("settings.view")]
	public async Task<IActionResult> GetUsage([FromQuery] int months = 6, CancellationToken ct = default)
	{
		var usage = await _whatsAppService.GetUsageAsync(months, ct);
		return Ok(usage);
	}

	[HttpGet("templates")]
	[RequirePermission("settings.view")]
	public async Task<IActionResult> GetTemplates(CancellationToken ct)
	{
		var result = await _whatsAppService.GetMetaTemplatesAsync(ct);
		return Ok(result);
	}

	[HttpGet("managed-templates")]
	[RequirePermission("settings.view")]
	public async Task<IActionResult> GetManagedTemplates(CancellationToken ct)
	{
		return Ok(await _templateProvisioning.GetManagedTemplatesAsync(ct));
	}

	[HttpPost("managed-templates/provision")]
	[RequirePermission("settings.business")]
	[EnableRateLimiting("whatsapp-test")]
	public async Task<IActionResult> ProvisionManagedTemplates(CancellationToken ct)
	{
		return Ok(await _templateProvisioning.ProvisionAsync(ct));
	}

	[HttpPost("managed-templates/activate")]
	[RequirePermission("settings.business")]
	public async Task<IActionResult> ActivateManagedTemplates(CancellationToken ct)
	{
		return Ok(await _templateProvisioning.ActivateAsync(ct));
	}

	[HttpPost("test-message")]
	[RequirePermission("settings.business")]
	[EnableRateLimiting("whatsapp-test")]
	public async Task<IActionResult> SendTestMessage([FromBody] SendTestWhatsAppMessageRequest request, CancellationToken ct)
	{
		var result = await _whatsAppService.SendTestTemplateMessageAsync(request, ct);
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
