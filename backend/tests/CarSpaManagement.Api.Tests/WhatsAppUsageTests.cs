using System.Security.Claims;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
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

    private sealed class GrantedPoliciesAuthService(params string[] granted) : IAuthorizationService
    {
        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements) =>
            Task.FromResult(AuthorizationResult.Failed());

        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName) =>
            Task.FromResult(granted.Contains(policyName) ? AuthorizationResult.Success() : AuthorizationResult.Failed());
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

    private static async Task<(Customer Customer, Invoice Invoice)> SeedInvoiceAsync(
        AppDbContext db, string name = "Usage Customer", string phone = "9876543210", string? invoiceNumber = null)
    {
        var customer = new Customer { Id = Guid.NewGuid(), Name = name, PhoneNumber = phone, CreatedAt = DateTime.UtcNow };
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
            Id = Guid.NewGuid(), InvoiceNumber = invoiceNumber ?? "INV-2026-" + Guid.NewGuid().ToString("N")[..4], CustomerId = customer.Id,
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

    // ── Who was not sent a message ───────────────────────────────────────────────────

    [Fact]
    public async Task MessageLog_ListsOnlyFailedAndSkippedNewestFirstWithCustomerAndInvoice()
    {
        using var db = CreateDb();
        var (asha, ashaInvoice) = await SeedInvoiceAsync(db, "Asha Raman", "9000000001", "GST/0007");
        var (ben, benInvoice) = await SeedInvoiceAsync(db, "Ben Thomas", "9000000002", "GST/0008");
        var (chitra, chitraInvoice) = await SeedInvoiceAsync(db, "Chitra Devi", "9000000003");
        var (dev, devInvoice) = await SeedInvoiceAsync(db, "Dev Kumar", "9000000004");
        var now = DateTime.UtcNow;
        var failed = Msg(ashaInvoice.Id, asha.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Failed, now.AddHours(-3));
        failed.ErrorMessage = "Meta rejected the message";
        failed.AttemptCount = 3;
        var skipped = Msg(benInvoice.Id, ben.Id, WhatsAppMessageType.PaymentCompleted, WhatsAppMessageStatus.Skipped, now.AddHours(-1));
        skipped.ErrorMessage = "Customer phone number unavailable or invalid.";
        db.WhatsAppMessages.AddRange(
            failed, skipped,
            Msg(chitraInvoice.Id, chitra.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Sent, now.AddHours(-2)),
            Msg(devInvoice.Id, dev.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Pending, now.AddHours(-2)));
        await db.SaveChangesAsync();

        var log = await CreateService(db).GetMessageLogAsync();

        Assert.Equal(2, log.TotalCount);
        Assert.Collection(log.Items,
            first =>
            {
                Assert.Equal("Ben Thomas", first.CustomerName);
                Assert.Equal("Skipped", first.Status);
                Assert.Equal("PaymentCompleted", first.MessageType);
                Assert.Equal("GST/0008", first.InvoiceNumber);
                Assert.Equal("Customer phone number unavailable or invalid.", first.Reason);
            },
            second =>
            {
                Assert.Equal("Asha Raman", second.CustomerName);
                Assert.Equal("Failed", second.Status);
                Assert.Equal("InvoiceFinalized", second.MessageType);
                Assert.Equal("919876543210", second.RecipientPhone);
                Assert.Equal("Meta rejected the message", second.Reason);
                Assert.Equal(3, second.AttemptCount);
            });
    }

    [Theory]
    [InlineData("failed", "Failed")]
    [InlineData("SKIPPED", "Skipped")]
    public async Task MessageLog_StatusFilterNarrowsTheList(string filter, string expected)
    {
        using var db = CreateDb();
        var (c1, i1) = await SeedInvoiceAsync(db, "One", "9000000011");
        var (c2, i2) = await SeedInvoiceAsync(db, "Two", "9000000012");
        db.WhatsAppMessages.AddRange(
            Msg(i1.Id, c1.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Failed, DateTime.UtcNow),
            Msg(i2.Id, c2.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Skipped, DateTime.UtcNow));
        await db.SaveChangesAsync();

        var log = await CreateService(db).GetMessageLogAsync(status: filter);

        var item = Assert.Single(log.Items);
        Assert.Equal(expected, item.Status);
    }

    [Fact]
    public async Task MessageLog_DefaultsToLastSixMonthsAndAMonthCanBePicked()
    {
        using var db = CreateDb();
        var (customer, invoice) = await SeedInvoiceAsync(db);
        var now = DateTime.UtcNow;
        var thisMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var lastMonth = thisMonth.AddMonths(-1).AddDays(3);
        var tooOld = thisMonth.AddMonths(-8);
        db.WhatsAppMessages.AddRange(
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Failed, thisMonth.AddHours(2)),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.PaymentCompleted, WhatsAppMessageStatus.Failed, lastMonth),
            Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Skipped, tooOld));
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var defaultWindow = await service.GetMessageLogAsync();
        var onlyLastMonth = await service.GetMessageLogAsync(year: lastMonth.Year, month: lastMonth.Month);

        Assert.Equal(2, defaultWindow.TotalCount);
        var item = Assert.Single(onlyLastMonth.Items);
        Assert.Equal("PaymentCompleted", item.MessageType);
    }

    [Fact]
    public async Task MessageLog_PagesAndClampsPageSize()
    {
        using var db = CreateDb();
        var (customer, _) = await SeedInvoiceAsync(db);
        var now = DateTime.UtcNow;
        for (var i = 0; i < 5; i++)
        {
            var (c, inv) = await SeedInvoiceAsync(db, $"Customer {i}", $"90000001{i:00}");
            db.WhatsAppMessages.Add(Msg(inv.Id, c.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Failed, now.AddMinutes(-i)));
        }
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var second = await service.GetMessageLogAsync(page: 2, pageSize: 2);
        var huge = await service.GetMessageLogAsync(pageSize: 5000);
        var zero = await service.GetMessageLogAsync(page: 0, pageSize: 0);

        Assert.Equal(5, second.TotalCount);
        Assert.Equal(2, second.Items.Count);
        Assert.Equal("Customer 2", second.Items[0].CustomerName);
        Assert.Equal(100, huge.PageSize);
        Assert.Equal(5, huge.Items.Count);
        Assert.Equal((1, 1), (zero.Page, zero.PageSize));
    }

    [Fact]
    public async Task MessageLog_StillShowsMessagesForCustomersDeletedLater()
    {
        using var db = CreateDb();
        var (customer, invoice) = await SeedInvoiceAsync(db, "Gone Later", "9000000021");
        db.WhatsAppMessages.Add(Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Failed, DateTime.UtcNow));
        await db.SaveChangesAsync();
        var tracked = await db.Customers.SingleAsync(c => c.Id == customer.Id);
        tracked.IsDeleted = true;
        await db.SaveChangesAsync();

        var log = await CreateService(db).GetMessageLogAsync();

        Assert.Equal("Gone Later", Assert.Single(log.Items).CustomerName);
        Assert.Equal(1, log.TotalCount);
    }

    // ── Who may see the list ─────────────────────────────────────────────────────────

    [Fact]
    public void MessageLogEndpoint_NeedsSettingsView()
    {
        var method = typeof(WhatsAppSettingsController).GetMethod(nameof(WhatsAppSettingsController.GetMessages));
        Assert.NotNull(method);
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), inherit: true)
            .Cast<RequirePermissionAttribute>().SingleOrDefault();
        Assert.Equal("Permission:settings.view", permission?.Policy);
        Assert.Equal("messages", method.GetCustomAttributes(typeof(HttpGetAttribute), inherit: true).Cast<HttpGetAttribute>().Single().Template);
    }

    [Fact]
    public async Task MessageLogEndpoint_RefusesUsersWhoCannotViewCustomers()
    {
        using var db = CreateDb();
        var controller = new WhatsAppSettingsController(CreateService(db), null!, new GrantedPoliciesAuthService("Permission:settings.view"));

        var result = await controller.GetMessages(null, null, null);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task MessageLogEndpoint_ReturnsTheListForUsersWhoCanViewCustomers()
    {
        using var db = CreateDb();
        var (customer, invoice) = await SeedInvoiceAsync(db, "Visible Customer", "9000000031");
        db.WhatsAppMessages.Add(Msg(invoice.Id, customer.Id, WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Failed, DateTime.UtcNow));
        await db.SaveChangesAsync();
        var controller = new WhatsAppSettingsController(CreateService(db), null!,
            new GrantedPoliciesAuthService("Permission:settings.view", "Permission:customers.view"));

        var result = await controller.GetMessages("failed", null, null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<WhatsAppMessageLogResponse>(ok.Value);
        Assert.Equal("Visible Customer", Assert.Single(body.Items).CustomerName);
    }
}
