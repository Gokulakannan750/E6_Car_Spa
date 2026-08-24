using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/settings/business")]
public class BusinessProfileController : ControllerBase
{
    private readonly IBusinessProfileService _profileService;

    public BusinessProfileController(IBusinessProfileService profileService)
    {
        _profileService = profileService;
    }

    /// <summary>
    /// Retrieves current active Business Profile & Invoice Configuration.
    /// </summary>
    [HttpGet]
    [RequirePermission("settings.view")]
    public async Task<IActionResult> GetProfile(CancellationToken ct)
    {
        var profile = await _profileService.GetProfileAsync(ct);
        return Ok(profile);
    }

    /// <summary>
    /// Updates Business Profile & Invoice Configuration details.
    /// </summary>
    [HttpPut]
    [RequirePermission("settings.business")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateBusinessProfileRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var profile = await _profileService.UpdateProfileAsync(request, ct);
            return Ok(profile);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Uploads a new business logo (PNG, JPEG, WebP up to 5MB).
    /// </summary>
    [HttpPost("logo")]
    [RequirePermission("settings.business")]
    public async Task<IActionResult> UploadLogo([FromForm] IFormFile file, CancellationToken ct)
    {
        try
        {
            var result = await _profileService.UploadLogoAsync(file, ct);
            return Ok(result);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Removes the configured business logo.
    /// </summary>
    [HttpDelete("logo")]
    [RequirePermission("settings.business")]
    public async Task<IActionResult> RemoveLogo(CancellationToken ct)
    {
        var result = await _profileService.RemoveLogoAsync(ct);
        return Ok(result);
    }
}
