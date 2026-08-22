using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/job-cards")]
public class JobCardsController : ControllerBase
{
	private readonly IJobCardService _service;

	public JobCardsController(IJobCardService service)
	{
		_service = service;
	}

	[HttpGet("{id:guid}")]
	public async Task<IActionResult> Get(Guid id, CancellationToken ct)
	{
		var dto = await _service.GetByIdAsync(id, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpGet("{id:guid}/print")]
	public async Task<IActionResult> GetForPrint(Guid id, CancellationToken ct)
	{
		var dto = await _service.GetForPrintAsync(id, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpGet("by-number/{jobCardNumber}")]
	public async Task<IActionResult> GetByNumber(string jobCardNumber, CancellationToken ct)
	{
		var dto = await _service.GetByNumberAsync(jobCardNumber, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpGet]
	public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] JobCardStatus? status = null, [FromQuery] Guid? customerId = null, [FromQuery] Guid? vehicleId = null, [FromQuery] string? search = null, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null, CancellationToken ct = default)
	{
		if (page < 1) page = 1;
		if (pageSize < 1 || pageSize > 100) pageSize = 20;

		var items = await _service.GetAllAsync(page, pageSize, status, customerId, vehicleId, search, fromDate, toDate, ct);
		var total = await _service.GetTotalCountAsync(status, customerId, vehicleId, search, fromDate, toDate, ct);
		return Ok(new JobCardListResponse(items, total, page, pageSize));
	}

	[HttpGet("by-customer/{customerId:guid}")]
	public async Task<IActionResult> GetByCustomer(Guid customerId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
	{
		if (page < 1) page = 1;
		if (pageSize < 1 || pageSize > 100) pageSize = 20;

		var items = await _service.GetByCustomerIdAsync(customerId, page, pageSize, ct);
		var total = await _service.GetTotalCountAsync(customerId: customerId, cancellationToken: ct);
		return Ok(new JobCardListResponse(items, total, page, pageSize));
	}

	[HttpGet("by-vehicle/{vehicleId:guid}")]
	public async Task<IActionResult> GetByVehicle(Guid vehicleId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
	{
		if (page < 1) page = 1;
		if (pageSize < 1 || pageSize > 100) pageSize = 20;

		var items = await _service.GetByVehicleIdAsync(vehicleId, page, pageSize, ct);
		var total = await _service.GetTotalCountAsync(vehicleId: vehicleId, cancellationToken: ct);
		return Ok(new JobCardListResponse(items, total, page, pageSize));
	}

	[HttpPost]
	public async Task<IActionResult> Create([FromBody] CreateJobCardRequest request, CancellationToken ct)
	{
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		try
		{
			var dto = await _service.CreateAsync(request, ct);
			return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}

	[HttpPut("{id:guid}/services")]
	public async Task<IActionResult> UpdateServices(Guid id, [FromBody] UpdateJobCardServicesRequest request, CancellationToken ct)
	{
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		var dto = await _service.UpdateServicesAsync(id, request, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpDelete("{id:guid}")]
	public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
	{
		var deleted = await _service.DeleteAsync(id, ct);
		return deleted ? NoContent() : NotFound();
	}
}
