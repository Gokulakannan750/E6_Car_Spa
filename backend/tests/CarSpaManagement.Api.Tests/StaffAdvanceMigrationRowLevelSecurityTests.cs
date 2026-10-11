using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Migrations;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// With row-level security on, a connection that is not working for a company sees no rows, so a data repair that
/// must touch every company's rows has to say so. These tests run the staff-advance repair exactly as written, as an
/// ordinary (non-superuser) database role, which is how a production database is used.
/// </summary>
public class StaffAdvanceMigrationRowLevelSecurityTests : IClassFixture<PostgresTestDatabase>, IAsyncLifetime
{
    private const string RoleName = "carspa_mig_tester";

    // Staff codes look like "RT001S" (two letters, three digits, one letter) and are unique per company.
    private static int _staffCounter;

    private readonly PostgresTestDatabase _pg;

    public StaffAdvanceMigrationRowLevelSecurityTests(PostgresTestDatabase pg) => _pg = pg;

    public async Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is null) return;

        await using var conn = new NpgsqlConnection(_pg.ConnectionString);
        await conn.OpenAsync();
        await Exec(conn, $@"DO $$ BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{RoleName}') THEN
                    CREATE ROLE {RoleName} NOSUPERUSER NOBYPASSRLS;
                END IF; END $$;");
        await Exec(conn, $"GRANT ALL ON ALL TABLES IN SCHEMA public TO {RoleName}");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task Exec(NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<Guid> SeedLegacyAdvanceAsync(NpgsqlConnection conn)
    {
        var staffId = Guid.NewGuid();
        var advanceId = Guid.NewGuid();
        var company = DefaultOrganization.Id;
        await Exec(conn, $@"INSERT INTO ""Staff"" (""Id"", ""Name"", ""PhoneNumber"", ""StaffMasterId"", ""IsActive"", ""CreatedAt"", ""IsDeleted"", ""OrganizationId"")
            VALUES ('{staffId}', 'RLS Test Staff', '9000000001', 'RT{Interlocked.Increment(ref _staffCounter) % 1000:000}S', TRUE, NOW(), FALSE, '{company}')");
        await Exec(conn, $@"INSERT INTO ""StaffAdvances"" (""Id"", ""StaffId"", ""StaffName"", ""Amount"", ""AdvanceDate"", ""Reason"", ""Status"", ""AdvanceType"", ""Description"", ""CreatedAt"", ""IsDeleted"", ""OrganizationId"")
            VALUES ('{advanceId}', '{staffId}', 'RLS Test Staff', 100, CURRENT_DATE, '', 'Pending', 'Travel', 'Bus fare', NOW(), FALSE, '{company}')");
        return advanceId;
    }

    /// <summary>Runs the given SQL statements in one transaction as the ordinary role, the way a migration runs.</summary>
    private static async Task RunAsOrdinaryRoleAsync(NpgsqlConnection conn, IEnumerable<string> statements)
    {
        await using var tx = await conn.BeginTransactionAsync();
        await Exec(conn, $"SET LOCAL ROLE {RoleName}");
        foreach (var sql in statements)
        {
            await Exec(conn, sql);
        }
        await tx.CommitAsync();
    }

    private static async Task<(string Status, string Reason)> ReadAsync(NpgsqlConnection conn, Guid advanceId)
    {
        await using var cmd = new NpgsqlCommand($@"SELECT ""Status"", ""Reason"" FROM ""StaffAdvances"" WHERE ""Id"" = '{advanceId}'", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return (reader.GetString(0), reader.GetString(1));
    }

    private static List<string> MigrationSql() =>
        new BackfillStaffAdvanceLegacyData().UpOperations.OfType<SqlOperation>().Select(o => o.Sql).ToList();

    [PostgresFact]
    public async Task WithoutTheBypass_RowLevelSecurityHidesTheRows_SoTheRepairWouldDoNothing()
    {
        await using var conn = new NpgsqlConnection(_pg.ConnectionString);
        await conn.OpenAsync();
        var advanceId = await SeedLegacyAdvanceAsync(conn);

        // Everything except the line that switches the bypass on.
        var repairOnly = MigrationSql().Where(sql => !sql.Contains("app.bypass_rls")).ToList();
        Assert.NotEmpty(repairOnly);
        await RunAsOrdinaryRoleAsync(conn, repairOnly);

        var (status, reason) = await ReadAsync(conn, advanceId);
        Assert.Equal("Pending", status); // untouched: this is the silent failure the bypass prevents
        Assert.Equal("", reason);
    }

    [PostgresFact]
    public async Task AsWritten_TheRepairReachesEveryCompanysRows_EvenForAnOrdinaryRole()
    {
        await using var conn = new NpgsqlConnection(_pg.ConnectionString);
        await conn.OpenAsync();
        var advanceId = await SeedLegacyAdvanceAsync(conn);

        await RunAsOrdinaryRoleAsync(conn, MigrationSql());

        var (status, reason) = await ReadAsync(conn, advanceId);
        Assert.Equal("Outstanding", status);
        Assert.Equal("Bus fare", reason);
    }

    [PostgresFact]
    public async Task TheBypass_IsOnlyForTheMigrationsTransaction_AndDoesNotLeakOut()
    {
        await using var conn = new NpgsqlConnection(_pg.ConnectionString);
        await conn.OpenAsync();
        await SeedLegacyAdvanceAsync(conn);

        await RunAsOrdinaryRoleAsync(conn, MigrationSql());

        // Same connection, afterwards, as the ordinary role: the lock is back and nothing is visible.
        await using var tx = await conn.BeginTransactionAsync();
        await Exec(conn, $"SET LOCAL ROLE {RoleName}");
        await using var cmd = new NpgsqlCommand(@"SELECT count(*) FROM ""StaffAdvances""", conn);
        Assert.Equal(0L, await cmd.ExecuteScalarAsync());
        await tx.RollbackAsync();
    }
}
