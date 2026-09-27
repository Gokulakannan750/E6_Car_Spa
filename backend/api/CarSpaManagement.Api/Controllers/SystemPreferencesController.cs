using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/settings/system")]
public class SystemPreferencesController : ControllerBase
{
    private readonly ISystemPreferenceService _preferenceService;

    public SystemPreferencesController(ISystemPreferenceService preferenceService)
    {
        _preferenceService = preferenceService;
    }

    /// <summary>
    /// Retrieves current business-wide System Preferences.
    /// </summary>
    [HttpGet]
    [RequirePermission("settings.view")]
    public async Task<IActionResult> GetPreferences(CancellationToken ct)
    {
        var preferences = await _preferenceService.GetPreferencesAsync(ct);
        return Ok(preferences);
    }

    /// <summary>
    /// Updates business-wide System Preferences.
    /// </summary>
    [HttpPut]
    [RequirePermission("settings.business")]
    public async Task<IActionResult> UpdatePreferences([FromBody] UpdateSystemPreferenceRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            Guid? userId = null;
            var sub = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(sub, out var uid)) userId = uid;

            var preferences = await _preferenceService.UpdatePreferencesAsync(request, userId, ct);
            return Ok(preferences);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
