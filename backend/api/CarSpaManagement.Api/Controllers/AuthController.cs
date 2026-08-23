using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [HttpGet("status")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthStatusDto>> GetStatus(CancellationToken cancellationToken)
    {
        var status = await authService.GetStatusAsync(cancellationToken);
        return Ok(status);
    }

    [HttpPost("bootstrap")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthUserDto>> BootstrapOwner([FromBody] BootstrapOwnerRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var owner = await authService.BootstrapOwnerAsync(request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, owner);
        }
        catch (ConflictException ex)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { error = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await authService.LoginAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (UnauthorizedException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthUserDto>> GetMe(CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { error = "Invalid user identifier in token." });
        }

        try
        {
            var user = await authService.GetCurrentUserAsync(userId, cancellationToken);
            return Ok(user);
        }
        catch (UnauthorizedException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }
}
