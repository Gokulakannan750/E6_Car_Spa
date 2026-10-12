using System.Data.Common;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace CarSpaManagement.Api.Infrastructure.Tenancy;

/// <summary>
/// On the platform, points each database connection at the current company's own database, with that company's own
/// login, just before it opens. The company comes from the context (set from the verified sign-in token or by
/// trusted server code), so business code never chooses a database itself. With no company, nothing opens.
/// </summary>
public sealed class TenantConnectionInterceptor(ICompanyDirectory directory, TenantContext? requestTenant = null) : DbConnectionInterceptor
{
    public override InterceptionResult ConnectionOpening(DbConnection connection, ConnectionEventData eventData, InterceptionResult result)
    {
        Point(connection, ResolveAsync(eventData, CancellationToken.None).GetAwaiter().GetResult());
        return result;
    }

    public override async ValueTask<InterceptionResult> ConnectionOpeningAsync(DbConnection connection, ConnectionEventData eventData,
        InterceptionResult result, CancellationToken cancellationToken = default)
    {
        Point(connection, await ResolveAsync(eventData, cancellationToken));
        return result;
    }

    private async Task<string> ResolveAsync(ConnectionEventData eventData, CancellationToken cancellationToken)
    {
        var companyId = eventData.Context is AppDbContext db ? db.CurrentOrganizationId : Guid.Empty;
        if (companyId == Guid.Empty)
        {
            throw new TenantViolationException("No company has been selected, so no company database can be opened.");
        }

        // Registration reaches a company that is not open for sign-in yet, through the connection it was given.
        if (requestTenant is { ConnectionOverride: { } overridden } && requestTenant.OrganizationId == companyId)
        {
            return overridden;
        }

        var route = await directory.FindActiveByIdAsync(companyId, cancellationToken);
        if (route?.ConnectionString is null)
        {
            throw new TenantViolationException("The company is not available.");
        }

        return route.ConnectionString;
    }

    private static void Point(DbConnection connection, string connectionString)
    {
        if (!string.Equals(connection.ConnectionString, connectionString, StringComparison.Ordinal))
        {
            connection.ConnectionString = connectionString;
        }
    }
}
