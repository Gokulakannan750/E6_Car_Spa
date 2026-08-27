using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/job-cards")]
public class JobCardsController : ControllerBase
{
	private readonly IJobCardService _service;
	private readonly IAuthorizationService _authorizationService;
	private readonly IWebHostEnvironment _environment;

	public JobCardsController(IJobCardService service, IAuthorizationService authorizationService, IWebHostEnvironment environment)
	{
		_service = service;
		_authorizationService = authorizationService;
		_environment = environment;
	}

	[HttpGet("{id:guid}")]
	[RequirePermission("jobcards.view")]
	public async Task<IActionResult> Get(Guid id, CancellationToken ct)
	{
		var dto = await _service.GetByIdAsync(id, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpGet("{id:guid}/print")]
	[RequirePermission("jobcards.print")]
	public async Task<IActionResult> GetForPrint(Guid id, CancellationToken ct)
	{
		var dto = await _service.GetForPrintAsync(id, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpGet("by-number/{jobCardNumber}")]
	[RequirePermission("jobcards.view")]
	public async Task<IActionResult> GetByNumber(string jobCardNumber, CancellationToken ct)
	{
		var dto = await _service.GetByNumberAsync(jobCardNumber, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpGet]
	[RequirePermission("jobcards.view")]
	public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] JobCardStatus? status = null, [FromQuery] Guid? customerId = null, [FromQuery] Guid? vehicleId = null, [FromQuery] string? search = null, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null, CancellationToken ct = default)
	{
		if (page < 1) page = 1;
		if (pageSize < 1 || pageSize > 100) pageSize = 20;

		var items = await _service.GetAllAsync(page, pageSize, status, customerId, vehicleId, search, fromDate, toDate, ct);
		var total = await _service.GetTotalCountAsync(status, customerId, vehicleId, search, fromDate, toDate, ct);
		return Ok(new JobCardListResponse(items, total, page, pageSize));
	}

	[HttpGet("by-customer/{customerId:guid}")]
	[RequirePermission("jobcards.view")]
	public async Task<IActionResult> GetByCustomer(Guid customerId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
	{
		if (page < 1) page = 1;
		if (pageSize < 1 || pageSize > 100) pageSize = 20;

		var items = await _service.GetByCustomerIdAsync(customerId, page, pageSize, ct);
		var total = await _service.GetTotalCountAsync(customerId: customerId, cancellationToken: ct);
		return Ok(new JobCardListResponse(items, total, page, pageSize));
	}

	[HttpGet("by-vehicle/{vehicleId:guid}")]
	[RequirePermission("jobcards.view")]
	public async Task<IActionResult> GetByVehicle(Guid vehicleId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
	{
		if (page < 1) page = 1;
		if (pageSize < 1 || pageSize > 100) pageSize = 20;

		var items = await _service.GetByVehicleIdAsync(vehicleId, page, pageSize, ct);
		var total = await _service.GetTotalCountAsync(vehicleId: vehicleId, cancellationToken: ct);
		return Ok(new JobCardListResponse(items, total, page, pageSize));
	}

	[HttpPost]
	[RequirePermission("jobcards.create")]
	public async Task<IActionResult> Create([FromBody] CreateJobCardRequest request, CancellationToken ct)
	{
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		if (request.Services.Any(s => s.DiscountAmount > 0))
		{
			var authResult = await _authorizationService.AuthorizeAsync(User, "Permission:invoices.discount");
			if (!authResult.Succeeded)
			{
				return Forbid();
			}
		}

		try
		{
			var dto = await _service.CreateAsync(request, ct);
			return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = _environment.IsDevelopment() ? ex.InnerException?.Message ?? ex.Message : null });
		}
	}

	[HttpPut("{id:guid}/services")]
	[RequirePermission("jobcards.edit")]
	public async Task<IActionResult> UpdateServices(Guid id, [FromBody] UpdateJobCardServicesRequest request, CancellationToken ct)
	{
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		if (request.Services.Any(s => s.DiscountAmount > 0))
		{
			var authResult = await _authorizationService.AuthorizeAsync(User, "Permission:invoices.discount");
			if (!authResult.Succeeded)
			{
				return Forbid();
			}
		}

		var dto = await _service.UpdateServicesAsync(id, request, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpDelete("{id:guid}")]
	[RequirePermission("jobcards.delete")]
	public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
	{
		var deleted = await _service.DeleteAsync(id, ct);
		return deleted ? NoContent() : NotFound();
	}
}
