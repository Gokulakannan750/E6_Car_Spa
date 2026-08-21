using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/staff-advances")]
public class StaffAdvancesController : ControllerBase
{
 private readonly IStaffAdvanceService _service;

 public StaffAdvancesController(IStaffAdvanceService service)
 {
 _service = service;
 }

 [HttpGet]
 public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? staffId = null, [FromQuery] string? status = null, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null, [FromQuery] string? search = null, CancellationToken ct = default)
 {
 if (page < 1) page = 1;
 if (pageSize < 1 || pageSize > 100) pageSize = 20;

 var items = await _service.GetAllAsync(page, pageSize, staffId, status, fromDate, toDate, search, ct);
 var total = await _service.GetTotalCountAsync(staffId, status, fromDate, toDate, search, ct);
 return Ok(new StaffAdvanceListResponse(items, total, page, pageSize));
 }

 [HttpGet("{id:guid}")]
 public async Task<IActionResult> Get(Guid id, CancellationToken ct)
 {
 var dto = await _service.GetByIdAsync(id, ct);
 if (dto is null) return NotFound();
 return Ok(dto);
 }

 [HttpPost]
 public async Task<IActionResult> Create([FromBody] CreateStaffAdvanceRequest request, CancellationToken ct)
 {
 var dto = await _service.CreateAsync(request, ct);
 return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
 }

 [HttpPut("{id:guid}")]
 public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStaffAdvanceRequest request, CancellationToken ct)
 {
 var dto = await _service.UpdateAsync(id, request, ct);
 if (dto is null) return NotFound();
 return Ok(dto);
 }

 [HttpDelete("{id:guid}")]
 public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
 {
 var deleted = await _service.DeleteAsync(id, ct);
 if (!deleted) return NotFound();
 return NoContent();
 }

 [HttpGet("staff")]
 public async Task<IActionResult> GetStaff(CancellationToken ct)
 {
 var staff = await _service.GetStaffAsync(ct);
 return Ok(staff);
 }

 [HttpGet("staff/{staffId:guid}")]
 public async Task<IActionResult> GetStaffById(Guid staffId, CancellationToken ct)
 {
 var staff = await _service.GetStaffByIdAsync(staffId, ct);
 if (staff is null) return NotFound();
 return Ok(staff);
 }

 [HttpGet("staff/{staffId:guid}/advances")]
 public async Task<IActionResult> GetByStaffId(Guid staffId, CancellationToken ct)
 {
 var items = await _service.GetByStaffIdAsync(staffId, ct);
 return Ok(items);
 }
}
