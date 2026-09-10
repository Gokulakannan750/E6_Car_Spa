using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CarSpaManagement.Api.Controllers;

/// <summary>
/// Public endpoint for retrieving business branding (business name and logo) anonymously.
/// Safe for pre-login and public invoice views without exposing internal configuration.
/// </summary>
[ApiController]
[Route("api/public/business-profile")]
[AllowAnonymous]
[EnableRateLimiting("public-invoice")]
public class PublicBusinessProfileController(IBusinessProfileService profileService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PublicBusinessProfileDto>> GetPublicProfile(CancellationToken ct)
    {
        var profile = await profileService.GetPublicProfileAsync(ct);
        return Ok(profile);
    }
}
