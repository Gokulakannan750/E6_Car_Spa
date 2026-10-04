using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Line = CarSpaManagement.Api.Application.Common.InvoiceCalculator.LineInput;
using JobCardServiceApp = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

/// <summary>Phase 0 (P0-3): invoice totals must be derived from lines (line discounts and per-line GST rates).</summary>
public class InvoiceCalculationTests
{
    // ── Pure calculator ─────────────────────────────────────────────────────

    [Fact]
    public void Test1_NoDiscount_SingleLine_18Percent()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 1000m, 0m, 18m)], 0m, isGstEnabled: true);

        Assert.Equal(1000m, r.Subtotal);
        Assert.Equal(1000m, r.Taxable);
        Assert.Equal(90m, r.Cgst);
        Assert.Equal(90m, r.Sgst);
        Assert.Equal(180m, r.GstAmount);
        Assert.Equal(1180m, r.Total);
    }

    [Fact]
    public void Test2_FixedLineDiscount_ReducesTaxableValueBeforeGst()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 1000m, 100m, 18m)], 0m, isGstEnabled: true);

        Assert.Equal(1000m, r.Lines[0].Gross);
        Assert.Equal(900m, r.Lines[0].Taxable);
        Assert.Equal(81m, r.Cgst);
        Assert.Equal(81m, r.Sgst);
        // Old behaviour: header ignored the discount (₹1,180) and lines taxed the gross (₹1,080).
        Assert.Equal(1062m, r.Total);
    }

    [Fact]
    public void Test3_MultipleLines_DifferentPricesAndQuantities()
    {
        var r = InvoiceCalculator.Calculate(
            [new Line(2, 500m, 0m, 18m), new Line(3, 250m, 50m, 18m)],
            0m, isGstEnabled: true);

        Assert.Equal(1700m, r.Subtotal);       // 1000 + (750 − 50)
        Assert.Equal(1700m, r.Taxable);
        Assert.Equal(306m, r.GstAmount);
        Assert.Equal(2006m, r.Total);
        Assert.Equal(r.Total, r.Lines.Sum(l => l.Total));
    }

    [Fact]
    public void Test4_DifferentTaxRates_UsePerLineRates_NotFlat18()
    {
        var r = InvoiceCalculator.Calculate(
            [new Line(1, 1000m, 0m, 18m), new Line(1, 1000m, 0m, 5m), new Line(1, 500m, 0m, 28m)],
            0m, isGstEnabled: true);

        Assert.Equal(2500m, r.Taxable);
        Assert.Equal(90m + 25m + 70m, r.Cgst);
        Assert.Equal(r.Cgst, r.Sgst);
        Assert.Equal(370m, r.GstAmount);       // flat 18% would have charged ₹450
        Assert.Equal(2870m, r.Total);
    }

    [Fact]
    public void Test5_ZeroDiscounts_EqualNoDiscount()
    {
        var withZero = InvoiceCalculator.Calculate([new Line(1, 1000m, 0m, 18m)], 0m, true);
        Assert.Equal(1180m, withZero.Total);
        Assert.Equal(0m, withZero.InvoiceDiscount);
        Assert.Equal(0m, withZero.Lines[0].AllocatedInvoiceDiscount);
    }

    [Fact]
    public void Test6_LineDiscountPlusInvoiceDiscount_AllocatedProRata()
    {
        // Lines net 900 and 500 (subtotal 1400); invoice discount 140 → shares 90 and 50.
        var r = InvoiceCalculator.Calculate(
            [new Line(1, 1000m, 100m, 18m), new Line(1, 500m, 0m, 18m)],
            140m, isGstEnabled: true);

        Assert.Equal(1400m, r.Subtotal);
        Assert.Equal(140m, r.InvoiceDiscount);
        Assert.Equal(90m, r.Lines[0].AllocatedInvoiceDiscount);
        Assert.Equal(50m, r.Lines[1].AllocatedInvoiceDiscount);
        Assert.Equal(1260m, r.Taxable);
        Assert.Equal(226.80m, r.GstAmount);
        Assert.Equal(1486.80m, r.Total);
        Assert.Equal(r.Subtotal - r.InvoiceDiscount, r.Taxable);
    }

    [Fact]
    public void Test6b_InvoiceDiscountAcrossMixedRates_TaxesEachShareAtItsOwnRate()
    {
        var r = InvoiceCalculator.Calculate(
            [new Line(1, 1000m, 0m, 18m), new Line(1, 1000m, 0m, 5m)],
            200m, isGstEnabled: true);

        Assert.Equal(900m, r.Lines[0].Taxable);
        Assert.Equal(900m, r.Lines[1].Taxable);
        Assert.Equal(162m + 45m, r.GstAmount);
        Assert.Equal(2007m, r.Total);
    }

    [Fact]
    public void Test7_Rounding_TwoDecimalPlaces_PerLineHalves()
    {
        // 3 × 333.33 = 999.99; 9% = 89.9991 → 90.00 for each half.
        var r = InvoiceCalculator.Calculate([new Line(3, 333.33m, 0m, 18m)], 0m, true);
        Assert.Equal(999.99m, r.Taxable);
        Assert.Equal(90.00m, r.Cgst);
        Assert.Equal(90.00m, r.Sgst);
        Assert.Equal(1179.99m, r.Total);
    }

    [Fact]
    public void Test7b_Rounding_KeepsExistingMidpointRule_ToEven()
    {
        // 0.50 × 9% = 0.045 → 0.04 under the existing .NET Math.Round (to-even) rule. Documented, not changed.
        var r = InvoiceCalculator.Calculate([new Line(1, 0.50m, 0m, 18m)], 0m, true);
        Assert.Equal(0.04m, r.Cgst);
        Assert.Equal(0.04m, r.Sgst);
        Assert.Equal(MidpointRounding.ToEven, InvoiceCalculator.Rounding);
    }

    [Fact]
    public void Test7c_Rounding_DiscountAllocationRemainder_SumsExactly()
    {
        var r = InvoiceCalculator.Calculate(
            [new Line(1, 100m, 0m, 18m), new Line(1, 100m, 0m, 18m), new Line(1, 100m, 0m, 18m)],
            100m, true);

        Assert.Equal(100m, r.Lines.Sum(l => l.AllocatedInvoiceDiscount));
        Assert.Equal(200m, r.Taxable);
        Assert.Equal(r.Total, r.Lines.Sum(l => l.Total));
    }

    [Fact]
    public void GstDisabled_ProducesNoTax_RegardlessOfRates()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 1000m, 100m, 18m)], 0m, isGstEnabled: false);
        Assert.Equal(0m, r.GstAmount);
        Assert.Equal(900m, r.Total);
    }

    [Fact]
    public void LineDiscountGreaterThanLineAmount_IsRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            InvoiceCalculator.Calculate([new Line(1, 100m, 100.01m, 18m)], 0m, true));
    }

    [Fact]
    public void InvoiceDiscountGreaterThanSubtotal_IsRejected()
    {
        var ex = Assert.Throws<ArgumentOutOfRangeException>(() =>
            InvoiceCalculator.Calculate([new Line(1, 1000m, 100m, 18m)], 900.01m, true));
        Assert.Contains("Discount cannot exceed subtotal", ex.Message);
    }

    [Fact]
    public void NegativeValues_AreRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => InvoiceCalculator.Calculate([new Line(1, 100m, -1m, 18m)], 0m, true));
        Assert.Throws<ArgumentOutOfRangeException>(() => InvoiceCalculator.Calculate([new Line(1, -100m, 0m, 18m)], 0m, true));
        Assert.Throws<ArgumentOutOfRangeException>(() => InvoiceCalculator.Calculate([new Line(1, 100m, 0m, 18m)], -1m, true));
        Assert.Throws<ArgumentOutOfRangeException>(() => InvoiceCalculator.Calculate([new Line(0, 100m, 0m, 18m)], 0m, true));
    }

    // ── Service integration (job card → invoice) ────────────────────────────

    private sealed record Ctx(AppDbContext Db, IInvoiceService Invoices, IJobCardService JobCards);

    private static Ctx Create()
    {
        var services = new ServiceCollection();
        var dbName = Guid.NewGuid().ToString();
        services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(dbName)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddSingleton<IAuditLogService, RecordingAuditLogService>();
        services.AddSingleton<IWhatsAppService, NoopWhatsAppService>();
        services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
        services.AddScoped<IInvoiceService, InvoiceService>();
        var scope = services.BuildServiceProvider().CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return new Ctx(db,
            scope.ServiceProvider.GetRequiredService<IInvoiceService>(),
            new JobCardServiceApp(db, scope.ServiceProvider.GetRequiredService<IAuditLogService>()));
    }

    private static async Task<(Guid customerId, Guid vehicleId)> SeedCustomerAsync(AppDbContext db)
    {
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Test Customer", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = $"TN{Random.Shared.Next(10, 99)}AB{Random.Shared.Next(1000, 9999)}", Make = "Hyundai", Model = "Creta" };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        await db.SaveChangesAsync();
        return (customer.Id, vehicle.Id);
    }

    private static async Task<Service> SeedServiceAsync(AppDbContext db, decimal price, decimal taxPercent)
    {
        var s = new Service { Id = Guid.NewGuid(), Name = $"Service {price}@{taxPercent}", Category = "Exterior", Price = price, TaxPercentage = taxPercent, IsActive = true };
        db.Services.Add(s);
        await db.SaveChangesAsync();
        return s;
    }

    [Fact]
    public async Task InvoiceFromJobCard_WithLineDiscount_ChargesDiscountedAmountAndReconciles()
    {
        var ctx = Create();
        var (customerId, vehicleId) = await SeedCustomerAsync(ctx.Db);
        var svc = await SeedServiceAsync(ctx.Db, 1000m, 18m);

        var jobCard = await ctx.JobCards.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId,
            VehicleId = vehicleId,
            Services = [new JobCardServiceItemRequest { ServiceId = svc.Id, Quantity = 1, DiscountAmount = 100m }],
        });
        Assert.Equal(1062m, jobCard.TotalAmount);

        var invoice = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));

        Assert.Equal(900m, invoice.Subtotal);
        Assert.Equal(900m, invoice.TaxableAmount);
        Assert.Equal(162m, invoice.GstAmount);
        Assert.Equal(1062m, invoice.TotalAmount);
        Assert.Equal(1062m, invoice.BalanceAmount);
        Assert.Equal(jobCard.TotalAmount, invoice.TotalAmount);

        var stored = await ctx.Db.Invoices.Include(i => i.InvoiceItems).SingleAsync(i => i.Id == invoice.Id);
        Assert.Equal(stored.TotalAmount, stored.InvoiceItems.Sum(i => i.TotalAmount));
        Assert.Equal(stored.TaxableAmount, stored.InvoiceItems.Sum(i => i.TaxableAmount));
        Assert.Equal(stored.GstAmount, stored.InvoiceItems.Sum(i => i.TaxAmount));
    }

    [Fact]
    public async Task InvoiceFromJobCard_MixedRates_UsesEachServiceRate()
    {
        var ctx = Create();
        var (customerId, vehicleId) = await SeedCustomerAsync(ctx.Db);
        var s18 = await SeedServiceAsync(ctx.Db, 1000m, 18m);
        var s5 = await SeedServiceAsync(ctx.Db, 1000m, 5m);

        var jobCard = await ctx.JobCards.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId,
            VehicleId = vehicleId,
            Services = [new JobCardServiceItemRequest { ServiceId = s18.Id }, new JobCardServiceItemRequest { ServiceId = s5.Id }],
        });

        var invoice = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));

        Assert.Equal(2000m, invoice.TaxableAmount);
        Assert.Equal(180m + 50m, invoice.GstAmount);
        Assert.Equal(2230m, invoice.TotalAmount);
        Assert.Equal(jobCard.TotalAmount, invoice.TotalAmount);
    }

    [Fact]
    public async Task DraftInvoiceDiscountEdit_RecalculatesFromLines_AndGenerateKeepsTotals()
    {
        var ctx = Create();
        var (customerId, vehicleId) = await SeedCustomerAsync(ctx.Db);
        var svc = await SeedServiceAsync(ctx.Db, 1000m, 18m);
        var jobCard = await ctx.JobCards.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId,
            VehicleId = vehicleId,
            Services = [new JobCardServiceItemRequest { ServiceId = svc.Id, Quantity = 2, DiscountAmount = 200m }],
        });
        var draft = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.Equal(1800m, draft.Subtotal);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            ctx.Invoices.UpdateAsync(draft.Id, new UpdateInvoiceRequest(1800.01m, null, null)));

        var edited = await ctx.Invoices.UpdateAsync(draft.Id, new UpdateInvoiceRequest(300m, null, null));
        Assert.NotNull(edited);
        Assert.Equal(300m, edited!.Discount);
        Assert.Equal(1500m, edited.TaxableAmount);
        Assert.Equal(270m, edited.GstAmount);
        Assert.Equal(1770m, edited.TotalAmount);

        var generated = await ctx.Invoices.GenerateInvoiceAsync(draft.Id);
        Assert.Equal(1770m, generated.TotalAmount);
        Assert.Equal(1770m, generated.BalanceAmount);
        Assert.False(string.IsNullOrEmpty(generated.InvoiceNumber));
    }

    [Fact]
    public async Task DraftInvoice_EnablingGstOnNonGstJobCard_UsesStandardRateFallback()
    {
        var ctx = Create();
        var (customerId, vehicleId) = await SeedCustomerAsync(ctx.Db);
        var svc = await SeedServiceAsync(ctx.Db, 1000m, 18m);
        var jobCard = await ctx.JobCards.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId,
            VehicleId = vehicleId,
            IsGstEnabled = false,
            Services = [new JobCardServiceItemRequest { ServiceId = svc.Id }],
        });
        var draft = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.False(draft.IsGstEnabled);
        Assert.Equal(1000m, draft.TotalAmount);

        var withGst = await ctx.Invoices.UpdateAsync(draft.Id, new UpdateInvoiceRequest(null, null, null, IsGstEnabled: true));
        Assert.Equal(180m, withGst!.GstAmount);
        Assert.Equal(1180m, withGst.TotalAmount);
    }

    [Fact]
    public async Task JobCard_LineDiscountAboveLineAmount_IsRejected()
    {
        var ctx = Create();
        var (customerId, vehicleId) = await SeedCustomerAsync(ctx.Db);
        var svc = await SeedServiceAsync(ctx.Db, 500m, 18m);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => ctx.JobCards.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId,
            VehicleId = vehicleId,
            Services = [new JobCardServiceItemRequest { ServiceId = svc.Id, DiscountAmount = 600m }],
        }));
    }
}
