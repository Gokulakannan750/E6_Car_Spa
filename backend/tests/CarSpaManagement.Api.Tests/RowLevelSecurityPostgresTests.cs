using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// The database's own company separation (row-level security), checked on real PostgreSQL as an ordinary,
/// non-superuser role: superusers always bypass row-level security, so the test connects as a role that does not.
/// </summary>
public class RowLevelSecurityPostgresTests : IClassFixture<PostgresTestDatabase>, IAsyncLifetime
{
    private const string RoleName = "carspa_rls_tester";
    private const string RolePassword = "rls-tester-only";

    private static readonly Guid OrgA = Guid.Parse("aaaaaaaa-0000-0000-0000-00000000000a");
    private static readonly Guid OrgB = Guid.Parse("bbbbbbbb-0000-0000-0000-00000000000b");

    private readonly PostgresTestDatabase _pg;

    public RowLevelSecurityPostgresTests(PostgresTestDatabase pg) => _pg = pg;

    public async Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is null) return;

        await using var conn = new NpgsqlConnection(_pg.ConnectionString);
        await conn.OpenAsync();
        await Exec(conn, $@"DO $$ BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{RoleName}') THEN
                    CREATE ROLE {RoleName} LOGIN PASSWORD '{RolePassword}' NOSUPERUSER NOBYPASSRLS;
                END IF; END $$;");
        await Exec(conn, $"GRANT ALL ON ALL TABLES IN SCHEMA public TO {RoleName}");
        await Exec(conn, $"GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO {RoleName}");

        // Two companies, each with one customer. The superuser connection is not subject to row-level security.
        await Exec(conn, $@"INSERT INTO ""Organizations"" (""Id"",""Code"",""Name"",""IsActive"",""CreatedAt"",""IsDeleted"")
            VALUES ('{OrgA}','00A','A',TRUE,NOW(),FALSE), ('{OrgB}','00B','B',TRUE,NOW(),FALSE) ON CONFLICT DO NOTHING");
        await Exec(conn, $@"INSERT INTO ""Customers"" (""Id"",""Name"",""PhoneNumber"",""CreatedAt"",""IsDeleted"",""OrganizationId"")
            VALUES (gen_random_uuid(),'Customer of A','9000000001',NOW(),FALSE,'{OrgA}'),
                   (gen_random_uuid(),'Customer of B','9000000002',NOW(),FALSE,'{OrgB}')");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task Exec(NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private AppDbContext AsTester(ITenantContext tenant)
    {
        var connection = new NpgsqlConnectionStringBuilder(_pg.ConnectionString)
        {
            Username = RoleName,
            Password = RolePassword,
            Pooling = false
        }.ConnectionString;

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connection)
            .AddInterceptors(new TenantSessionInterceptor())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new AppDbContext(options, tenant);
    }

    [PostgresFact]
    public async Task EveryCompanyTable_HasRowLevelSecurityOn_AndForced()
    {
        await using var conn = new NpgsqlConnection(_pg.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(@"
            SELECT c.relname FROM pg_class c
            JOIN information_schema.columns col ON col.table_name = c.relname AND col.table_schema = 'public'
            WHERE col.column_name = 'OrganizationId' AND c.relkind = 'r'
              AND NOT (c.relrowsecurity AND c.relforcerowsecurity
                       AND EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname AND p.policyname = 'tenant_isolation'))", conn);
        var unprotected = new List<string>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync()) unprotected.Add(reader.GetString(0));

        Assert.Empty(unprotected);
    }

    [PostgresFact]
    public async Task ACompany_SeesOnlyItsOwnRows_EvenWhenTheQueryFiltersAreSwitchedOff()
    {
        await using var a = AsTester(new FixedTenantContext(OrgA));
        var seenByA = await a.Customers.IgnoreQueryFilters().Select(c => c.OrganizationId).Distinct().ToListAsync();
        Assert.Equal([OrgA], seenByA);

        await using var b = AsTester(new FixedTenantContext(OrgB));
        var seenByB = await b.Customers.IgnoreQueryFilters().Select(c => c.OrganizationId).Distinct().ToListAsync();
        Assert.Equal([OrgB], seenByB);
    }

    [PostgresFact]
    public async Task WithNoCompany_NoRowIsVisible()
    {
        await using var nobody = AsTester(new NoTenantContext());
        Assert.Empty(await nobody.Customers.IgnoreQueryFilters().ToListAsync());
    }

    [PostgresFact]
    public async Task HandWrittenSql_CannotReachAnotherCompany()
    {
        await using var a = AsTester(new FixedTenantContext(OrgA));

        // An UPDATE with no WHERE touches only the current company's rows.
        Assert.True(await a.Database.ExecuteSqlRawAsync(@"UPDATE ""Customers"" SET ""Name"" = 'Hacked'") >= 1);

        var deleted = await a.Database.ExecuteSqlRawAsync(@"DELETE FROM ""Customers"" WHERE ""OrganizationId"" = {0}", OrgB);
        Assert.Equal(0, deleted);

        var ex = await Assert.ThrowsAsync<PostgresException>(() => a.Database.ExecuteSqlRawAsync(
            @"INSERT INTO ""Customers"" (""Id"",""Name"",""PhoneNumber"",""CreatedAt"",""IsDeleted"",""OrganizationId"")
              VALUES (gen_random_uuid(),'Planted','9000000003',NOW(),FALSE,{0})", OrgB));
        Assert.Equal("42501", ex.SqlState); // row-level security violation

        // The other company's rows are untouched (checked as the superuser, who sees everything).
        await using var admin = new NpgsqlConnection(_pg.ConnectionString);
        await admin.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            $@"SELECT count(*) FROM ""Customers"" WHERE ""OrganizationId"" = '{OrgB}' AND (""Name"" = 'Hacked' OR ""Name"" = 'Planted')", admin);
        Assert.Equal(0L, await cmd.ExecuteScalarAsync());
    }

    [PostgresFact]
    public async Task TheCompanySetting_FollowsTheContext_AcrossRollbacks()
    {
        await using var a = AsTester(new FixedTenantContext(OrgA));
        await using (var tx = await a.Database.BeginTransactionAsync())
        {
            Assert.Single(await a.Customers.IgnoreQueryFilters().ToListAsync());
            await tx.RollbackAsync();
        }

        // After the rollback the setting must be sent again, not assumed.
        Assert.Single(await a.Customers.IgnoreQueryFilters().ToListAsync());
    }

    [PostgresFact]
    public async Task NormalWork_StillSavesAndReads_ThroughTheDatabaseLock()
    {
        await using var a = AsTester(new FixedTenantContext(OrgA));
        var customer = new Customer { Name = "Saved through RLS", PhoneNumber = "9000000009" };
        a.Customers.Add(customer);
        await a.SaveChangesAsync();

        await using var again = AsTester(new FixedTenantContext(OrgA));
        Assert.Contains(await again.Customers.ToListAsync(), c => c.Id == customer.Id);

        await using var other = AsTester(new FixedTenantContext(OrgB));
        Assert.DoesNotContain(await other.Customers.ToListAsync(), c => c.Id == customer.Id);
    }
}
