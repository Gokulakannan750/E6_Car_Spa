using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/invoices")]
public class InvoicesController : ControllerBase
{
	private readonly IInvoiceService _service;

	public InvoicesController(IInvoiceService service)
	{
		_service = service;
	}

	[HttpGet]
	public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null, [FromQuery] InvoiceStatus? status = null, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null, CancellationToken ct = default)
	{
		if (page < 1) page = 1;
		if (pageSize < 1 || pageSize > 100) pageSize = 20;

		var items = await _service.GetAllAsync(page, pageSize, search, status, fromDate, toDate, ct);
		var total = await _service.GetTotalCountAsync(search, status, fromDate, toDate, ct);
		return Ok(new InvoiceListResponse(items, total, page, pageSize));
	}

	[HttpGet("{id:guid}")]
	public async Task<IActionResult> Get(Guid id, CancellationToken ct)
	{
		var dto = await _service.GetByIdAsync(id, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpGet("by-number/{invoiceNumber}")]
	public async Task<IActionResult> GetByNumber(string invoiceNumber, CancellationToken ct)
	{
		var dto = await _service.GetByNumberAsync(invoiceNumber, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpPost("from-job-card/{jobCardId:guid}")]
	public async Task<IActionResult> CreateFromJobCard(Guid jobCardId, CancellationToken ct)
	{
		try
		{
			var dto = await _service.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCardId), ct);
			return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
		catch (InvalidOperationException ex)
		{
			return Conflict(new { error = ex.Message });
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}

	[HttpPut("{id:guid}")]
	public async Task<IActionResult> Update(Guid id, [FromBody] UpdateInvoiceRequest request, CancellationToken ct)
	{
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		try
		{
			var dto = await _service.UpdateAsync(id, request, ct);
			if (dto is null) return NotFound();
			return Ok(dto);
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}
}
