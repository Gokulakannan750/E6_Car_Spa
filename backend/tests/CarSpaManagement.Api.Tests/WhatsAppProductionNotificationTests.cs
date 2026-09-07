using System.Net;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class WhatsAppProductionNotificationTests
{
    private class MockHttpMessageHandler : HttpMessageHandler
    {
        public List<HttpRequestMessage> RecordedRequests { get; } = new();
        public List<string> RecordedPayloads { get; } = new();
        public Func<HttpRequestMessage, HttpResponseMessage>? ResponseFactory { get; set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RecordedRequests.Add(request);
            if (request.Content != null)
            {
                var contentStr = await request.Content.ReadAsStringAsync(cancellationToken);
                RecordedPayloads.Add(contentStr);
            }
            else
            {
                RecordedPayloads.Add(string.Empty);
            }

            if (ResponseFactory != null)
            {
                return ResponseFactory(request);
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"data\":[]}", Encoding.UTF8, "application/json")
            };
        }
    }

    private class NullAuditLogService : IAuditLogService
    {
        public List<(string Action, string Description, string Outcome)> RecordedLogs { get; } = new();

        public Task RecordAsync(
            string action,
            string module,
            string description,
            Guid? userId = null,
            string? userName = null,
            string? userRole = null,
            string? entityType = null,
            Guid? entityId = null,
            string? entityReference = null,
            string? oldValues = null,
            string? newValues = null,
            string? metadata = null,
            string outcome = "Success",
            CancellationToken cancellationToken = default)
        {
            RecordedLogs.Add((action, description, outcome));
            return Task.CompletedTask;
        }

        public Task<Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>> GetLogsAsync(
            Application.DTOs.Audit.AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>());
        }
    }

    private static AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static IAesEncryptionService CreateEncryptionService()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            ["WhatsApp:EncryptionKey"] = "12345678901234567890123456789012"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        return new AesEncryptionService(config);
    }

    private static WhatsAppService CreateService(
        AppDbContext db,
        HttpClient httpClient,
        IAesEncryptionService enc,
        IAuditLogService? audit = null)
    {
        var config = new ConfigurationBuilder().Build();
        return new WhatsAppService(
            db,
            httpClient,
            enc,
            audit ?? new NullAuditLogService(),
            config,
            NullLogger<WhatsAppService>.Instance);
    }

    private static string StandardTemplatesDiscoveryJson()
    {
        return JsonSerializer.Serialize(new
        {
            data = new object[]
            {
                new
                {
                    name = "e6_carspa_invoice_generated",
                    status = "APPROVED",
                    category = "UTILITY",
                    language = "en_US",
                    id = "tpl_inv_101",
                    components = new object[]
                    {
                        new
                        {
                            type = "BODY",
                            text = "Hi {{1}}, your invoice {{2}} is ready."
                        }
                    }
                },
                new
                {
                    name = "e6_carspa_payment_completed",
                    status = "APPROVED",
                    category = "UTILITY",
                    language = "en_US",
                    id = "tpl_pay_102",
                    components = new object[]
                    {
                        new
                        {
                            type = "BODY",
                            text = "Dear {{1}}, we have received payment of Rs.{{2}} for vehicle {{3}}. Thank you!"
                        }
                    }
                },
                new
                {
                    name = "e6_car_spa_app",
                    status = "APPROVED",
                    category = "UTILITY",
                    language = "en",
                    id = "tpl_app_103",
                    components = new object[]
                    {
                        new
                        {
                            type = "BODY",
                            text = "Thank you {{1}}! Payment of Rs.{{2}} for {{3}} received. - E6 Car Spa"
                        }
                    }
                },
                new
                {
                    name = "unapproved_invoice_template",
                    status = "PENDING",
                    category = "UTILITY",
                    language = "en_US",
                    id = "tpl_unapp_104",
                    components = new object[]
                    {
                        new { type = "BODY", text = "Invoice {{1}}" }
                    }
                }
            }
        });
    }

    private static async Task<(Customer customer, Vehicle vehicle, Invoice invoice)> SeedInvoiceAsync(
        AppDbContext db,
        string customerPhone = "9876543210",
        InvoiceStatus status = InvoiceStatus.Generated,
        decimal totalAmount = 1500.00m)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Gokul Kannan",
            PhoneNumber = customerPhone,
            CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            RegistrationNumber = "TN33AB1234",
            Make = "Hyundai",
            Model = "Creta",
            CustomerId = customer.Id,
            CreatedAt = DateTime.UtcNow
        };
        db.Vehicles.Add(vehicle);

        var jobCard = new JobCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-001",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Status = JobCardStatus.Ready,
            CreatedAt = DateTime.UtcNow
        };
        db.JobCards.Add(jobCard);

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-2026-001",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            JobCardId = jobCard.Id,
            TotalAmount = totalAmount,
            PaidAmount = status == InvoiceStatus.Paid ? totalAmount : 0m,
            BalanceAmount = status == InvoiceStatus.Paid ? 0m : totalAmount,
            Status = status,
            CreatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(invoice);

        await db.SaveChangesAsync();
        return (customer, vehicle, invoice);
    }

    // -------------------------------------------------------------
    // 1. Invoice Finalized Queueing Tests
    // -------------------------------------------------------------

    [Fact]
    public async Task QueueInvoiceFinalized_WhenEnabledAndValid_QueuesPendingMessage()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "+91 98765 43210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            InvoiceNotificationsEnabled = true,
            PhoneNumberId = "phone_123",
            BusinessAccountId = "waba_123",
            AccessTokenEncrypted = enc.Encrypt("token_123")
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

        // Assert
        Assert.NotNull(msg);
        Assert.Equal(WhatsAppMessageStatus.Pending, msg.Status);
        Assert.Equal("919876543210", msg.RecipientPhone);
        Assert.Equal(WhatsAppMessageType.InvoiceFinalized, msg.MessageType);
        Assert.Contains("Gokul Kannan", msg.TemplateParametersJson);
        Assert.Contains("INV-2026-001", msg.TemplateParametersJson);
        Assert.Contains("TN33AB1234", msg.TemplateParametersJson);
    }

    [Fact]
    public async Task QueueInvoiceFinalized_WhenIntegrationDisabled_QueuesSkippedMessage()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = false,
            InvoiceNotificationsEnabled = true
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

        // Assert
        Assert.NotNull(msg);
        Assert.Equal(WhatsAppMessageStatus.Skipped, msg.Status);
        Assert.Contains("disabled", msg.ErrorMessage);
    }

    [Fact]
    public async Task QueueInvoiceFinalized_WhenInvalidPhone_QueuesSkippedMessage()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "12345", InvoiceStatus.Generated); // Invalid short phone

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            InvoiceNotificationsEnabled = true
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

        // Assert
        Assert.NotNull(msg);
        Assert.Equal(WhatsAppMessageStatus.Skipped, msg.Status);
        Assert.Contains("invalid", msg.ErrorMessage?.ToLowerInvariant());
    }

    // -------------------------------------------------------------
    // 2. Payment Completed Queueing Tests
    // -------------------------------------------------------------

    [Fact]
    public async Task QueuePaymentCompleted_WhenEnabledAndPaid_QueuesPendingMessage()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "+91 98765 43210", InvoiceStatus.Paid, 2500m);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PaymentCompletedNotificationsEnabled = true,
            PhoneNumberId = "phone_123",
            BusinessAccountId = "waba_123",
            AccessTokenEncrypted = enc.Encrypt("token_123")
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg = await service.QueuePaymentCompletedNotificationAsync(invoice.Id, 2500m);

        // Assert
        Assert.NotNull(msg);
        Assert.Equal(WhatsAppMessageStatus.Pending, msg.Status);
        Assert.Equal("919876543210", msg.RecipientPhone);
        Assert.Equal(WhatsAppMessageType.PaymentCompleted, msg.MessageType);
        Assert.Contains("2,500.00", msg.TemplateParametersJson);
        Assert.Contains("TN33AB1234", msg.TemplateParametersJson);
    }

    [Fact]
    public async Task QueuePaymentCompleted_WhenInvoiceNotPaid_ReturnsNull()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated); // Not Paid

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PaymentCompletedNotificationsEnabled = true
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg = await service.QueuePaymentCompletedNotificationAsync(invoice.Id, 500m);

        // Assert
        Assert.Null(msg);
    }

    // -------------------------------------------------------------
    // 3. Idempotency Tests
    // -------------------------------------------------------------

    [Fact]
    public async Task QueueInvoiceFinalized_DuplicateInvocation_ReturnsExistingMessageWithoutDuplicate()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            InvoiceNotificationsEnabled = true
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg1 = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        var msg2 = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

        // Assert
        Assert.NotNull(msg1);
        Assert.NotNull(msg2);
        Assert.Equal(msg1.Id, msg2.Id);

        var count = await db.WhatsAppMessages.CountAsync(m => m.InvoiceId == invoice.Id && m.MessageType == WhatsAppMessageType.InvoiceFinalized);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task QueuePaymentCompleted_DuplicateInvocation_ReturnsExistingMessageWithoutDuplicate()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Paid);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PaymentCompletedNotificationsEnabled = true
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg1 = await service.QueuePaymentCompletedNotificationAsync(invoice.Id, 1000m);
        var msg2 = await service.QueuePaymentCompletedNotificationAsync(invoice.Id, 1000m);

        // Assert
        Assert.NotNull(msg1);
        Assert.NotNull(msg2);
        Assert.Equal(msg1.Id, msg2.Id);

        var count = await db.WhatsAppMessages.CountAsync(m => m.InvoiceId == invoice.Id && m.MessageType == WhatsAppMessageType.PaymentCompleted);
        Assert.Equal(1, count);
    }

    // -------------------------------------------------------------
    // 4. Delivery & Meta Cloud API Dispatch Tests
    // -------------------------------------------------------------

    [Fact]
    public async Task ProcessMessage_ValidInvoiceNotification_DispatchesToMetaAndCapturesWamid()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var audit = new NullAuditLogService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_meta_777",
            BusinessAccountId = "waba_meta_888",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("meta_secret_token_abc"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en_US"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(StandardTemplatesDiscoveryJson(), Encoding.UTF8, "application/json")
                };
            }
            if (uri.Contains("messages"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"messages\":[{\"id\":\"wamid.HBgLMTIzNDU2\"}]}", Encoding.UTF8, "application/json")
                };
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        };

        var service = CreateService(db, new HttpClient(handler), enc, audit);
        var queuedMsg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(queuedMsg);

        // Act
        var result = await service.ProcessMessageAsync(queuedMsg.Id);

        // Assert
        Assert.True(result);

        var refreshed = await db.WhatsAppMessages.FindAsync(queuedMsg.Id);
        Assert.NotNull(refreshed);
        Assert.Equal(WhatsAppMessageStatus.Sent, refreshed.Status);
        Assert.Equal("wamid.HBgLMTIzNDU2", refreshed.MetaMessageId);
        Assert.NotNull(refreshed.SentAtUtc);
        Assert.Null(refreshed.ErrorMessage);

        // Verify outgoing request payload
        var postRequest = handler.RecordedRequests.FirstOrDefault(r => r.Method == HttpMethod.Post);
        Assert.NotNull(postRequest);
        Assert.Contains("v25.0/phone_meta_777/messages", postRequest.RequestUri!.ToString());
        Assert.Equal("Bearer", postRequest.Headers.Authorization?.Scheme);
        Assert.Equal("meta_secret_token_abc", postRequest.Headers.Authorization?.Parameter);

        var postPayload = handler.RecordedPayloads.First(p => !string.IsNullOrEmpty(p));
        using var doc = JsonDocument.Parse(postPayload);
        var root = doc.RootElement;
        Assert.Equal("whatsapp", root.GetProperty("messaging_product").GetString());
        Assert.Equal("919876543210", root.GetProperty("to").GetString());
        Assert.Equal("template", root.GetProperty("type").GetString());

        var tpl = root.GetProperty("template");
        Assert.Equal("e6_carspa_invoice_generated", tpl.GetProperty("name").GetString());
        Assert.Equal("en_US", tpl.GetProperty("language").GetProperty("code").GetString());

        var bodyParams = tpl.GetProperty("components")[0].GetProperty("parameters");
        Assert.Equal(2, bodyParams.GetArrayLength());
        Assert.Equal("Gokul Kannan", bodyParams[0].GetProperty("text").GetString());
        Assert.Equal("INV-2026-001", bodyParams[1].GetProperty("text").GetString());

        // Verify Audit Log
        Assert.Contains(audit.RecordedLogs, l => l.Action == AuditActions.WhatsAppInvoiceSent && l.Outcome == "Success");
    }

    [Fact]
    public async Task ProcessMessage_ValidPaymentNotification_DispatchesCorrectPayload()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var audit = new NullAuditLogService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Paid, 5000m);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_meta_777",
            BusinessAccountId = "waba_meta_888",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("meta_token_123"),
            PaymentCompletedTemplateName = "e6_carspa_payment_completed",
            PaymentCompletedTemplateLanguage = "en_US"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(StandardTemplatesDiscoveryJson(), Encoding.UTF8, "application/json")
                };
            }
            if (uri.Contains("messages"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"messages\":[{\"id\":\"wamid.PAYMENT_123\"}]}", Encoding.UTF8, "application/json")
                };
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        };

        var service = CreateService(db, new HttpClient(handler), enc, audit);
        var queuedMsg = await service.QueuePaymentCompletedNotificationAsync(invoice.Id, 5000m);
        Assert.NotNull(queuedMsg);

        // Act
        var result = await service.ProcessMessageAsync(queuedMsg.Id);

        // Assert
        Assert.True(result);

        var refreshed = await db.WhatsAppMessages.FindAsync(queuedMsg.Id);
        Assert.NotNull(refreshed);
        Assert.Equal(WhatsAppMessageStatus.Sent, refreshed.Status);
        Assert.Equal("wamid.PAYMENT_123", refreshed.MetaMessageId);

        var postPayload = handler.RecordedPayloads.First(p => !string.IsNullOrEmpty(p));
        using var doc = JsonDocument.Parse(postPayload);
        var tpl = doc.RootElement.GetProperty("template");
        Assert.Equal("e6_carspa_payment_completed", tpl.GetProperty("name").GetString());

        var bodyParams = tpl.GetProperty("components")[0].GetProperty("parameters");
        Assert.Equal(3, bodyParams.GetArrayLength());
        Assert.Equal("Gokul Kannan", bodyParams[0].GetProperty("text").GetString());
        Assert.Contains("5,000.00", bodyParams[1].GetProperty("text").GetString());
        Assert.Equal("TN33AB1234", bodyParams[2].GetProperty("text").GetString());

        Assert.Contains(audit.RecordedLogs, l => l.Action == AuditActions.WhatsAppPaymentCompletedSent && l.Outcome == "Success");
    }

    [Fact]
    public async Task ProcessMessage_WhenTemplateUnapproved_RejectsSafelyWithoutInfiniteRetry()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var audit = new NullAuditLogService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_meta_777",
            BusinessAccountId = "waba_meta_888",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("meta_token_123"),
            InvoiceTemplateName = "unapproved_invoice_template", // PENDING status
            InvoiceTemplateLanguage = "en_US"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(StandardTemplatesDiscoveryJson(), Encoding.UTF8, "application/json")
        };

        var service = CreateService(db, new HttpClient(handler), enc, audit);
        var queuedMsg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(queuedMsg);

        // Act
        var result = await service.ProcessMessageAsync(queuedMsg.Id);

        // Assert
        Assert.False(result);

        var refreshed = await db.WhatsAppMessages.FindAsync(queuedMsg.Id);
        Assert.NotNull(refreshed);
        Assert.Equal(WhatsAppMessageStatus.Failed, refreshed.Status);
        Assert.Contains("not approved", refreshed.ErrorMessage);

        // Verify no message POST was attempted
        Assert.DoesNotContain(handler.RecordedRequests, r => r.Method == HttpMethod.Post);

        // Verify failure audit log
        Assert.Contains(audit.RecordedLogs, l => l.Action == AuditActions.WhatsAppNotificationFailed && l.Outcome == "Failure");
    }

    [Fact]
    public async Task ProcessMessage_WhenTemplateNotFound_FailsSafely()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_meta_777",
            BusinessAccountId = "waba_meta_888",
            AccessTokenEncrypted = enc.Encrypt("token"),
            InvoiceTemplateName = "non_existent_template_xyz",
            InvoiceTemplateLanguage = "en_US"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(StandardTemplatesDiscoveryJson(), Encoding.UTF8, "application/json")
        };

        var service = CreateService(db, new HttpClient(handler), enc);
        var queuedMsg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(queuedMsg);

        // Act
        var result = await service.ProcessMessageAsync(queuedMsg.Id);

        // Assert
        Assert.False(result);
        var refreshed = await db.WhatsAppMessages.FindAsync(queuedMsg.Id);
        Assert.NotNull(refreshed);
        Assert.Equal(WhatsAppMessageStatus.Failed, refreshed.Status);
        Assert.Contains("not found", refreshed.ErrorMessage);
    }

    [Fact]
    public async Task ProcessMessage_WhenLanguageMismatch_FailsSafely()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_meta_777",
            BusinessAccountId = "waba_meta_888",
            AccessTokenEncrypted = enc.Encrypt("token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "es_ES" // Template is en_US
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(StandardTemplatesDiscoveryJson(), Encoding.UTF8, "application/json")
        };

        var service = CreateService(db, new HttpClient(handler), enc);
        var queuedMsg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(queuedMsg);

        // Act
        var result = await service.ProcessMessageAsync(queuedMsg.Id);

        // Assert
        Assert.False(result);
        var refreshed = await db.WhatsAppMessages.FindAsync(queuedMsg.Id);
        Assert.NotNull(refreshed);
        Assert.Equal(WhatsAppMessageStatus.Failed, refreshed.Status);
        Assert.Contains("language mismatch", refreshed.ErrorMessage, StringComparison.OrdinalIgnoreCase);
    }

    // -------------------------------------------------------------
    // 5. Retry and Permanent Error Handling
    // -------------------------------------------------------------

    [Fact]
    public async Task ProcessMessage_WhenTransientError_RetriesWithBackoff()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_meta_777",
            BusinessAccountId = "waba_meta_888",
            AccessTokenEncrypted = enc.Encrypt("token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en_US"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(StandardTemplatesDiscoveryJson(), Encoding.UTF8, "application/json")
                };
            }
            // Simulate Meta rate limiting (HTTP 429)
            return new HttpResponseMessage((HttpStatusCode)429)
            {
                Content = new StringContent("{\"error\":{\"message\":\"Rate limit reached\",\"type\":\"OAuthException\",\"code\":4}}", Encoding.UTF8, "application/json")
            };
        };

        var service = CreateService(db, new HttpClient(handler), enc);
        var queuedMsg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(queuedMsg);

        // Act
        var result = await service.ProcessMessageAsync(queuedMsg.Id);

        // Assert
        Assert.False(result);

        var refreshed = await db.WhatsAppMessages.FindAsync(queuedMsg.Id);
        Assert.NotNull(refreshed);
        Assert.Equal(WhatsAppMessageStatus.Pending, refreshed.Status); // Remains Pending for retry
        Assert.Equal(1, refreshed.AttemptCount);
        Assert.NotNull(refreshed.NextAttemptAtUtc);
        Assert.True(refreshed.NextAttemptAtUtc > DateTime.UtcNow);
    }

    [Fact]
    public async Task ProcessMessage_WhenPermanentMetaError_MarksFailedImmediately()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_meta_777",
            BusinessAccountId = "waba_meta_888",
            AccessTokenEncrypted = enc.Encrypt("token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en_US"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(StandardTemplatesDiscoveryJson(), Encoding.UTF8, "application/json")
                };
            }
            // Simulate Meta 400 bad request (permanent)
            return new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("{\"error\":{\"message\":\"Recipient is not a valid WhatsApp user\",\"type\":\"OAuthException\",\"code\":100}}", Encoding.UTF8, "application/json")
            };
        };

        var service = CreateService(db, new HttpClient(handler), enc);
        var queuedMsg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(queuedMsg);

        // Act
        var result = await service.ProcessMessageAsync(queuedMsg.Id);

        // Assert
        Assert.False(result);

        var refreshed = await db.WhatsAppMessages.FindAsync(queuedMsg.Id);
        Assert.NotNull(refreshed);
        Assert.Equal(WhatsAppMessageStatus.Failed, refreshed.Status);
        Assert.Equal(1, refreshed.AttemptCount);
        Assert.Contains("Recipient is not a valid WhatsApp user", refreshed.ErrorMessage);
    }

    [Fact]
    public async Task ProcessMessage_AlreadySentOrSkipped_ReturnsTrueWithoutCallingMeta()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        var sentMsg = new WhatsAppMessage
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            CustomerId = invoice.CustomerId,
            MessageType = WhatsAppMessageType.InvoiceFinalized,
            RecipientPhone = "919876543210",
            Status = WhatsAppMessageStatus.Sent,
            MetaMessageId = "wamid.ALREADY_SENT",
            SentAtUtc = DateTime.UtcNow
        };
        db.WhatsAppMessages.Add(sentMsg);
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.ProcessMessageAsync(sentMsg.Id);

        // Assert
        Assert.True(result);
        Assert.Empty(handler.RecordedRequests); // Zero network calls made
    }

    // -------------------------------------------------------------
    // 6. Security & Token Leakage Tests
    // -------------------------------------------------------------

    [Fact]
    public async Task ProcessMessage_NeverExposesAccessTokenInErrorsOrAudit()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var audit = new NullAuditLogService();
        var rawSecret = "EAAB_SECRET_META_TOKEN_99999_NEVER_LEAK";
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_meta_777",
            BusinessAccountId = "waba_meta_888",
            AccessTokenEncrypted = enc.Encrypt(rawSecret),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en_US"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            // Meta returns an error string mentioning the secret token
            return new HttpResponseMessage(HttpStatusCode.Unauthorized)
            {
                Content = new StringContent($"{{\"error\":{{\"message\":\"Invalid token {rawSecret} in Bearer {rawSecret}\",\"type\":\"OAuthException\",\"code\":190}}}}", Encoding.UTF8, "application/json")
            };
        };

        var service = CreateService(db, new HttpClient(handler), enc, audit);
        var queuedMsg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(queuedMsg);

        // Act
        await service.ProcessMessageAsync(queuedMsg.Id);

        // Assert
        var refreshed = await db.WhatsAppMessages.FindAsync(queuedMsg.Id);
        Assert.NotNull(refreshed);
        Assert.DoesNotContain(rawSecret, refreshed.ErrorMessage ?? string.Empty);
        Assert.Contains("[REDACTED]", refreshed.ErrorMessage ?? string.Empty);

        foreach (var log in audit.RecordedLogs)
        {
            Assert.DoesNotContain(rawSecret, log.Description);
        }
    }

    [Fact]
    public async Task ProcessMessage_NeverModifiesWhatsAppConfiguration()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        var originalConfig = new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_untouched_123",
            BusinessAccountId = "waba_untouched_456",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("token_untouched"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en_US",
            PaymentCompletedTemplateName = "e6_carspa_payment_completed",
            PaymentCompletedTemplateLanguage = "en_US"
        };
        db.WhatsAppConfigurations.Add(originalConfig);
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(StandardTemplatesDiscoveryJson(), Encoding.UTF8, "application/json") };
            }
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"messages\":[{\"id\":\"wamid.OK\"}]}", Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(msg);

        // Act
        await service.ProcessMessageAsync(msg.Id);

        // Assert
        var dbConfig = await db.WhatsAppConfigurations.FirstAsync();
        Assert.Equal("phone_untouched_123", dbConfig.PhoneNumberId);
        Assert.Equal("waba_untouched_456", dbConfig.BusinessAccountId);
        Assert.Equal("v25.0", dbConfig.GraphApiVersion);
        Assert.Equal("token_untouched", enc.Decrypt(dbConfig.AccessTokenEncrypted));
        Assert.Equal("e6_carspa_invoice_generated", dbConfig.InvoiceTemplateName);
        Assert.Equal("e6_carspa_payment_completed", dbConfig.PaymentCompletedTemplateName);
    }

    [Fact]
    public void ResolveBodyParameters_ContextualMatching_CorrectlyResolvesTemplateVariables()
    {
        // Arrange
        var json = JsonSerializer.Serialize(new
        {
            customerName = "Raghavan",
            invoiceNumber = "INV-8899",
            totalAmount = "3,400.00",
            paymentReceived = "2,000.00",
            vehicleRegistration = "TN33ZZ9999"
        });
        using var doc = JsonDocument.Parse(json);

        // Act 1: Invoice Finalized with 2 variables
        var invoiceText = "Hi {{1}}, your invoice {{2}} is ready.";
        var invoiceParams = WhatsAppService.ResolveBodyParameters(
            WhatsAppMessageType.InvoiceFinalized,
            invoiceText,
            2,
            doc.RootElement);

        // Assert 1
        Assert.Equal(2, invoiceParams.Count);
        Assert.Equal("Raghavan", invoiceParams[0]);
        Assert.Equal("INV-8899", invoiceParams[1]);

        // Act 2: Payment Completed matching e6_car_spa_app: "Thank you {{1}}! Payment of Rs.{{2}} for {{3}} received. - E6 Car Spa"
        var paymentText = "Thank you {{1}}! Payment of Rs.{{2}} for {{3}} received. - E6 Car Spa";
        var paymentParams = WhatsAppService.ResolveBodyParameters(
            WhatsAppMessageType.PaymentCompleted,
            paymentText,
            3,
            doc.RootElement);

        // Assert 2
        Assert.Equal(3, paymentParams.Count);
        Assert.Equal("Raghavan", paymentParams[0]);
        Assert.Equal("2,000.00", paymentParams[1]);
        Assert.Equal("TN33ZZ9999", paymentParams[2]);
    }

    [Fact]
    public void ResolveBodyParameters_E6CarSpaInvoiceGenerated_ContextualMatching_MapsExactFourVariablesInCorrectOrder()
    {
        // Arrange - Meta template e6_carspa_invoice_generated:
        // {{1}} Customer Name, {{2}} Invoice Number, {{3}} Vehicle Number, {{4}} Invoice Total
        var templateText = "Hello {{1}},\n\nYour invoice {{2}} for your vehicle {{3}} has been generated by E6 Car Spa.\n\nAmount: Rs.{{4}}\n\nYou can view your invoice using the button below.\n\nThank you for choosing E6 Car Spa.";

        // JsonElement without explicit "parameters" array to ensure contextual keyword matching works independently
        var json = JsonSerializer.Serialize(new
        {
            customerName = "Muthu Kumar",
            invoiceNumber = "INV-2026-000010",
            vehicleRegistration = "TN56P3334",
            totalAmount = "15,000.00"
        });
        using var doc = JsonDocument.Parse(json);

        // Act
        var resolved = WhatsAppService.ResolveBodyParameters(
            WhatsAppMessageType.InvoiceFinalized,
            templateText,
            4,
            doc.RootElement);

        // Assert - Verify exact four values and order
        Assert.Equal(4, resolved.Count);
        Assert.Equal("Muthu Kumar", resolved[0]);      // {{1}} Customer Name
        Assert.Equal("INV-2026-000010", resolved[1]);  // {{2}} Invoice Number
        Assert.Equal("TN56P3334", resolved[2]);        // {{3}} Vehicle Number
        Assert.Equal("15,000.00", resolved[3]);        // {{4}} Invoice Total
    }

    [Fact]
    public void ResolveBodyParameters_E6CarSpaInvoiceGenerated_WhenVehicleRegMissing_UsesNA()
    {
        // Arrange
        var templateText = "Hello {{1}},\n\nYour invoice {{2}} for your vehicle {{3}} has been generated by E6 Car Spa.\n\nAmount: Rs.{{4}}\n\nYou can view your invoice using the button below.\n\nThank you for choosing E6 Car Spa.";

        var json = JsonSerializer.Serialize(new
        {
            customerName = "Muthu Kumar",
            invoiceNumber = "INV-2026-000011",
            vehicleRegistration = "",
            totalAmount = "8,500.00"
        });
        using var doc = JsonDocument.Parse(json);

        // Act
        var resolved = WhatsAppService.ResolveBodyParameters(
            WhatsAppMessageType.InvoiceFinalized,
            templateText,
            4,
            doc.RootElement);

        // Assert
        Assert.Equal(4, resolved.Count);
        Assert.Equal("Muthu Kumar", resolved[0]);
        Assert.Equal("INV-2026-000011", resolved[1]);
        Assert.Equal("N/A", resolved[2]);
        Assert.Equal("8,500.00", resolved[3]);
    }

    [Fact]
    public void ResolveBodyParameters_InvoiceFinalized_PositionalFallback_ReturnsExactFourVariablesInCorrectOrder()
    {
        // Arrange - No bodyText provided (null) triggers positional fallback
        var json = JsonSerializer.Serialize(new
        {
            customerName = "Anand Raj",
            invoiceNumber = "INV-2026-000012",
            vehicleRegistration = "TN38BZ1234",
            totalAmount = "4,200.00"
        });
        using var doc = JsonDocument.Parse(json);

        // Act
        var resolved = WhatsAppService.ResolveBodyParameters(
            WhatsAppMessageType.InvoiceFinalized,
            null,
            4,
            doc.RootElement);

        // Assert - Positional fallback must return {{1}} Name, {{2}} InvNum, {{3}} Vehicle, {{4}} Total
        Assert.Equal(4, resolved.Count);
        Assert.Equal("Anand Raj", resolved[0]);
        Assert.Equal("INV-2026-000012", resolved[1]);
        Assert.Equal("TN38BZ1234", resolved[2]);
        Assert.Equal("4,200.00", resolved[3]);
    }

    [Fact]
    public void ResolveBodyParameters_InvoiceFinalized_WithExplicitParametersArray_ReturnsExactFourVariablesInCorrectOrder()
    {
        // Arrange
        var json = JsonSerializer.Serialize(new
        {
            customerName = "Customer",
            invoiceNumber = "INV",
            vehicleRegistration = "TN01",
            totalAmount = "100.00",
            parameters = new[]
            {
                "Gokul",
                "INV-EXPLICIT-01",
                "TN33TEST9999",
                "7,777.00"
            }
        });
        using var doc = JsonDocument.Parse(json);

        // Act
        var resolved = WhatsAppService.ResolveBodyParameters(
            WhatsAppMessageType.InvoiceFinalized,
            "Template text ignored when explicit parameters present",
            4,
            doc.RootElement);

        // Assert
        Assert.Equal(4, resolved.Count);
        Assert.Equal("Gokul", resolved[0]);
        Assert.Equal("INV-EXPLICIT-01", resolved[1]);
        Assert.Equal("TN33TEST9999", resolved[2]);
        Assert.Equal("7,777.00", resolved[3]);
    }

    private static string EnInvoiceTemplateWithButtonDiscoveryJson()
    {
        return JsonSerializer.Serialize(new
        {
            data = new object[]
            {
                new
                {
                    name = "e6_carspa_invoice_generated",
                    status = "APPROVED",
                    category = "UTILITY",
                    language = "en",
                    id = "2138982353272990",
                    components = new object[]
                    {
                        new
                        {
                            type = "BODY",
                            text = "Hello {{1}},\n\nYour invoice {{2}} for your vehicle {{3}} has been generated by E6 Car Spa.\n\nAmount: Rs.{{4}}\n\nYou can view your invoice using the button below.\n\nThank you for choosing E6 Car Spa.",
                            example = new
                            {
                                body_text = new[]
                                {
                                    new[] { "Customer", "INV-2026-000001", "TN01AB1234", "1500" }
                                }
                            }
                        },
                        new
                        {
                            type = "BUTTONS",
                            buttons = new object[]
                            {
                                new
                                {
                                    type = "URL",
                                    text = "View Invoice",
                                    url = "https://invoice.e6carspa.com/i/{{1}}",
                                    example = new[] { "demo123" }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    // -------------------------------------------------------------
    // Step 3 Diagnostic Audit Regression Tests
    // -------------------------------------------------------------

    [Fact]
    public async Task ProcessMessage_WhenConfiguredWithEnLanguage_SendsSuccessfully()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_123",
            BusinessAccountId = "waba_456",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("test_token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en"
        });
        await db.SaveChangesAsync();

        string? capturedLanguage = null;
        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(EnInvoiceTemplateWithButtonDiscoveryJson(), Encoding.UTF8, "application/json") };
            }
            if (req.Content != null)
            {
                var bodyStr = req.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                using var doc = JsonDocument.Parse(bodyStr);
                capturedLanguage = doc.RootElement.GetProperty("template").GetProperty("language").GetProperty("code").GetString();
            }
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"messages\":[{\"id\":\"wamid.EN_SUCCESS\"}]}", Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(msg);

        // Act
        var result = await service.ProcessMessageAsync(msg.Id);

        // Assert
        Assert.True(result);
        Assert.Equal("en", capturedLanguage);
        var refreshed = await db.WhatsAppMessages.FindAsync(msg.Id);
        Assert.Equal(WhatsAppMessageStatus.Sent, refreshed!.Status);
    }

    [Fact]
    public async Task QueueInvoiceFinalized_AutomaticallyCreatesAndRetrievesPublicInvoiceToken()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_123",
            BusinessAccountId = "waba_456",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("test_token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en"
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

        // Assert
        Assert.NotNull(msg);
        var publicLinks = await db.InvoicePublicLinks.Where(l => l.InvoiceId == invoice.Id && !l.IsRevoked && !l.IsDeleted).ToListAsync();
        Assert.Single(publicLinks);
        var link = publicLinks[0];
        Assert.Equal(64, link.TokenHash.Length);

        // Verify stored snapshot contains rawToken and valid publicUrl
        using var doc = JsonDocument.Parse(msg.TemplateParametersJson ?? "{}");
        Assert.True(doc.RootElement.TryGetProperty("rawToken", out var rtProp));
        var rawToken = rtProp.GetString();
        Assert.False(string.IsNullOrWhiteSpace(rawToken));
        Assert.Equal(64, rawToken.Length);

        Assert.True(doc.RootElement.TryGetProperty("publicUrl", out var puProp));
        var publicUrl = puProp.GetString();
        Assert.Contains($"/i/{rawToken}", publicUrl);

        // Verify stored snapshot contains parameters array with exact four values in order
        Assert.True(doc.RootElement.TryGetProperty("parameters", out var paramsProp));
        Assert.Equal(4, paramsProp.GetArrayLength());
        Assert.Equal("Gokul Kannan", paramsProp[0].GetString());
        Assert.Equal("INV-2026-001", paramsProp[1].GetString());
        Assert.Equal("TN33AB1234", paramsProp[2].GetString());
        Assert.Equal("1,500.00", paramsProp[3].GetString());
    }

    [Fact]
    public async Task ProcessMessage_WithDynamicUrlButton_SerializesExpectedMetaButtonPayload()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_123",
            BusinessAccountId = "waba_456",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("test_token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en"
        });
        await db.SaveChangesAsync();

        string? capturedPayloadJson = null;
        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(EnInvoiceTemplateWithButtonDiscoveryJson(), Encoding.UTF8, "application/json") };
            }
            if (req.Content != null)
            {
                capturedPayloadJson = req.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            }
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"messages\":[{\"id\":\"wamid.BUTTON_TEST\"}]}", Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(msg);

        // Act
        var result = await service.ProcessMessageAsync(msg.Id);

        // Assert
        Assert.True(result);
        Assert.NotNull(capturedPayloadJson);

        using var payloadDoc = JsonDocument.Parse(capturedPayloadJson!);
        var components = payloadDoc.RootElement.GetProperty("template").GetProperty("components");
        Assert.Equal(2, components.GetArrayLength());

        // Body component
        var bodyComp = components[0];
        Assert.Equal("body", bodyComp.GetProperty("type").GetString());
        var bodyParams = bodyComp.GetProperty("parameters");
        Assert.Equal(4, bodyParams.GetArrayLength());

        // Verify exact four values and order sent to Meta
        Assert.Equal("Gokul Kannan", bodyParams[0].GetProperty("text").GetString()); // {{1}} Customer Name
        Assert.Equal("INV-2026-001", bodyParams[1].GetProperty("text").GetString()); // {{2}} Invoice Number
        Assert.Equal("TN33AB1234", bodyParams[2].GetProperty("text").GetString());   // {{3}} Vehicle Number
        Assert.Equal("1,500.00", bodyParams[3].GetProperty("text").GetString());     // {{4}} Invoice Total

        // Button component: type = button, sub_type = url, index = "0", parameters = [{ type = "text", text = "<rawToken>" }]
        var buttonComp = components[1];
        Assert.Equal("button", buttonComp.GetProperty("type").GetString());
        Assert.Equal("url", buttonComp.GetProperty("sub_type").GetString());
        Assert.Equal("0", buttonComp.GetProperty("index").GetString());

        var btnParams = buttonComp.GetProperty("parameters");
        Assert.Equal(1, btnParams.GetArrayLength());
        Assert.Equal("text", btnParams[0].GetProperty("type").GetString());
        var tokenText = btnParams[0].GetProperty("text").GetString();
        Assert.False(string.IsNullOrWhiteSpace(tokenText));
        Assert.Equal(64, tokenText.Length);
    }

    [Fact]
    public async Task QueueInvoiceFinalized_WhenPhoneNumberMissingOrInvalid_MarksMessageAsSkipped()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_123",
            BusinessAccountId = "waba_456",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("test_token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en"
        });
        await db.SaveChangesAsync();

        var service = CreateService(db, new HttpClient(new MockHttpMessageHandler()), enc);

        // Act
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

        // Assert
        Assert.NotNull(msg);
        Assert.Equal(WhatsAppMessageStatus.Skipped, msg.Status);
        Assert.Contains("Customer phone number unavailable or invalid", msg.ErrorMessage);
    }

    [Fact]
    public async Task ProcessMessage_WhenMetaReturnsSuccess_TransitionsToSentWithMetaMessageId()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var audit = new NullAuditLogService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_123",
            BusinessAccountId = "waba_456",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("test_token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(EnInvoiceTemplateWithButtonDiscoveryJson(), Encoding.UTF8, "application/json") };
            }
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"messages\":[{\"id\":\"wamid.SUCCESS_123\"}]}", Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc, audit);
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(msg);

        // Act
        var result = await service.ProcessMessageAsync(msg.Id);

        // Assert
        Assert.True(result);
        var refreshed = await db.WhatsAppMessages.FindAsync(msg.Id);
        Assert.Equal(WhatsAppMessageStatus.Sent, refreshed!.Status);
        Assert.Equal("wamid.SUCCESS_123", refreshed.MetaMessageId);
        Assert.NotNull(refreshed.SentAtUtc);
        Assert.Null(refreshed.ErrorMessage);

        Assert.Contains(audit.RecordedLogs, l => l.Action == AuditActions.WhatsAppInvoiceSent && l.Outcome == "Success");
    }

    [Fact]
    public async Task ProcessMessage_WhenMetaReturnsPermanentError_TransitionsToFailedWithErrorDetail()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var audit = new NullAuditLogService();
        var (_, _, invoice) = await SeedInvoiceAsync(db, "9876543210", InvoiceStatus.Generated);

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "phone_123",
            BusinessAccountId = "waba_456",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("test_token"),
            InvoiceTemplateName = "e6_carspa_invoice_generated",
            InvoiceTemplateLanguage = "en"
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(EnInvoiceTemplateWithButtonDiscoveryJson(), Encoding.UTF8, "application/json") };
            }
            return new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("{\"error\":{\"message\":\"(#100) Invalid parameter\",\"type\":\"OAuthException\",\"code\":100}}", Encoding.UTF8, "application/json")
            };
        };

        var service = CreateService(db, new HttpClient(handler), enc, audit);
        var msg = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
        Assert.NotNull(msg);

        // Act
        var result = await service.ProcessMessageAsync(msg.Id);

        // Assert
        Assert.False(result);
        var refreshed = await db.WhatsAppMessages.FindAsync(msg.Id);
        Assert.Equal(WhatsAppMessageStatus.Failed, refreshed!.Status);
        Assert.NotNull(refreshed.FailedAtUtc);
        Assert.Null(refreshed.MetaMessageId);
        Assert.Contains("100", refreshed.ErrorMessage);
        Assert.Contains("Invalid parameter", refreshed.ErrorMessage);

        Assert.Contains(audit.RecordedLogs, l => l.Action == AuditActions.WhatsAppNotificationFailed && l.Outcome == "Failure");
    }
}
