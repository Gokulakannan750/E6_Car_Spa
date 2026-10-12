using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Npgsql;

namespace CarSpaManagement.Api.Infrastructure.Tenancy;

/// <summary>A company that can be worked for, and how to reach its data.</summary>
/// <param name="ConnectionString">The company's own database connection, or null when all companies share the
/// default database (single-database mode).</param>
public sealed record CompanyRoute(Guid Id, string Code, string Name, string? ConnectionString);

/// <summary>
/// Finds companies. In single-database mode they are rows of the one database; on the platform they come from
/// Trovo's catalog, each with its own database.
/// </summary>
public interface ICompanyDirectory
{
    /// <summary>The active company for a sign-in code. With no code, the only active company, if there is exactly one.</summary>
    Task<CompanyRoute?> FindActiveByCodeAsync(string? companyCode, CancellationToken cancellationToken = default);

    /// <summary>The active company with this id (from a verified sign-in token), or null.</summary>
    Task<CompanyRoute?> FindActiveByIdAsync(Guid companyId, CancellationToken cancellationToken = default);

    /// <summary>Every active company, for background work and start-up tasks.</summary>
    Task<IReadOnlyList<CompanyRoute>> ListActiveAsync(CancellationToken cancellationToken = default);
}

/// <summary>The original layout: every company in the one database.</summary>
public sealed class SingleDatabaseCompanyDirectory(AppDbContext db) : ICompanyDirectory
{
    public async Task<CompanyRoute?> FindActiveByCodeAsync(string? companyCode, CancellationToken cancellationToken = default)
    {
        var organization = await OrganizationLookup.FindActiveAsync(db, companyCode, cancellationToken);
        return organization is null ? null : new CompanyRoute(organization.Id, organization.Code, organization.Name, null);
    }

    public async Task<CompanyRoute?> FindActiveByIdAsync(Guid companyId, CancellationToken cancellationToken = default) =>
        await db.Organizations.Where(o => o.Id == companyId && o.IsActive)
            .Select(o => new CompanyRoute(o.Id, o.Code, o.Name, null))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<CompanyRoute>> ListActiveAsync(CancellationToken cancellationToken = default) =>
        await db.Organizations.Where(o => o.IsActive)
            .Select(o => new CompanyRoute(o.Id, o.Code, o.Name, null))
            .ToListAsync(cancellationToken);
}

/// <summary>
/// Trovo's platform: companies come from the catalog, and each one is reached through its own database with its
/// own login. Only registered (Active) companies whose last migration succeeded can be worked for.
/// </summary>
public sealed class PlatformCompanyDirectory(
    PlatformDbContext catalog,
    IAesEncryptionService encryption,
    IConfiguration configuration,
    IMemoryCache cache,
    IOptions<PlatformOptions> options) : ICompanyDirectory
{
    private PlatformOptions Options => options.Value;

    public async Task<CompanyRoute?> FindActiveByCodeAsync(string? companyCode, CancellationToken cancellationToken = default)
    {
        var code = companyCode?.Trim().ToUpperInvariant();
        var companies = Usable(await ProductCompaniesAsync(cancellationToken));

        if (!string.IsNullOrEmpty(code))
        {
            var match = await companies.FirstOrDefaultAsync(c => c.Code == code, cancellationToken);
            return match is null ? null : ToRoute(match);
        }

        var only = await companies.Take(2).ToListAsync(cancellationToken);
        return only.Count == 1 ? ToRoute(only[0]) : null;
    }

    public async Task<CompanyRoute?> FindActiveByIdAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var key = $"platform-company:{companyId}";
        if (cache.TryGetValue(key, out CompanyRoute? cached))
        {
            return cached;
        }

        var company = await Usable(await ProductCompaniesAsync(cancellationToken))
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);
        var route = company is null ? null : ToRoute(company);
        cache.Set(key, route, TimeSpan.FromSeconds(Math.Max(1, Options.DirectoryCacheSeconds)));
        return route;
    }

    public async Task<IReadOnlyList<CompanyRoute>> ListActiveAsync(CancellationToken cancellationToken = default)
    {
        var companies = await Usable(await ProductCompaniesAsync(cancellationToken))
            .OrderBy(c => c.Code)
            .ToListAsync(cancellationToken);
        return companies.Select(ToRoute).ToList();
    }

    private async Task<IQueryable<PlatformCompany>> ProductCompaniesAsync(CancellationToken cancellationToken)
    {
        var productId = await catalog.Products.Where(p => p.Key == Options.ProductKey).Select(p => p.Id)
            .FirstOrDefaultAsync(cancellationToken);
        return catalog.Companies.AsNoTracking().Where(c => c.ProductId == productId);
    }

    private static IQueryable<PlatformCompany> Usable(IQueryable<PlatformCompany> companies) =>
        companies.Where(c => c.Status == PlatformCompanyStatus.Active && c.MigrationError == null);

    private CompanyRoute ToRoute(PlatformCompany company) =>
        new(company.Id, company.Code, company.Name, CompanyConnectionStrings.ForCompanyLogin(configuration, company, encryption));
}

/// <summary>Builds connection strings for company databases. Passwords are decrypted only here, in memory.</summary>
public static class CompanyConnectionStrings
{
    /// <summary>The privileged login's connection, pointed at the given database (or its configured one).</summary>
    public static string ForAdmin(IConfiguration configuration, string? database = null)
    {
        var adminConnection = configuration.GetConnectionString("PlatformAdmin")
            ?? throw new InvalidOperationException("Connection string 'PlatformAdmin' is required when the platform is enabled.");
        var builder = new NpgsqlConnectionStringBuilder(adminConnection);
        if (database is not null)
        {
            builder.Database = database;
        }
        return builder.ConnectionString;
    }

    /// <summary>The company's own login against the company's own database, on the same server as the admin login.</summary>
    public static string ForCompanyLogin(IConfiguration configuration, PlatformCompany company, IAesEncryptionService encryption)
    {
        var builder = new NpgsqlConnectionStringBuilder(ForAdmin(configuration, company.DatabaseName))
        {
            Username = company.DatabaseUser,
            Password = encryption.Decrypt(company.DatabasePasswordEncrypted)
                ?? throw new InvalidOperationException($"The database password of company {company.Code} cannot be read."),
            // Each company gets its own small pool; the server holds no idle connections for quiet companies.
            MaxPoolSize = 20,
            ConnectionIdleLifetime = 120
        };
        return builder.ConnectionString;
    }
}
