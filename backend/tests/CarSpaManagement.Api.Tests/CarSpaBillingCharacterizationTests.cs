using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public sealed class CarSpaBillingCharacterizationTests
{
    [PostgresFact]
    public async Task ExistingCarSpaAmountsAndSeatsRemainUnchanged()
    {
        await using var env = new PlatformTestEnvironment();
        var licences = new LicenceCounts(2, 1, 3);
        var addOns = new Dictionary<string, int>();
        var company = (await env.CreateCompanyAsync("Characterization paid",
            new CompanyPlan("starter", BillingInterval.Month, addOns, DateTime.UtcNow.AddMonths(1), licences))).Company;
        var entitlement = await env.EntitlementsAsync(company.Id);
        Assert.Equal(licences, entitlement.Licences);
        Assert.Equal(6, entitlement.SeatLimit);

        await using (var scope = env.Scope())
        {
            var services = scope.ServiceProvider;
            var quotes = services.GetRequiredService<PriceQuoteService>();
            var monthly = await quotes.QuoteAsync(company.ProductId,
                new PlanChoice("starter", BillingInterval.Month, licences, addOns), new PlatformOptions());
            var yearly = await quotes.QuoteAsync(company.ProductId,
                new PlanChoice("starter", BillingInterval.Year, licences, addOns), new PlatformOptions());
            Assert.Equal(469_400, monthly.TotalMinor);
            Assert.Equal(4_694_000, yearly.TotalMinor);
            var generic = await quotes.QuoteAsync(company.ProductId,
                new PlanChoice("starter", BillingInterval.Month, new LicenceCounts(0, 0, 0), addOns,
                    new Dictionary<string, int> { ["android"] = 2, ["windows"] = 1, ["both"] = 3 }), new PlatformOptions());
            Assert.Equal(monthly.TotalMinor, generic.TotalMinor);
            Assert.Equal(licences, generic.Licences);
        }

        var midpoint = DateTime.UtcNow;
        await env.EditSubscriptionAsync(company.Id, s =>
        {
            s.CurrentPeriodStart = midpoint.AddDays(-15);
            s.CurrentPeriodEnd = midpoint.AddDays(15);
        });
        await using (var scope = env.Scope())
        {
            var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var trialPlan = await catalog.Products.Where(p => p.Id == company.ProductId).Select(p => p.TrialPlanCode).SingleAsync();
            var preview = await scope.ServiceProvider.GetRequiredService<PlanChangeService>().PreviewAsync(company.Id,
                new PlanChangeTarget(trialPlan, BillingInterval.Month, licences, addOns));
            Assert.Equal(469_400, preview.CurrentPeriodPriceMinor);
            Assert.Equal(729_400, preview.NewPeriodPriceMinor);
            Assert.Equal(130_000, preview.AmountNowMinor);
            var invoice = await scope.ServiceProvider.GetRequiredService<SubscriptionService>().IssueNextInvoiceAsync(company.Id);
            Assert.Equal(469_400, invoice.TotalMinor);
        }

        var trial = (await env.CreateCompanyAsync("Characterization trial")).Company;
        var trialEntitlements = await env.EntitlementsAsync(trial.Id);
        Assert.Equal(new LicenceCounts(0, 0, 3), trialEntitlements.Licences);
        Assert.Equal(3, trialEntitlements.SeatLimit);
        Assert.Equal(3, await env.WithCatalogAsync(c => c.Subscriptions
            .Where(s => s.CompanyId == trial.Id && s.IsCurrent).SelectMany(s => s.Seats).SumAsync(s => s.Quantity)));
    }
}
