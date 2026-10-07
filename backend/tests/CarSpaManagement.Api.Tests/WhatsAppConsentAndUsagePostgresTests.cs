using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Real-PostgreSQL checks for the consent columns and the monthly usage query. The in-memory tests cannot prove that the
/// month grouping translates to SQL or that rows created before the migration read back as "no consent".
/// Skipped unless CARSPA_TEST_PG_CONNECTION is set.
/// </summary>
public class WhatsAppConsentAndUsagePostgresTests : IClassFixture<PostgresTestDatabase>
{
    private readonly PostgresTestDatabase _pg;

    public WhatsAppConsentAndUsagePostgresTests(PostgresTestDatabase pg) => _pg = pg;

    private static WhatsAppService CreateService(AppDbContext db)
    {
        var enc = new AesEncryptionService(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["WhatsApp:EncryptionKey"] = "12345678901234567890123456789012" })
            .Build());
        return new WhatsAppService(db, new HttpClient(), enc, new RecordingAuditLogService(), new ConfigurationBuilder().Build(),
            new InvoicePdfGenerator(), NullLogger<WhatsAppService>.Instance);
    }

    [PostgresFact]
    public async Task Usage_GroupsRealRowsByMonthAndStatus()
    {
        var now = DateTime.UtcNow;
        var thisMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var lastMonth = thisMonth.AddMonths(-1).AddDays(5);

        // The database allows one message per (invoice, type), so spread the rows across several invoices.
        var invoiceIds = new List<Guid>();
        for (var i = 0; i < 6; i++)
            invoiceIds.Add(await SeriesTestHelpers.CreateDraftAsync(_pg, gst: false));

        await using var seed = _pg.CreateContext();
        var customerIds = await seed.Invoices.AsNoTracking().Where(i => invoiceIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id, i => i.CustomerId);

        WhatsAppMessage For(Guid inv, WhatsAppMessageType type, WhatsAppMessageStatus status, DateTime at) => new()
        {
            Id = Guid.NewGuid(), InvoiceId = inv, CustomerId = customerIds[inv], MessageType = type, Status = status,
            RecipientPhone = "919000000006", CreatedAt = at
        };

        seed.WhatsAppMessages.AddRange(
            For(invoiceIds[0], WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Sent, thisMonth.AddHours(1)),
            For(invoiceIds[0], WhatsAppMessageType.PaymentCompleted, WhatsAppMessageStatus.Sent, thisMonth.AddHours(2)),
            For(invoiceIds[1], WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Failed, thisMonth.AddHours(3)),
            For(invoiceIds[2], WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Skipped, thisMonth.AddHours(4)),
            For(invoiceIds[3], WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Pending, thisMonth.AddHours(5)),
            For(invoiceIds[4], WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Processing, thisMonth.AddHours(6)),
            For(invoiceIds[5], WhatsAppMessageType.InvoiceFinalized, WhatsAppMessageStatus.Sent, lastMonth));
        await seed.SaveChangesAsync();

        await using var readDb = _pg.CreateContext();
        var usage = await CreateService(readDb).GetUsageAsync(months: 2);

        Assert.Equal(2, usage.Months.Count);
        var current = usage.Months[0];
        Assert.Equal((thisMonth.Year, thisMonth.Month), (current.Year, current.Month));
        Assert.Equal(6, current.Total);
        Assert.Equal(2, current.Sent);
        Assert.Equal(1, current.Failed);
        Assert.Equal(1, current.Skipped);
        Assert.Equal(2, current.Pending);
        Assert.Equal(1, current.InvoiceMessagesSent);
        Assert.Equal(1, current.PaymentMessagesSent);
        Assert.Equal(1, usage.Months[1].Sent);
    }

    [PostgresFact]
    public async Task Consent_RowsInsertedWithoutTheColumnDefaultToNoConsent()
    {
        var id = Guid.NewGuid();
        await using (var conn = new NpgsqlConnection(_pg.ConnectionString))
        {
            await conn.OpenAsync();
            // Mimics a customer that existed before the consent columns were added: the column is not mentioned at all.
            await using var cmd = new NpgsqlCommand(
                "INSERT INTO \"Customers\" (\"Id\", \"Name\", \"PhoneNumber\", \"CreatedAt\", \"IsDeleted\") VALUES (@id, 'Legacy Customer', '9000000099', now(), false)", conn);
            cmd.Parameters.AddWithValue("id", id);
            await cmd.ExecuteNonQueryAsync();
        }

        await using var db = _pg.CreateContext();
        var customer = await db.Customers.AsNoTracking().SingleAsync(c => c.Id == id);

        Assert.False(customer.WhatsAppConsent);
        Assert.Null(customer.WhatsAppConsentUpdatedAtUtc);
        Assert.Null(customer.WhatsAppConsentUpdatedByUserId);
    }

    [PostgresFact]
    public async Task Configuration_RequireConsentDefaultsToOffAndPersists()
    {
        await using (var db = _pg.CreateContext())
        {
            var service = CreateService(db);
            var initial = await service.GetConfigurationAsync();
            Assert.False(initial.RequireCustomerConsent);

            var updated = await service.UpdateConfigurationAsync(new Application.DTOs.WhatsApp.UpdateWhatsAppConfigRequest
            {
                IsEnabled = true,
                RequireCustomerConsent = true
            });
            Assert.True(updated.RequireCustomerConsent);
        }

        await using var verify = _pg.CreateContext();
        Assert.True((await verify.WhatsAppConfigurations.AsNoTracking().SingleAsync()).RequireCustomerConsent);
    }
}
