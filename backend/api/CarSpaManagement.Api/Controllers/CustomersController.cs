using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomersController : ControllerBase
{
 private readonly ICustomerService _service;

 public CustomersController(ICustomerService service)
 {
 _service = service;
 }

 [HttpGet("{id:guid}")]
 public async Task<IActionResult> Get(Guid id, CancellationToken ct)
 => (await _service.GetByIdAsync(id, ct)) is { } dto ? Ok(dto) : NotFound();

 [HttpGet("by-phone/{phoneNumber}")]
 public async Task<IActionResult> GetByPhone(string phoneNumber, CancellationToken ct)
 => (await _service.GetByPhoneAsync(phoneNumber, ct)) is { } dto ? Ok(dto) : NotFound();

 [HttpGet("by-registration/{registrationNumber}")]
 public async Task<IActionResult> GetByRegistration(string registrationNumber, CancellationToken ct)
 => (await _service.GetByRegistrationAsync(registrationNumber, ct)) is { } dto ? Ok(dto) : NotFound();

 [HttpGet]
 public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null, CancellationToken ct = default)
 {
 if (page < 1) page = 1;
 if (pageSize < 1 || pageSize > 100) pageSize = 20;

 var items = await _service.GetAllAsync(page, pageSize, search, ct);
 var total = await _service.GetTotalCountAsync(search, ct);
 return Ok(new CustomerListResponse(items, total, page, pageSize));
 }

 [HttpGet("{id:guid}/history")]
 public async Task<IActionResult> GetHistory(Guid id, CancellationToken ct)
 {
 var history = await _service.GetHistoryAsync(id, ct);
 if (history.TotalJobCards == 0 && history.CustomerName == string.Empty)
 return NotFound(new { error = "Customer not found." });

 return Ok(history);
 }

 [HttpPost]
 public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request, CancellationToken ct)
 {
 if (!ModelState.IsValid) return ValidationProblem(ModelState);

 if (await _service.PhoneExistsAsync(request.PhoneNumber))
 return Conflict(new { error = "A customer with this phone number already exists." });

 var dto = await _service.CreateAsync(request, ct);
 return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
 }

 [HttpPut("{id:guid}")]
 public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request, CancellationToken ct)
 {
 if (!ModelState.IsValid) return ValidationProblem(ModelState);

 if (await _service.PhoneExistsAsync(request.PhoneNumber, excludeId: id))
 return Conflict(new { error = "A customer with this phone number already exists." });

 var dto = await _service.UpdateAsync(id, request, ct);
 return dto is null ? NotFound() : Ok(dto);
 }

 [HttpDelete("{id:guid}")]
 public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
 {
 var deleted = await _service.DeleteAsync(id, ct);
 return deleted ? NoContent() : NotFound();
 }
}
