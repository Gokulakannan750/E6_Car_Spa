using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>WhatsApp SaaS phase 1: monthly message usage counts.</summary>
public class WhatsAppUsageTests
{
    private sealed class NoAuditLogService : IAuditLogService
    {
        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>> GetLogsAsync(
            Application.DTOs.Audit.AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            Task.FromResult(new Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>());
    }

    private sealed class FailIfCalledHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("No request to Meta is expected for this test.");
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static WhatsAppService CreateService(AppDbContext db)
    {
        var enc = new AesEncryptionService(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["WhatsApp:EncryptionKey"] = "12345678901234567890123456789012" })
            .Build());
        return new WhatsAppService(db, new HttpClient(new FailIfCalledHandler()), enc, new NoAuditLogService(),
            new ConfigurationBuilder().Build(), new InvoicePdfGenerator(), NullLogger<WhatsAppService>.Instance);
    }

    private static async Task<(Customer Customer, Invoice Invoice)> SeedInvoiceAsync(AppDbContext db)
    {
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Usage Customer", PhoneNumber = "9876543210", CreatedAt = DateTime.UtcNow };
        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(), RegistrationNumber = "TN33AB1234", Make = "Hyundai", Model = "Creta",
            CustomerId = customer.Id, CreatedAt = DateTime.UtcNow
        };
        var jobCard = new JobCard
        {
            Id = Guid.NewGuid(), JobCardNumber = "JC-" + Guid.NewGuid().ToString("N")[..6], CustomerId = customer.Id,
            VehicleId = vehicle.Id, Status = JobCardStatus.Ready, CreatedAt = DateTime.UtcNow
        };
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(), InvoiceNumber = "INV-2026-" + Guid.NewGuid().ToString("N")[..4], CustomerId = customer.Id,
            VehicleId = vehicle.Id, JobCardId = jobCard.Id, TotalAmount = 1500m, BalanceAmount = 1500m,
            Status = InvoiceStatus.Generated, CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();
        return (customer, invoice);
    }

    private static WhatsAppMessage Msg(Guid invoiceId, Guid customerId, WhatsAppMessageType type, WhatsAppMessageStatus status, DateTime createdAt) =>
        new()
        {
            Id = Guid.NewGuid(), InvoiceId = invoiceId, CustomerId = customerId, MessageType = type, Status = status,
            RecipientPhone = "919876543210", CreatedAt = createdAt
        };

    [Fact]
    public async Task Usage_CountsByMonthAndStatusNewestFirstIncludingEmptyMonths()
    {
        using var db = CreateDb();
        var (customer, invoice) = await SeedInvoiceAsync(db);
        var now = DateTime.UtcNow;
        var thisMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var lastMonth = thisMonth.AddMonths(-1).AddDays(10);
        var tooOld = thisMonth.AddMonths(-5);

        db.WhatsAppMessages.AddRange(
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Sent, thisMonth.AddHours(1)),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.PaymentCompleted, WhatsAppMessageStatus.Sent, thisMonth.AddHours(2)),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Failed, thisMonth.AddHours(3)),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Skipped, thisMonth.AddHours(4)),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Pending, thisMonth.AddHours(5)),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.PaymentCompleted, WhatsAppMessageStatus.Processing, thisMonth.AddHours(6)),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Sent, lastMonth),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Sent, tooOld));
        await db.SaveChangesAsync();

        var usage = await CreateService(db).GetUsageAsync(months: 3);

        Assert.Equal(3, usage.Months.Count);
        var current = usage.Months[0];
        Assert.Equal((thisMonth.Year, thisMonth.Month), (current.Year, current.Month));
        Assert.Equal(6, current.Total);
        Assert.Equal(2, current.Sent);
        Assert.Equal(1, current.Failed);
        Assert.Equal(1, current.Skipped);
        Assert.Equal(2, current.Pending);
        Assert.Equal(1, current.InvoiceMessagesSent);
        Assert.Equal(1, current.PaymentMessagesSent);

        var previous = usage.Months[1];
        Assert.Equal((thisMonth.AddMonths(-1).Year, thisMonth.AddMonths(-1).Month), (previous.Year, previous.Month));
        Assert.Equal(1, previous.Total);
        Assert.Equal(1, previous.Sent);

        var empty = usage.Months[2];
        Assert.Equal(0, empty.Total);
        Assert.DoesNotContain(usage.Months, m => (m.Year, m.Month) == (tooOld.Year, tooOld.Month));
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-4, 1)]
    [InlineData(100, 24)]
    public async Task Usage_ClampsRequestedMonths(int requested, int expected)
    {
        using var db = CreateDb();

        var usage = await CreateService(db).GetUsageAsync(requested);

        Assert.Equal(expected, usage.Months.Count);
    }
}
