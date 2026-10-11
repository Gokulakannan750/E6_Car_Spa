using Microsoft.Extensions.DependencyInjection;

namespace CarSpaManagement.Api.Infrastructure.Tenancy;

public static class TenantScopeExtensions
{
    /// <summary>
    /// Creates a dependency-injection scope that works for one specific company. Use this whenever work runs
    /// outside a request (background sending, start-up tasks, fire-and-forget work): a plain new scope has no
    /// company, so it would see no company data.
    /// </summary>
    public static IServiceScope CreateTenantScope(this IServiceScopeFactory factory, Guid organizationId)
    {
        var scope = factory.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().Set(organizationId);
        return scope;
    }
}
