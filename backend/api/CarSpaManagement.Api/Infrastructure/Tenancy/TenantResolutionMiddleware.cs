using CarSpaManagement.Api.Application.Services;

namespace CarSpaManagement.Api.Infrastructure.Tenancy;

/// <summary>
/// Sets the request's company from the verified sign-in token. It runs after authentication. A request with no
/// company in its token (including tokens issued before companies existed) is left without one, so it sees no
/// company data and the user simply signs in again.
/// </summary>
public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, TenantContext tenant)
    {
        if (context.User.Identity?.IsAuthenticated == true &&
            Guid.TryParse(context.User.FindFirst(JwtTokenService.OrganizationClaim)?.Value, out var organizationId) &&
            organizationId != Guid.Empty)
        {
            tenant.Set(organizationId);
        }

        await next(context);
    }
}
