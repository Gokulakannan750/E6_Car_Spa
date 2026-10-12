using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Subscriptions on a real catalog database: trial, invoices, manual payments, renewal, grace, read-only,
/// suspension, cancellation, plan changes and seat limits.
/// </summary>
public class PlatformSubscriptionTests : IAsyncLifetime
{
    private PlatformTestEnvironment? _env;
    private PlatformTestEnvironment Env => _env!;
    private static readonly SubscriptionActor Admin = new(PlatformActorType.Admin, Guid.NewGuid());

    public Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is not null) _env = new PlatformTestEnvironment();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (_env is not null) await _env.DisposeAsync();
    }

    [PostgresFact]
    public async Task ANewCompany_StartsASevenDayProfessionalTrial_WithItsOwnBillingAccount()
    {
        var company = (await Env.CreateCompanyAsync("Trial Detailing")).Company;

        var subscription = await Env.WithCatalogAsync(c => c.Subscriptions.Include(s => s.PlanVersion!).ThenInclude(v => v.Plan)
            .SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent));
        Assert.Equal(SubscriptionStatus.Trialing, subscription.Status);
        Assert.Equal("professional", subscription.PlanVersion!.Plan!.Code);
        Assert.InRange(subscription.TrialEndsAt!.Value - DateTime.UtcNow, TimeSpan.FromDays(6.9), TimeSpan.FromDays(7));
        Assert.Equal(1, await Env.WithCatalogAsync(c => c.BillingAccounts.CountAsync(b => b.CompanyId == company.Id)));

        var entitlements = await Env.EntitlementsAsync(company.Id);
        Assert.Equal(CompanyAccessLevel.Full, entitlements.Access);
        Assert.Equal(10, entitlements.SeatLimit);
        Assert.True(entitlements.Has(FeatureKeys.WhatsAppAutomation));
        Assert.False(entitlements.Has(FeatureKeys.Showroom));
    }

    [PostgresFact]
    public async Task AnUnpaidTrial_BecomesReadOnly_AndPayingStartsAFreshPeriodFromToday()
    {
        var company = (await Env.CreateCompanyAsync("Unpaid Trial")).Company;
        await Env.EditSubscriptionAsync(company.Id, s => { s.TrialEndsAt = DateTime.UtcNow.AddDays(2); s.CurrentPeriodEnd = s.TrialEndsAt.Value; });

        // In the trial's last days its first invoice appears.
        await Env.WithSubscriptionsAsync(s => s.RunLifecycleAsync(DateTime.UtcNow));
        var invoice = await Env.WithCatalogAsync(c => c.BillingInvoices.Include(i => i.Lines).SingleAsync(i => i.CompanyId == company.Id));
        Assert.Equal(BillingInvoiceStatus.Open, invoice.Status);
        Assert.Equal(199_900, invoice.TotalMinor);
        Assert.Equal(0, invoice.TaxMinor);
        Assert.StartsWith("TROVO/", invoice.InvoiceNumber);

        await Env.EditSubscriptionAsync(company.Id, s => s.TrialEndsAt = DateTime.UtcNow.AddMinutes(-1));
        await Env.WithSubscriptionsAsync(s => s.RunLifecycleAsync(DateTime.UtcNow));
        Assert.Equal(CompanyAccessLevel.ReadOnly, (await Env.EntitlementsAsync(company.Id)).Access);

        await Env.WithSubscriptionsAsync(s => s.RecordManualPaymentAsync(invoice.Id, 199_900, "UPI 1001", null, Admin));

        var paid = await Env.WithCatalogAsync(c => c.Subscriptions.SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent));
        Assert.Equal(SubscriptionStatus.Active, paid.Status);
        Assert.InRange(paid.CurrentPeriodStart, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(1));
        Assert.Equal(paid.CurrentPeriodStart.AddMonths(1), paid.CurrentPeriodEnd);
        Assert.Equal(BillingInvoiceStatus.Paid, (await Env.WithCatalogAsync(c => c.BillingInvoices.SingleAsync(i => i.Id == invoice.Id))).Status);
        Assert.Equal(CompanyAccessLevel.Full, (await Env.EntitlementsAsync(company.Id)).Access);
    }

    [PostgresFact]
    public async Task AnEndedPeriod_GivesSevenDaysGrace_ThenReadOnly_AndOnTimeRenewalKeepsTheAnniversary()
    {
        var periodEnd = DateTime.UtcNow.AddDays(3);
        var company = (await Env.CreateCompanyAsync("Monthly Co",
            new CompanyPlan("professional", BillingInterval.Month, new Dictionary<string, int>(), periodEnd))).Company;

        // Renewal invoice a week before the period ends; paying it on time extends from the old end date.
        await Env.WithSubscriptionsAsync(s => s.RunLifecycleAsync(DateTime.UtcNow));
        var renewal = await Env.WithCatalogAsync(c => c.BillingInvoices.SingleAsync(i => i.CompanyId == company.Id));
        Assert.Equal(periodEnd, renewal.PeriodStart!.Value, TimeSpan.FromSeconds(1));
        await Env.WithSubscriptionsAsync(s => s.RecordManualPaymentAsync(renewal.Id, renewal.TotalMinor, "NEFT UTR 77", null, Admin));
        var renewed = await Env.WithCatalogAsync(c => c.Subscriptions.SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent));
        Assert.Equal(periodEnd.AddMonths(1), renewed.CurrentPeriodEnd, TimeSpan.FromSeconds(1));

        // Next period ends unpaid: past due with grace, then read-only.
        await Env.EditSubscriptionAsync(company.Id, s => s.CurrentPeriodEnd = DateTime.UtcNow.AddMinutes(-1));
        await Env.WithSubscriptionsAsync(s => s.RunLifecycleAsync(DateTime.UtcNow));
        var pastDue = await Env.WithCatalogAsync(c => c.Subscriptions.SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent));
        Assert.Equal(SubscriptionStatus.PastDue, pastDue.Status);
        Assert.Equal(pastDue.CurrentPeriodEnd.AddDays(7), pastDue.GraceEndsAt!.Value, TimeSpan.FromSeconds(1));
        Assert.Equal(CompanyAccessLevel.Full, (await Env.EntitlementsAsync(company.Id)).Access);

        await Env.EditSubscriptionAsync(company.Id, s => s.GraceEndsAt = DateTime.UtcNow.AddMinutes(-1));
        await Env.WithSubscriptionsAsync(s => s.RunLifecycleAsync(DateTime.UtcNow));
        Assert.Equal(CompanyAccessLevel.ReadOnly, (await Env.EntitlementsAsync(company.Id)).Access);
    }

    [PostgresFact]
    public async Task ManualPayments_RefuseDuplicateReferences_Overpayment_AndPaidInvoices()
    {
        var company = (await Env.CreateCompanyAsync("Careful Payer")).Company;
        var invoice = await Env.WithCatalogAsync(async c =>
        {
            await using var scope = Env.Scope();
            return await scope.ServiceProvider.GetRequiredService<SubscriptionService>().IssueNextInvoiceAsync(company.Id);
        });

        await Assert.ThrowsAsync<ValidationException>(() => Env.WithSubscriptionsAsync(s =>
            s.RecordManualPaymentAsync(invoice.Id, invoice.TotalMinor + 1, "UPI 2001", null, Admin)));

        await Env.WithSubscriptionsAsync(s => s.RecordManualPaymentAsync(invoice.Id, 100_000, "UPI 2002", null, Admin));
        var partly = await Env.WithCatalogAsync(c => c.BillingInvoices.SingleAsync(i => i.Id == invoice.Id));
        Assert.Equal(BillingInvoiceStatus.Open, partly.Status);
        Assert.Equal(invoice.TotalMinor - 100_000, partly.AmountDueMinor);

        await Assert.ThrowsAsync<ConflictException>(() => Env.WithSubscriptionsAsync(s =>
            s.RecordManualPaymentAsync(invoice.Id, 1_000, "UPI 2002", null, Admin)));

        await Env.WithSubscriptionsAsync(s => s.RecordManualPaymentAsync(invoice.Id, partly.AmountDueMinor, "UPI 2003", null, Admin));
        await Assert.ThrowsAsync<ValidationException>(() => Env.WithSubscriptionsAsync(s =>
            s.RecordManualPaymentAsync(invoice.Id, 1_000, "UPI 2004", null, Admin)));

        Assert.Equal(SubscriptionStatus.Active, (await Env.WithCatalogAsync(c => c.Subscriptions.SingleAsync(s => s.CompanyId == company.Id))).Status);
    }

    [PostgresFact]
    public async Task InvoiceNumbers_RunOnWithoutGaps_AcrossCompanies()
    {
        var first = (await Env.CreateCompanyAsync("Numbered One")).Company;
        var second = (await Env.CreateCompanyAsync("Numbered Two")).Company;
        await using var scope = Env.Scope();
        var service = scope.ServiceProvider.GetRequiredService<SubscriptionService>();

        var a = await service.IssueNextInvoiceAsync(first.Id);
        var b = await service.IssueNextInvoiceAsync(second.Id);

        var year = BillingInvoiceService.FinancialYear(DateTime.UtcNow);
        Assert.Equal($"TROVO/{year}/0001", a.InvoiceNumber);
        Assert.Equal($"TROVO/{year}/0002", b.InvoiceNumber);
        await Assert.ThrowsAsync<ConflictException>(() => service.IssueNextInvoiceAsync(first.Id)); // one open invoice at a time
    }

    [PostgresFact]
    public async Task Suspension_RemovesAllAccess_AndReactivationRestoresThePreviousState()
    {
        var company = await Env.CreateRegisteredCompanyAsync("Paused Co");
        await Env.WithSubscriptionsAsync(s => s.SuspendAsync(company.Id, "Unpaid for three months", Admin));
        Assert.Equal(CompanyAccessLevel.None, (await Env.EntitlementsAsync(company.Id)).Access);

        await Assert.ThrowsAsync<ValidationException>(() => Env.WithSubscriptionsAsync(s => s.ReactivateAsync(company.Id, " ", Admin)));
        await Env.WithSubscriptionsAsync(s => s.ReactivateAsync(company.Id, "Paid in full", Admin));

        var subscription = await Env.WithCatalogAsync(c => c.Subscriptions.SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent));
        Assert.Equal(SubscriptionStatus.Trialing, subscription.Status);
        var events = await Env.WithCatalogAsync(c => c.SubscriptionEvents.Where(e => e.SubscriptionId == subscription.Id)
            .OrderBy(e => e.CreatedAt).Select(e => e.EventType).ToListAsync());
        Assert.Equal(new[] { "trial_started", "suspended", "reactivated" }, events);
    }

    [PostgresFact]
    public async Task CancelingAtPeriodEnd_KeepsAccessUntilThen_ThenNinetyDaysReadOnly()
    {
        var company = (await Env.CreateCompanyAsync("Leaving Co",
            new CompanyPlan("starter", BillingInterval.Year, new Dictionary<string, int>(), DateTime.UtcNow.AddMonths(6)))).Company;

        await Env.WithSubscriptionsAsync(s => s.CancelAsync(company.Id, atPeriodEnd: true, "Closing the business", Admin));
        Assert.Equal(CompanyAccessLevel.Full, (await Env.EntitlementsAsync(company.Id)).Access);

        await Env.EditSubscriptionAsync(company.Id, s => s.CurrentPeriodEnd = DateTime.UtcNow.AddMinutes(-1));
        await Env.WithSubscriptionsAsync(s => s.RunLifecycleAsync(DateTime.UtcNow));

        var canceled = await Env.WithCatalogAsync(c => c.Subscriptions.SingleAsync(s => s.CompanyId == company.Id && s.IsCurrent));
        Assert.Equal(SubscriptionStatus.Canceled, canceled.Status);
        Assert.InRange(canceled.RetainUntil!.Value - DateTime.UtcNow, TimeSpan.FromDays(89.9), TimeSpan.FromDays(90));
        Assert.Equal(CompanyAccessLevel.ReadOnly, (await Env.EntitlementsAsync(company.Id)).Access);
        Assert.False(await Env.WithCatalogAsync(c => c.BillingInvoices.AnyAsync(i => i.CompanyId == company.Id)));
    }

    [PostgresFact]
    public async Task ThePlansUserLimit_IsEnforcedOnCreateAndReactivate_AndAPackRaisesIt()
    {
        var company = await Env.CreateRegisteredCompanyAsync("Small Team",
            new CompanyPlan("starter", BillingInterval.Month, new Dictionary<string, int>(), DateTime.UtcNow.AddMonths(1)));
        var ownerId = await OwnerIdAsync(company.Id);

        async Task<UserDto> CreateUser(string username)
        {
            await using var scope = Env.CompanyScope(company.Id);
            return await scope.ServiceProvider.GetRequiredService<IUserService>().CreateUserAsync(new CreateUserRequest
            {
                FullName = username, Username = username, Password = PlatformTestEnvironment.OwnerPassword,
                ConfirmPassword = PlatformTestEnvironment.OwnerPassword, Role = "Staff"
            }, ownerId, isOwner: true);
        }

        // Starter = 3 users, the Owner included.
        await CreateUser("staff1");
        var staff2 = await CreateUser("staff2");
        var full = await Assert.ThrowsAsync<ValidationException>(() => CreateUser("staff3"));
        Assert.Contains("allows 3 active users", full.Message);

        // Deactivating frees a seat; reactivating needs one again.
        await using (var scope = Env.CompanyScope(company.Id))
            await scope.ServiceProvider.GetRequiredService<IUserService>().ToggleUserStatusAsync(staff2.Id, ownerId);
        await CreateUser("staff3");
        await using (var scope = Env.CompanyScope(company.Id))
            await Assert.ThrowsAsync<ValidationException>(() =>
                scope.ServiceProvider.GetRequiredService<IUserService>().ToggleUserStatusAsync(staff2.Id, ownerId));

        // A 5-user pack: 8 users.
        await Env.WithSubscriptionsAsync(s => s.ChangeAsync(company.Id,
            new SubscriptionChange(AddOns: new Dictionary<string, int> { ["seats_5"] = 1 }), Admin));
        Assert.Equal(8, (await Env.EntitlementsAsync(company.Id)).SeatLimit);
        await using (var scope = Env.CompanyScope(company.Id))
            await scope.ServiceProvider.GetRequiredService<IUserService>().ToggleUserStatusAsync(staff2.Id, ownerId);
    }

    [PostgresFact]
    public async Task ChangingThePlan_ChangesFeaturesAtOnce_AndKeepsAddOnHistory()
    {
        var company = (await Env.CreateCompanyAsync("Upgrader",
            new CompanyPlan("starter", BillingInterval.Month, new Dictionary<string, int> { ["showroom"] = 1 }, DateTime.UtcNow.AddMonths(1)))).Company;
        var before = await Env.EntitlementsAsync(company.Id);
        Assert.False(before.Has(FeatureKeys.WhatsAppAutomation));
        Assert.True(before.Has(FeatureKeys.Showroom));

        await Env.WithSubscriptionsAsync(s => s.ChangeAsync(company.Id,
            new SubscriptionChange(PlanCode: "professional", AddOns: new Dictionary<string, int>()), Admin));

        var after = await Env.EntitlementsAsync(company.Id);
        Assert.True(after.Has(FeatureKeys.WhatsAppAutomation));
        Assert.False(after.Has(FeatureKeys.Showroom));
        Assert.Equal(10, after.SeatLimit);
        var items = await Env.WithCatalogAsync(c => c.SubscriptionItems.Where(i => i.Subscription!.CompanyId == company.Id).ToListAsync());
        Assert.Single(items);
        Assert.NotNull(items[0].EffectiveTo); // the showroom item is closed, not deleted
    }

    [PostgresFact]
    public async Task TheAuditLog_AndSubscriptionHistory_CannotBeChangedOrDeleted()
    {
        var company = (await Env.CreateCompanyAsync("Audited Co")).Company;
        await using (var scope = Env.Scope())
            await scope.ServiceProvider.GetRequiredService<PlatformAuditService>().RecordAsync("test.action", company.Id, null, new { ok = true }, "testing");

        await using var connection = new NpgsqlConnection(PlatformTestEnvironment.AdminConnection(Env.CatalogDatabase));
        await connection.OpenAsync();
        foreach (var sql in new[]
                 {
                     """UPDATE "PlatformAuditLogs" SET "Action" = 'changed'""",
                     """DELETE FROM "PlatformAuditLogs" """,
                     """UPDATE "SubscriptionEvents" SET "EventType" = 'changed'""",
                     """DELETE FROM "SubscriptionEvents" """
                 })
        {
            await using var command = new NpgsqlCommand(sql, connection);
            var error = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteNonQueryAsync());
            Assert.Contains("append-only", error.MessageText);
        }
    }

    [PostgresFact]
    public async Task ACompanyStartedOnAPaidPlan_GetsThatPlanAndItsAddOns()
    {
        var company = (await Env.CreateCompanyAsync("Franchisor Co", new CompanyPlan("professional", BillingInterval.Year,
            new Dictionary<string, int> { ["showroom"] = 1, ["franchise_network"] = 1 }, DateTime.UtcNow.AddYears(1)))).Company;

        var entitlements = await Env.EntitlementsAsync(company.Id);
        Assert.Equal(SubscriptionStatus.Active, entitlements.Status);
        Assert.Equal(BillingInterval.Year, entitlements.Interval);
        Assert.True(entitlements.Has(FeatureKeys.Showroom));
        Assert.True(entitlements.Has(FeatureKeys.FranchiseNetwork));
        Assert.Equal(10, entitlements.Number(FeatureKeys.FranchiseNetworkBranches));
    }

    private async Task<Guid> OwnerIdAsync(Guid companyId)
    {
        await using var scope = Env.CompanyScope(companyId);
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.Database.AppDbContext>();
        return await db.Users.Where(u => u.Role == Domain.Enums.UserRole.Owner).Select(u => u.Id).SingleAsync();
    }
}
