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
        await using (var db = _pg.CreateContext())
        {
            var jobCard = await new JobCardServiceApp(db, new RecordingAuditLogService())
                .CreateAsync(new CreateJobCardRequest { CustomerId = customerId, VehicleId = vehicleId, Services = items });
            invoiceId = (await Invoices(db).CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id))).Id;
        }
        await using (var db = _pg.CreateContext())
            await Invoices(db).GenerateInvoiceAsync(invoiceId);

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
            await Assert.ThrowsAsync<InvalidOperationException>(() => Invoices(db).GenerateInvoiceAsync(invoiceId));
            _ = await Invoices(db).GetByIdAsync(invoiceId);
        }

        await using var read = _pg.CreateContext();
        var stored = await read.Invoices.AsNoTracking().SingleAsync(i => i.Id == invoiceId);
        Assert.Equal(1180m, stored.TotalAmount);
        Assert.Equal(180m, stored.GstAmount);
        Assert.Equal(1000m, stored.TaxableAmount);
        Assert.Equal(0m, stored.Discount);
    }
}
