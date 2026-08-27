using CarSpaManagement.Api.Application.DTOs.Services;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ServicesController : ControllerBase
{
 private readonly IServiceService _service;

 public ServicesController(IServiceService service)
 {
 _service = service;
 }

 [HttpGet("{id:guid}")]
 public async Task<IActionResult> Get(Guid id, CancellationToken ct)
 => (await _service.GetByIdAsync(id, ct)) is { } dto ? Ok(dto) : NotFound();

 [HttpGet("categories")]
 public async Task<IActionResult> GetCategories(CancellationToken ct)
 => Ok(await _service.GetCategoriesAsync(ct));

 [HttpGet]
 public async Task<IActionResult> GetAll([FromQuery] bool? isActive = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? search = null, [FromQuery] string? category = null, CancellationToken ct = default)
 {
 if (page < 1) page = 1;
 if (pageSize < 1 || pageSize > 200) pageSize = 50;

 var items = await _service.GetAllAsync(isActive, page, pageSize, search, category, ct);
 var total = await _service.GetTotalCountAsync(isActive, search, category, ct);
 return Ok(new ServiceListResponse(items, total, page, pageSize));
 }

 [HttpPost]
 [RequirePermission("settings.edit")]
 public async Task<IActionResult> Create([FromBody] CreateServiceRequest request, CancellationToken ct)
 {
 if (!ModelState.IsValid) return ValidationProblem(ModelState);

 var dto = await _service.CreateAsync(request, ct);
 return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
 }

 [HttpPut("{id:guid}")]
 [RequirePermission("settings.edit")]
 public async Task<IActionResult> Update(Guid id, [FromBody] UpdateServiceRequest request, CancellationToken ct)
 {
 if (!ModelState.IsValid) return ValidationProblem(ModelState);

 var dto = await _service.UpdateAsync(id, request, ct);
 return dto is null ? NotFound() : Ok(dto);
 }

 [HttpDelete("{id:guid}")]
 [RequirePermission("settings.edit")]
 public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
 {
 var deleted = await _service.DeleteAsync(id, ct);
 return deleted ? NoContent() : NotFound();
 }
}
