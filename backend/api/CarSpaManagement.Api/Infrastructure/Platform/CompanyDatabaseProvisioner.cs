using System.Security.Cryptography;
using CarSpaManagement.Api.Infrastructure.Platform.Products;
using System.Text;
using System.Text.RegularExpressions;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// A paid plan to start a company on (instead of the free trial): plan, interval, add-on quantities and the date it
/// is paid until.
/// </summary>
/// <summary>
/// A paid subscription to start a company on. Without <paramref name="Licences"/> a new company gets one licence for
/// both apps, and an adopted database one licence for both apps per active user (so nobody loses access).
/// </summary>
public sealed record CompanyPlan(string PlanCode, BillingInterval Interval, IReadOnlyDictionary<string, int> AddOns, DateTime PaidUntil,
    LicenceCounts? Licences = null);

/// <summary>A newly created company and the registration code to give the customer (shown only once).</summary>
public sealed record CreatedCompany(PlatformCompany Company, string RegistrationCode, DateTime RegistrationCodeExpiresAt);

/// <summary>
/// Creates and maintains company databases on Trovo's platform. Uses the privileged PlatformAdmin login; nothing
/// here is reachable from a company's sign-in.
/// </summary>
public sealed partial class CompanyDatabaseProvisioner(
    PlatformDbContext catalog,
    IAesEncryptionService encryption,
    IConfiguration configuration,
    IOptions<PlatformOptions> options,
    SubscriptionService subscriptions,
    IProductModuleRegistry modules)
{
    private PlatformOptions Options => options.Value;

    // ── Catalog ──────────────────────────────────────────────────────────────────

    /// <summary>Creates the catalog database if needed, applies its migrations and makes sure the product exists.</summary>
    public async Task<PlatformProduct> EnsureCatalogAsync(CancellationToken cancellationToken = default)
    {
        var catalogDatabase = new NpgsqlConnectionStringBuilder(catalog.Database.GetConnectionString()).Database
            ?? throw new InvalidOperationException("The Platform connection string must name a database.");
        await CreateDatabaseIfMissingAsync(catalogDatabase, cancellationToken);

        await catalog.Database.MigrateAsync(cancellationToken);
        await LockCatalogAsync(catalogDatabase, cancellationToken);

        foreach (var module in modules.All)
        {
            var existing = await catalog.Products.SingleOrDefaultAsync(p => p.Key == module.Key, cancellationToken);
            if (existing is null)
            {
                // Module defaults own first creation only. Admin edits are authoritative after that.
                existing = new PlatformProduct
                {
                    Id = Guid.NewGuid(), Key = module.Key, Name = module.Name, DatabasePrefix = module.DatabasePrefix,
                    TrialPlanCode = module.TrialPlanCode, SeatModel = module.SeatModel,
                    Capabilities = string.Join(",", module.Capabilities.OrderBy(c => c)), CreatedAt = DateTime.UtcNow
                };
                catalog.Products.Add(existing);
                await catalog.SaveChangesAsync(cancellationToken);
                Log.Information("Platform catalog: added product {ProductKey}", existing.Key);
            }
            await module.SeedCatalogAsync(catalog, existing, cancellationToken);
        }
        return await catalog.Products.SingleAsync(p => p.Key == Options.ProductKey, cancellationToken);
    }

    /// <summary>
    /// Only the catalog's own login (and the admin) may connect to the catalog; company logins may not, even though
    /// they would find no tables they can read.
    /// </summary>
    private async Task LockCatalogAsync(string catalogDatabase, CancellationToken cancellationToken)
    {
        await ExecuteAdminAsync(null, $"REVOKE ALL ON DATABASE {Quote(catalogDatabase)} FROM PUBLIC", cancellationToken);
        var catalogLogin = new NpgsqlConnectionStringBuilder(catalog.Database.GetConnectionString()).Username;
        var adminLogin = new NpgsqlConnectionStringBuilder(CompanyConnectionStrings.ForAdmin(configuration)).Username;
        if (!string.IsNullOrEmpty(catalogLogin) && !string.Equals(catalogLogin, adminLogin, StringComparison.Ordinal))
        {
            await ExecuteAdminAsync(null, $"GRANT CONNECT ON DATABASE {Quote(catalogDatabase)} TO {Quote(catalogLogin)}", cancellationToken);
        }
    }

    // ── New company ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates a company: the next code, its own database and login, all migrations, starting data, its subscription
    /// (the free trial, or <paramref name="plan"/> when Trovo was already paid) and a one-time registration code.
    /// If anything fails, the half-made company, database and login are removed again.
    /// </summary>
    public async Task<CreatedCompany> CreateCompanyAsync(string name, CompanyPlan? plan = null, CancellationToken cancellationToken = default)
        => await CreateCompanyAsync(Options.ProductKey, name, plan, cancellationToken);

    public async Task<CreatedCompany> CreateCompanyAsync(string productKey, string name, CompanyPlan? plan = null, CancellationToken cancellationToken = default)
    {
        modules.Get(productKey);
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("A company name is required.", nameof(name));
        }

        await EnsureCatalogAsync(cancellationToken);
        var product = await catalog.Products.SingleAsync(p => p.Key == productKey, cancellationToken);
        if (await catalog.Products.AnyAsync(p => p.Id != product.Id && p.DatabasePrefix == product.DatabasePrefix, cancellationToken))
            throw new InvalidOperationException("The product database prefix is already used by another product.");
        var code = await NextCodeAsync(product.Id, cancellationToken);
        var databaseName = DatabaseNameFor(product, code);
        var company = new PlatformCompany
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            Code = code,
            Name = name.Trim(),
            Status = PlatformCompanyStatus.AwaitingRegistration,
            DatabaseName = databaseName,
            DatabaseUser = databaseName,
            CreatedAt = DateTime.UtcNow
        };

        var password = NewDatabasePassword();
        company.DatabasePasswordEncrypted = encryption.Encrypt(password)
            ?? throw new InvalidOperationException("The server encryption key is not configured.");

        var createdDatabase = false;
        var createdLogin = false;
        try
        {
            await ExecuteAdminAsync(null, $"CREATE ROLE {Quote(company.DatabaseUser)} LOGIN PASSWORD '{password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION", cancellationToken);
            createdLogin = true;
            await ExecuteAdminAsync(null, $"CREATE DATABASE {Quote(databaseName)}", cancellationToken);
            createdDatabase = true;

            catalog.Companies.Add(company);
            await catalog.SaveChangesAsync(cancellationToken);

            await MigrateCompanyAsync(company, cancellationToken);
            if (company.MigrationError is not null)
            {
                throw new InvalidOperationException($"The new company database could not be prepared: {company.MigrationError}");
            }

            var (registrationCode, expiresAt) = await IssueRegistrationCodeAsync(company.Id, cancellationToken);
            await StartSubscriptionAsync(company, plan, cancellationToken);
            Log.Information("Platform: created company {Code} ({Name}) with database {Database}", company.Code, company.Name, databaseName);
            return new CreatedCompany(company, registrationCode, expiresAt);
        }
        catch
        {
            Log.Error("Platform: creating company {Code} failed; removing its database and login", code);
            catalog.ChangeTracker.Clear();
            try
            {
                await catalog.Subscriptions.Where(s => s.CompanyId == company.Id).ExecuteDeleteAsync(CancellationToken.None);
                await catalog.BillingAccounts.Where(b => b.CompanyId == company.Id).ExecuteDeleteAsync(CancellationToken.None);
                await catalog.Companies.Where(c => c.Id == company.Id).ExecuteDeleteAsync(CancellationToken.None);
            }
            catch { /* reported by the caller */ }
            if (createdDatabase)
            {
                try { await ExecuteAdminAsync(null, $"DROP DATABASE IF EXISTS {Quote(databaseName)} WITH (FORCE)", CancellationToken.None); } catch { }
            }
            if (createdLogin)
            {
                try { await ExecuteAdminAsync(null, $"DROP ROLE IF EXISTS {Quote(company.DatabaseUser)}", CancellationToken.None); } catch { }
            }
            throw;
        }
    }

    /// <summary>
    /// Brings an existing single-company database (for example E6's) onto the platform without copying or changing
    /// its data: the company keeps its id and code, and the database gets its own new login.
    /// </summary>
    public async Task<PlatformCompany> AdoptDatabaseAsync(string databaseName, CompanyPlan plan, CancellationToken cancellationToken = default)
    {
        // Adoption reads a Car Spa schema and is deliberately unavailable to external modules.
        if (modules.Get(Options.ProductKey) is not CarSpaProductModule)
            throw new InvalidOperationException("Database adoption is supported only for Car Spa.");
        ValidateIdentifier(databaseName, allowExisting: true);
        var product = await EnsureCatalogAsync(cancellationToken);

        if (await catalog.Companies.AnyAsync(c => c.DatabaseName == databaseName, cancellationToken))
        {
            throw new InvalidOperationException($"Database '{databaseName}' is already on the platform.");
        }

        // The database's own company record says who it belongs to.
        Organization organization;
        int activeUsers;
        await using (var db = CreateAdminContext(databaseName, Guid.Empty))
        {
            var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).ToList();
            if (pending.Count > 0)
            {
                await db.Database.MigrateAsync(cancellationToken);
            }

            var organizations = await db.Organizations.AsNoTracking().ToListAsync(cancellationToken);
            if (organizations.Count != 1)
            {
                throw new InvalidOperationException(
                    $"Database '{databaseName}' holds {organizations.Count} companies; only a database with exactly one company can be adopted.");
            }
            organization = organizations[0];
            activeUsers = await db.Users.IgnoreQueryFilters().CountAsync(u => u.IsActive && !u.IsDeleted, cancellationToken);
        }

        if (await catalog.Companies.AnyAsync(c => c.Id == organization.Id || (c.ProductId == product.Id && c.Code == organization.Code), cancellationToken))
        {
            throw new InvalidOperationException($"A company with id {organization.Id} or code {organization.Code} is already on the platform.");
        }

        var login = DatabaseNameFor(product, organization.Code);
        var password = NewDatabasePassword();
        await ExecuteAdminAsync(null, $"CREATE ROLE {Quote(login)} LOGIN PASSWORD '{password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION", cancellationToken);

        var company = new PlatformCompany
        {
            Id = organization.Id,
            ProductId = product.Id,
            Code = organization.Code,
            Name = organization.Name,
            Status = PlatformCompanyStatus.Active,
            DatabaseName = databaseName,
            DatabaseUser = login,
            DatabasePasswordEncrypted = encryption.Encrypt(password)
                ?? throw new InvalidOperationException("The server encryption key is not configured."),
            CreatedAt = DateTime.UtcNow,
            RegisteredAt = DateTime.UtcNow
        };
        catalog.Companies.Add(company);
        await catalog.SaveChangesAsync(cancellationToken);

        await MigrateCompanyAsync(company, cancellationToken);
        await StartSubscriptionAsync(company, plan with { Licences = plan.Licences ?? new LicenceCounts(0, 0, Math.Max(1, activeUsers)) }, cancellationToken);
        Log.Information("Platform: adopted database {Database} as company {Code}", databaseName, company.Code);
        return company;
    }

    // ── Migrations ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Migrates every company database, one at a time. A failure is recorded on that company (which pauses its
    /// sign-in) and the others carry on.
    /// </summary>
    /// <summary>The default rollout is restricted to this API's runtime product. Pass an explicit null only for an operator-requested all-product rollout.</summary>
    public async Task<IReadOnlyList<PlatformCompany>> MigrateAllAsync(CancellationToken cancellationToken = default)
        => await MigrateAllAsync(Options.ProductKey, cancellationToken);

    public async Task<IReadOnlyList<PlatformCompany>> MigrateAllAsync(string? productKey, CancellationToken cancellationToken = default)
    {
        if (productKey is not null) modules.Get(productKey);
        await EnsureCatalogAsync(cancellationToken);
        var companies = await catalog.Companies.Include(c => c.Product)
            .Where(c => (productKey == null || c.Product!.Key == productKey) && c.Status != PlatformCompanyStatus.Suspended)
            .OrderBy(c => c.Code).ToListAsync(cancellationToken);
        foreach (var company in companies)
        {
            await MigrateCompanyAsync(company, cancellationToken);
        }

        // A company created before subscriptions existed gets the free trial, so it is never left without one.
        var withoutSubscription = await catalog.Companies
            .Where(c => (productKey == null || c.Product!.Key == productKey) && !catalog.Subscriptions.Any(s => s.CompanyId == c.Id && s.IsCurrent))
            .ToListAsync(cancellationToken);
        foreach (var company in withoutSubscription)
        {
            await subscriptions.StartTrialAsync(company, SubscriptionActor.System, cancellationToken);
            Log.Warning("Platform: company {Code} had no subscription; started the free trial", company.Code);
        }
        return companies;
    }

    private async Task StartSubscriptionAsync(PlatformCompany company, CompanyPlan? plan, CancellationToken cancellationToken)
    {
        if (plan is null)
        {
            await subscriptions.StartTrialAsync(company, SubscriptionActor.System, cancellationToken);
            return;
        }

        var now = DateTime.UtcNow;
        await subscriptions.StartPaidAsync(company, plan.PlanCode, plan.Interval, plan.AddOns, plan.Licences ?? new LicenceCounts(0, 0, 1),
            now, plan.PaidUntil, SubscriptionActor.System, cancellationToken);
    }

    /// <summary>
    /// Applies migrations to one company database as the privileged login, gives the company's login its rights,
    /// makes sure the database's own company record and starting data exist, and records the outcome.
    /// </summary>
    public async Task MigrateCompanyAsync(PlatformCompany company, CancellationToken cancellationToken = default)
    {
        try
        {
            var product = await catalog.Products.SingleAsync(p => p.Id == company.ProductId, cancellationToken);
            var module = modules.Get(product.Key);
            if (module is ExternalCommandProductModule && !company.DatabaseName.StartsWith(product.DatabasePrefix + "_t_", StringComparison.Ordinal))
                throw new InvalidOperationException("The company database does not belong to its product prefix.");
            company.SchemaVersion = await module.MigrateCompanyDatabaseAsync(new ProvisionContext(
                company.Id, company.Code, company.Name, company.DatabaseName,
                database => database == company.DatabaseName
                    ? CompanyConnectionStrings.ForAdmin(configuration, database)
                    : throw new InvalidOperationException("A product module can provision only the assigned company database.")), cancellationToken);

            await GrantCompanyLoginAsync(company, cancellationToken);
            company.MigrationError = null;
            company.LastMigratedAt = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Platform: migrating company {Code} ({Database}) failed", company.Code, company.DatabaseName);
            company.MigrationError = Truncate(ex.Message, 1000);
        }

        if (catalog.Entry(company).State != EntityState.Detached)
        {
            await catalog.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>
    /// The company's login may connect only to its own database and may only read and change data there (no schema
    /// changes, no other databases). Re-applied after every migration so new tables are covered.
    /// </summary>
    private async Task GrantCompanyLoginAsync(PlatformCompany company, CancellationToken cancellationToken)
    {
        var database = Quote(company.DatabaseName);
        var login = Quote(company.DatabaseUser);
        await ExecuteAdminAsync(null, $"REVOKE ALL ON DATABASE {database} FROM PUBLIC", cancellationToken);
        await ExecuteAdminAsync(null, $"GRANT CONNECT, TEMPORARY ON DATABASE {database} TO {login}", cancellationToken);
        await ExecuteAdminAsync(company.DatabaseName, $"""
            REVOKE CREATE ON SCHEMA public FROM PUBLIC;
            GRANT USAGE ON SCHEMA public TO {login};
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {login};
            GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO {login};
            GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO {login};
            DO $grant$ BEGIN
                IF to_regclass('public."__EFMigrationsHistory"') IS NOT NULL THEN
                    REVOKE ALL ON TABLE "__EFMigrationsHistory" FROM {login};
                    GRANT SELECT ON TABLE "__EFMigrationsHistory" TO {login};
                END IF;
            END $grant$;
            """, cancellationToken);
    }

    // ── Registration codes ───────────────────────────────────────────────────────

    /// <summary>Issues a new one-time registration code for a company (any earlier unused code stops working).</summary>
    public async Task<(string Code, DateTime ExpiresAt)> IssueRegistrationCodeAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var open = await catalog.RegistrationCodes
            .Where(r => r.CompanyId == companyId && r.UsedAt == null && r.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var old in open)
        {
            old.RevokedAt = now;
        }

        var code = RegistrationCodes.Generate();
        var expiresAt = now.AddDays(Math.Max(1, Options.RegistrationCodeValidDays));
        catalog.RegistrationCodes.Add(new PlatformRegistrationCode
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            CodeHash = RegistrationCodes.Hash(companyId, code),
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await catalog.SaveChangesAsync(cancellationToken);
        return (code, expiresAt);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private AppDbContext CreateAdminContext(string databaseName, Guid companyId)
    {
        var adminOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(CompanyConnectionStrings.ForAdmin(configuration, databaseName),
                npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(new TenantSessionInterceptor())
            .Options;
        return new AppDbContext(adminOptions, companyId == Guid.Empty ? NoTenantContext.Instance : new FixedTenantContext(companyId));
    }

    private async Task<string> NextCodeAsync(Guid productId, CancellationToken cancellationToken)
    {
        var codes = await catalog.Companies.Where(c => c.ProductId == productId).Select(c => c.Code).ToListAsync(cancellationToken);
        var highest = codes.Select(c => int.TryParse(c, out var n) ? n : 0).DefaultIfEmpty(0).Max();
        return Organization.FormatCode(highest + 1);
    }

    private static string DatabaseNameFor(PlatformProduct product, string code)
    {
        var name = $"{product.DatabasePrefix}_t_{code}".ToLowerInvariant();
        ValidateIdentifier(name, allowExisting: false);
        return name;
    }

    private async Task CreateDatabaseIfMissingAsync(string databaseName, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(CompanyConnectionStrings.ForAdmin(configuration, "postgres"));
        await connection.OpenAsync(cancellationToken);
        await using var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @name", connection);
        exists.Parameters.AddWithValue("name", databaseName);
        if (await exists.ExecuteScalarAsync(cancellationToken) is null)
        {
            ValidateIdentifier(databaseName, allowExisting: true);
            await using var create = new NpgsqlCommand($"CREATE DATABASE {Quote(databaseName)}", connection);
            await create.ExecuteNonQueryAsync(cancellationToken);
            Log.Information("Platform: created catalog database {Database}", databaseName);
        }
    }

    private async Task ExecuteAdminAsync(string? database, string sql, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(CompanyConnectionStrings.ForAdmin(configuration, database ?? "postgres"));
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <summary>Random letters and digits only, so it is safe inside the CREATE ROLE statement.</summary>
    private static string NewDatabasePassword() =>
        RandomNumberGenerator.GetString("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", 40);

    private static void ValidateIdentifier(string name, bool allowExisting)
    {
        var pattern = allowExisting ? SafeExistingIdentifier() : SafeNewIdentifier();
        if (!pattern.IsMatch(name))
        {
            throw new ArgumentException($"'{name}' is not an allowed database name.");
        }
    }

    private static string Quote(string identifier)
    {
        ValidateIdentifier(identifier, allowExisting: true);
        return "\"" + identifier + "\"";
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];

    [GeneratedRegex("^[a-z][a-z0-9_]{2,62}$")]
    private static partial Regex SafeNewIdentifier();

    [GeneratedRegex("^[A-Za-z][A-Za-z0-9_]{1,62}$")]
    private static partial Regex SafeExistingIdentifier();
}

/// <summary>One-time registration codes: easy to read aloud and type, stored only as a hash.</summary>
public static class RegistrationCodes
{
    // No 0/O, 1/I/L, so a code read over the phone is not mistyped.
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    /// <summary>A new code such as "K7QM-4RTX-9PWD" (about 59 bits of randomness).</summary>
    public static string Generate()
    {
        var raw = RandomNumberGenerator.GetString(Alphabet, 12);
        return $"{raw[..4]}-{raw[4..8]}-{raw[8..]}";
    }

    /// <summary>Ignores dashes, spaces and letter case, so "k7qm 4rtx 9pwd" matches "K7QM-4RTX-9PWD".</summary>
    public static string Normalize(string? code) =>
        new((code ?? string.Empty).ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());

    public static string Hash(Guid companyId, string code)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{companyId:N}:{Normalize(code)}"));
        return Convert.ToHexString(bytes);
    }

    public static bool Matches(Guid companyId, string? code, string storedHash) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(Hash(companyId, code ?? string.Empty)),
            Encoding.ASCII.GetBytes(storedHash));
}
