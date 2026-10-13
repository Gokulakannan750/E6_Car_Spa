using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Franchise;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Franchise sign-up codes: a franchisor makes a short-lived code, a new business enters it on the sign-up website,
/// consents, and its new company is linked to the franchisor as soon as it is created. Anything that goes wrong
/// leaves the company created as an independent one, with the reason.
/// </summary>
public class PlatformFranchiseSignupCodeTests : IAsyncLifetime
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

    private static SignupBusiness Business(string name) => new(name, "New Owner", $"9{Random.Shared.Next(100_000_000, 999_999_999)}",
        $"{Guid.NewGuid():N}@franchisee.test", "Salem", "Tamil Nadu", null);

    private static readonly PlanChoice Starter = new("starter", BillingInterval.Month, new LicenceCounts(0, 0, 1), new Dictionary<string, int>());

    private async Task<CreatedFranchiseSignupCodeDto> NewCodeAsync(PlatformCompany franchisor, params string[] scopes)
    {
        await using var scope = Env.CompanyScope(franchisor.Id);
        return await scope.ServiceProvider.GetRequiredService<IFranchiseSignupCodeService>()
            .CreateAsync(new CreateFranchiseSignupCodeRequest { Scopes = scopes.ToList(), Label = "Salem" });
    }

    private async Task<T> AsCompanyAsync<T>(PlatformCompany company, Func<IFranchiseSignupCodeService, Task<T>> work)
    {
        await using var scope = Env.CompanyScope(company.Id);
        return await work(scope.ServiceProvider.GetRequiredService<IFranchiseSignupCodeService>());
    }

    private async Task<T> SignupAsync<T>(Func<SignupService, Task<T>> work)
    {
        await using var scope = Env.Scope();
        return await work(scope.ServiceProvider.GetRequiredService<SignupService>());
    }

    private Task<FranchiseLink?> LinkToAsync(Guid franchiseeId) =>
        Env.WithCatalogAsync(c => c.FranchiseLinks.Include(l => l.Scopes).SingleOrDefaultAsync(l => l.FranchiseeOrganizationId == franchiseeId));

    private async Task<Guid> CompanyIdAsync(string code) =>
        await Env.WithCatalogAsync(c => c.Companies.Where(x => x.Code == code).Select(x => x.Id).SingleAsync());

    [PostgresFact]
    public async Task ATrialWithACodeAndConsent_IsLinkedAtOnce_WithTheRequestedItemsAllowed()
    {
        var franchisor = await Env.CreateRegisteredCompanyAsync("E6 Head Office", FranchisorPlan);
        var created = await NewCodeAsync(franchisor, FranchiseScopes.FinancialTotals, FranchiseScopes.InvoiceList);
        Assert.Matches("^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$", created.Code);
        Assert.Equal("Open", created.Item.Status);
        Assert.InRange(created.Item.ExpiresAt, DateTime.UtcNow.AddMinutes(55), DateTime.UtcNow.AddMinutes(61)); // 1 hour by default

        // The code is stored only as a hash.
        Assert.False(await Env.WithCatalogAsync(c => c.FranchiseSignupCodes.AnyAsync(x => x.CodeHash.Contains(created.Code.Replace("-", "")))));

        // The website's check shows who the franchisor is and what they ask to see (case and dashes don't matter).
        var check = await SignupAsync(async _ =>
        {
            await using var scope = Env.Scope();
            return (await scope.ServiceProvider.GetRequiredService<FranchiseSignupCodeRedemption>().CheckAsync(created.Code.ToLowerInvariant().Replace("-", " "))).Check;
        });
        Assert.Equal("E6 Head Office", check.FranchisorName);
        Assert.Equal([FranchiseScopes.FinancialTotals, FranchiseScopes.InvoiceList], check.Scopes.Select(s => s.Scope));

        var result = await SignupAsync(s => s.CreateAsync(new SignupRequest(Business("E6 Salem"), true, null, true, created.Code, true), null));
        Assert.True(result.FranchiseLinked);
        Assert.Equal("E6 Head Office", result.FranchisorName);
        Assert.Null(result.FranchiseProblem);

        var franchiseeId = await CompanyIdAsync(result.CompanyCode!);
        var link = await LinkToAsync(franchiseeId);
        Assert.NotNull(link);
        Assert.Equal(franchisor.Id, link!.FranchisorOrganizationId);
        Assert.Equal(FranchiseLinkStatus.Active, link.Status);
        Assert.All(link.Scopes, s => Assert.Equal(FranchiseScopeStatus.Granted, s.Status));
        Assert.Equal(2, link.Scopes.Count);

        var list = await AsCompanyAsync(franchisor, s => s.ListAsync());
        Assert.True(list.Available);
        Assert.Equal(60, list.LifetimeMinutes);
        var used = Assert.Single(list.Codes);
        Assert.Equal("Used", used.Status);
        Assert.Equal("E6 Salem", used.UsedByCompanyName);

        // Single-use.
        var again = await Assert.ThrowsAsync<NotFoundException>(() =>
            SignupAsync(s => s.CreateAsync(new SignupRequest(Business("Second"), true, null, true, created.Code, true), null)));
        Assert.Equal(FranchiseSignupCodeRules.NotValidMessage, again.Message);
    }

    [PostgresFact]
    public async Task WithoutConsent_NothingIsCreated_AndTheCodeStaysOpen()
    {
        var franchisor = await Env.CreateRegisteredCompanyAsync("Consent Franchisor", FranchisorPlan);
        var created = await NewCodeAsync(franchisor);
        var business = Business("No Consent Spa");

        var refused = await Assert.ThrowsAsync<ValidationException>(() =>
            SignupAsync(s => s.CreateAsync(new SignupRequest(business, true, null, true, created.Code, false), null)));
        Assert.Contains("Tick the box", refused.Message);
        Assert.False(await Env.WithCatalogAsync(c => c.SignupOrders.AnyAsync(o => o.Email == business.Email)));
        Assert.Equal("Open", Assert.Single((await AsCompanyAsync(franchisor, s => s.ListAsync())).Codes).Status);
    }

    [PostgresFact]
    public async Task UnknownExpiredAndWithdrawnCodes_AllGetTheSameAnswer()
    {
        var franchisor = await Env.CreateRegisteredCompanyAsync("Answers Franchisor", FranchisorPlan);
        var expired = await NewCodeAsync(franchisor);
        var withdrawn = await NewCodeAsync(franchisor);
        await Env.WithCatalogAsync(async c =>
        {
            var row = await c.FranchiseSignupCodes.SingleAsync(x => x.Id == expired.Item.Id);
            row.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            return await c.SaveChangesAsync();
        });
        Assert.Equal("Cancelled", (await AsCompanyAsync(franchisor, s => s.CancelAsync(withdrawn.Item.Id))).Status);

        await using var scope = Env.Scope();
        var redemption = scope.ServiceProvider.GetRequiredService<FranchiseSignupCodeRedemption>();
        foreach (var code in new[] { RegistrationCodes.Generate(), expired.Code, withdrawn.Code, "short", "" })
        {
            var refused = await Assert.ThrowsAsync<NotFoundException>(() => redemption.CheckAsync(code));
            Assert.Equal(FranchiseSignupCodeRules.NotValidMessage, refused.Message);
        }
    }

    [PostgresFact]
    public async Task OnlyAFranchisorWithTheAddOnAndAFreeBranch_CanMakeCodes()
    {
        var plain = await Env.CreateRegisteredCompanyAsync("No Add-on Co");
        var noAddOn = await Assert.ThrowsAsync<ConflictException>(() => NewCodeAsync(plain));
        Assert.Contains("Franchise network is not active", noAddOn.Message);

        // Open codes count against the plan's 10 franchise branches, like open invitations.
        var franchisor = await Env.CreateRegisteredCompanyAsync("Ten Codes Co", FranchisorPlan);
        for (var i = 0; i < 10; i++) await NewCodeAsync(franchisor);
        var full = await Assert.ThrowsAsync<ConflictException>(() => NewCodeAsync(franchisor));
        Assert.Contains("covers 10 franchise branches", full.Message);

        // Withdrawing one frees its place.
        var first = (await AsCompanyAsync(franchisor, s => s.ListAsync())).Codes[0];
        await AsCompanyAsync(franchisor, s => s.CancelAsync(first.Id));
        await NewCodeAsync(franchisor);
    }

    [PostgresFact]
    public async Task APaidOrder_ReservesTheCode_AndAWithdrawnCodeStillCreatesTheCompany_Unlinked()
    {
        var franchisor = await Env.CreateRegisteredCompanyAsync("Reserve Franchisor", FranchisorPlan);
        var created = await NewCodeAsync(franchisor);

        var order = await SignupAsync(s => s.CreateAsync(new SignupRequest(Business("Paid Franchisee"), false, Starter, true, created.Code, true), null));
        Assert.Equal(SignupStatus.AwaitingPayment, order.Status);
        Assert.Equal("Reserve Franchisor", order.FranchisorName);
        Assert.Equal("Reserved", Assert.Single((await AsCompanyAsync(franchisor, s => s.ListAsync())).Codes).Status);

        // Nobody else can use it while the order waits for payment.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            SignupAsync(s => s.CreateAsync(new SignupRequest(Business("Someone Else"), true, null, true, created.Code, true), null)));

        // The franchisor withdraws it; the payment still creates the company, as an independent one, with the reason.
        await AsCompanyAsync(franchisor, s => s.CancelAsync(created.Item.Id));
        var paid = await SignupAsync(async s =>
        {
            var row = await Env.WithCatalogAsync(c => c.SignupOrders.SingleAsync(o => o.Id == order.OrderId));
            await using var scope = Env.Scope();
            var service = scope.ServiceProvider.GetRequiredService<SignupService>();
            var tracked = await scope.ServiceProvider.GetRequiredService<PlatformDbContext>().SignupOrders.SingleAsync(o => o.Id == row.Id);
            return await service.CompletePaidAsync(tracked, "Test", $"TEST-{row.Id:N}", row.AmountMinor);
        });
        Assert.Equal(SignupStatus.Completed, paid.Status);
        Assert.NotNull(paid.CompanyCode);
        Assert.False(paid.FranchiseLinked);
        Assert.Contains("withdrew", paid.FranchiseProblem);
        Assert.Null(await LinkToAsync(await CompanyIdAsync(paid.CompanyCode!)));
    }

    [PostgresFact]
    public async Task APaidOrder_IsLinkedOnPayment()
    {
        var franchisor = await Env.CreateRegisteredCompanyAsync("Paid Link Franchisor", FranchisorPlan);
        var created = await NewCodeAsync(franchisor, FranchiseScopes.FinancialTotals);
        var order = await SignupAsync(s => s.CreateAsync(new SignupRequest(Business("Paid Linked"), false, Starter, true, created.Code, true), null));

        await using var scope = Env.Scope();
        var tracked = await scope.ServiceProvider.GetRequiredService<PlatformDbContext>().SignupOrders.SingleAsync(o => o.Id == order.OrderId);
        var paid = await scope.ServiceProvider.GetRequiredService<SignupService>().CompletePaidAsync(tracked, "Test", "TEST-1", tracked.AmountMinor);
        Assert.True(paid.FranchiseLinked);
        var link = await LinkToAsync(await CompanyIdAsync(paid.CompanyCode!));
        Assert.Equal(FranchiseLinkStatus.Active, link!.Status);
        Assert.Equal(FranchiseScopes.FinancialTotals, Assert.Single(link.Scopes).Scope);
    }

    [PostgresFact]
    public async Task AFranchisorThatLapsed_GetsNoLink_ButTheTrialCompanyIsCreated()
    {
        var franchisor = await Env.CreateRegisteredCompanyAsync("Lapsing Franchisor", FranchisorPlan);
        var created = await NewCodeAsync(franchisor);
        var order = await SignupAsync(s => s.CreateAsync(new SignupRequest(Business("Lapse Franchisee"), false, Starter, true, created.Code, true), null));

        await Env.EditSubscriptionAsync(franchisor.Id, s => s.Status = SubscriptionStatus.ReadOnly);
        await Env.EntitlementsAsync(franchisor.Id); // clears the 30-second cache

        await using var scope = Env.Scope();
        var tracked = await scope.ServiceProvider.GetRequiredService<PlatformDbContext>().SignupOrders.SingleAsync(o => o.Id == order.OrderId);
        var paid = await scope.ServiceProvider.GetRequiredService<SignupService>().CompletePaidAsync(tracked, "Test", "TEST-2", tracked.AmountMinor);
        Assert.Equal(SignupStatus.Completed, paid.Status);
        Assert.False(paid.FranchiseLinked);
        Assert.Contains("not active", paid.FranchiseProblem);
    }

    [PostgresFact]
    public async Task TwoSignupsRacingForOneCode_OnlyOneGetsIt()
    {
        var franchisor = await Env.CreateRegisteredCompanyAsync("Race Franchisor", FranchisorPlan);
        var created = await NewCodeAsync(franchisor);

        async Task<bool> TryReserve()
        {
            await using var scope = Env.Scope();
            try
            {
                await scope.ServiceProvider.GetRequiredService<FranchiseSignupCodeRedemption>()
                    .ReserveAsync(created.Code, Guid.NewGuid(), DateTime.UtcNow.AddHours(1));
                return true;
            }
            catch (NotFoundException)
            {
                return false;
            }
        }

        var results = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => TryReserve()));
        Assert.Equal(1, results.Count(r => r));
    }

    [PostgresFact]
    public async Task TheLifetime_ComesFromThePlatformSettings_WithinLimits()
    {
        await Env.CreateCompanyAsync("Catalog first"); // the catalog exists before settings are saved
        await using (var scope = Env.Scope())
        {
            var settings = scope.ServiceProvider.GetRequiredService<PlatformSettingsService>();
            await Assert.ThrowsAsync<ValidationException>(() =>
                settings.SaveAsync(new Dictionary<string, int> { [PlatformSettingsService.FranchiseCodeMinutesKey] = 5 }, "test"));
            Assert.Equal(15, (await settings.SaveAsync(new Dictionary<string, int> { [PlatformSettingsService.FranchiseCodeMinutesKey] = 15 }, "test"))
                .FranchiseCodeMinutes);
        }

        var franchisor = await Env.CreateRegisteredCompanyAsync("Short Codes Co", FranchisorPlan);
        var created = await NewCodeAsync(franchisor);
        Assert.InRange(created.Item.ExpiresAt, DateTime.UtcNow.AddMinutes(14), DateTime.UtcNow.AddMinutes(16));
    }
}
