using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace CarSpaManagement.Api.Tests.TestSupport;

/// <summary>
/// A throwaway Trovo platform on the test PostgreSQL server: its own catalog and company databases under a random
/// product key, all removed again afterwards. Used by the platform tests.
/// </summary>
public sealed class PlatformTestEnvironment : IAsyncDisposable
{
    public const string OwnerPassword = "Platform#Test2026";

    public string ProductKey { get; } = "pt" + Guid.NewGuid().ToString("N")[..10];
    public string CatalogDatabase => $"{ProductKey}_catalog";
    public ServiceProvider Services { get; }
    public IReadOnlyDictionary<string, string?> Settings { get; }

    public PlatformTestEnvironment(Action<DbContextOptionsBuilder>? configureCatalog = null)
    {
        var admin = PostgresTestEnvironment.AdminConnectionString
            ?? throw new InvalidOperationException("Platform tests need a PostgreSQL server.");

        Settings = new Dictionary<string, string?>
        {
            ["Platform:Enabled"] = "true",
            ["Platform:ProductKey"] = ProductKey,
            ["Platform:ProductName"] = "Platform test",
            ["Platform:DirectoryCacheSeconds"] = "1",
            ["ConnectionStrings:Platform"] = new NpgsqlConnectionStringBuilder(admin) { Database = CatalogDatabase }.ConnectionString,
            ["ConnectionStrings:PlatformAdmin"] = new NpgsqlConnectionStringBuilder(admin) { Database = "postgres" }.ConnectionString,
            ["Security:EncryptionKey"] = "platform-test-encryption-key-32-chars!!",
            ["Jwt:Key"] = "company-test-signing-key-at-least-32-characters",
            ["Platform:Jwt:Key"] = "platform-test-signing-key-at-least-32-characters"
        };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(Settings).Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();
        services.AddHttpContextAccessor();
        services.AddDatabase(configuration);
        if (configureCatalog is not null) services.AddDbContext<PlatformDbContext>(configureCatalog);
        services.AddSingleton<IAesEncryptionService>(new AesEncryptionService(configuration));
        services.AddScoped<IPasswordHasherService, PasswordHasherService>();
        services.AddScoped<IAuditLogService, NullAuditLogService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<PlatformAuditService>();
        services.AddSingleton<Microsoft.Extensions.Hosting.IHostEnvironment>(new TestHostEnvironment());
        Services = services.BuildServiceProvider();
    }

    public AsyncServiceScope Scope() => Services.CreateAsyncScope();

    /// <summary>A scope working for one company (its own database), as a signed-in request would.</summary>
    public AsyncServiceScope CompanyScope(Guid companyId)
    {
        var scope = Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().Set(companyId);
        return scope;
    }

    public async Task<CreatedCompany> CreateCompanyAsync(string name, CompanyPlan? plan = null)
    {
        await using var scope = Scope();
        return await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().CreateCompanyAsync(name, plan);
    }

    /// <summary>Creates and registers a company, so it can be signed in to. Returns the company.</summary>
    public async Task<PlatformCompany> CreateRegisteredCompanyAsync(string name, CompanyPlan? plan = null, string username = "owner")
    {
        var created = await CreateCompanyAsync(name, plan);
        await RegisterAsync(created.Company.Code, created.RegistrationCode, username);
        return created.Company;
    }

    public async Task<BootstrapOwnerResponse> RegisterAsync(string companyCode, string registrationCode, string username)
    {
        await using var scope = Scope();
        return await scope.ServiceProvider.GetRequiredService<CompanyRegistrationService>().RegisterAsync(new RegisterCompanyRequest
        {
            CompanyCode = companyCode,
            RegistrationCode = registrationCode,
            FullName = "Test Owner",
            Username = username,
            Password = OwnerPassword,
            ConfirmPassword = OwnerPassword
        });
    }

    public async Task<T> WithCatalogAsync<T>(Func<PlatformDbContext, Task<T>> work)
    {
        await using var scope = Scope();
        return await work(scope.ServiceProvider.GetRequiredService<PlatformDbContext>());
    }

    public async Task WithSubscriptionsAsync(Func<SubscriptionService, Task> work)
    {
        await using var scope = Scope();
        await work(scope.ServiceProvider.GetRequiredService<SubscriptionService>());
    }

    /// <summary>Edits the current subscription row directly (to move time-based dates into the past in tests).</summary>
    public async Task EditSubscriptionAsync(Guid companyId, Action<Subscription> change)
    {
        await using var scope = Scope();
        var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        change(await catalog.Subscriptions.SingleAsync(s => s.CompanyId == companyId && s.IsCurrent));
        await catalog.SaveChangesAsync();
    }

    public async Task<CompanyEntitlements> EntitlementsAsync(Guid companyId)
    {
        await using var scope = Scope();
        var service = scope.ServiceProvider.GetRequiredService<IEntitlementService>();
        service.Invalidate(companyId);
        return await service.GetForCompanyAsync(companyId);
    }

    public string Decrypt(string encrypted) => Services.GetRequiredService<IAesEncryptionService>().Decrypt(encrypted)!;

    public string CompanyLogin(PlatformCompany company, string? database = null) =>
        new NpgsqlConnectionStringBuilder(AdminConnection(database ?? company.DatabaseName))
        {
            Username = company.DatabaseUser,
            Password = Decrypt(company.DatabasePasswordEncrypted),
            Pooling = false
        }.ConnectionString;

    public static string AdminConnection(string database) =>
        new NpgsqlConnectionStringBuilder(PostgresTestEnvironment.AdminConnectionString!) { Database = database, Pooling = false }.ConnectionString;

    public async ValueTask DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();
        await Services.DisposeAsync();
        await DropEverythingAsync(ProductKey);
    }

    /// <summary>Removes every database and login whose name starts with the product key.</summary>
    public static async Task DropEverythingAsync(string productKey)
    {
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(AdminConnection("postgres"));
        await connection.OpenAsync();

        async Task<List<string>> NamesAsync(string sql)
        {
            var names = new List<string>();
            await using var list = new NpgsqlCommand(sql, connection);
            list.Parameters.AddWithValue("prefix", productKey + "%");
            await using var reader = await list.ExecuteReaderAsync();
            while (await reader.ReadAsync()) names.Add(reader.GetString(0));
            return names;
        }

        foreach (var database in await NamesAsync("SELECT datname FROM pg_database WHERE datname LIKE @prefix"))
        {
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{database}\" WITH (FORCE)", connection);
            await drop.ExecuteNonQueryAsync();
        }
        foreach (var role in await NamesAsync("SELECT rolname FROM pg_roles WHERE rolname LIKE @prefix"))
        {
            await using var drop = new NpgsqlCommand($"DROP ROLE IF EXISTS \"{role}\"", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private sealed class TestHostEnvironment : Microsoft.Extensions.Hosting.IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "CarSpaManagement.Api.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
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
