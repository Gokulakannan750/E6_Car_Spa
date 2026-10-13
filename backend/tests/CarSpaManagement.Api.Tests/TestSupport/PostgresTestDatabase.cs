using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests.TestSupport;

/// <summary>
/// Real-PostgreSQL integration tests (row locks, transactions, constraints, migrations) cannot run on EF InMemory.
/// Set CARSPA_TEST_PG_CONNECTION to a connection string for a PostgreSQL server where the user may
/// CREATE/DROP DATABASE (e.g. a local dev server). Each fixture creates a throwaway database
/// "carspa_test_&lt;guid&gt;", applies all EF Core migrations, and drops it afterwards.
/// Without the variable these tests are reported as skipped.
/// </summary>
public static class PostgresTestEnvironment
{
    public const string ConnectionVariable = "CARSPA_TEST_PG_CONNECTION";

    /// <summary>
    /// The server connection used to create and drop the throwaway databases. Creating a database makes the server
    /// write a checkpoint, and many tests do it at once, so each can wait well past the 30 second default.
    /// </summary>
    public static string? AdminConnectionString =>
        Environment.GetEnvironmentVariable(ConnectionVariable) is { } cs && !string.IsNullOrWhiteSpace(cs)
            ? new NpgsqlConnectionStringBuilder(cs) { CommandTimeout = 180 }.ConnectionString
            : null;
}

public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (PostgresTestEnvironment.AdminConnectionString is null)
            Skip = $"Real PostgreSQL test: set {PostgresTestEnvironment.ConnectionVariable} to run.";
    }
}

public sealed class PostgresTheoryAttribute : TheoryAttribute
{
    public PostgresTheoryAttribute()
    {
        if (PostgresTestEnvironment.AdminConnectionString is null)
            Skip = $"Real PostgreSQL test: set {PostgresTestEnvironment.ConnectionVariable} to run.";
    }
}

public sealed class PostgresTestDatabase : IAsyncLifetime
{
    private readonly string _databaseName = $"carspa_test_{Guid.NewGuid():N}";
    private string? _adminConnectionString;

    public string ConnectionString { get; private set; } = string.Empty;

    public AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new AppDbContext(options);
    }

    public Task InitializeAsync() => InitializeAsync(null);

    public async Task InitializeAsync(string? targetMigration)
    {
        _adminConnectionString = PostgresTestEnvironment.AdminConnectionString;
        if (_adminConnectionString is null) return;

        var admin = new NpgsqlConnectionStringBuilder(_adminConnectionString) { Database = "postgres", Pooling = false };
        await using (var conn = new NpgsqlConnection(admin.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{_databaseName}\"", conn);
            await cmd.ExecuteNonQueryAsync();
        }

        // Building a whole schema, many times at once on a busy machine, can take longer than the 30 second default.
        ConnectionString = new NpgsqlConnectionStringBuilder(_adminConnectionString) { Database = _databaseName, CommandTimeout = 180 }.ConnectionString;

        await using var db = CreateContext();
        await db.Database.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>()
            .MigrateAsync(targetMigration);

        // A partly migrated database (a migration test stopping at an earlier step) is left exactly as that step
        // made it; the test seeds whatever it needs. A fully migrated one gets the default company and its series.
        if (targetMigration is null)
        {
            await EnsureDefaultCompanyAsync(db);
            // Like a real company, the default company starts with its two invoice numbering series.
            await new Application.Services.InvoiceNumberAllocator(db).GetOrCreateSeriesAsync();
        }
    }

    /// <summary>
    /// The default company the test contexts work for. A brand-new database has no company (first-time setup
    /// creates it), so tests that save company-owned rows need this row for the foreign key.
    /// </summary>
    public static async Task EnsureDefaultCompanyAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO ""Organizations"" (""Id"", ""Code"", ""Name"", ""IsActive"", ""CreatedAt"", ""IsDeleted"")
            VALUES ({Infrastructure.Tenancy.DefaultOrganization.Id}, {Infrastructure.Tenancy.DefaultOrganization.Code}, 'Test company', TRUE, NOW(), FALSE)
            ON CONFLICT DO NOTHING");
    }

    public async Task DisposeAsync()
    {
        if (_adminConnectionString is null) return;
        NpgsqlConnection.ClearAllPools();
        var admin = new NpgsqlConnectionStringBuilder(_adminConnectionString) { Database = "postgres", Pooling = false };
        await using var conn = new NpgsqlConnection(admin.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)", conn);
        await cmd.ExecuteNonQueryAsync();
    }
}
