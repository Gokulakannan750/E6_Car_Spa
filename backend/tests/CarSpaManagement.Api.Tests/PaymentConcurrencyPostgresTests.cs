using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
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

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Phase 0 (P0-4): payment recording must be safe under concurrency. Runs against a REAL PostgreSQL
/// database (row locks cannot be exercised on EF InMemory). Each concurrent request uses its own
/// DbContext/connection, exactly like two API requests (e.g. desktop + Android, or a double click).
/// </summary>
public class PaymentConcurrencyPostgresTests : IClassFixture<PostgresTestDatabase>
{
    private const int Rounds = 5;
    private readonly PostgresTestDatabase _pg;

    public PaymentConcurrencyPostgresTests(PostgresTestDatabase pg) => _pg = pg;

    private static InvoiceService CreateInvoiceService(AppDbContext db) =>
        new(db,
            new RecordingAuditLogService(),
            new ConfigurationBuilder().Build(),
            new HttpContextAccessor(),
            new NoopWhatsAppService(),
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());

    private async Task<Guid> SeedGeneratedInvoiceAsync(decimal total)
    {
        await using var db = _pg.CreateContext();
        var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var customer = new Customer { Name = "Concurrency Test", PhoneNumber = "9000000000" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN01{suffix}", Make = "Test", Model = "Car" };
        var jobCard = new JobCard { JobCardNumber = $"JC-T-{suffix}", CustomerId = customer.Id, VehicleId = vehicle.Id, Status = JobCardStatus.Invoiced, Subtotal = total, TotalAmount = total };
        var invoice = new Invoice
        {
            InvoiceNumber = $"INV-T-{suffix}",
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Subtotal = total,
            TaxableAmount = total,
            TotalAmount = total,
            BalanceAmount = total,
            IsGstEnabled = false,
            Status = InvoiceStatus.Generated,
        };
        db.AddRange(customer, vehicle, jobCard, invoice);
        await db.SaveChangesAsync();
        return invoice.Id;
    }

    /// <summary>Starts all payment attempts at the same moment, each on its own context, and collects outcomes.</summary>
    private async Task<(int succeeded, List<Exception> failures)> PayConcurrentlyAsync(Guid invoiceId, params decimal[] amounts)
    {
        var contexts = amounts.Select(_ => _pg.CreateContext()).ToList();
        foreach (var c in contexts) await c.Database.OpenConnectionAsync();

        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = amounts.Select((amount, i) => Task.Run(async () =>
        {
            await gate.Task;
            await CreateInvoiceService(contexts[i]).RecordPaymentAsync(invoiceId, new RecordPaymentRequest(amount, "Cash"));
        })).ToList();

        gate.SetResult();
        var failures = new List<Exception>();
        foreach (var t in tasks)
        {
            try { await t; }
            catch (Exception ex) { failures.Add(ex); }
        }
        foreach (var c in contexts) await c.DisposeAsync();
        return (tasks.Count - failures.Count, failures);
    }

    private async Task<(decimal paidColumn, decimal paymentsSum, InvoiceStatus status)> ReadInvoiceAsync(Guid invoiceId)
    {
        await using var db = _pg.CreateContext();
        var invoice = await db.Invoices.AsNoTracking().SingleAsync(i => i.Id == invoiceId);
        var sum = await db.Payments.Where(p => p.InvoiceId == invoiceId && !p.IsDeleted).SumAsync(p => p.Amount);
        return (invoice.PaidAmount, sum, invoice.Status);
    }

    [PostgresFact]
    public async Task TwoConcurrentFullPayments_OnlyOneSucceeds_NeverOverpays()
    {
        for (var round = 0; round < Rounds; round++)
        {
            var invoiceId = await SeedGeneratedInvoiceAsync(10_000m);

            var (succeeded, failures) = await PayConcurrentlyAsync(invoiceId, 10_000m, 10_000m);

            Assert.Equal(1, succeeded);
            var failure = Assert.Single(failures);
            var business = Assert.IsType<InvalidOperationException>(failure);
            Assert.Contains("cannot exceed current balance", business.Message);

            var (paid, sum, status) = await ReadInvoiceAsync(invoiceId);
            Assert.Equal(10_000m, sum);
            Assert.Equal(10_000m, paid);
            Assert.Equal(InvoiceStatus.Paid, status);
        }
    }

    [PostgresFact]
    public async Task ConcurrentPartialPayments_ThatFitBalance_BothSucceed()
    {
        for (var round = 0; round < Rounds; round++)
        {
            var invoiceId = await SeedGeneratedInvoiceAsync(10_000m);

            var (succeeded, failures) = await PayConcurrentlyAsync(invoiceId, 6_000m, 4_000m);

            Assert.Equal(2, succeeded);
            Assert.Empty(failures);
            var (paid, sum, status) = await ReadInvoiceAsync(invoiceId);
            Assert.Equal(10_000m, sum);
            Assert.Equal(10_000m, paid);
            Assert.Equal(InvoiceStatus.Paid, status);
        }
    }

    [PostgresFact]
    public async Task ConcurrentPartialPayments_ExceedingBalance_SecondIsRejected()
    {
        for (var round = 0; round < Rounds; round++)
        {
            var invoiceId = await SeedGeneratedInvoiceAsync(10_000m);

            var (succeeded, failures) = await PayConcurrentlyAsync(invoiceId, 6_000m, 6_000m);

            Assert.Equal(1, succeeded);
            Assert.IsType<InvalidOperationException>(Assert.Single(failures));
            var (paid, sum, status) = await ReadInvoiceAsync(invoiceId);
            Assert.Equal(6_000m, sum);
            Assert.Equal(6_000m, paid);
            Assert.Equal(InvoiceStatus.PartiallyPaid, status);
        }
    }

    [PostgresFact]
    public async Task ManyConcurrentPayments_TotalNeverExceedsInvoice()
    {
        var invoiceId = await SeedGeneratedInvoiceAsync(10_000m);

        var (succeeded, _) = await PayConcurrentlyAsync(invoiceId, Enumerable.Repeat(3_000m, 8).ToArray());

        Assert.Equal(3, succeeded); // 3 × 3,000 = 9,000; a 4th would exceed 10,000
        var (paid, sum, _) = await ReadInvoiceAsync(invoiceId);
        Assert.Equal(9_000m, sum);
        Assert.Equal(sum, paid);
    }

    [PostgresFact]
    public async Task DuplicateSubmission_SecondFullPaymentIsRejected()
    {
        var invoiceId = await SeedGeneratedInvoiceAsync(10_000m);

        await using (var db = _pg.CreateContext())
            await CreateInvoiceService(db).RecordPaymentAsync(invoiceId, new RecordPaymentRequest(10_000m, "UPI"));

        await using (var db = _pg.CreateContext())
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                CreateInvoiceService(db).RecordPaymentAsync(invoiceId, new RecordPaymentRequest(10_000m, "UPI")));
            Assert.Contains("cannot exceed current balance of ₹0.00", ex.Message);
        }

        var (paid, sum, _) = await ReadInvoiceAsync(invoiceId);
        Assert.Equal(10_000m, sum);
        Assert.Equal(10_000m, paid);
    }

    [PostgresFact]
    public async Task FailedPayment_RollsBackCompletely()
    {
        var invoiceId = await SeedGeneratedInvoiceAsync(1_000m);

        await using (var db = _pg.CreateContext())
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                CreateInvoiceService(db).RecordPaymentAsync(invoiceId, new RecordPaymentRequest(1_000.01m, "Cash")));

        var (paid, sum, status) = await ReadInvoiceAsync(invoiceId);
        Assert.Equal(0m, sum);
        Assert.Equal(0m, paid);
        Assert.Equal(InvoiceStatus.Generated, status);
    }

    [PostgresFact]
    public async Task ShowroomDailyBill_ConcurrentPayments_NeverExceedBill()
    {
        Guid showroomId;
        var date = DateTime.UtcNow.Date;
        await using (var db = _pg.CreateContext())
        {
            var showroom = new Showroom { MasterId = $"TS{Random.Shared.Next(10000, 99999)}", Name = "Concurrency Showroom", Address = "Test" };
            db.Showrooms.Add(showroom);
            db.ShowroomDailyBills.Add(new ShowroomDailyBill { ShowroomId = showroom.Id, Date = date, Amount = 10_000m });
            await db.SaveChangesAsync();
            showroomId = showroom.Id;
        }

        var contexts = new[] { _pg.CreateContext(), _pg.CreateContext() };
        foreach (var c in contexts) await c.Database.OpenConnectionAsync();
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = contexts.Select(c => Task.Run(async () =>
        {
            await gate.Task;
            await new ShowroomService(c, new RecordingAuditLogService())
                .RecordPaymentAsync(showroomId, date, new RecordShowroomPaymentRequest { Amount = 10_000m, PaymentMethod = "Cash" });
        })).ToList();
        gate.SetResult();

        var outcomes = new List<Exception?>();
        foreach (var t in tasks)
        {
            try { await t; outcomes.Add(null); }
            catch (Exception ex) { outcomes.Add(ex); }
        }
        foreach (var c in contexts) await c.DisposeAsync();

        Assert.Single(outcomes, o => o is null);
        Assert.Single(outcomes, o => o is InvalidOperationException);

        await using var verify = _pg.CreateContext();
        var total = await verify.ShowroomPayments.Where(p => !p.IsDeleted && p.ShowroomDailyBill.ShowroomId == showroomId).SumAsync(p => p.Amount);
        Assert.Equal(10_000m, total);
    }

    [PostgresFact]
    public async Task AllMigrations_ApplyToAnEmptyPostgresDatabase()
    {
        await using var db = _pg.CreateContext();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.NotEmpty(await db.Database.GetAppliedMigrationsAsync());
    }
}
