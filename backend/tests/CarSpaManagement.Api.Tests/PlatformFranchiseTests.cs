using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Franchise;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Franchise on Trovo's platform, where every company has its own database: links live in the catalog, and the
/// franchisor's figures and reports are read from the franchisee's own database, read-only, only as approved.
/// </summary>
public class PlatformFranchiseTests : IAsyncLifetime
{
    private PlatformTestEnvironment? _env;
    private PlatformTestEnvironment Env => _env!;

    private static readonly CompanyPlan FranchisorPlan = new("professional", BillingInterval.Year,
        new Dictionary<string, int> { ["franchise_network"] = 1 }, DateTime.UtcNow.AddYears(1));

    public Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is not null) _env = new PlatformTestEnvironment();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (_env is not null) await _env.DisposeAsync();
    }

    // ── The franchise services as a signed-in company would use them ──────────────

    private sealed class Company(AsyncServiceScope scope) : IAsyncDisposable
    {
        public IServiceProvider Services => scope.ServiceProvider;
        public CatalogFranchiseLinkStore Store => new(Services.GetRequiredService<PlatformDbContext>(), Services.GetRequiredService<TenantContext>(),
            Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<PlatformOptions>>());

        public FranchiseService Franchise()
        {
            var entitlements = Services.GetRequiredService<IEntitlementService>();
            return new FranchiseService(
                Services.GetRequiredService<AppDbContext>(), Services.GetRequiredService<IAuditLogService>(),
                new SubscriptionFranchiseEntitlement(entitlements), new HttpContextAccessor(),
                Figures(), Services.GetRequiredService<IConfiguration>(), Store, entitlements);
        }

        public CrossDatabaseFranchiseFigures Figures() =>
            new(Store, Services.GetRequiredService<TenantContext>(), Services.GetRequiredService<DbContextOptions<AppDbContext>>());

        public FranchiseReportService Reports() => new(
            Services.GetRequiredService<AppDbContext>(), Services.GetRequiredService<DbContextOptions<AppDbContext>>(),
            new SubscriptionFranchiseEntitlement(Services.GetRequiredService<IEntitlementService>()),
            Services.GetRequiredService<IAuditLogService>(), Store);

        public ValueTask DisposeAsync() => scope.DisposeAsync();
    }

    private Company As(PlatformCompany company) => new(Env.CompanyScope(company.Id));

    /// <summary>The same figures as the single-database test: 2 invoices in the period, ₹1,300 invoiced, ₹700 collected.</summary>
    private async Task SeedFranchiseeAsync(PlatformCompany franchisee)
    {
        await using var scope = Env.CompanyScope(franchisee.Id);
        var b = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var customer = new Customer { Name = "Franchisee customer", PhoneNumber = "9000000100" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = "TN" + Guid.NewGuid().ToString("N")[..8], Make = "M", Model = "X" };
        b.AddRange(customer, vehicle);
        await b.SaveChangesAsync();

        JobCard NewJob(JobCardStatus s) => new()
        {
            JobCardNumber = "JC" + Guid.NewGuid().ToString("N")[..10], CustomerId = customer.Id, VehicleId = vehicle.Id, Status = s
        };
        var jobs = Enumerable.Range(0, 5).Select(_ => NewJob(JobCardStatus.Invoiced)).ToList();
        b.JobCards.AddRange(jobs);
        b.JobCards.Add(NewJob(JobCardStatus.Cancelled));
        await b.SaveChangesAsync();

        Invoice NewInvoice(int i, InvoiceStatus s, decimal total, decimal paid, DateTime date) => new()
        {
            InvoiceNumber = "INV" + Guid.NewGuid().ToString("N")[..10], JobCardId = jobs[i].Id, CustomerId = customer.Id, VehicleId = vehicle.Id,
            InvoiceDate = date, Status = s, TotalAmount = total, PaidAmount = paid, BalanceAmount = total - paid
        };
        var today = DateTime.UtcNow.Date;
        var partlyPaid = NewInvoice(0, InvoiceStatus.PartiallyPaid, 1000m, 400m, today);
        var paid = NewInvoice(1, InvoiceStatus.Paid, 300m, 300m, today);
        b.Invoices.AddRange(partlyPaid, paid,
            NewInvoice(2, InvoiceStatus.Draft, 500m, 0m, today),
            NewInvoice(3, InvoiceStatus.Cancelled, 700m, 0m, today),
            NewInvoice(4, InvoiceStatus.Generated, 200m, 0m, today.AddDays(-60)));
        await b.SaveChangesAsync();

        b.Payments.AddRange(
            new Payment { InvoiceId = partlyPaid.Id, Amount = 400m, PaymentMethod = PaymentMethod.Cash, PaymentDate = DateTime.UtcNow },
            new Payment { InvoiceId = paid.Id, Amount = 300m, PaymentMethod = PaymentMethod.UPI, PaymentDate = DateTime.UtcNow });
        await b.SaveChangesAsync();
    }

    /// <summary>A franchisor (with the add-on) whose invitation the franchisee has accepted, allowing the given items.</summary>
    private async Task<(PlatformCompany A, PlatformCompany B, Guid LinkId)> LinkedPairAsync(params string[] allowed)
    {
        var a = await Env.CreateRegisteredCompanyAsync("Franchisor Co", FranchisorPlan);
        var b = await Env.CreateRegisteredCompanyAsync("Franchisee Co");
        await SeedFranchiseeAsync(b);

        await using (var franchisor = As(a))
        {
            await franchisor.Franchise().SendInviteAsync(new SendFranchiseInviteRequest
            {
                FranchiseeCode = b.Code,
                Scopes = [FranchiseScopes.FinancialTotals, FranchiseScopes.InvoiceList]
            });
        }

        Guid linkId;
        await using (var franchisee = As(b))
        {
            var network = await franchisee.Franchise().GetNetworkAsync();
            linkId = Assert.Single(network.Franchisors).Id;
            await franchisee.Franchise().RespondAsync(linkId, new RespondToFranchiseInviteRequest { Accept = true, GrantedScopes = allowed.ToList() });
        }
        return (a, b, linkId);
    }

    [PostgresFact]
    public async Task InviteAcceptDashboard_WorksAcrossSeparateDatabases_WithTheSameFiguresAsBefore()
    {
        var (a, b, _) = await LinkedPairAsync(FranchiseScopes.FinancialTotals);

        await using var franchisor = As(a);
        var dashboard = await franchisor.Franchise().GetDashboardAsync(null, null);

        var row = Assert.Single(dashboard.Franchisees);
        Assert.True(row.FinancialTotalsAllowed);
        Assert.Equal(2, row.Totals!.InvoiceCount);
        Assert.Equal(1300m, row.Totals.InvoicedAmount);
        Assert.Equal(700m, row.Totals.CollectedAmount);
        Assert.Equal(600m, row.Totals.OutstandingAmount);
        Assert.Equal(5, row.Totals.JobCardCount);
        Assert.Equal(1300m, dashboard.Network.InvoicedAmount);
        Assert.Equal("Franchisee Co", row.PartnerName);
        Assert.NotEqual(b.Code, row.PartnerCodeHint); // the code is masked

        // The link lives in the catalog, not in either company's database.
        Assert.Equal(1, await Env.WithCatalogAsync(c => c.FranchiseLinks.CountAsync()));
        await using var direct = new NpgsqlConnection(PlatformTestEnvironment.AdminConnection(a.DatabaseName));
        await direct.OpenAsync();
        await using var count = new NpgsqlCommand("SELECT count(*) FROM \"FranchiseLinks\"", direct);
        Assert.Equal(0L, (long)(await count.ExecuteScalarAsync())!);
    }

    [PostgresFact]
    public async Task AnotherCompany_SeesNoLinks_AndCannotReadTheFigures()
    {
        var (_, b, linkId) = await LinkedPairAsync(FranchiseScopes.FinancialTotals);
        var outsider = await Env.CreateRegisteredCompanyAsync("Outsider Co", FranchisorPlan);

        await using var c = As(outsider);
        Assert.Empty(await c.Store.Links.ToListAsync());
        var network = await c.Franchise().GetNetworkAsync();
        Assert.Empty(network.Franchisees);
        Assert.Empty(network.Franchisors);
        await Assert.ThrowsAsync<ForbiddenException>(() => c.Figures().GetFinancialTotalsAsync(b.Id, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)), DateOnly.FromDateTime(DateTime.UtcNow)));
        await Assert.ThrowsAsync<NotFoundException>(() => c.Reports().GetMonthlyBillingReportAsync(linkId, DateTime.UtcNow.Year, DateTime.UtcNow.Month));
    }

    [PostgresFact]
    public async Task TheBillingReport_NeedsTheInvoiceList_AndComesFromTheFranchiseesOwnDatabase()
    {
        var (a, b, linkId) = await LinkedPairAsync(FranchiseScopes.FinancialTotals);

        await using (var franchisor = As(a))
        {
            await Assert.ThrowsAsync<ForbiddenException>(() =>
                franchisor.Reports().GetMonthlyBillingReportAsync(linkId, DateTime.UtcNow.Year, DateTime.UtcNow.Month));
        }

        await using (var franchisee = As(b))
        {
            await franchisee.Franchise().DecideScopeAsync(linkId, FranchiseScopes.InvoiceList, new DecideFranchiseScopeRequest { Grant = true });
        }

        await using (var franchisor = As(a))
        {
            var report = await franchisor.Reports().GetMonthlyBillingReportAsync(linkId, DateTime.UtcNow.Year, DateTime.UtcNow.Month);
            Assert.NotNull(report);
            Assert.True(report.Summary.TotalInvoices >= 2);
        }
    }

    [PostgresFact]
    public async Task EndingTheLink_StopsTheFranchisorsAccessAtOnce()
    {
        var (a, b, linkId) = await LinkedPairAsync(FranchiseScopes.FinancialTotals);
        await using (var franchisee = As(b))
        {
            await franchisee.Franchise().EndLinkAsync(linkId);
        }

        await using var franchisor = As(a);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            franchisor.Figures().GetFinancialTotalsAsync(b.Id, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)), DateOnly.FromDateTime(DateTime.UtcNow)));
        Assert.Empty((await franchisor.Franchise().GetDashboardAsync(null, null)).Franchisees);
    }

    [PostgresFact]
    public async Task WithoutTheFranchiseAddOn_ACompanyCannotInvite()
    {
        var a = await Env.CreateRegisteredCompanyAsync("No Add-on Co");
        var b = await Env.CreateRegisteredCompanyAsync("Would-be Franchisee");

        await using var company = As(a);
        Assert.False((await company.Franchise().GetAccessAsync()).CanActAsFranchisor);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            company.Franchise().SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = b.Code }));
    }

    [PostgresFact]
    public async Task TheNetwork_IsLimitedToTheBranchesThePlanCovers()
    {
        var a = await Env.CreateRegisteredCompanyAsync("Big Network Co", FranchisorPlan);
        var b = await Env.CreateRegisteredCompanyAsync("Eleventh Branch");

        // Ten open links already (catalog-only companies are enough for counting).
        await Env.WithCatalogAsync(async c =>
        {
            var productId = await c.Products.Where(p => p.Key == Env.ProductKey).Select(p => p.Id).SingleAsync();
            for (var i = 0; i < 10; i++)
            {
                var other = new PlatformCompany
                {
                    Id = Guid.NewGuid(), ProductId = productId, Code = $"X{i:000}", Name = $"Branch {i}", Status = PlatformCompanyStatus.Active,
                    DatabaseName = $"{Env.ProductKey}_none_{i}", DatabaseUser = $"{Env.ProductKey}_none_{i}", DatabasePasswordEncrypted = "-", CreatedAt = DateTime.UtcNow
                };
                c.Companies.Add(other);
                c.FranchiseLinks.Add(new FranchiseLink
                {
                    Id = Guid.NewGuid(), FranchisorOrganizationId = a.Id, FranchiseeOrganizationId = other.Id,
                    Status = FranchiseLinkStatus.Pending, ExpiresAt = DateTime.UtcNow.AddDays(7)
                });
            }
            return await c.SaveChangesAsync();
        });

        await using (var company = As(a))
        {
            var full = await Assert.ThrowsAsync<ConflictException>(() =>
                company.Franchise().SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = b.Code }));
            Assert.Contains("covers 10 franchise branches", full.Message);
        }

        await Env.WithSubscriptionsAsync(s => s.ChangeAsync(a.Id, new SubscriptionChange(AddOns: new Dictionary<string, int>
            { ["franchise_network"] = 1, ["franchise_branches_10"] = 1 }), SubscriptionActor.System));
        await using (var company = As(a))
        {
            company.Services.GetRequiredService<IEntitlementService>().Invalidate(a.Id);
            await company.Franchise().SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = b.Code });
        }
    }

    [PostgresFact]
    public async Task TheFranchiseesDatabase_IsOpenedReadOnly_ForTheFigures()
    {
        var b = await Env.CreateRegisteredCompanyAsync("Read Only View Co");
        await using var scope = Env.CompanyScope(b.Id);
        var options = scope.ServiceProvider.GetRequiredService<DbContextOptions<AppDbContext>>();
        await using var view = CompanyViews.ReadOnly(options, b.Id);

        var error = await Assert.ThrowsAsync<PostgresException>(() => CompanyViews.ReadOnlyTransactionAsync(view, async () =>
            await view.Database.ExecuteSqlRawAsync("UPDATE \"Customers\" SET \"Name\" = 'changed'"), CancellationToken.None));
        Assert.Equal("25006", error.SqlState); // read_only_sql_transaction
    }
}
