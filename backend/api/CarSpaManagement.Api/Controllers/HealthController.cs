using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
 private readonly HealthCheckService _healthCheckService;

 public HealthController(HealthCheckService healthCheckService)
 {
 _healthCheckService = healthCheckService;
 }

 [HttpGet]
 public async Task<IActionResult> Get(CancellationToken ct)
 {
 var report = await _healthCheckService.CheckHealthAsync(ct);

 var response = new
 {
 status = report.Status.ToString(),
 checks = report.Entries.Select(e => new
 {
 component = e.Key,
 status = e.Value.Status.ToString(),
 description = e.Value.Description,
 })
 };

 return report.Status == HealthStatus.Healthy ? Ok(response) : StatusCode(503, response);
 }
}
