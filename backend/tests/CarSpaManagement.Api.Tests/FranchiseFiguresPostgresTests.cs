using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// The franchisor's view of a franchisee's figures, on real PostgreSQL as an ordinary (non-superuser) role so that
/// row-level security is genuinely in force: the database function must return the approved totals and nothing else.
/// </summary>
public class FranchiseFiguresPostgresTests : IClassFixture<PostgresTestDatabase>, IAsyncLifetime
{
    private const string RoleName = "carspa_fig_tester";
    private const string RolePassword = "fig-tester-only";

    private readonly PostgresTestDatabase _pg;

    public FranchiseFiguresPostgresTests(PostgresTestDatabase pg) => _pg = pg;

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
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task Exec(NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private AppDbContext AsSuperuser(Guid company)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_pg.ConnectionString)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)).Options;
        return new AppDbContext(options, new FixedTenantContext(company));
    }

    private DbContextOptions<AppDbContext> TesterOptions()
    {
        var connection = new NpgsqlConnectionStringBuilder(_pg.ConnectionString)
        {
            Username = RoleName, Password = RolePassword, Pooling = false
        }.ConnectionString;
        return new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection)
            .AddInterceptors(new TenantSessionInterceptor())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)).Options;
    }

    private AppDbContext AsTester(Guid company) => new(TesterOptions(), new FixedTenantContext(company));

    private sealed record World(Guid Franchisor, Guid Franchisee, Guid Outsider);

    /// <summary>Three new companies; the franchisor has an ACTIVE link to the franchisee with the financial totals granted.</summary>
    private async Task<World> NewWorldAsync(FranchiseLinkStatus status = FranchiseLinkStatus.Active,
        FranchiseScopeStatus scope = FranchiseScopeStatus.Granted, FranchiseScopeStatus? invoiceList = null)
    {
        var world = new World(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        await using (var db = AsSuperuser(world.Franchisor))
        {
            foreach (var id in new[] { world.Franchisor, world.Franchisee, world.Outsider })
            {
                db.Organizations.Add(new Organization { Id = id, Code = "T" + id.ToString("N")[..8], Name = "Company " + id.ToString("N")[..4], IsActive = true });
            }
            await db.SaveChangesAsync();

            var link = new FranchiseLink
            {
                Id = Guid.NewGuid(), FranchisorOrganizationId = world.Franchisor, FranchiseeOrganizationId = world.Franchisee,
                Status = status, ExpiresAt = DateTime.UtcNow.AddDays(7)
            };
            link.Scopes.Add(new FranchiseLinkScope
            {
                Id = Guid.NewGuid(), FranchiseLinkId = link.Id, FranchisorOrganizationId = world.Franchisor,
                FranchiseeOrganizationId = world.Franchisee, Scope = "financial_totals", Status = scope
            });
            if (invoiceList is { } list)
            {
                link.Scopes.Add(new FranchiseLinkScope
                {
                    Id = Guid.NewGuid(), FranchiseLinkId = link.Id, FranchisorOrganizationId = world.Franchisor,
                    FranchiseeOrganizationId = world.Franchisee, Scope = "invoice_list", Status = list
                });
            }
            db.FranchiseLinks.Add(link);
            await db.SaveChangesAsync();
        }

        await using var b = AsSuperuser(world.Franchisee);
        var customer = new Customer { Name = "Franchisee customer", PhoneNumber = "9000000100" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = "TN" + Guid.NewGuid().ToString("N")[..8], Make = "M", Model = "X" };
        b.AddRange(customer, vehicle);
        await b.SaveChangesAsync();

        JobCard NewJob(JobCardStatus s) => new()
        {
            JobCardNumber = "JC" + Guid.NewGuid().ToString("N")[..10], CustomerId = customer.Id, VehicleId = vehicle.Id, Status = s
        };
        // One job card per invoice (an invoice belongs to exactly one job card), plus a cancelled job card.
        var jobs = Enumerable.Range(0, 5).Select(_ => NewJob(JobCardStatus.Invoiced)).ToList();
        b.JobCards.AddRange(jobs);
        b.JobCards.Add(NewJob(JobCardStatus.Cancelled));
        await b.SaveChangesAsync();

        Invoice NewInvoice(int jobIndex, InvoiceStatus s, decimal total, decimal paid, DateTime date) => new()
        {
            InvoiceNumber = "INV" + Guid.NewGuid().ToString("N")[..10], JobCardId = jobs[jobIndex].Id, CustomerId = customer.Id, VehicleId = vehicle.Id,
            InvoiceDate = date, Status = s, TotalAmount = total, PaidAmount = paid, BalanceAmount = total - paid
        };
        var today = DateTime.UtcNow.Date;
        var partlyPaid = NewInvoice(0, InvoiceStatus.PartiallyPaid, 1000m, 400m, today);
        var paid = NewInvoice(1, InvoiceStatus.Paid, 300m, 300m, today);
        b.Invoices.AddRange(partlyPaid, paid,
            NewInvoice(2, InvoiceStatus.Draft, 500m, 0m, today),             // a draft is not revenue
            NewInvoice(3, InvoiceStatus.Cancelled, 700m, 0m, today),         // a cancelled invoice is not revenue
            NewInvoice(4, InvoiceStatus.Generated, 200m, 0m, today.AddDays(-60))); // outside the period
        await b.SaveChangesAsync();

        b.Payments.AddRange(
            new Payment { InvoiceId = partlyPaid.Id, Amount = 400m, PaymentMethod = PaymentMethod.Cash, PaymentDate = DateTime.UtcNow },
            new Payment { InvoiceId = paid.Id, Amount = 300m, PaymentMethod = PaymentMethod.UPI, PaymentDate = DateTime.UtcNow });
        await b.SaveChangesAsync();

        return world;
    }

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    [PostgresFact]
    public async Task TheFranchisor_GetsTheApprovedTotals_AndNothingElse()
    {
        var world = await NewWorldAsync();

        await using var db = AsTester(world.Franchisor);
        var totals = await new PostgresFranchiseFigures(db).GetFinancialTotalsAsync(world.Franchisee, Today.AddDays(-7), Today);

        Assert.Equal(2, totals.InvoiceCount);            // the draft, the cancelled one and the old one are left out
        Assert.Equal(1300m, totals.InvoicedAmount);
        Assert.Equal(700m, totals.CollectedAmount);
        Assert.Equal(600m, totals.OutstandingAmount);
        Assert.Equal(5, totals.JobCardCount);            // the five job cards made today; the cancelled one is left out
        var day = Assert.Single(totals.Daily);
        Assert.Equal(Today.ToString("yyyy-MM-dd"), day.Date);
        Assert.Equal(1300m, day.Invoiced);
        Assert.Equal(700m, day.Collected);
    }

    [PostgresFact]
    public async Task TheLock_IsBackOn_AfterTheFiguresWereRead()
    {
        var world = await NewWorldAsync();

        await using var db = AsTester(world.Franchisor);
        await new PostgresFranchiseFigures(db).GetFinancialTotalsAsync(world.Franchisee, Today.AddDays(-7), Today);

        // Same connection, straight afterwards: the franchisee's rows are still out of reach.
        Assert.Equal(0, await db.Invoices.IgnoreQueryFilters().CountAsync(i => i.OrganizationId == world.Franchisee));
        Assert.Equal(0, await db.Payments.IgnoreQueryFilters().CountAsync(p => p.OrganizationId == world.Franchisee));
    }

    [PostgresFact]
    public async Task SomeoneWithoutALink_GetsNothing()
    {
        var world = await NewWorldAsync();

        await using var outsider = AsTester(world.Outsider);
        var ex = await Assert.ThrowsAnyAsync<Exception>(() =>
            new PostgresFranchiseFigures(outsider).GetFinancialTotalsAsync(world.Franchisee, Today.AddDays(-7), Today));
        Assert.Equal("42501", Assert.IsType<PostgresException>(ex.InnerException ?? ex).SqlState);

        // The franchisee cannot read the franchisor's figures through the same link either.
        await using var franchisee = AsTester(world.Franchisee);
        var reverse = await Assert.ThrowsAnyAsync<Exception>(() =>
            new PostgresFranchiseFigures(franchisee).GetFinancialTotalsAsync(world.Franchisor, Today.AddDays(-7), Today));
        Assert.Equal("42501", Assert.IsType<PostgresException>(reverse.InnerException ?? reverse).SqlState);
    }

    [PostgresTheory]
    [InlineData(FranchiseLinkStatus.Pending, FranchiseScopeStatus.Requested)]
    [InlineData(FranchiseLinkStatus.Active, FranchiseScopeStatus.Denied)]
    [InlineData(FranchiseLinkStatus.Active, FranchiseScopeStatus.Requested)]
    [InlineData(FranchiseLinkStatus.Ended, FranchiseScopeStatus.Granted)]
    [InlineData(FranchiseLinkStatus.Declined, FranchiseScopeStatus.Denied)]
    public async Task WithoutAnActiveLink_AndAGrantedItem_TheDatabaseRefuses(FranchiseLinkStatus status, FranchiseScopeStatus scope)
    {
        var world = await NewWorldAsync(status, scope);

        await using var db = AsTester(world.Franchisor);
        var ex = await Assert.ThrowsAnyAsync<Exception>(() =>
            new PostgresFranchiseFigures(db).GetFinancialTotalsAsync(world.Franchisee, Today.AddDays(-7), Today));
        Assert.Equal("42501", Assert.IsType<PostgresException>(ex.InnerException ?? ex).SqlState);
    }

    // ── The franchisee's own billing report, for the franchisor ────────────────────────────────────────────

    private FranchiseReportService ReportsFor(AppDbContext franchisorDb) =>
        new(franchisorDb, TesterOptions(), new AlwaysOnFranchiseEntitlement(), new NoopAudit());

    private sealed class NoopAudit : CarSpaManagement.Api.Application.Interfaces.IAuditLogService
    {
        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<CarSpaManagement.Api.Application.DTOs.Audit.PagedResult<CarSpaManagement.Api.Application.DTOs.Audit.AuditLogDto>> GetLogsAsync(
            CarSpaManagement.Api.Application.DTOs.Audit.AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private static async Task<Guid> LinkIdAsync(AppDbContext db) => (await db.FranchiseLinks.SingleAsync()).Id;

    [PostgresFact]
    public async Task WithTheInvoiceListAllowed_TheFranchisorGetsTheFranchiseesBillingReport()
    {
        var world = await NewWorldAsync(invoiceList: FranchiseScopeStatus.Granted);

        await using var db = AsTester(world.Franchisor);
        var linkId = await LinkIdAsync(db);
        var report = await ReportsFor(db).GetMonthlyBillingReportAsync(linkId, DateTime.UtcNow.Year, DateTime.UtcNow.Month);

        Assert.Equal(DateTime.UtcNow.Month, report.Month);
        Assert.Equal(1, report.Summary.TotalInvoicesPaid);       // the franchisee's own report logic, on the franchisee's data
        Assert.Equal(1, report.Summary.TotalInvoicesDraft);
        Assert.Equal(1, report.Summary.TotalInvoicesCancelled);
        Assert.Equal(report.DaysInMonth, report.DailySheets.Count);

        // And the lock is back on for the franchisor's own connection afterwards.
        Assert.Equal(0, await db.Invoices.IgnoreQueryFilters().CountAsync(i => i.OrganizationId == world.Franchisee));
    }

    [PostgresFact]
    public async Task WithOnlyTheTotalsAllowed_TheBillingReportIsRefused()
    {
        var world = await NewWorldAsync(); // financial totals granted, invoice list never asked for

        await using var db = AsTester(world.Franchisor);
        var linkId = await LinkIdAsync(db);
        await Assert.ThrowsAsync<CarSpaManagement.Api.Application.Common.ForbiddenException>(() =>
            ReportsFor(db).GetMonthlyBillingReportAsync(linkId, DateTime.UtcNow.Year, DateTime.UtcNow.Month));

        var switchedOff = await NewWorldAsync(invoiceList: FranchiseScopeStatus.Denied);
        await using var db2 = AsTester(switchedOff.Franchisor);
        await Assert.ThrowsAsync<CarSpaManagement.Api.Application.Common.ForbiddenException>(async () =>
            await ReportsFor(db2).GetMonthlyBillingReportAsync(await LinkIdAsync(db2), DateTime.UtcNow.Year, DateTime.UtcNow.Month));
    }

    [PostgresFact]
    public async Task ACompanyThatIsNotTheFranchisor_CannotUseSomeoneElsesLink()
    {
        var world = await NewWorldAsync(invoiceList: FranchiseScopeStatus.Granted);
        Guid linkId;
        await using (var franchisor = AsTester(world.Franchisor)) linkId = await LinkIdAsync(franchisor);

        foreach (var other in new[] { world.Outsider, world.Franchisee })
        {
            await using var db = AsTester(other);
            await Assert.ThrowsAsync<CarSpaManagement.Api.Application.Common.NotFoundException>(() =>
                ReportsFor(db).GetMonthlyBillingReportAsync(linkId, DateTime.UtcNow.Year, DateTime.UtcNow.Month));
        }
    }

    [PostgresFact]
    public async Task TheDatabaseCheck_AnswersFromItsOwnLinkRecords()
    {
        var world = await NewWorldAsync(invoiceList: FranchiseScopeStatus.Granted);

        async Task<bool> Has(Guid company, Guid franchisee, string scope)
        {
            await using var db = AsTester(company);
            return await db.Database.SqlQuery<bool>($"SELECT franchise_has_scope({franchisee}, {scope}) AS \"Value\"").SingleAsync();
        }

        Assert.True(await Has(world.Franchisor, world.Franchisee, "invoice_list"));
        Assert.True(await Has(world.Franchisor, world.Franchisee, "financial_totals"));
        Assert.False(await Has(world.Franchisor, world.Franchisee, "customers"));      // never granted
        Assert.False(await Has(world.Outsider, world.Franchisee, "invoice_list"));     // no link
        Assert.False(await Has(world.Franchisee, world.Franchisor, "invoice_list"));   // the link does not work in reverse
    }

    [PostgresFact]
    public async Task TheViewOfAnotherCompany_CannotBeUsedToChangeAnything()
    {
        var world = await NewWorldAsync(invoiceList: FranchiseScopeStatus.Granted);

        await using var view = AppDbContext.ForReadOnly(TesterOptions(), new FixedTenantContext(world.Franchisee));
        Assert.True(await view.Invoices.AnyAsync());      // it can read
        view.Customers.Add(new Customer { Name = "Planted", PhoneNumber = "9000000999" });
        await Assert.ThrowsAsync<TenantViolationException>(() => view.SaveChangesAsync());
    }
}
