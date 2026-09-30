using CarSpaManagement.Api.Application.DTOs.Vendors;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/vendors")]
public class VendorsController : ControllerBase
{
    private readonly IVendorService _vendorService;

    public VendorsController(IVendorService vendorService)
    {
        _vendorService = vendorService;
    }

    [HttpGet]
    [RequirePermission("jobcards.view")]
    public async Task<IActionResult> GetAll([FromQuery] bool activeOnly = true, CancellationToken ct = default)
    {
        var list = await _vendorService.GetAllAsync(activeOnly, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("jobcards.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var vendor = await _vendorService.GetByIdAsync(id, ct);
        if (vendor == null) return NotFound();
        return Ok(vendor);
    }

    [HttpPost]
    [RequirePermission("jobcards.edit")]
    public async Task<IActionResult> Create([FromBody] CreateVendorRequest request, CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        try
        {
            var created = await _vendorService.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("jobcards.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateVendorRequest request, CancellationToken ct = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        try
        {
            var updated = await _vendorService.UpdateAsync(id, request, ct);
            if (updated == null) return NotFound();
            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("jobcards.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var deleted = await _vendorService.DeleteAsync(id, ct);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
