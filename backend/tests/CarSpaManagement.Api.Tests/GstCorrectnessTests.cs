using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
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

/// <summary>
/// Phase 1 (billing &amp; GST correctness): 0% is 0%, mixed rates are taxed per line, the amount previewed and
/// confirmed is the amount issued, and finalized invoices keep their stored values.
/// </summary>
public class GstCorrectnessTests
{
    // ── 1–12: authoritative calculator ──────────────────────────────────────

    [Fact]
    public void Case01_Single18Percent()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 10000m, 0m, 18m)], 0m, true);
        Assert.Equal((10000m, 900m, 900m, 11800m), (r.Taxable, r.Cgst, r.Sgst, r.Total));
    }

    [Fact]
    public void Case02_Single5Percent()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 10000m, 0m, 5m)], 0m, true);
        Assert.Equal((10000m, 250m, 250m, 10500m), (r.Taxable, r.Cgst, r.Sgst, r.Total));
    }

    [Fact]
    public void Case03_Single0Percent_IsNotTaxed()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 5000m, 0m, 0m)], 0m, true);
        Assert.Equal((5000m, 0m, 0m, 0m, 5000m), (r.Taxable, r.Cgst, r.Sgst, r.GstAmount, r.Total));
    }

    [Fact]
    public void Case04_MultipleLinesSameRate()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 1000m, 0m, 18m), new Line(1, 2500m, 0m, 18m)], 0m, true);
        Assert.Equal((3500m, 630m, 4130m), (r.Taxable, r.GstAmount, r.Total));
    }

    [Fact]
    public void Case05_Mixed18And5()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 10000m, 0m, 18m), new Line(1, 10000m, 0m, 5m)], 0m, true);
        Assert.Equal((20000m, 1150m, 1150m, 22300m), (r.Taxable, r.Cgst, r.Sgst, r.Total));
    }

    [Fact]
    public void Case06_Mixed18And0()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 10000m, 0m, 18m), new Line(1, 5000m, 0m, 0m)], 0m, true);
        Assert.Equal((15000m, 1800m, 16800m), (r.Taxable, r.GstAmount, r.Total));
        Assert.Equal(0m, r.Lines[1].Tax);
    }

    [Fact]
    public void Case07_Mixed18And5And0_EachLineAtItsOwnRate_HeaderEqualsSumOfLines()
    {
        var r = InvoiceCalculator.Calculate(
            [new Line(1, 10000m, 0m, 18m), new Line(1, 10000m, 0m, 5m), new Line(1, 5000m, 0m, 0m)], 0m, true);

        Assert.Equal([1800m, 500m, 0m], r.Lines.Select(l => l.Tax));
        Assert.Equal(25000m, r.Taxable);
        Assert.Equal(1150m, r.Cgst);
        Assert.Equal(1150m, r.Sgst);
        Assert.Equal(2300m, r.GstAmount);          // a flat 18% would have charged ₹4,500
        Assert.Equal(27300m, r.Total);
        Assert.Equal(r.Taxable, r.Lines.Sum(l => l.Taxable));
        Assert.Equal(r.Cgst, r.Lines.Sum(l => l.Cgst));
        Assert.Equal(r.Sgst, r.Lines.Sum(l => l.Sgst));
        Assert.Equal(r.Total, r.Lines.Sum(l => l.Total));
    }

    [Fact]
    public void Case08_FixedInvoiceDiscount_ReducesTaxableBeforeGst()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 10000m, 0m, 18m)], 1000m, true);
        Assert.Equal((9000m, 1620m, 10620m), (r.Taxable, r.GstAmount, r.Total));
    }

    [Fact]
    public void Case09_MultipleLineDiscounts()
    {
        var r = InvoiceCalculator.Calculate([new Line(1, 1000m, 100m, 18m), new Line(1, 2000m, 500m, 18m)], 0m, true);
        Assert.Equal([900m, 1500m], r.Lines.Select(l => l.Taxable));
        Assert.Equal((2400m, 432m, 2832m), (r.Taxable, r.GstAmount, r.Total));
    }

    [Fact]
    public void Case10_QuantityGreaterThanOne()
    {
        var r = InvoiceCalculator.Calculate([new Line(3, 1500m, 0m, 5m)], 0m, true);
        Assert.Equal((4500m, 112.50m, 112.50m, 4725m), (r.Taxable, r.Cgst, r.Sgst, r.Total));
    }

    [Fact]
    public void Case11_MixedRatesWithLineAndInvoiceDiscounts()
    {
        // Nets 10,000 / 10,000 / 5,000; ₹1,000 invoice discount shared 400 / 400 / 200 (remainder to the largest line).
        var r = InvoiceCalculator.Calculate(
            [new Line(1, 10000m, 0m, 18m), new Line(1, 10000m, 0m, 5m), new Line(2, 2600m, 200m, 0m)], 1000m, true);

        Assert.Equal([9600m, 9600m, 4800m], r.Lines.Select(l => l.Taxable));
        Assert.Equal([1728m, 480m, 0m], r.Lines.Select(l => l.Tax));
        Assert.Equal(24000m, r.Taxable);
        Assert.Equal(2208m, r.GstAmount);
        Assert.Equal(26208m, r.Total);
        Assert.Equal(r.Total, r.Lines.Sum(l => l.Total));
    }

    [Theory]
    [InlineData(0.50, 18, 0.04)]     // 0.045 → 0.04 (to even)
    [InlineData(1.50, 18, 0.14)]     // 0.135 → 0.14 (to even)
    [InlineData(2.50, 5, 0.06)]      // 0.0625 → 0.06
    [InlineData(999.99, 5, 25.00)]   // 24.99975 → 25.00
    [InlineData(333.33, 18, 30.00)]  // 29.9997 → 30.00
    [InlineData(0.01, 18, 0.00)]     // 0.0009 → 0.00
    public void Case12_RoundingBoundaries_PerHalfToTwoPlaces(double taxable, double rate, double expectedHalf)
    {
        var r = InvoiceCalculator.Calculate([new Line(1, (decimal)taxable, 0m, (decimal)rate)], 0m, true);
        Assert.Equal((decimal)expectedHalf, r.Cgst);
        Assert.Equal(r.Cgst, r.Sgst);
        Assert.Equal(r.Taxable + 2 * r.Cgst, r.Total);
    }

    [Fact]
    public void Case12b_DiscountAllocationWithFractionalPaise_SumsExactly()
    {
        var r = InvoiceCalculator.Calculate(
            [new Line(1, 333.33m, 0m, 18m), new Line(1, 333.33m, 0m, 5m), new Line(1, 333.34m, 0m, 0m)], 100m, true);

        Assert.Equal(100m, r.Lines.Sum(l => l.AllocatedInvoiceDiscount));
        Assert.Equal(900m, r.Taxable);
        Assert.Equal(r.Total, r.Lines.Sum(l => l.Total));
        Assert.Equal(r.GstAmount, r.Lines.Sum(l => l.Tax));
    }

    [Fact]
    public void ServiceRate_ZeroStaysZero_JobCardRateWins_GstOffLineUsesCatalogue()
    {
        Assert.Equal(0m, InvoiceCalculator.ResolveServiceRate(0m, 0m));
        Assert.Equal(5m, InvoiceCalculator.ResolveServiceRate(5m, 18m));
        Assert.Equal(5m, InvoiceCalculator.ResolveServiceRate(0m, 5m));
    }

    [Fact]
    public void StoredSummary_GroupsByRate_AndFallsBackToHeaderForLegacyLines()
    {
        var invoice = new Invoice
        {
            IsGstEnabled = true,
            TaxableAmount = 25000m,
            GstAmount = 2300m,
            InvoiceItems =
            [
                new() { Description = "A", TaxRatePercent = 18m, TaxableAmount = 10000m, TaxAmount = 1800m },
                new() { Description = "B", TaxRatePercent = 5m, TaxableAmount = 10000m, TaxAmount = 500m },
                new() { Description = "C", TaxRatePercent = 0m, TaxableAmount = 5000m, TaxAmount = 0m },
            ],
        };

        var groups = InvoiceCalculator.SummarizeStoredInvoice(invoice);
        Assert.Equal([18m, 5m, 0m], groups.Select(g => g.RatePercent!.Value));
        Assert.Equal([900m, 250m, 0m], groups.Select(g => g.Cgst));
        Assert.Equal(invoice.GstAmount, groups.Sum(g => g.Tax));

        // Legacy: lines carry no tax but the header does → shown as one group of unknown rate, never hidden.
        foreach (var item in invoice.InvoiceItems) item.TaxAmount = 0m;
        var legacy = Assert.Single(InvoiceCalculator.SummarizeStoredInvoice(invoice));
        Assert.Null(legacy.RatePercent);
        Assert.Equal(2300m, legacy.Tax);
    }

    [Fact]
    public void PdfTaxRows_UseActualRates_NeverAFlat9Percent()
    {
        var rows = InvoicePdfGenerator.TaxRows(
        [
            new InvoiceCalculator.TaxGroup(18m, 10000m, 900m, 900m),
            new InvoiceCalculator.TaxGroup(5m, 10000m, 250m, 250m),
            new InvoiceCalculator.TaxGroup(0m, 5000m, 0m, 0m),
        ]).ToList();

        Assert.Contains(rows, r => r.Label.StartsWith("CGST @ 9%") && r.Amount == 900m);
        Assert.Contains(rows, r => r.Label.StartsWith("SGST @ 2.5%") && r.Amount == 250m);
        Assert.Contains(rows, r => r.Label.StartsWith("GST @ 0%") && r.Amount == 0m);
        Assert.DoesNotContain(rows, r => r.Label.Contains("(9%)"));
    }

    // ── Service flow: catalogue → job card → draft → preview → confirm → generate ──

    private sealed record Ctx(AppDbContext Db, InvoiceService Invoices, JobCardServiceApp JobCards);

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
        services.AddScoped<InvoiceService>();
        var scope = services.BuildServiceProvider().CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return new Ctx(db,
            scope.ServiceProvider.GetRequiredService<InvoiceService>(),
            new JobCardServiceApp(db, scope.ServiceProvider.GetRequiredService<IAuditLogService>()));
    }

    private static async Task<(Guid CustomerId, Guid VehicleId)> SeedCustomerAsync(AppDbContext db)
    {
        var customer = new Customer { Name = "GST Customer", PhoneNumber = "9876500000" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN09GS{Random.Shared.Next(1000, 9999)}", Make = "Tata", Model = "Nexon" };
        db.AddRange(customer, vehicle);
        await db.SaveChangesAsync();
        return (customer.Id, vehicle.Id);
    }

    private static async Task<Service> SeedServiceAsync(AppDbContext db, decimal price, decimal taxPercent)
    {
        var s = new Service { Name = $"Svc {price}@{taxPercent} {Guid.NewGuid():N}"[..30], Category = "Detailing", Price = price, TaxPercentage = taxPercent, IsActive = true };
        db.Services.Add(s);
        await db.SaveChangesAsync();
        return s;
    }

    /// <summary>The comparison example: ₹10,000 @ 18%, ₹10,000 @ 5%, ₹5,000 @ 0%.</summary>
    private static async Task<(JobCardDto JobCard, Service S18, Service S5, Service S0)> MixedJobCardAsync(Ctx ctx, bool isGstEnabled = true)
    {
        var (customerId, vehicleId) = await SeedCustomerAsync(ctx.Db);
        var s18 = await SeedServiceAsync(ctx.Db, 10000m, 18m);
        var s5 = await SeedServiceAsync(ctx.Db, 10000m, 5m);
        var s0 = await SeedServiceAsync(ctx.Db, 5000m, 0m);
        var jobCard = await ctx.JobCards.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId,
            VehicleId = vehicleId,
            IsGstEnabled = isGstEnabled,
            Services = [new() { ServiceId = s18.Id }, new() { ServiceId = s5.Id }, new() { ServiceId = s0.Id }],
        });
        return (jobCard, s18, s5, s0);
    }

    [Fact]
    public async Task ZeroPercentService_OnGstInvoice_IsChargedNoGst()
    {
        var ctx = Create();
        var (customerId, vehicleId) = await SeedCustomerAsync(ctx.Db);
        var s18 = await SeedServiceAsync(ctx.Db, 1000m, 18m);
        var s0 = await SeedServiceAsync(ctx.Db, 200m, 0m);
        var jobCard = await ctx.JobCards.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId,
            VehicleId = vehicleId,
            Services = [new() { ServiceId = s18.Id }, new() { ServiceId = s0.Id }],
        });

        var draft = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));

        Assert.True(draft.IsGstEnabled);
        Assert.Equal(180m, draft.GstAmount);           // before Phase 1 the ₹200 line was also taxed (₹36)
        Assert.Equal(1380m, draft.TotalAmount);
        var exempt = draft.Items.Single(i => i.ServiceId == s0.Id);
        Assert.Equal((0m, 0m, 0m, 200m), (exempt.TaxRatePercent!.Value, exempt.TaxAmount, exempt.CgstAmount, exempt.TotalAmount));
    }

    [Fact]
    public async Task ZeroPercentOnlyDraft_TurningGstOn_StaysZero()
    {
        var ctx = Create();
        var (customerId, vehicleId) = await SeedCustomerAsync(ctx.Db);
        var s0 = await SeedServiceAsync(ctx.Db, 200m, 0m);
        var jobCard = await ctx.JobCards.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customerId,
            VehicleId = vehicleId,
            Services = [new() { ServiceId = s0.Id }],
        });
        var draft = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.False(draft.IsGstEnabled);

        var gstOn = await ctx.Invoices.UpdateAsync(draft.Id, new UpdateInvoiceRequest(null, null, null, IsGstEnabled: true));

        Assert.Equal(0m, gstOn!.GstAmount);             // was ₹36 (0% read as 18%)
        Assert.Equal(200m, gstOn.TotalAmount);
    }

    [Fact]
    public async Task GstOffJobCard_TurningGstOnInDraft_UsesEachServicesOwnRate()
    {
        var ctx = Create();
        var (jobCard, _, s5, s0) = await MixedJobCardAsync(ctx, isGstEnabled: false);
        var draft = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.False(draft.IsGstEnabled);
        Assert.Equal(25000m, draft.TotalAmount);

        var gstOn = await ctx.Invoices.UpdateAsync(draft.Id, new UpdateInvoiceRequest(null, null, null, IsGstEnabled: true));

        Assert.Equal(2300m, gstOn!.GstAmount);          // was ₹4,500 (every line read as 18%)
        Assert.Equal(27300m, gstOn.TotalAmount);
        Assert.Equal(5m, gstOn.Items.Single(i => i.ServiceId == s5.Id).TaxRatePercent);
        Assert.Equal(0m, gstOn.Items.Single(i => i.ServiceId == s0.Id).TaxRatePercent);
    }

    [Fact]
    public async Task MixedRates_JobCardEstimate_Draft_Preview_Confirmation_Generated_AllReconcile()
    {
        var ctx = Create();
        var (jobCard, s18, s5, s0) = await MixedJobCardAsync(ctx);

        var estimate = await ctx.JobCards.PreviewAsync(new PreviewJobCardRequest
        {
            Services = [new() { ServiceId = s18.Id }, new() { ServiceId = s5.Id }, new() { ServiceId = s0.Id }],
        });
        Assert.Equal(jobCard.TotalAmount, estimate.TotalAmount);
        Assert.Equal(27300m, estimate.TotalAmount);
        Assert.Equal([18m, 5m, 0m], estimate.TaxBreakdown.Select(b => b.RatePercent!.Value));

        var draft = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.Equal(27300m, draft.TotalAmount);

        // Preview with an unsaved ₹1,000 discount: nothing is persisted.
        var preview = await ctx.Invoices.PreviewAsync(draft.Id, new PreviewInvoiceRequest(Discount: 1000m));
        Assert.Equal((24000m, 2208m, 1104m, 1104m, 26208m), (preview.TaxableAmount, preview.GstAmount, preview.CgstAmount, preview.SgstAmount, preview.TotalAmount));
        var stillStored = await ctx.Db.Invoices.AsNoTracking().SingleAsync(i => i.Id == draft.Id);
        Assert.Equal((0m, 27300m), (stillStored.Discount, stillStored.TotalAmount));

        // Save, then confirm exactly the previewed amount.
        await ctx.Invoices.UpdateAsync(draft.Id, new UpdateInvoiceRequest(1000m, null, null));
        var generated = await ctx.Invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: preview.TotalAmount);

        Assert.Equal(preview.TotalAmount, generated.TotalAmount);
        Assert.Equal(preview.GstAmount, generated.GstAmount);
        Assert.Equal(generated.GstAmount, generated.TaxBreakdown!.Sum(b => b.TaxAmount));
        Assert.Equal(generated.CgstAmount, generated.Items.Sum(i => i.CgstAmount));
        Assert.Equal(generated.TaxableAmount, generated.Items.Sum(i => i.TaxableAmount));
        Assert.Equal(generated.TotalAmount, generated.Items.Sum(i => i.TotalAmount));
        Assert.Equal([18m, 5m, 0m], generated.TaxBreakdown!.Select(b => b.RatePercent!.Value));
    }

    [Fact]
    public async Task Generate_RefusesWhenConfirmedTotalDiffers_AndConsumesNoNumber()
    {
        var ctx = Create();
        var (jobCard, _, _, _) = await MixedJobCardAsync(ctx);
        var draft = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));

        // ₹29,500 is what a flat-18% screen would have shown for this invoice (₹25,000 × 1.18).
        var ex = await Assert.ThrowsAsync<ConflictException>(() => ctx.Invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: 29500m));
        Assert.Contains("27,300.00", ex.Message);

        var stored = await ctx.Db.Invoices.AsNoTracking().SingleAsync(i => i.Id == draft.Id);
        Assert.Equal(InvoiceStatus.Draft, stored.Status);
        Assert.Null(stored.InvoiceNumber);
        Assert.Empty(await ctx.Db.InvoiceNumberAllocations.ToListAsync());
    }

    [Fact]
    public async Task Case13_FinalizedInvoice_IsNotRecalculatedWhenCatalogueChanges()
    {
        var ctx = Create();
        var (jobCard, _, _, _) = await MixedJobCardAsync(ctx);
        var draft = await ctx.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        var generated = await ctx.Invoices.GenerateInvoiceAsync(draft.Id);

        // Change every catalogue rate and price after finalization.
        foreach (var svc in await ctx.Db.Services.ToListAsync()) { svc.TaxPercentage = 28m; svc.Price += 999m; }
        await ctx.Db.SaveChangesAsync();
        ctx.Db.ChangeTracker.Clear();

        var reloaded = (await ctx.Invoices.GetByIdAsync(draft.Id))!;
        var previewed = await ctx.Invoices.PreviewAsync(draft.Id, new PreviewInvoiceRequest(Discount: 5000m, IsGstEnabled: false));

        foreach (var dto in new[] { reloaded, previewed })
        {
            Assert.Equal(generated.TotalAmount, dto.TotalAmount);
            Assert.Equal(generated.GstAmount, dto.GstAmount);
            Assert.Equal([18m, 5m, 0m], dto.TaxBreakdown!.Select(b => b.RatePercent!.Value));
        }
        await Assert.ThrowsAsync<InvalidOperationException>(() => ctx.Invoices.UpdateAsync(draft.Id, new UpdateInvoiceRequest(1m, null, null)));
    }
}
