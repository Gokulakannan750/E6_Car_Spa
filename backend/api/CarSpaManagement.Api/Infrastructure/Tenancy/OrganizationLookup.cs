using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Tenancy;

public static class OrganizationLookup
{
    /// <summary>
    /// Finds the active company for a company code. With no code it answers only while the server has exactly one
    /// company, so a single-company installation keeps working without anyone typing a code.
    /// </summary>
    public static async Task<Organization?> FindActiveAsync(AppDbContext db, string? companyCode, CancellationToken cancellationToken)
    {
        var code = companyCode?.Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(code))
        {
            return await db.Organizations.FirstOrDefaultAsync(o => o.Code == code && o.IsActive, cancellationToken);
        }

        var all = await db.Organizations.Where(o => o.IsActive).Take(2).ToListAsync(cancellationToken);
        return all.Count == 1 ? all[0] : null;
    }
}
