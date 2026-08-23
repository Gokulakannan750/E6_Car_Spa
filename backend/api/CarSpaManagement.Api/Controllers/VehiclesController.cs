using CarSpaManagement.Api.Application.DTOs.Vehicles;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VehiclesController : ControllerBase
{
 private readonly IVehicleService _service;
 private readonly ICustomerService _customerService;

 public VehiclesController(IVehicleService service, ICustomerService customerService)
 {
 _service = service;
 _customerService = customerService;
 }

 [HttpGet("{id:guid}")]
 [RequirePermission("vehicles.view")]
 public async Task<IActionResult> Get(Guid id, CancellationToken ct)
 => (await _service.GetByIdAsync(id, ct)) is { } dto ? Ok(dto) : NotFound();

 [HttpGet("by-customer/{customerId:guid}")]
 [RequirePermission("vehicles.view")]
 public async Task<IActionResult> GetByCustomer(Guid customerId, CancellationToken ct)
 => Ok(await _service.GetByCustomerIdAsync(customerId, ct));

 [HttpGet("by-registration/{registrationNumber}")]
 [RequirePermission("vehicles.view")]
 public async Task<IActionResult> GetByRegistration(string registrationNumber, CancellationToken ct)
 => (await _service.GetByRegistrationNumberAsync(registrationNumber, ct)) is { } dto ? Ok(dto) : NotFound();

 [HttpGet]
 [RequirePermission("vehicles.view")]
 public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null, CancellationToken ct = default)
 {
 if (page < 1) page = 1;
 if (pageSize < 1 || pageSize > 100) pageSize = 20;

 var items = await _service.GetAllAsync(page, pageSize, search, ct);
 var total = await _service.GetTotalCountAsync(search, ct);
 return Ok(new VehicleListResponse(items, total, page, pageSize));
 }

 [HttpPost]
 [RequirePermission("vehicles.create")]
 public async Task<IActionResult> Create([FromBody] CreateVehicleRequest request, CancellationToken ct)
 {
 if (!ModelState.IsValid) return ValidationProblem(ModelState);

 // Verify customer exists
 if (await _customerService.GetByIdAsync(request.CustomerId, ct) is null)
 return BadRequest(new { error = "The specified customer does not exist." });

 var dto = await _service.CreateAsync(request, ct);
 return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
 }

 [HttpPut("{id:guid}")]
 [RequirePermission("vehicles.edit")]
 public async Task<IActionResult> Update(Guid id, [FromBody] UpdateVehicleRequest request, CancellationToken ct)
 {
 if (!ModelState.IsValid) return ValidationProblem(ModelState);

 var dto = await _service.UpdateAsync(id, request, ct);
 return dto is null ? NotFound() : Ok(dto);
 }

 [HttpDelete("{id:guid}")]
 [RequirePermission("vehicles.edit")]
 public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
 {
 var deleted = await _service.DeleteAsync(id, ct);
 return deleted ? NoContent() : NotFound();
 }
}
