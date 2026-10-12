using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>Single-company server: links in the company database, visible only to their two companies (row rules).</summary>
public sealed class CompanyDatabaseFranchiseLinkStore(AppDbContext db) : IFranchiseLinkStore
{
    public bool InCompanyDatabase => true;
    public IQueryable<FranchiseLink> Links => db.FranchiseLinks;
    public void Add(FranchiseLink link) => db.FranchiseLinks.Add(link);
    public void AddScope(FranchiseLinkScope scope) => db.FranchiseLinkScopes.Add(scope);
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => db.SaveChangesAsync(cancellationToken);

    public async Task<FranchisePartner?> FindActiveCompanyByCodeAsync(string code, CancellationToken cancellationToken = default) =>
        await db.Organizations.AsNoTracking()
            .Where(o => o.Code == code && o.IsActive)
            .Select(o => new FranchisePartner(o.Id, o.Code, o.Name))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, FranchisePartner>> GetCompaniesAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default)
    {
        var list = ids.Distinct().ToList();
        return await db.Organizations.AsNoTracking().Where(o => list.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, o => new FranchisePartner(o.Id, o.Code, o.Name), cancellationToken);
    }
}

/// <summary>
/// Trovo's platform: links in the catalog. The catalog holds every company's links, so this store itself limits
/// every query to the signed-in company's own links; with no company signed in it returns nothing.
/// </summary>
public sealed class CatalogFranchiseLinkStore(PlatformDbContext catalog, ITenantContext tenant, IOptions<PlatformOptions> options) : IFranchiseLinkStore
{
    public bool InCompanyDatabase => false;

    public IQueryable<FranchiseLink> Links
    {
        get
        {
            var me = tenant.OrganizationId ?? Guid.Empty;
            return catalog.FranchiseLinks.Where(l => me != Guid.Empty && (l.FranchisorOrganizationId == me || l.FranchiseeOrganizationId == me));
        }
    }

    public void Add(FranchiseLink link) => catalog.FranchiseLinks.Add(link);
    public void AddScope(FranchiseLinkScope scope) => catalog.FranchiseLinkScopes.Add(scope);
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => catalog.SaveChangesAsync(cancellationToken);

    public async Task<FranchisePartner?> FindActiveCompanyByCodeAsync(string code, CancellationToken cancellationToken = default) =>
        await catalog.Companies.AsNoTracking()
            .Where(c => c.Product!.Key == options.Value.ProductKey && c.Code == code
                        && c.Status == PlatformCompanyStatus.Active && c.MigrationError == null)
            .Select(c => new FranchisePartner(c.Id, c.Code, c.Name))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, FranchisePartner>> GetCompaniesAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default)
    {
        var list = ids.Distinct().ToList();
        return await catalog.Companies.AsNoTracking().Where(c => list.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => new FranchisePartner(c.Id, c.Code, c.Name), cancellationToken);
    }
}
