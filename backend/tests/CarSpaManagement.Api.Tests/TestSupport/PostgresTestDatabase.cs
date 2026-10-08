using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
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

    public static string? AdminConnectionString =>
        Environment.GetEnvironmentVariable(ConnectionVariable) is { Length: > 0 } cs ? cs : null;
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

    public async Task InitializeAsync()
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

        ConnectionString = new NpgsqlConnectionStringBuilder(_adminConnectionString) { Database = _databaseName }.ConnectionString;

        await using var db = CreateContext();
        await db.Database.MigrateAsync();
        await EnsureDefaultCompanyAsync(db);
        // Like a real company, the default company starts with its two invoice numbering series.
        await new Application.Services.InvoiceNumberAllocator(db).GetOrCreateSeriesAsync();
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
