using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Real-PostgreSQL check for the failed/skipped message list. It has its own class, and therefore its own database,
/// so its rows cannot change the monthly counts asserted by <see cref="WhatsAppUsagePostgresTests"/>.
/// Skipped unless CARSPA_TEST_PG_CONNECTION is set.
/// </summary>
public class WhatsAppMessageLogPostgresTests : IClassFixture<PostgresTestDatabase>
{
    private readonly PostgresTestDatabase _pg;

    public WhatsAppMessageLogPostgresTests(PostgresTestDatabase pg) => _pg = pg;

    private static WhatsAppService CreateService(AppDbContext db)
    {
        var enc = new AesEncryptionService(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["WhatsApp:EncryptionKey"] = "12345678901234567890123456789012" })
            .Build());
        return new WhatsAppService(db, new HttpClient(), enc, new RecordingAuditLogService(), new ConfigurationBuilder().Build(),
            new InvoicePdfGenerator(), NullLogger<WhatsAppService>.Instance);
    }

    [PostgresFact]
    public async Task MessageLog_ListsRealFailedAndSkippedRowsWithCustomerNames()
    {
        var failedInvoice = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false);
        var skippedInvoice = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false);
        var sentInvoice = await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false);

        await using var seed = _pg.CreateContext();
        var ids = new[] { failedInvoice, skippedInvoice, sentInvoice };
        var customers = await seed.Invoices.AsNoTracking().Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id, i => i.CustomerId);
        var now = DateTime.UtcNow;

        WhatsAppMessage For(Guid inv, WhatsAppMessageStatus status, DateTime at, string? reason) => new()
        {
            Id = Guid.NewGuid(), InvoiceId = inv, CustomerId = customers[inv], MessageType = WhatsAppMessageType.InvoiceFinalized,
            Status = status, RecipientPhone = "919000000006", CreatedAt = at, ErrorMessage = reason
        };

        seed.WhatsAppMessages.AddRange(
            For(failedInvoice, WhatsAppMessageStatus.Failed, now.AddMinutes(-10), "Meta rejected the message"),
            For(skippedInvoice, WhatsAppMessageStatus.Skipped, now.AddMinutes(-5), "Customer phone number unavailable or invalid."),
            For(sentInvoice, WhatsAppMessageStatus.Sent, now.AddMinutes(-1), null));
        await seed.SaveChangesAsync();

        await using var readDb = _pg.CreateContext();
        var service = CreateService(readDb);
        var all = await service.GetMessageLogAsync();
        var onlyFailed = await service.GetMessageLogAsync(status: "failed");

        Assert.Equal(2, all.TotalCount);
        Assert.Equal(new[] { "Skipped", "Failed" }, all.Items.Select(i => i.Status));
        Assert.All(all.Items, i => Assert.Equal("Series Test", i.CustomerName));
        var failed = Assert.Single(onlyFailed.Items);
        Assert.Equal("Meta rejected the message", failed.Reason);
    }
}
