using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.Extensions.DependencyInjection;

namespace CarSpaManagement.Api.Tests.TestSupport;

public static class TestScopes
{
    /// <summary>A service scope for the default company, for tests that reach into a running test server.</summary>
    public static IServiceScope CreateTestScope(this IServiceProvider services) =>
        services.GetRequiredService<IServiceScopeFactory>().CreateTenantScope(DefaultOrganization.Id);
}
