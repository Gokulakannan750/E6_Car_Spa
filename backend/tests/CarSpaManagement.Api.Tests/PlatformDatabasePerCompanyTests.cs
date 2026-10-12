using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Trovo's platform on a real PostgreSQL server: every company gets its own database and its own login, a company
/// is registered once with the code Trovo gave it, and requests only ever reach the signed-in company's database.
/// Each test builds its own catalog and company databases under a random product key and removes them afterwards.
/// </summary>
public class PlatformDatabasePerCompanyTests : IAsyncLifetime
{
    private const string Password = "Platform#Test2026";

    private readonly string _productKey = "pt" + Guid.NewGuid().ToString("N")[..10];
    private ServiceProvider? _services;
    private string _catalogDatabase = string.Empty;

    public Task InitializeAsync()
    {
        var admin = PostgresTestEnvironment.AdminConnectionString;
        if (admin is null) return Task.CompletedTask;

        _catalogDatabase = $"{_productKey}_catalog";
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Platform:Enabled"] = "true",
            ["Platform:ProductKey"] = _productKey,
            ["Platform:ProductName"] = "Platform test",
            ["Platform:DirectoryCacheSeconds"] = "1",
            ["ConnectionStrings:Platform"] = new NpgsqlConnectionStringBuilder(admin) { Database = _catalogDatabase }.ConnectionString,
            ["ConnectionStrings:PlatformAdmin"] = new NpgsqlConnectionStringBuilder(admin) { Database = "postgres" }.ConnectionString,
            ["Security:EncryptionKey"] = "platform-test-encryption-key-32-chars!!",
            ["Jwt:Key"] = "company-test-signing-key-at-least-32-characters",
            ["Platform:Jwt:Key"] = "platform-test-signing-key-at-least-32-characters"
        }).Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();
        services.AddDatabase(configuration);
        services.AddSingleton<IAesEncryptionService>(new AesEncryptionService(configuration));
        services.AddScoped<IPasswordHasherService, PasswordHasherService>();
        services.AddScoped<IAuditLogService, NullAuditLogService>();
        _services = services.BuildServiceProvider();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (_services is null) return;
        NpgsqlConnection.ClearAllPools();
        await _services.DisposeAsync();

        await using var connection = new NpgsqlConnection(AdminConnection("postgres"));
        await connection.OpenAsync();
        var databases = new List<string>();
        await using (var list = new NpgsqlCommand("SELECT datname FROM pg_database WHERE datname LIKE @prefix", connection))
        {
            list.Parameters.AddWithValue("prefix", _productKey + "%");
            await using var reader = await list.ExecuteReaderAsync();
            while (await reader.ReadAsync()) databases.Add(reader.GetString(0));
        }
        foreach (var database in databases)
        {
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{database}\" WITH (FORCE)", connection);
            await drop.ExecuteNonQueryAsync();
        }
        var roles = new List<string>();
        await using (var list = new NpgsqlCommand("SELECT rolname FROM pg_roles WHERE rolname LIKE @prefix", connection))
        {
            list.Parameters.AddWithValue("prefix", _productKey + "%");
            await using var reader = await list.ExecuteReaderAsync();
            while (await reader.ReadAsync()) roles.Add(reader.GetString(0));
        }
        foreach (var role in roles)
        {
            await using var drop = new NpgsqlCommand($"DROP ROLE IF EXISTS \"{role}\"", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }

    // ── Separate databases and logins ─────────────────────────────────────────────

    [PostgresFact]
    public async Task EachCompany_GetsItsOwnDatabaseAndLogin_ThatCannotReachAnotherCompanyOrTheCatalog()
    {
        var a = await CreateCompanyAsync("Alpha Detailing");
        var b = await CreateCompanyAsync("Beta Detailing");

        Assert.NotEqual(a.Company.DatabaseName, b.Company.DatabaseName);
        Assert.NotEqual(a.Company.DatabaseUser, b.Company.DatabaseUser);

        // Its own database: it can connect and read.
        await using (var own = new NpgsqlConnection(CompanyLogin(a.Company)))
        {
            await own.OpenAsync();
            await using var read = new NpgsqlCommand("SELECT count(*) FROM \"Organizations\"", own);
            Assert.Equal(1L, (long)(await read.ExecuteScalarAsync())!);

            // ...but cannot change the schema or the migration history, and is not a superuser.
            await AssertDeniedAsync(own, "CREATE TABLE \"Intruder\" (\"Id\" int)");
            await AssertDeniedAsync(own, "DELETE FROM \"__EFMigrationsHistory\"");
            await using var super = new NpgsqlCommand("SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname = current_user", own);
            Assert.False((bool)(await super.ExecuteScalarAsync())!);
        }

        // Another company's database and Trovo's catalog refuse the login outright.
        await AssertCannotConnectAsync(CompanyLogin(a.Company, b.Company.DatabaseName));
        await AssertCannotConnectAsync(CompanyLogin(b.Company, a.Company.DatabaseName));
        await AssertCannotConnectAsync(CompanyLogin(a.Company, _catalogDatabase));
    }

    [PostgresFact]
    public async Task ANewCompanyDatabase_HoldsOnlyThatCompany_WithItsStartingData_AndThePasswordIsStoredEncrypted()
    {
        var created = await CreateCompanyAsync("Gamma Detailing");

        Assert.DoesNotContain(Decrypt(created.Company.DatabasePasswordEncrypted), created.Company.DatabasePasswordEncrypted);
        Assert.NotNull(created.Company.SchemaVersion);
        Assert.Null(created.Company.MigrationError);
        Assert.Equal(PlatformCompanyStatus.AwaitingRegistration, created.Company.Status);

        await using var connection = new NpgsqlConnection(CompanyLogin(created.Company));
        await connection.OpenAsync();
        await using var orgs = new NpgsqlCommand("SELECT \"Id\", \"Code\" FROM \"Organizations\"", connection);
        await using (var reader = await orgs.ExecuteReaderAsync())
        {
            Assert.True(await reader.ReadAsync());
            Assert.Equal(created.Company.Id, reader.GetGuid(0));
            Assert.Equal(created.Company.Code, reader.GetString(1));
            Assert.False(await reader.ReadAsync());
        }

        // Row-level security is active for the company login: without its company set, nothing is visible.
        await using var hidden = new NpgsqlCommand("SELECT count(*) FROM \"BusinessProfiles\"", connection);
        Assert.Equal(0L, (long)(await hidden.ExecuteScalarAsync())!);
        await using var set = new NpgsqlCommand($"SELECT set_config('app.current_org', '{created.Company.Id}', false)", connection);
        await set.ExecuteScalarAsync();
        Assert.Equal(1L, (long)(await hidden.ExecuteScalarAsync())!);
    }

    // ── Registration with the code Trovo gives ────────────────────────────────────

    [PostgresFact]
    public async Task Registration_WorksOnceWithTheGivenCode_TypedInAnyCase_ThenTheCompanyIsOpen()
    {
        var created = await CreateCompanyAsync("Delta Detailing");
        var typedLoosely = created.RegistrationCode.ToLowerInvariant().Replace("-", " ");

        var owner = await RegisterAsync(created.Company.Code, typedLoosely, "owner");

        Assert.Equal(created.Company.Code, owner.CompanyCode);
        Assert.True(owner.IsOwner);
        var company = await CatalogCompanyAsync(created.Company.Id);
        Assert.Equal(PlatformCompanyStatus.Active, company.Status);
        Assert.NotNull(company.RegisteredAt);

        await Assert.ThrowsAsync<ConflictException>(() => RegisterAsync(created.Company.Code, created.RegistrationCode, "second"));

        // The owner is in the company's own database, and only there.
        await using var scope = TenantScope(created.Company.Id);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(new[] { "owner" }, await db.Users.Select(u => u.Username).ToListAsync());
    }

    [PostgresFact]
    public async Task Registration_WrongCodesAreCounted_AndTooManyLockTheCode_EvenForTheRightOne()
    {
        var created = await CreateCompanyAsync("Epsilon Detailing");

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            var wrong = await Assert.ThrowsAsync<ValidationException>(() => RegisterAsync(created.Company.Code, "AAAA-BBBB-CCCC", "owner"));
            Assert.Equal("Invalid company code or registration code.", wrong.Message);
        }

        var locked = await Assert.ThrowsAsync<ValidationException>(() => RegisterAsync(created.Company.Code, created.RegistrationCode, "owner"));
        Assert.Contains("Too many wrong attempts", locked.Message);
        Assert.Equal(PlatformCompanyStatus.AwaitingRegistration, (await CatalogCompanyAsync(created.Company.Id)).Status);

        // Trovo issues a new code; that one works.
        string newCode;
        await using (var scope = _services!.CreateAsyncScope())
        {
            (newCode, _) = await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().IssueRegistrationCodeAsync(created.Company.Id);
        }
        await RegisterAsync(created.Company.Code, newCode, "owner");
    }

    [PostgresFact]
    public async Task Registration_RejectsAReplacedOrExpiredCode_AndAnUnknownCompany()
    {
        var created = await CreateCompanyAsync("Zeta Detailing");

        await Assert.ThrowsAsync<ValidationException>(() => RegisterAsync("9999", created.RegistrationCode, "owner"));

        string replacement;
        await using (var scope = _services!.CreateAsyncScope())
        {
            (replacement, _) = await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().IssueRegistrationCodeAsync(created.Company.Id);
        }
        await Assert.ThrowsAsync<ValidationException>(() => RegisterAsync(created.Company.Code, created.RegistrationCode, "owner"));

        await using (var scope = _services!.CreateAsyncScope())
        {
            var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var open = await catalog.RegistrationCodes.SingleAsync(r => r.CompanyId == created.Company.Id && r.UsedAt == null && r.RevokedAt == null);
            open.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await catalog.SaveChangesAsync();
        }
        var expired = await Assert.ThrowsAsync<ValidationException>(() => RegisterAsync(created.Company.Code, replacement, "owner"));
        Assert.Contains("expired", expired.Message);
    }

    // ── Requests reach only the signed-in company's database ──────────────────────

    [PostgresFact]
    public async Task OnlyRegisteredHealthyCompanies_CanBeSignedInTo()
    {
        var created = await CreateCompanyAsync("Eta Detailing");

        Assert.Null(await FindByCodeAsync(created.Company.Code)); // not registered yet
        await RegisterAsync(created.Company.Code, created.RegistrationCode, "owner");
        Assert.NotNull(await FindByCodeAsync(created.Company.Code));

        await SetCompanyAsync(created.Company.Id, c => c.MigrationError = "simulated failure");
        Assert.Null(await FindByCodeAsync(created.Company.Code)); // paused until its database is migrated again

        await SetCompanyAsync(created.Company.Id, c => { c.MigrationError = null; c.Status = PlatformCompanyStatus.Suspended; });
        Assert.Null(await FindByCodeAsync(created.Company.Code));
    }

    [PostgresFact]
    public async Task WorkForOneCompany_IsSavedInItsOwnDatabase_AndIsInvisibleToAnother()
    {
        var a = await CreateCompanyAsync("Theta Detailing");
        var b = await CreateCompanyAsync("Iota Detailing");
        await RegisterAsync(a.Company.Code, a.RegistrationCode, "owner");
        await RegisterAsync(b.Company.Code, b.RegistrationCode, "owner");

        await using (var scope = TenantScope(a.Company.Id))
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Customers.Add(new Customer { Id = Guid.NewGuid(), Name = "Only Alpha's customer", PhoneNumber = "9000000001", CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            Assert.Equal(1, await db.Customers.CountAsync());
        }

        await using (var scope = TenantScope(b.Company.Id))
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(0, await db.Customers.IgnoreQueryFilters().CountAsync());
        }

        await using var direct = new NpgsqlConnection(AdminConnection(b.Company.DatabaseName));
        await direct.OpenAsync();
        await using var count = new NpgsqlCommand("SELECT count(*) FROM \"Customers\"", direct);
        Assert.Equal(0L, (long)(await count.ExecuteScalarAsync())!);
    }

    [PostgresFact]
    public async Task WithNoCompanySelected_NoCompanyDatabaseIsOpened()
    {
        await CreateCompanyAsync("Kappa Detailing");

        await using var scope = _services!.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await Assert.ThrowsAsync<TenantViolationException>(() => db.Customers.CountAsync());
    }

    // ── Bringing an existing database (E6) onto the platform ──────────────────────

    [PostgresFact]
    public async Task AnExistingOneCompanyDatabase_IsAdoptedUnchanged_WithItsOwnNewLogin()
    {
        var existing = new PostgresTestDatabase();
        await existing.InitializeAsync();
        await using (var db = existing.CreateContext())
        {
            db.Customers.Add(new Customer { Id = Guid.NewGuid(), Name = "Existing customer", PhoneNumber = "9000000002", CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }
        var existingName = new NpgsqlConnectionStringBuilder(existing.ConnectionString).Database!;

        PlatformCompany adopted;
        await using (var scope = _services!.CreateAsyncScope())
        {
            adopted = await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().AdoptDatabaseAsync(existingName,
                new CompanyPlan("professional", BillingInterval.Year, new Dictionary<string, int>(), DateTime.UtcNow.AddYears(1)));
        }

        try
        {
            Assert.Equal(DefaultOrganization.Id, adopted.Id);
            Assert.Equal(DefaultOrganization.Code, adopted.Code);
            Assert.Equal(PlatformCompanyStatus.Active, adopted.Status);
            Assert.Null(adopted.MigrationError);

            await using var scope = TenantScope(adopted.Id);
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(new[] { "Existing customer" }, await db.Customers.Select(c => c.Name).ToListAsync());

            var other = await CreateCompanyAsync("Lambda Detailing");
            await AssertCannotConnectAsync(CompanyLogin(adopted, other.Company.DatabaseName));
            await AssertCannotConnectAsync(CompanyLogin(other.Company, existingName));
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await existing.DisposeAsync();
            await using var connection = new NpgsqlConnection(AdminConnection("postgres"));
            await connection.OpenAsync();
            await using var dropRole = new NpgsqlCommand($"DROP ROLE IF EXISTS \"{adopted.DatabaseUser}\"", connection);
            await dropRole.ExecuteNonQueryAsync();
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async Task<CreatedCompany> CreateCompanyAsync(string name)
    {
        await using var scope = _services!.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().CreateCompanyAsync(name);
    }

    private async Task<BootstrapOwnerResponse> RegisterAsync(string companyCode, string registrationCode, string username)
    {
        await using var scope = _services!.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<CompanyRegistrationService>().RegisterAsync(new RegisterCompanyRequest
        {
            CompanyCode = companyCode,
            RegistrationCode = registrationCode,
            FullName = "Test Owner",
            Username = username,
            Password = Password,
            ConfirmPassword = Password
        });
    }

    private async Task<CompanyRoute?> FindByCodeAsync(string code)
    {
        await using var scope = _services!.CreateAsyncScope();
        await Task.Delay(1100); // the directory caches answers for a second in these tests
        return await scope.ServiceProvider.GetRequiredService<ICompanyDirectory>().FindActiveByCodeAsync(code);
    }

    private async Task<PlatformCompany> CatalogCompanyAsync(Guid id)
    {
        await using var scope = _services!.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<PlatformDbContext>().Companies.AsNoTracking().SingleAsync(c => c.Id == id);
    }

    private async Task SetCompanyAsync(Guid id, Action<PlatformCompany> change)
    {
        await using var scope = _services!.CreateAsyncScope();
        var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        change(await catalog.Companies.SingleAsync(c => c.Id == id));
        await catalog.SaveChangesAsync();
    }

    private AsyncServiceScope TenantScope(Guid companyId)
    {
        var scope = _services!.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().Set(companyId);
        return scope;
    }

    private string Decrypt(string encrypted) => _services!.GetRequiredService<IAesEncryptionService>().Decrypt(encrypted)!;

    private string CompanyLogin(PlatformCompany company, string? database = null) =>
        new NpgsqlConnectionStringBuilder(AdminConnection(database ?? company.DatabaseName))
        {
            Username = company.DatabaseUser,
            Password = Decrypt(company.DatabasePasswordEncrypted),
            Pooling = false
        }.ConnectionString;

    private static string AdminConnection(string database) =>
        new NpgsqlConnectionStringBuilder(PostgresTestEnvironment.AdminConnectionString!) { Database = database, Pooling = false }.ConnectionString;

    private static async Task AssertCannotConnectAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        var error = await Assert.ThrowsAsync<PostgresException>(() => connection.OpenAsync());
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }

    private static async Task AssertDeniedAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        var error = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteNonQueryAsync());
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }

    private sealed class NullAuditLogService : IAuditLogService
    {
        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>> GetLogsAsync(
            Application.DTOs.Audit.AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            Task.FromResult(new Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>());
    }
}

/// <summary>Registration codes: readable, forgiving to type, stored only as a hash.</summary>
public class RegistrationCodeTests
{
    [Fact]
    public void ANewCode_HasThreeGroupsOfFour_WithoutLookalikeCharacters()
    {
        for (var i = 0; i < 200; i++)
        {
            var code = RegistrationCodes.Generate();
            Assert.Matches("^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$", code);
            Assert.DoesNotContain(code, c => "01OIL".Contains(c));
        }
    }

    [Fact]
    public void TheHash_IgnoresCaseSpacesAndDashes_ButDependsOnTheCompany()
    {
        var company = Guid.NewGuid();
        var hash = RegistrationCodes.Hash(company, "K7QM-4RTX-9PWD");

        Assert.True(RegistrationCodes.Matches(company, "k7qm 4rtx 9pwd", hash));
        Assert.True(RegistrationCodes.Matches(company, "K7QM4RTX9PWD", hash));
        Assert.False(RegistrationCodes.Matches(company, "K7QM-4RTX-9PWE", hash));
        Assert.False(RegistrationCodes.Matches(Guid.NewGuid(), "K7QM-4RTX-9PWD", hash));
        Assert.DoesNotContain("K7QM", hash);
    }
}
