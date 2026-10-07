using System.Security.Claims;
using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// WhatsApp SaaS phase 1: per-customer consent (recorded, audited, optionally enforced) and monthly usage counts.
/// </summary>
public class WhatsAppConsentAndUsageTests
{
    private sealed record AuditEntry(string Action, string Module, Guid? UserId, Guid? EntityId, string? OldValues, string? NewValues);

    private sealed class CapturingAuditLogService : IAuditLogService
    {
        public List<AuditEntry> Entries { get; } = new();

        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default)
        {
            Entries.Add(new AuditEntry(action, module, userId, entityId, oldValues, newValues));
            return Task.CompletedTask;
        }

        public Task<Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>> GetLogsAsync(
            Application.DTOs.Audit.AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            Task.FromResult(new Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>());
    }

    private sealed class FailIfCalledHandler : HttpMessageHandler
    {
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            throw new InvalidOperationException("No request to Meta is expected for this test.");
        }
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static WhatsAppService CreateWhatsAppService(AppDbContext db, HttpMessageHandler handler, IAuditLogService? audit = null)
    {
        var enc = new AesEncryptionService(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["WhatsApp:EncryptionKey"] = "12345678901234567890123456789012" })
            .Build());
        return new WhatsAppService(db, new HttpClient(handler), enc, audit ?? new CapturingAuditLogService(),
            new ConfigurationBuilder().Build(), new InvoicePdfGenerator(), NullLogger<WhatsAppService>.Instance);
    }

    private static async Task<WhatsAppConfiguration> SeedConfigAsync(AppDbContext db, bool requireConsent)
    {
        var config = new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            InvoiceNotificationsEnabled = true,
            PaymentCompletedNotificationsEnabled = true,
            RequireCustomerConsent = requireConsent,
            PhoneNumberId = "123456",
            BusinessAccountId = "654321",
            CreatedAt = DateTime.UtcNow
        };
        db.WhatsAppConfigurations.Add(config);
        await db.SaveChangesAsync();
        return config;
    }

    private static async Task<(Customer Customer, Invoice Invoice)> SeedInvoiceAsync(
        AppDbContext db, bool consent, InvoiceStatus status = InvoiceStatus.Generated)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Consent Customer",
            PhoneNumber = "9876543210",
            WhatsAppConsent = consent,
            WhatsAppConsentUpdatedAtUtc = consent ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow
        };
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
            VehicleId = vehicle.Id, JobCardId = jobCard.Id, TotalAmount = 1500m,
            PaidAmount = status == InvoiceStatus.Paid ? 1500m : 0m,
            BalanceAmount = status == InvoiceStatus.Paid ? 0m : 1500m,
            Status = status, CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();
        return (customer, invoice);
    }

    // ── Consent recorded on the customer ─────────────────────────────────────────────

    [Fact]
    public async Task CreateCustomer_WithConsent_RecordsConsentTimeUserAndAudit()
    {
        using var db = CreateDb();
        var audit = new CapturingAuditLogService();
        var service = new CustomerService(db, audit);
        var userId = Guid.NewGuid();

        var dto = await service.CreateAsync(
            new CreateCustomerRequest { Name = "Asha", PhoneNumber = "9000000001", WhatsAppConsent = true },
            actingUserId: userId);

        Assert.True(dto.WhatsAppConsent);
        Assert.NotNull(dto.WhatsAppConsentUpdatedAtUtc);
        var stored = await db.Customers.SingleAsync(c => c.Id == dto.Id);
        Assert.True(stored.WhatsAppConsent);
        Assert.Equal(userId, stored.WhatsAppConsentUpdatedByUserId);

        var entry = Assert.Single(audit.Entries, e => e.Action == AuditActions.CustomerWhatsAppConsentChanged);
        Assert.Equal(AuditModules.Customers, entry.Module);
        Assert.Equal(userId, entry.UserId);
        Assert.Contains("\"whatsAppConsent\":false", entry.OldValues);
        Assert.Contains("\"whatsAppConsent\":true", entry.NewValues);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(false)]
    public async Task CreateCustomer_WithoutConsent_StoresNoConsentAndWritesNoConsentAudit(bool? consent)
    {
        using var db = CreateDb();
        var audit = new CapturingAuditLogService();
        var service = new CustomerService(db, audit);

        var dto = await service.CreateAsync(new CreateCustomerRequest { Name = "Ben", PhoneNumber = "9000000002", WhatsAppConsent = consent });

        Assert.False(dto.WhatsAppConsent);
        Assert.Null(dto.WhatsAppConsentUpdatedAtUtc);
        Assert.DoesNotContain(audit.Entries, e => e.Action == AuditActions.CustomerWhatsAppConsentChanged);
    }

    [Fact]
    public async Task UpdateCustomer_ConsentGivenThenWithdrawn_RecordsEachChange()
    {
        using var db = CreateDb();
        var audit = new CapturingAuditLogService();
        var service = new CustomerService(db, audit);
        var created = await service.CreateAsync(new CreateCustomerRequest { Name = "Chitra", PhoneNumber = "9000000003" });
        var userA = Guid.NewGuid();
        var userB = Guid.NewGuid();

        await service.UpdateAsync(created.Id, new UpdateCustomerRequest { Name = "Chitra", PhoneNumber = "9000000003", WhatsAppConsent = true }, actingUserId: userA);
        var afterGive = await db.Customers.AsNoTracking().SingleAsync(c => c.Id == created.Id);
        Assert.True(afterGive.WhatsAppConsent);
        Assert.Equal(userA, afterGive.WhatsAppConsentUpdatedByUserId);

        await service.UpdateAsync(created.Id, new UpdateCustomerRequest { Name = "Chitra", PhoneNumber = "9000000003", WhatsAppConsent = false }, actingUserId: userB);
        var afterWithdraw = await db.Customers.AsNoTracking().SingleAsync(c => c.Id == created.Id);
        Assert.False(afterWithdraw.WhatsAppConsent);
        Assert.Equal(userB, afterWithdraw.WhatsAppConsentUpdatedByUserId);

        var changes = audit.Entries.Where(e => e.Action == AuditActions.CustomerWhatsAppConsentChanged).ToList();
        Assert.Equal(2, changes.Count);
        Assert.Contains("\"whatsAppConsent\":true", changes[0].NewValues);
        Assert.Contains("\"whatsAppConsent\":true", changes[1].OldValues);
        Assert.Contains("\"whatsAppConsent\":false", changes[1].NewValues);
    }

    [Fact]
    public async Task UpdateCustomer_OmittedOrUnchangedConsent_LeavesRecordAndAuditUntouched()
    {
        using var db = CreateDb();
        var audit = new CapturingAuditLogService();
        var service = new CustomerService(db, audit);
        var created = await service.CreateAsync(new CreateCustomerRequest { Name = "Dev", PhoneNumber = "9000000004", WhatsAppConsent = true }, actingUserId: Guid.NewGuid());
        var before = await db.Customers.AsNoTracking().SingleAsync(c => c.Id == created.Id);
        audit.Entries.Clear();

        // Older clients do not send the field: it must not reset consent.
        await service.UpdateAsync(created.Id, new UpdateCustomerRequest { Name = "Dev Kumar", PhoneNumber = "9000000004" });
        // Same value again is not a change.
        await service.UpdateAsync(created.Id, new UpdateCustomerRequest { Name = "Dev Kumar", PhoneNumber = "9000000004", WhatsAppConsent = true });

        var after = await db.Customers.AsNoTracking().SingleAsync(c => c.Id == created.Id);
        Assert.True(after.WhatsAppConsent);
        Assert.Equal(before.WhatsAppConsentUpdatedAtUtc, after.WhatsAppConsentUpdatedAtUtc);
        Assert.Equal(before.WhatsAppConsentUpdatedByUserId, after.WhatsAppConsentUpdatedByUserId);
        Assert.DoesNotContain(audit.Entries, e => e.Action == AuditActions.CustomerWhatsAppConsentChanged);
    }

    [Fact]
    public async Task GetCustomer_ReturnsConsentFields()
    {
        using var db = CreateDb();
        var service = new CustomerService(db, new CapturingAuditLogService());
        var created = await service.CreateAsync(new CreateCustomerRequest { Name = "Esha", PhoneNumber = "9000000005", WhatsAppConsent = true });

        var fetched = await service.GetByIdAsync(created.Id);

        Assert.NotNull(fetched);
        Assert.True(fetched!.WhatsAppConsent);
        Assert.NotNull(fetched.WhatsAppConsentUpdatedAtUtc);
    }

    [Fact]
    public async Task CustomersController_PassesSignedInUserAsConsentRecorder()
    {
        using var db = CreateDb();
        var service = new CustomerService(db, new CapturingAuditLogService());
        var userId = Guid.NewGuid();
        var controller = new CustomersController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "test"))
                }
            }
        };

        var result = await controller.Create(new CreateCustomerRequest { Name = "Farah", PhoneNumber = "9000000006", WhatsAppConsent = true }, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<CustomerDto>(created.Value);
        var stored = await db.Customers.SingleAsync(c => c.Id == dto.Id);
        Assert.Equal(userId, stored.WhatsAppConsentUpdatedByUserId);
    }

    // ── Sending rules ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Configuration_RequireConsentIsOffByDefault()
    {
        using var db = CreateDb();
        var service = CreateWhatsAppService(db, new FailIfCalledHandler());

        var config = await service.GetConfigurationAsync();

        Assert.False(config.RequireCustomerConsent);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Queue_WhenConsentNotRequired_QueuesRegardlessOfConsent(bool hasConsent)
    {
        using var db = CreateDb();
        await SeedConfigAsync(db, requireConsent: false);
        var (_, invoice) = await SeedInvoiceAsync(db, consent: hasConsent);
        var service = CreateWhatsAppService(db, new FailIfCalledHandler());

        var message = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

        Assert.Equal(WhatsAppMessageStatus.Pending, message!.Status);
    }

    [Fact]
    public async Task QueueInvoice_WhenConsentRequiredAndMissing_IsSkippedWithReason()
    {
        using var db = CreateDb();
        await SeedConfigAsync(db, requireConsent: true);
        var (_, invoice) = await SeedInvoiceAsync(db, consent: false);
        var service = CreateWhatsAppService(db, new FailIfCalledHandler());

        var message = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

        Assert.Equal(WhatsAppMessageStatus.Skipped, message!.Status);
        Assert.Equal(WhatsAppService.NoConsentMessage, message.ErrorMessage);
    }

    [Fact]
    public async Task QueuePayment_WhenConsentRequiredAndMissing_IsSkippedWithReason()
    {
        using var db = CreateDb();
        await SeedConfigAsync(db, requireConsent: true);
        var (_, invoice) = await SeedInvoiceAsync(db, consent: false, status: InvoiceStatus.Paid);
        var service = CreateWhatsAppService(db, new FailIfCalledHandler());

        var message = await service.QueuePaymentCompletedNotificationAsync(invoice.Id, 1500m);

        Assert.Equal(WhatsAppMessageStatus.Skipped, message!.Status);
        Assert.Equal(WhatsAppService.NoConsentMessage, message.ErrorMessage);
    }

    [Fact]
    public async Task Queue_WhenConsentRequiredAndGiven_QueuesBothMessages()
    {
        using var db = CreateDb();
        await SeedConfigAsync(db, requireConsent: true);
        var (_, generated) = await SeedInvoiceAsync(db, consent: true);
        var (_, paid) = await SeedInvoiceAsync(db, consent: true, status: InvoiceStatus.Paid);
        var service = CreateWhatsAppService(db, new FailIfCalledHandler());

        var invoiceMessage = await service.QueueInvoiceFinalizedNotificationAsync(generated.Id);
        var paymentMessage = await service.QueuePaymentCompletedNotificationAsync(paid.Id, 1500m);

        Assert.Equal(WhatsAppMessageStatus.Pending, invoiceMessage!.Status);
        Assert.Equal(WhatsAppMessageStatus.Pending, paymentMessage!.Status);
    }

    [Fact]
    public async Task Process_WhenConsentWithdrawnAfterQueueing_SkipsWithoutCallingMeta()
    {
        using var db = CreateDb();
        await SeedConfigAsync(db, requireConsent: true);
        var (customer, invoice) = await SeedInvoiceAsync(db, consent: true);
        var handler = new FailIfCalledHandler();
        var service = CreateWhatsAppService(db, handler);
        var queued = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.Equal(WhatsAppMessageStatus.Pending, queued!.Status);

        // The customer opts out before the background worker gets to the message.
        var tracked = await db.Customers.SingleAsync(c => c.Id == customer.Id);
        tracked.WhatsAppConsent = false;
        await db.SaveChangesAsync();

        var done = await service.ProcessMessageAsync(queued.Id);

        Assert.True(done);
        Assert.Equal(0, handler.Calls);
        var message = await db.WhatsAppMessages.AsNoTracking().SingleAsync(m => m.Id == queued.Id);
        Assert.Equal(WhatsAppMessageStatus.Skipped, message.Status);
        Assert.Equal(WhatsAppService.NoConsentMessage, message.ErrorMessage);
    }

    // ── Configuration flag ───────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateConfiguration_RequireConsentNullLeavesValueAndTrueSetsIt()
    {
        using var db = CreateDb();
        var audit = new CapturingAuditLogService();
        var service = CreateWhatsAppService(db, new FailIfCalledHandler(), audit);
        await service.GetConfigurationAsync();

        var turnedOn = await service.UpdateConfigurationAsync(new UpdateWhatsAppConfigRequest { IsEnabled = true, RequireCustomerConsent = true });
        Assert.True(turnedOn.RequireCustomerConsent);

        // A client that does not know the field must not switch it off.
        var untouched = await service.UpdateConfigurationAsync(new UpdateWhatsAppConfigRequest { IsEnabled = true });
        Assert.True(untouched.RequireCustomerConsent);

        var turnedOff = await service.UpdateConfigurationAsync(new UpdateWhatsAppConfigRequest { IsEnabled = true, RequireCustomerConsent = false });
        Assert.False(turnedOff.RequireCustomerConsent);

        var last = audit.Entries.Last(e => e.Action == AuditActions.WhatsAppConfigUpdated);
        Assert.Contains("\"requireCustomerConsent\":false", last.NewValues);
    }

    // ── Usage counts ─────────────────────────────────────────────────────────────────

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
        var (customer, invoice) = await SeedInvoiceAsync(db, consent: true);
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
        var service = CreateWhatsAppService(db, new FailIfCalledHandler());

        var usage = await service.GetUsageAsync(months: 3);

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
        var service = CreateWhatsAppService(db, new FailIfCalledHandler());

        var usage = await service.GetUsageAsync(requested);

        Assert.Equal(expected, usage.Months.Count);
    }
}
