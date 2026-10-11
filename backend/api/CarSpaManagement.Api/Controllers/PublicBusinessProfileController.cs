using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
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
public class PublicBusinessProfileController(
    IBusinessProfileService profileService,
    TenantContext? tenant = null,
    AppDbContext? db = null) : ControllerBase
{
    /// <summary>
    /// The company's public branding for the sign-in page. The company comes from <c>companyCode</c>; with no code it
    /// is the only company on the server, if there is exactly one. An unknown code and a server with no company yet
    /// both get the same neutral, empty answer, so codes cannot be probed.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PublicBusinessProfileDto>> GetPublicProfile([FromQuery] string? companyCode, CancellationToken ct)
    {
        if (tenant is not null && db is not null)
        {
            var organization = await OrganizationLookup.FindActiveAsync(db, companyCode, ct);
            if (organization is null)
            {
                return Ok(new PublicBusinessProfileDto(string.Empty, null, null));
            }

            tenant.Set(organization.Id);
        }

        var profile = await profileService.GetPublicProfileAsync(ct);
        return Ok(profile);
    }
}
