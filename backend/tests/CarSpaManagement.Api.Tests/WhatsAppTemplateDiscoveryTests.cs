using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class WhatsAppTemplateDiscoveryTests
{
    private class MockHttpMessageHandler : HttpMessageHandler
    {
        public List<HttpRequestMessage> RecordedRequests { get; } = new();
        public Func<HttpRequestMessage, HttpResponseMessage>? ResponseFactory { get; set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RecordedRequests.Add(request);
            if (ResponseFactory != null)
            {
                return Task.FromResult(ResponseFactory(request));
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"data\":[]}", Encoding.UTF8, "application/json")
            });
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

    [Fact]
    public async Task GetMetaTemplates_ValidSinglePage_ReturnsMappedTemplates()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "111222333",
            BusinessAccountId = "1046927407924057",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("valid_secret_token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var json = JsonSerializer.Serialize(new
            {
                data = new[]
                {
                    new
                    {
                        name = "jaspers_market_order_confirmation_v1",
                        status = "APPROVED",
                        category = "UTILITY",
                        language = "en_US",
                        id = "98765432101",
                        components = new object[]
                        {
                            new { type = "BODY", text = "Your order has been confirmed." }
                        }
                    },
                    new
                    {
                        name = "e6_carspa_invoice_generated",
                        status = "APPROVED",
                        category = "UTILITY",
                        language = "en_US",
                        id = "98765432102",
                        components = new object[]
                        {
                            new { type = "BODY", text = "Hi {{1}}, your invoice {{2}} is ready." }
                        }
                    }
                }
            });

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        };

        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.Templates.Count);
        Assert.Equal("jaspers_market_order_confirmation_v1", result.Templates[0].Name);
        Assert.Equal("APPROVED", result.Templates[0].Status);
        Assert.Equal("UTILITY", result.Templates[0].Category);
        Assert.Equal("en_US", result.Templates[0].Language);
        Assert.Equal("e6_carspa_invoice_generated", result.Templates[1].Name);

        Assert.Single(handler.RecordedRequests);
        Assert.Equal("Bearer", handler.RecordedRequests[0].Headers.Authorization?.Scheme);
        Assert.Equal("valid_secret_token_123", handler.RecordedRequests[0].Headers.Authorization?.Parameter);
        Assert.Contains("1046927407924057/message_templates", handler.RecordedRequests[0].RequestUri!.ToString());
    }

    [Fact]
    public async Task GetMetaTemplates_MultiPagePagination_TraversesAllPagesAndCombines()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            BusinessAccountId = "waba_pagination_test",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("token_xyz"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var uri = req.RequestUri!.ToString();
            if (uri.Contains("after=page2_cursor"))
            {
                // Page 2 response (no next page)
                var page2 = JsonSerializer.Serialize(new
                {
                    data = new[]
                    {
                        new { name = "template_page2_item1", status = "APPROVED", category = "MARKETING", language = "en_US", id = "p2_1" },
                        new { name = "template_page2_item2", status = "PENDING", category = "AUTHENTICATION", language = "en_US", id = "p2_2" }
                    },
                    paging = new { cursors = new { before = "...", after = "..." } }
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(page2, Encoding.UTF8, "application/json") };
            }
            else
            {
                // Page 1 response with paging.next
                var page1 = JsonSerializer.Serialize(new
                {
                    data = new[]
                    {
                        new { name = "template_page1_item1", status = "APPROVED", category = "UTILITY", language = "en_US", id = "p1_1" },
                        new { name = "template_page1_item2", status = "APPROVED", category = "UTILITY", language = "en_US", id = "p1_2" }
                    },
                    paging = new
                    {
                        next = "https://graph.facebook.com/v25.0/waba_pagination_test/message_templates?limit=100&after=page2_cursor"
                    }
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(page1, Encoding.UTF8, "application/json") };
            }
        };

        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(4, result.TotalCount);
        Assert.Equal(4, result.Templates.Count);
        Assert.Equal("template_page1_item1", result.Templates[0].Name);
        Assert.Equal("template_page1_item2", result.Templates[1].Name);
        Assert.Equal("template_page2_item1", result.Templates[2].Name);
        Assert.Equal("template_page2_item2", result.Templates[3].Name);

        // Verify both pages were requested
        Assert.Equal(2, handler.RecordedRequests.Count);
        Assert.Equal("token_xyz", handler.RecordedRequests[0].Headers.Authorization?.Parameter);
        Assert.Equal("token_xyz", handler.RecordedRequests[1].Headers.Authorization?.Parameter);
    }

    [Fact]
    public async Task GetMetaTemplates_ExactWabaIdUsed_NeverUsesPhoneId()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        var configuredWaba = "exact_waba_account_88888";
        var configuredPhone = "different_phone_99999";

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = configuredPhone,
            BusinessAccountId = configuredWaba,
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        await service.GetMetaTemplatesAsync();

        // Assert
        Assert.Single(handler.RecordedRequests);
        var requestedUrl = handler.RecordedRequests[0].RequestUri!.ToString();
        Assert.Contains($"/v25.0/{configuredWaba}/message_templates", requestedUrl);
        Assert.DoesNotContain(configuredPhone, requestedUrl);
    }

    [Fact]
    public async Task GetMetaTemplates_ExtractsVariablesAndExamples()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "waba_var_test",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var json = JsonSerializer.Serialize(new
            {
                data = new[]
                {
                    new
                    {
                        name = "invoice_notification_template",
                        status = "APPROVED",
                        category = "UTILITY",
                        language = "en_US",
                        id = "tpl_var_1",
                        components = new object[]
                        {
                            new
                            {
                                type = "HEADER",
                                format = "TEXT",
                                text = "Car Spa Invoice {{1}}",
                                example = new { header_text = new[] { "INV-1001" } }
                            },
                            new
                            {
                                type = "BODY",
                                text = "Dear {{1}}, your total due is ₹{{2}}. Link: {{3}}",
                                example = new { body_text = new[] { new[] { "Gokul", "1,500.00", "https://carspa.com/inv/1" } } }
                            },
                            new
                            {
                                type = "FOOTER",
                                text = "Thank you for choosing E6 Car Spa!"
                            }
                        }
                    }
                }
            });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Templates);
        var tpl = result.Templates[0];

        var header = tpl.Components.FirstOrDefault(c => c.Type == "HEADER");
        Assert.NotNull(header);
        Assert.Equal("TEXT", header.Format);
        Assert.Equal("Car Spa Invoice {{1}}", header.Text);
        Assert.Contains("{{1}}", header.Variables!);
        Assert.Contains("INV-1001", header.Examples!);

        var body = tpl.Components.FirstOrDefault(c => c.Type == "BODY");
        Assert.NotNull(body);
        Assert.Equal(3, body.Variables!.Count);
        Assert.Contains("{{1}}", body.Variables);
        Assert.Contains("{{2}}", body.Variables);
        Assert.Contains("{{3}}", body.Variables);
        Assert.Equal(3, body.Examples!.Count);
        Assert.Contains("Gokul", body.Examples);
        Assert.Contains("1,500.00", body.Examples);
    }

    [Fact]
    public async Task GetMetaTemplates_HeaderMediaTypes_DeserializesSafely()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "waba_media_test",
            AccessTokenEncrypted = enc.Encrypt("token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var json = JsonSerializer.Serialize(new
            {
                data = new[]
                {
                    new
                    {
                        name = "media_image_template",
                        status = "APPROVED",
                        category = "MARKETING",
                        language = "en_US",
                        id = "media_1",
                        components = new object[]
                        {
                            new { type = "HEADER", format = "IMAGE" },
                            new { type = "BODY", text = "Check out our new ceramic coating package!" }
                        }
                    },
                    new
                    {
                        name = "media_doc_template",
                        status = "APPROVED",
                        category = "UTILITY",
                        language = "en_US",
                        id = "media_2",
                        components = new object[]
                        {
                            new { type = "HEADER", format = "DOCUMENT" },
                            new { type = "BODY", text = "Here is your attached PDF invoice." }
                        }
                    }
                }
            });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Templates.Count);
        Assert.Equal("IMAGE", result.Templates[0].Components[0].Format);
        Assert.Equal("DOCUMENT", result.Templates[1].Components[0].Format);
    }

    [Fact]
    public async Task GetMetaTemplates_ButtonTypes_DeserializesSafely()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "waba_buttons_test",
            AccessTokenEncrypted = enc.Encrypt("token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var json = JsonSerializer.Serialize(new
            {
                data = new[]
                {
                    new
                    {
                        name = "buttons_template",
                        status = "APPROVED",
                        category = "UTILITY",
                        language = "en_US",
                        id = "btn_tpl_1",
                        components = new object[]
                        {
                            new { type = "BODY", text = "Please review your invoice below." },
                            new
                            {
                                type = "BUTTONS",
                                buttons = new object[]
                                {
                                    new { type = "URL", text = "View Invoice", url = "https://carspa.com/invoices/{{1}}", example = new[] { "INV-100" } },
                                    new { type = "PHONE_NUMBER", text = "Call Support", phone_number = "+919876543210" },
                                    new { type = "QUICK_REPLY", text = "Confirm Delivery" }
                                }
                            }
                        }
                    }
                }
            });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Templates);
        var btnsComp = result.Templates[0].Components.FirstOrDefault(c => c.Type == "BUTTONS");
        Assert.NotNull(btnsComp);
        Assert.NotNull(btnsComp.Buttons);
        Assert.Equal(3, btnsComp.Buttons.Count);
        Assert.Equal("URL", btnsComp.Buttons[0].Type);
        Assert.Equal("View Invoice", btnsComp.Buttons[0].Text);
        Assert.Equal("PHONE_NUMBER", btnsComp.Buttons[1].Type);
        Assert.Equal("+919876543210", btnsComp.Buttons[1].PhoneNumber);
        Assert.Equal("QUICK_REPLY", btnsComp.Buttons[2].Type);
    }

    [Fact]
    public async Task GetMetaTemplates_UnknownFields_DoesNotFailParsing()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "waba_unknown_fields",
            AccessTokenEncrypted = enc.Encrypt("token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            // Simulate Meta future fields
            var json = JsonSerializer.Serialize(new
            {
                data = new[]
                {
                    new
                    {
                        name = "future_template",
                        status = "APPROVED",
                        category = "UTILITY",
                        language = "en_US",
                        id = "future_1",
                        quality_score = 98,
                        sub_category = "billing",
                        rejected_reason = (string?)null,
                        components = new object[]
                        {
                            new
                            {
                                type = "BODY",
                                text = "Future template text.",
                                extra_meta_flag = true,
                                metadata_custom = new { v = 2 }
                            }
                        }
                    }
                }
            });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Templates);
        Assert.Equal("future_template", result.Templates[0].Name);
    }

    [Fact]
    public async Task GetMetaTemplates_EmptyData_ReturnsSuccessWithEmptyList()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "waba_empty",
            AccessTokenEncrypted = enc.Encrypt("token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.TotalCount);
        Assert.Empty(result.Templates);
        Assert.Contains("No WhatsApp templates found", result.Message);
    }

    [Fact]
    public async Task GetMetaTemplates_MetaError_ReturnsSanitizedFailure()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "waba_error",
            AccessTokenEncrypted = enc.Encrypt("token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var err = JsonSerializer.Serialize(new
            {
                error = new
                {
                    message = "Object with ID 'waba_error' does not exist.",
                    type = "OAuthException",
                    code = 100
                }
            });
            return new HttpResponseMessage(HttpStatusCode.NotFound) { Content = new StringContent(err, Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Unable to retrieve WhatsApp templates from Meta", result.Message);
        Assert.Contains("does not exist", result.Message);
        Assert.Empty(result.Templates);
    }

    [Fact]
    public async Task GetMetaTemplates_MissingWabaId_ReturnsValidationError()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "",
            AccessTokenEncrypted = enc.Encrypt("token_123"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("WhatsApp Business Account ID is not configured", result.Message);
        Assert.Empty(handler.RecordedRequests);
    }

    [Fact]
    public async Task GetMetaTemplates_MissingToken_ReturnsValidationError()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "waba_valid",
            AccessTokenEncrypted = "",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Meta Access Token is not configured", result.Message);
        Assert.Empty(handler.RecordedRequests);
    }

    [Fact]
    public async Task GetMetaTemplates_DoesNotMutateDatabase()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        var originalConfig = new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = false,
            PhoneNumberId = "orig_phone",
            BusinessAccountId = "orig_waba",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("orig_token"),
            InvoiceTemplateName = "orig_inv_tpl",
            CreatedAt = DateTime.UtcNow
        };
        db.WhatsAppConfigurations.Add(originalConfig);
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        await service.GetMetaTemplatesAsync();

        // Assert
        var dbConfig = await db.WhatsAppConfigurations.FirstAsync();
        Assert.Equal("orig_phone", dbConfig.PhoneNumberId);
        Assert.Equal("orig_waba", dbConfig.BusinessAccountId);
        Assert.Equal("v25.0", dbConfig.GraphApiVersion);
        Assert.Equal("orig_inv_tpl", dbConfig.InvoiceTemplateName);
        Assert.Equal("orig_token", enc.Decrypt(dbConfig.AccessTokenEncrypted));
    }

    [Fact]
    public async Task GetMetaTemplates_NeverExposesAccessToken()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var secretToken = "EAABtest_super_secret_token_value_999";

        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessAccountId = "waba_secret_test",
            AccessTokenEncrypted = enc.Encrypt(secretToken),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            var err = JsonSerializer.Serialize(new
            {
                error = new
                {
                    message = $"Invalid token: {secretToken} in Bearer {secretToken}",
                    type = "OAuthException",
                    code = 190
                }
            });
            return new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent(err, Encoding.UTF8, "application/json") };
        };

        var service = CreateService(db, new HttpClient(handler), enc);

        // Act
        var result = await service.GetMetaTemplatesAsync();

        // Assert
        Assert.False(result.IsSuccess);
        Assert.DoesNotContain(secretToken, result.Message);
        if (result.Details != null)
        {
            Assert.DoesNotContain(secretToken, result.Details);
            Assert.Contains("[REDACTED]", result.Details);
        }
    }
}
