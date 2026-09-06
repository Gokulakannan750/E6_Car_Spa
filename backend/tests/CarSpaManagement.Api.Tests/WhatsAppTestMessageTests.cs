using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class WhatsAppTestMessageTests
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

    private static WhatsAppService CreateService(AppDbContext db, HttpClient httpClient, IAesEncryptionService enc)
    {
        var config = new ConfigurationBuilder().Build();
        return new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);
    }

    private static string SampleTemplatesDiscoveryJson(string templateName = "e6_car_spa_app", string language = "en", string status = "APPROVED", int varCount = 3, string headerFormat = "TEXT")
    {
        var bodyText = varCount switch
        {
            3 => "Thank you {{1}}! Payment of Rs.{{2}} for {{3}} received. - E6 Car Spa",
            2 => "Hello {{1}}, order {{2}} is confirmed.",
            1 => "Hello {{1}}!",
            _ => "Simple text template."
        };

        return $$"""
        {
          "data": [
            {
              "name": "{{templateName}}",
              "status": "{{status}}",
              "category": "UTILITY",
              "id": "1001001",
              "language": "{{language}}",
              "components": [
                {
                  "type": "HEADER",
                  "format": "{{headerFormat}}"
                },
                {
                  "type": "BODY",
                  "text": "{{bodyText}}"
                }
              ]
            }
          ]
        }
        """;
    }

    [Fact]
    public async Task SendTestMessage_ValidTemplateAndParameters_ReturnsSuccessWithMetaMessageId()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var rawToken = "EAA_VALID_META_TOKEN_123";

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            IsEnabled = true,
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt(rawToken),
            InvoiceNotificationsEnabled = true,
            PaymentCompletedNotificationsEnabled = true
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            if (req.Method == HttpMethod.Get && req.RequestUri!.ToString().Contains("/message_templates"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(SampleTemplatesDiscoveryJson("e6_car_spa_app", "en", "APPROVED", 3), Encoding.UTF8, "application/json")
                };
            }

            if (req.Method == HttpMethod.Post && req.RequestUri!.ToString().Contains("/1263387163523264/messages"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"messaging_product\":\"whatsapp\",\"contacts\":[{\"input\":\"917502387733\",\"wa_id\":\"917502387733\"}],\"messages\":[{\"id\":\"wamid.HBgLMTIzNDU2\"}]}", Encoding.UTF8, "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest(
            TemplateName: "e6_car_spa_app",
            LanguageCode: "en",
            RecipientPhoneNumber: "+91 75023 87733",
            Parameters: new[] { "John Doe", "500", "TN01AB1234" }
        );

        // Act
        var result = await service.SendTestTemplateMessageAsync(request);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Message accepted by Meta.", result.Message);
        Assert.Equal("wamid.HBgLMTIzNDU2", result.MessageId);
        Assert.NotNull(result.Details);
        Assert.Contains("wamid.HBgLMTIzNDU2", result.Details);
    }

    [Fact]
    public async Task SendTestMessage_CorrectPayloadAndBodyParametersSentToMeta()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var rawToken = "EAA_VALID_META_TOKEN_123";

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            IsEnabled = true,
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt(rawToken)
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            if (req.Method == HttpMethod.Get)
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(SampleTemplatesDiscoveryJson("e6_car_spa_app", "en", "APPROVED", 3), Encoding.UTF8, "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"messages\":[{\"id\":\"wamid.123\"}]}", Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest(
            TemplateName: "e6_car_spa_app",
            LanguageCode: "en",
            RecipientPhoneNumber: "+91 75023 87733",
            Parameters: new[] { "John Doe", "500", "TN01AB1234" }
        );

        // Act
        await service.SendTestTemplateMessageAsync(request);

        // Assert
        var postRequest = mockHandler.RecordedRequests.FirstOrDefault(r => r.Method == HttpMethod.Post);
        Assert.NotNull(postRequest);
        Assert.Equal("Bearer", postRequest.Headers.Authorization?.Scheme);
        Assert.Equal(rawToken, postRequest.Headers.Authorization?.Parameter);

        var payloadStr = mockHandler.RecordedPayloads.Last();
        using var doc = JsonDocument.Parse(payloadStr);
        var root = doc.RootElement;

        Assert.Equal("whatsapp", root.GetProperty("messaging_product").GetString());
        Assert.Equal("917502387733", root.GetProperty("to").GetString());
        Assert.Equal("template", root.GetProperty("type").GetString());

        var tpl = root.GetProperty("template");
        Assert.Equal("e6_car_spa_app", tpl.GetProperty("name").GetString());
        Assert.Equal("en", tpl.GetProperty("language").GetProperty("code").GetString());

        var components = tpl.GetProperty("components");
        Assert.Equal(1, components.GetArrayLength());
        var bodyComp = components[0];
        Assert.Equal("body", bodyComp.GetProperty("type").GetString());

        var parameters = bodyComp.GetProperty("parameters");
        Assert.Equal(3, parameters.GetArrayLength());
        Assert.Equal("John Doe", parameters[0].GetProperty("text").GetString());
        Assert.Equal("500", parameters[1].GetProperty("text").GetString());
        Assert.Equal("TN01AB1234", parameters[2].GetProperty("text").GetString());
    }

    [Fact]
    public async Task SendTestMessage_MetaRejectsInvalidToken_ReturnsSanitizedFailure()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var rawToken = "EAA_INVALID_SECRET_TOKEN";

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            AccessTokenEncrypted = enc.Encrypt(rawToken)
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            return new HttpResponseMessage(HttpStatusCode.Unauthorized)
            {
                Content = new StringContent("{\"error\":{\"message\":\"Invalid OAuth access token " + rawToken + "\",\"type\":\"OAuthException\",\"code\":190}}", Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", "en", "917502387733", new[] { "A", "B", "C" });

        // Act
        var result = await service.SendTestTemplateMessageAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.DoesNotContain(rawToken, result.Message);
        if (result.Details != null)
        {
            Assert.DoesNotContain(rawToken, result.Details);
        }
    }

    [Fact]
    public async Task SendTestMessage_MetaRejectsInvalidTemplate_ReturnsSanitizedFailure()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            AccessTokenEncrypted = enc.Encrypt("token")
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            if (req.Method == HttpMethod.Get)
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(SampleTemplatesDiscoveryJson("e6_car_spa_app", "en", "APPROVED", 3), Encoding.UTF8, "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("{\"error\":{\"message\":\"Template does not exist or parameter count mismatch\",\"type\":\"OAuthException\",\"code\":100}}", Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", "en", "917502387733", new[] { "A", "B", "C" });

        // Act
        var result = await service.SendTestTemplateMessageAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Meta rejected", result.Message);
    }

    [Fact]
    public async Task SendTestMessage_MissingRecipient_ReturnsValidationError()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        using var httpClient = new HttpClient(new MockHttpMessageHandler());
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", "en", "   ", new[] { "A" });
        var result = await service.SendTestTemplateMessageAsync(request);

        Assert.False(result.IsSuccess);
        Assert.Contains("Recipient phone number is required", result.Message);
    }

    [Fact]
    public async Task SendTestMessage_MissingTemplate_ReturnsValidationError()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        using var httpClient = new HttpClient(new MockHttpMessageHandler());
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("", "en", "917502387733", new[] { "A" });
        var result = await service.SendTestTemplateMessageAsync(request);

        Assert.False(result.IsSuccess);
        Assert.Contains("Template name is required", result.Message);
    }

    [Fact]
    public async Task SendTestMessage_MissingLanguage_ReturnsValidationError()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        using var httpClient = new HttpClient(new MockHttpMessageHandler());
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", " ", "917502387733", new[] { "A" });
        var result = await service.SendTestTemplateMessageAsync(request);

        Assert.False(result.IsSuccess);
        Assert.Contains("Template language code is required", result.Message);
    }

    [Fact]
    public async Task SendTestMessage_AccessTokenNeverAppearsInResponseOrDetails()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var sensitiveToken = "EAA_SUPER_SECRET_TOKEN_999";

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            AccessTokenEncrypted = enc.Encrypt(sensitiveToken)
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            return new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent($"Error containing {sensitiveToken} in stacktrace", Encoding.UTF8, "text/plain")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", "en", "917502387733", new[] { "A" });
        var result = await service.SendTestTemplateMessageAsync(request);

        Assert.False(result.IsSuccess);
        Assert.DoesNotContain(sensitiveToken, result.Message);
        if (result.Details != null)
        {
            Assert.DoesNotContain(sensitiveToken, result.Details);
        }
    }

    [Fact]
    public async Task SendTestMessage_IsNonMutating_DatabaseRemainsUnchanged()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        var initialConfig = new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            IsEnabled = true,
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("token"),
            InvoiceTemplateName = "invoice_tpl",
            InvoiceTemplateLanguage = "en",
            PaymentCompletedTemplateName = "payment_tpl",
            PaymentCompletedTemplateLanguage = "en",
            InvoiceNotificationsEnabled = true,
            PaymentCompletedNotificationsEnabled = true
        };
        db.WhatsAppConfigurations.Add(initialConfig);
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            if (req.Method == HttpMethod.Get)
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(SampleTemplatesDiscoveryJson("e6_car_spa_app", "en", "APPROVED", 3), Encoding.UTF8, "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"messages\":[{\"id\":\"wamid.123\"}]}", Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", "en", "917502387733", new[] { "John Doe", "500", "TN01AB1234" });

        // Act
        await service.SendTestTemplateMessageAsync(request);

        // Assert
        var currentConfig = await db.WhatsAppConfigurations.FirstAsync();
        Assert.Equal(initialConfig.PhoneNumberId, currentConfig.PhoneNumberId);
        Assert.Equal(initialConfig.BusinessAccountId, currentConfig.BusinessAccountId);
        Assert.Equal(initialConfig.InvoiceTemplateName, currentConfig.InvoiceTemplateName);
        Assert.Equal(initialConfig.PaymentCompletedTemplateName, currentConfig.PaymentCompletedTemplateName);
        Assert.Equal(0, await db.WhatsAppMessages.CountAsync());
    }

    [Fact]
    public async Task SendTestMessage_RejectsUnapprovedTemplate()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            AccessTokenEncrypted = enc.Encrypt("token")
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(SampleTemplatesDiscoveryJson("e6_car_spa_app", "en", "PENDING", 3), Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", "en", "917502387733", new[] { "John Doe", "500", "TN01AB1234" });

        // Act
        var result = await service.SendTestTemplateMessageAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Only APPROVED templates can be tested", result.Message);
    }

    [Fact]
    public async Task SendTestMessage_RejectsLanguageMismatch()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            AccessTokenEncrypted = enc.Encrypt("token")
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(SampleTemplatesDiscoveryJson("e6_car_spa_app", "en", "APPROVED", 3), Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", "es", "917502387733", new[] { "John Doe", "500", "TN01AB1234" });

        // Act
        var result = await service.SendTestTemplateMessageAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Language mismatch", result.Message);
    }

    [Fact]
    public async Task SendTestMessage_RejectsIncorrectParameterCount()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            AccessTokenEncrypted = enc.Encrypt("token")
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(SampleTemplatesDiscoveryJson("e6_car_spa_app", "en", "APPROVED", 3), Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("e6_car_spa_app", "en", "917502387733", new[] { "John Doe", "500" }); // Provided 2, requires 3

        // Act
        var result = await service.SendTestTemplateMessageAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("requires 3 BODY variable(s), but 2 were provided", result.Message);
    }

    [Fact]
    public async Task SendTestMessage_RejectsUnsupportedMediaTemplate()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            AccessTokenEncrypted = enc.Encrypt("token")
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(SampleTemplatesDiscoveryJson("media_tpl", "en", "APPROVED", 1, "IMAGE"), Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("media_tpl", "en", "917502387733", new[] { "Val" });

        // Act
        var result = await service.SendTestTemplateMessageAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("unsupported parameters for the current test sender", result.Message);
    }

    [Fact]
    public async Task SendTestMessage_ZeroVariablesTemplate_SendsPayloadWithoutBodyComponents()
    {
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            PhoneNumberId = "1263387163523264",
            BusinessAccountId = "1046927407924057",
            AccessTokenEncrypted = enc.Encrypt("token")
        });
        await db.SaveChangesAsync();

        var mockHandler = new MockHttpMessageHandler();
        mockHandler.ResponseFactory = req =>
        {
            if (req.Method == HttpMethod.Get)
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(SampleTemplatesDiscoveryJson("simple_tpl", "en", "APPROVED", 0), Encoding.UTF8, "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"messages\":[{\"id\":\"wamid.zero_var\"}]}", Encoding.UTF8, "application/json")
            };
        };

        using var httpClient = new HttpClient(mockHandler);
        var service = CreateService(db, httpClient, enc);

        var request = new SendTestWhatsAppMessageRequest("simple_tpl", "en", "917502387733", Array.Empty<string>());

        // Act
        var result = await service.SendTestTemplateMessageAsync(request);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("wamid.zero_var", result.MessageId);

        var payloadStr = mockHandler.RecordedPayloads.Last();
        using var doc = JsonDocument.Parse(payloadStr);
        var tpl = doc.RootElement.GetProperty("template");
        Assert.False(tpl.TryGetProperty("components", out _));
    }

    [Fact]
    public void Controller_SendTestMessage_RequiresBusinessPermissionAndRateLimiting()
    {
        var method = typeof(WhatsAppSettingsController).GetMethod(nameof(WhatsAppSettingsController.SendTestMessage));
        Assert.NotNull(method);

        var permAttr = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(permAttr);
        Assert.Equal("Permission:settings.business", permAttr.Policy);

        var rateLimitAttr = method.GetCustomAttribute<EnableRateLimitingAttribute>();
        Assert.NotNull(rateLimitAttr);
        Assert.Equal("whatsapp-test", rateLimitAttr.PolicyName);

        var httpPostAttr = method.GetCustomAttribute<HttpPostAttribute>();
        Assert.NotNull(httpPostAttr);
        Assert.Equal("test-message", httpPostAttr.Template);
    }
}
