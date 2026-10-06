using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using JobCardServiceApp = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Phase 0 (P0-3) on a REAL PostgreSQL database: job card → draft invoice → generated invoice, then the persisted
/// numeric(18,2) header and line amounts are read back and compared with the authoritative InvoiceCalculator.
/// </summary>
public class InvoiceCalculationPostgresTests : IClassFixture<PostgresTestDatabase>
{
    private readonly PostgresTestDatabase _pg;
    public InvoiceCalculationPostgresTests(PostgresTestDatabase pg) => _pg = pg;

    private static InvoiceService Invoices(AppDbContext db) =>
        new(db, new RecordingAuditLogService(), new ConfigurationBuilder().Build(), new HttpContextAccessor(),
            new NoopWhatsAppService(), new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());

    private async Task<(Guid customerId, Guid vehicleId)> SeedCustomerAsync()
    {
        await using var db = _pg.CreateContext();
        var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var customer = new Customer { Name = "GST Test", PhoneNumber = "9000000002" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN02{suffix}", Make = "Test", Model = "Car" };
        db.AddRange(customer, vehicle);
        await db.SaveChangesAsync();
        return (customer.Id, vehicle.Id);
    }

    private async Task<Guid> SeedServiceAsync(decimal price, decimal taxPercent)
    {
        await using var db = _pg.CreateContext();
        var service = new Service { Name = $"GST {price}@{taxPercent} {Guid.NewGuid():N}"[..40], Category = "Exterior", Price = price, TaxPercentage = taxPercent, IsActive = true };
        db.Services.Add(service);
        await db.SaveChangesAsync();
        return service.Id;
    }

    /// <summary>Creates the job card and invoice, generates it, and returns the persisted invoice with its lines.</summary>
    private async Task<Invoice> CreateAndGenerateAsync(params (decimal price, decimal tax, int qty, decimal discount)[] lines)
    {
        var (customerId, vehicleId) = await SeedCustomerAsync();
        var items = new List<JobCardServiceItemRequest>();
        foreach (var (price, tax, qty, discount) in lines)
            items.Add(new JobCardServiceItemRequest { ServiceId = await SeedServiceAsync(price, tax), Quantity = qty, DiscountAmount = discount });

        Guid invoiceId;
        decimal draftTotal;
        await using (var db = _pg.CreateContext())
        {
            var jobCard = await new JobCardServiceApp(db, new RecordingAuditLogService())
                .CreateAsync(new CreateJobCardRequest { CustomerId = customerId, VehicleId = vehicleId, Services = items });
            var draft = await Invoices(db).CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
            invoiceId = draft.Id;
            draftTotal = draft.TotalAmount;
        }
        await using (var db = _pg.CreateContext())
            await Invoices(db).GenerateInvoiceAsync(invoiceId, expectedTotalAmount: draftTotal);

        await using var read = _pg.CreateContext();
        return await read.Invoices.AsNoTracking().Include(i => i.InvoiceItems).SingleAsync(i => i.Id == invoiceId);
    }

    private static void AssertMatchesCalculator(Invoice persisted, decimal expectedTaxable, decimal expectedGst, decimal expectedTotal,
        params (decimal price, decimal tax, int qty, decimal discount)[] lines)
    {
        var expected = InvoiceCalculator.Calculate(
            lines.Select(l => new InvoiceCalculator.LineInput(l.qty, l.price, l.discount, l.tax)).ToList(), 0m, isGstEnabled: true);

        Assert.Equal(expectedTaxable, expected.Taxable);
        Assert.Equal(expectedGst, expected.GstAmount);
        Assert.Equal(expectedTotal, expected.Total);

        Assert.Equal(expected.Subtotal, persisted.Subtotal);
        Assert.Equal(expected.Taxable, persisted.TaxableAmount);
        Assert.Equal(expected.GstAmount, persisted.GstAmount);
        Assert.Equal(expected.Total, persisted.TotalAmount);
        Assert.Equal(expected.Total, persisted.BalanceAmount);
        Assert.Equal(InvoiceStatus.Generated, persisted.Status);
        Assert.False(string.IsNullOrEmpty(persisted.InvoiceNumber));

        var active = persisted.InvoiceItems.Where(i => !i.IsDeleted).ToList();
        Assert.Equal(persisted.TaxableAmount, active.Sum(i => i.TaxableAmount));
        Assert.Equal(persisted.GstAmount, active.Sum(i => i.TaxAmount));
        Assert.Equal(persisted.TotalAmount, active.Sum(i => i.TotalAmount));
    }

    [PostgresFact]
    public async Task CaseA_SingleLine_NoDiscount_18Percent()
    {
        var line = (1000m, 18m, 1, 0m);
        AssertMatchesCalculator(await CreateAndGenerateAsync(line), 1000m, 180m, 1180m, line);
    }

    [PostgresFact]
    public async Task CaseB_SingleLine_FixedDiscount100_18Percent()
    {
        var line = (1000m, 18m, 1, 100m);
        AssertMatchesCalculator(await CreateAndGenerateAsync(line), 900m, 162m, 1062m, line);
    }

    [PostgresFact]
    public async Task CaseC_MultipleLines()
    {
        var a = (500m, 18m, 2, 0m);
        var b = (250m, 18m, 3, 50m);
        AssertMatchesCalculator(await CreateAndGenerateAsync(a, b), 1700m, 306m, 2006m, a, b);
    }

    [PostgresFact]
    public async Task CaseD_DifferentTaxRates()
    {
        var a = (1000m, 18m, 1, 0m);
        var b = (1000m, 5m, 1, 0m);
        var c = (500m, 28m, 1, 0m);
        AssertMatchesCalculator(await CreateAndGenerateAsync(a, b, c), 2500m, 370m, 2870m, a, b, c);
    }

    [PostgresFact]
    public async Task CaseE_RoundingSensitiveValues()
    {
        var a = (333.33m, 18m, 3, 0m);
        var b = (0.50m, 18m, 1, 0m);
        // 999.99 → CGST/SGST 90.00 each; 0.50 → 0.045 → 0.04 each (existing to-even rule).
        AssertMatchesCalculator(await CreateAndGenerateAsync(a, b), 1000.49m, 180.08m, 1180.57m, a, b);
    }

    [PostgresFact]
    public async Task FinalizedHistoricalInvoice_IsNotRecalculatedOrEditable()
    {
        // A finalized invoice stored with pre-Phase-0 (flat 18% on gross) totals.
        var (customerId, vehicleId) = await SeedCustomerAsync();
        var serviceId = await SeedServiceAsync(1000m, 18m);
        Guid invoiceId;
        await using (var db = _pg.CreateContext())
        {
            var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
            var jobCard = new JobCard { JobCardNumber = $"JC-H-{suffix}", CustomerId = customerId, VehicleId = vehicleId, Status = JobCardStatus.Invoiced };
            jobCard.JobCardServices.Add(new Domain.Entities.JobCardService { ServiceId = serviceId, ServiceName = "Legacy", UnitPrice = 1000m, Quantity = 1, TaxPercentage = 18m, DiscountAmount = 100m, LineTotal = 1080m });
            var invoice = new Invoice
            {
                InvoiceNumber = $"INV-H-{suffix}", JobCardId = jobCard.Id, CustomerId = customerId, VehicleId = vehicleId,
                Subtotal = 1000m, TaxableAmount = 1000m, GstAmount = 180m, TotalAmount = 1180m, BalanceAmount = 1180m,
                IsGstEnabled = true, Status = InvoiceStatus.Generated,
            };
            invoice.InvoiceItems.Add(new InvoiceItem { ServiceId = serviceId, Description = "Legacy", Quantity = 1, UnitPrice = 1000m, Discount = 100m, TaxableAmount = 1000m, TaxAmount = 180m, TotalAmount = 1080m });
            db.AddRange(jobCard, invoice);
            await db.SaveChangesAsync();
            invoiceId = invoice.Id;
        }

        await using (var db = _pg.CreateContext())
        {
            await Assert.ThrowsAsync<InvalidOperationException>(() => Invoices(db).UpdateAsync(invoiceId, new UpdateInvoiceRequest(50m, null, null)));
            await Assert.ThrowsAsync<InvalidOperationException>(() => Invoices(db).GenerateInvoiceAsync(invoiceId, expectedTotalAmount: 1180m));
            _ = await Invoices(db).GetByIdAsync(invoiceId);
        }

        await using var read = _pg.CreateContext();
        var stored = await read.Invoices.AsNoTracking().SingleAsync(i => i.Id == invoiceId);
        Assert.Equal(1180m, stored.TotalAmount);
        Assert.Equal(180m, stored.GstAmount);
        Assert.Equal(1000m, stored.TaxableAmount);
        Assert.Equal(0m, stored.Discount);
    }

    // ── Phase 1: mixed rates, 0%, stored per-line rate ──────────────────────

    [PostgresFact]
    public async Task Phase1_Mixed18_5_0_WithDiscounts_PersistedLinesReconcileWithHeader()
    {
        var a = (10000m, 18m, 1, 0m);
        var b = (5000m, 5m, 2, 500m);
        var c = (5000m, 0m, 1, 0m);
        var persisted = await CreateAndGenerateAsync(a, b, c);
        // 10,000 @ 18% = 1,800; (2 × 5,000 − 500) = 9,500 @ 5% = 475; 5,000 @ 0% = 0.
        AssertMatchesCalculator(persisted, 24500m, 2275m, 26775m, a, b, c);

        var lines = persisted.InvoiceItems.Where(i => !i.IsDeleted).ToList();
        Assert.Equal(new decimal?[] { 0m, 5m, 18m }, lines.Select(l => l.TaxRatePercent).OrderBy(r => r));
        Assert.Equal(0m, persisted.InvoiceItems.Single(i => i.TaxRatePercent == 0m).TaxAmount);

        var groups = InvoiceCalculator.SummarizeStoredInvoice(persisted);
        Assert.Equal(persisted.GstAmount, groups.Sum(g => g.Tax));
        Assert.Equal(persisted.TaxableAmount, groups.Sum(g => g.Taxable));
        Assert.Equal(groups.Sum(g => g.Cgst), groups.Sum(g => g.Sgst));
    }

    [PostgresFact]
    public async Task Phase1_ZeroPercentServiceOnGstInvoice_PersistsNoTax()
    {
        var a = (1000m, 18m, 1, 0m);
        var b = (200m, 0m, 1, 0m);
        var persisted = await CreateAndGenerateAsync(a, b);
        AssertMatchesCalculator(persisted, 1200m, 180m, 1380m, a, b);
        Assert.Equal(0m, persisted.InvoiceItems.Single(i => i.UnitPrice == 200m).TaxAmount);
    }

    [PostgresFact]
    public async Task Phase1_Migration_BackfillsOnlyRatesThatReproduceTheStoredTax()
    {
        var (customerId, vehicleId) = await SeedCustomerAsync();
        var s18 = await SeedServiceAsync(1000m, 18m);
        var s5 = await SeedServiceAsync(1000m, 5m);
        var s0 = await SeedServiceAsync(200m, 0m);
        Guid consistent18, consistent5, legacyZeroAs18, inconsistent, nonGst;
        await using (var db = _pg.CreateContext())
        {
            var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
            var jobCard = new JobCard { JobCardNumber = $"JC-B-{suffix}", CustomerId = customerId, VehicleId = vehicleId };
            jobCard.JobCardServices.Add(new Domain.Entities.JobCardService { ServiceId = s18, ServiceName = "A", UnitPrice = 1000m, Quantity = 1, TaxPercentage = 18m });
            jobCard.JobCardServices.Add(new Domain.Entities.JobCardService { ServiceId = s5, ServiceName = "B", UnitPrice = 1000m, Quantity = 1, TaxPercentage = 5m });
            jobCard.JobCardServices.Add(new Domain.Entities.JobCardService { ServiceId = s0, ServiceName = "C", UnitPrice = 200m, Quantity = 1, TaxPercentage = 0m });
            var gst = new Invoice { JobCardId = jobCard.Id, CustomerId = customerId, VehicleId = vehicleId, IsGstEnabled = true, InvoiceNumber = $"B-{suffix}", Status = InvoiceStatus.Generated };
            var i18 = new InvoiceItem { ServiceId = s18, Description = "A", Quantity = 1, UnitPrice = 1000m, TaxableAmount = 1000m, TaxAmount = 180m, TotalAmount = 1180m };
            var i5 = new InvoiceItem { ServiceId = s5, Description = "B", Quantity = 1, UnitPrice = 1000m, TaxableAmount = 1000m, TaxAmount = 50m, TotalAmount = 1050m };
            var i0 = new InvoiceItem { ServiceId = s0, Description = "C", Quantity = 1, UnitPrice = 200m, TaxableAmount = 200m, TaxAmount = 36m, TotalAmount = 236m };   // charged 18% by the old fallback
            var iBad = new InvoiceItem { Description = "Pre-Phase-0 line", Quantity = 1, UnitPrice = 500m, TaxableAmount = 500m, TaxAmount = 77m, TotalAmount = 577m };
            gst.InvoiceItems.AddRange([i18, i5, i0, iBad]);

            var jobCard2 = new JobCard { JobCardNumber = $"JC-N-{suffix}", CustomerId = customerId, VehicleId = vehicleId };
            var plain = new Invoice { JobCardId = jobCard2.Id, CustomerId = customerId, VehicleId = vehicleId, IsGstEnabled = false, InvoiceNumber = $"N-{suffix}", Status = InvoiceStatus.Generated };
            var iNon = new InvoiceItem { ServiceId = s18, Description = "A", Quantity = 1, UnitPrice = 1000m, TaxableAmount = 1000m, TaxAmount = 0m, TotalAmount = 1000m };
            plain.InvoiceItems.Add(iNon);

            db.AddRange(jobCard, gst, jobCard2, plain);
            await db.SaveChangesAsync();
            (consistent18, consistent5, legacyZeroAs18, inconsistent, nonGst) = (i18.Id, i5.Id, i0.Id, iBad.Id, iNon.Id);
        }

        // Re-run the migration over these rows: down one step (drops the column), then up (adds + backfills).
        await using (var db = _pg.CreateContext())
        {
            var migrator = db.GetService<IMigrator>();
            await migrator.MigrateAsync("20261004051221_AddInvoiceNumberSeriesAndAllocations");
            await migrator.MigrateAsync();
        }

        await using var read = _pg.CreateContext();
        var rates = await read.InvoiceItems.AsNoTracking()
            .Where(i => new[] { consistent18, consistent5, legacyZeroAs18, inconsistent, nonGst }.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, i => i.TaxRatePercent);
        Assert.Equal(18m, rates[consistent18]);
        Assert.Equal(5m, rates[consistent5]);
        Assert.Equal(18m, rates[legacyZeroAs18]);   // records what was actually charged, not what should have been
        Assert.Null(rates[inconsistent]);           // ₹77 on ₹500 matches no rate → unknown, never guessed
        Assert.Equal(0m, rates[nonGst]);
    }
}
