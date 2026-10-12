using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Infrastructure.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record PlatformLoginRequest(string Email, string Password);
public sealed record PlatformVerifyRequest(string ChallengeToken, string Code);

/// <summary>Step 1 result: always continue with an authenticator code; first time, set up the authenticator.</summary>
public sealed record PlatformLoginResponse(string Stage, string ChallengeToken, string? TotpSecret, string? AuthenticatorUri);

public sealed record PlatformAdminDto(Guid Id, string Email, string Name, string Role);
public sealed record PlatformSessionResponse(string Token, DateTime ExpiresAt, PlatformAdminDto Admin);

/// <summary>Sign-in for Trovo's platform administrators: email and password, then an authenticator code (always).</summary>
[ApiController]
[Route("api/platform/auth")]
public class PlatformAuthController(PlatformAdminService admins, PlatformTokenService tokens, PlatformAuditService audit) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    public async Task<ActionResult<PlatformLoginResponse>> Login([FromBody] PlatformLoginRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var step = await admins.VerifyPasswordAsync(request.Email, request.Password, cancellationToken);
            var challenge = tokens.CreateChallengeToken(step.Admin.Id);
            return step.NeedsTotpSetup
                ? Ok(new PlatformLoginResponse("totp-setup", challenge, step.TotpSecret, PlatformAdminService.AuthenticatorUri(step.Admin.Email, step.TotpSecret!)))
                : Ok(new PlatformLoginResponse("totp", challenge, null, null));
        }
        catch (UnauthorizedException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (ValidationException)
        {
            return Unauthorized(new { error = "Invalid email or password." });
        }
    }

    [HttpPost("verify")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    public async Task<ActionResult<PlatformSessionResponse>> Verify([FromBody] PlatformVerifyRequest request, CancellationToken cancellationToken)
    {
        var adminId = tokens.ReadChallengeToken(request.ChallengeToken);
        if (adminId is null)
        {
            return Unauthorized(new { error = "Sign-in expired. Please start again." });
        }

        try
        {
            var admin = await admins.VerifyTotpAsync(adminId.Value, request.Code, cancellationToken);
            var token = tokens.CreateAccessToken(admin);
            HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
                new Claim(ClaimTypes.Email, admin.Email)
            ], PlatformTokenService.Scheme));
            await audit.RecordAsync("platform.signed_in", null, null, null, null, cancellationToken);
            return Ok(new PlatformSessionResponse(token, DateTime.UtcNow.Add(PlatformTokenService.AccessLifetime),
                new PlatformAdminDto(admin.Id, admin.Email, admin.Name, admin.Role.ToString())));
        }
        catch (UnauthorizedException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpGet("me")]
    [Authorize(Policy = PlatformPolicies.Any)]
    public ActionResult<PlatformAdminDto> Me() => Ok(new PlatformAdminDto(
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
        User.FindFirstValue(ClaimTypes.Email)!,
        User.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
        User.FindFirstValue(ClaimTypes.Role)!));
}
