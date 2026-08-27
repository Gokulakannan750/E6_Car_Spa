using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
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
	[RequirePermission("invoices.view")]
	public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null, [FromQuery] InvoiceStatus? status = null, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null, CancellationToken ct = default)
	{
		if (page < 1) page = 1;
		if (pageSize < 1 || pageSize > 100) pageSize = 20;

		var items = await _service.GetAllAsync(page, pageSize, search, status, fromDate, toDate, ct);
		var total = await _service.GetTotalCountAsync(search, status, fromDate, toDate, ct);
		return Ok(new InvoiceListResponse(items, total, page, pageSize));
	}

	[HttpGet("{id:guid}")]
	[RequirePermission("invoices.view")]
	public async Task<IActionResult> Get(Guid id, CancellationToken ct)
	{
		var dto = await _service.GetByIdAsync(id, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpGet("by-number/{invoiceNumber}")]
	[RequirePermission("invoices.view")]
	public async Task<IActionResult> GetByNumber(string invoiceNumber, CancellationToken ct)
	{
		var dto = await _service.GetByNumberAsync(invoiceNumber, ct);
		if (dto is null) return NotFound();
		return Ok(dto);
	}

	[HttpPost("from-job-card/{jobCardId:guid}")]
	[RequirePermission("invoices.edit_draft")]
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
	[RequirePermission("invoices.edit_draft")]
	public async Task<IActionResult> Update(Guid id, [FromBody] UpdateInvoiceRequest request, CancellationToken ct)
	{
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		try
		{
			var dto = await _service.UpdateAsync(id, request, ct);
			if (dto is null) return NotFound();
			return Ok(dto);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
		catch (InvalidOperationException ex)
		{
			return Conflict(new { error = ex.Message });
		}
		catch (ArgumentOutOfRangeException ex)
		{
			return BadRequest(new { error = ex.Message });
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}

	[HttpPost("{id:guid}/generate")]
	[RequirePermission("invoices.generate")]
	public async Task<IActionResult> Generate(Guid id, CancellationToken ct)
	{
		try
		{
			var dto = await _service.GenerateInvoiceAsync(id, ct);
			return Ok(dto);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
		catch (InvalidOperationException ex)
		{
			return Conflict(new { error = ex.Message });
		}
		catch (ArgumentOutOfRangeException ex)
		{
			return BadRequest(new { error = ex.Message });
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}

	[HttpPost("{id:guid}/payments")]
	[RequirePermission("invoices.record_payment")]
	public async Task<IActionResult> RecordPayment(Guid id, [FromBody] RecordPaymentRequest request, CancellationToken ct)
	{
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		try
		{
			var payment = await _service.RecordPaymentAsync(id, request, ct);
			return Ok(payment);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
		catch (ArgumentOutOfRangeException ex)
		{
			return BadRequest(new { error = ex.Message });
		}
		catch (ArgumentException ex)
		{
			return BadRequest(new { error = ex.Message });
		}
		catch (InvalidOperationException ex)
		{
			return BadRequest(new { error = ex.Message });
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}

	[HttpGet("{id:guid}/payments")]
	[RequirePermission("invoices.view")]
	public async Task<IActionResult> GetPayments(Guid id, CancellationToken ct)
	{
		try
		{
			var payments = await _service.GetPaymentsByInvoiceIdAsync(id, ct);
			return Ok(payments);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
	}

	[HttpPost("{id:guid}/public-link")]
	[RequirePermission("invoices.generate")]
	public async Task<IActionResult> CreatePublicLink(Guid id, CancellationToken ct)
	{
		try
		{
			var response = await _service.CreatePublicLinkAsync(id, ct);
			return Ok(response);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
		catch (InvalidOperationException ex)
		{
			if (ex.Message.Contains("active public link already exists"))
			{
				return Conflict(new { error = ex.Message });
			}
			return BadRequest(new { error = ex.Message });
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}

	[HttpGet("{id:guid}/public-link/status")]
	[RequirePermission("invoices.view")]
	public async Task<IActionResult> GetPublicLinkStatus(Guid id, CancellationToken ct)
	{
		try
		{
			var status = await _service.GetPublicLinkStatusAsync(id, ct);
			return Ok(status);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
	}

	[HttpDelete("{id:guid}/public-link")]
	[RequirePermission("invoices.generate")]
	public async Task<IActionResult> RevokePublicLink(Guid id, CancellationToken ct)
	{
		try
		{
			await _service.RevokePublicLinkAsync(id, ct);
			return Ok(new { success = true, message = "Public invoice link revoked." });
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}

	[HttpPost("{id:guid}/public-link/rotate")]
	[RequirePermission("invoices.generate")]
	public async Task<IActionResult> RotatePublicLink(Guid id, CancellationToken ct)
	{
		try
		{
			var response = await _service.RotatePublicLinkAsync(id, ct);
			return Ok(response);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new { error = ex.Message });
		}
		catch (InvalidOperationException ex)
		{
			return BadRequest(new { error = ex.Message });
		}
		catch (DbUpdateException ex)
		{
			return StatusCode(500, new { error = "Database error", detail = ex.InnerException?.Message ?? ex.Message });
		}
	}
}
