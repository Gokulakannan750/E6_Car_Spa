using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace CarSpaManagement.Api.Tests.TestSupport;

/// <summary>Authorization service that grants every request, for controller tests that are not about permissions.</summary>
public sealed class AllowAllAuthorizationService : IAuthorizationService
{
    public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements)
        => Task.FromResult(AuthorizationResult.Success());

    public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName)
        => Task.FromResult(AuthorizationResult.Success());
}
