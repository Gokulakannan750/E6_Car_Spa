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

public class WhatsAppTestConnectionTests
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
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
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

    [Fact]
    public async Task TestConnection_ValidPhoneAndWabaAndToken_ReturnsSuccess()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        handler.ResponseFactory = req =>
        {
            if (req.RequestUri!.AbsolutePath.Contains("111222333"))
            {
                var phoneJson = JsonSerializer.Serialize(new
                {
                    verified_name = "E6 Car Spa",
                    display_phone_number = "+91 9876543210",
                    quality_rating = "GREEN",
                    platform_type = "CLOUD_API"
                });
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(phoneJson, Encoding.UTF8, "application/json")
                };
            }

            if (req.RequestUri!.AbsolutePath.Contains("444555666"))
            {
                var wabaJson = JsonSerializer.Serialize(new
                {
                    id = "444555666",
                    name = "E6 Car Spa WABA Account"
                });
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(wabaJson, Encoding.UTF8, "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        };

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "111222333",
            BusinessAccountId: "444555666",
            GraphApiVersion: "v25.0",
            AccessToken: "test_access_token_abc"
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Successfully connected to Meta WhatsApp Cloud API.", result.Message);
        Assert.NotNull(result.Details);
        Assert.Contains("+91 9876543210", result.Details);
        Assert.Contains("E6 Car Spa", result.Details);
        Assert.Contains("E6 Car Spa WABA Account", result.Details);

        // Verify HTTP requests
        Assert.Equal(2, handler.RecordedRequests.Count);
        Assert.Equal("Bearer", handler.RecordedRequests[0].Headers.Authorization?.Scheme);
        Assert.Equal("test_access_token_abc", handler.RecordedRequests[0].Headers.Authorization?.Parameter);
        Assert.Contains("https://graph.facebook.com/v25.0/111222333", handler.RecordedRequests[0].RequestUri!.ToString());
        Assert.Contains("https://graph.facebook.com/v25.0/444555666", handler.RecordedRequests[1].RequestUri!.ToString());
    }

    [Fact]
    public async Task TestConnection_IncorrectPhoneNumberId_ReturnsFailure()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        handler.ResponseFactory = req =>
        {
            var metaError = JsonSerializer.Serialize(new
            {
                error = new
                {
                    message = "(#100) Param id must be a valid ID",
                    type = "OAuthException",
                    code = 100,
                    error_subcode = 33
                }
            });
            return new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent(metaError, Encoding.UTF8, "application/json")
            };
        };

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "invalid_phone_999",
            BusinessAccountId: "444555666",
            GraphApiVersion: "v25.0",
            AccessToken: "valid_token"
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Phone Number ID validation failed", result.Message);
        Assert.Contains("Param id must be a valid ID", result.Message);
        // Should stop after phone failure and not call WABA endpoint
        Assert.Single(handler.RecordedRequests);
    }

    [Fact]
    public async Task TestConnection_IncorrectWabaId_ReturnsFailure()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        handler.ResponseFactory = req =>
        {
            if (req.RequestUri!.AbsolutePath.Contains("111222333"))
            {
                var phoneJson = JsonSerializer.Serialize(new
                {
                    verified_name = "E6 Car Spa",
                    display_phone_number = "+91 9876543210"
                });
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(phoneJson, Encoding.UTF8, "application/json")
                };
            }

            var wabaError = JsonSerializer.Serialize(new
            {
                error = new
                {
                    message = "Unsupported get request. Object with ID 'invalid_waba_888' does not exist.",
                    type = "GraphMethodException",
                    code = 100
                }
            });
            return new HttpResponseMessage(HttpStatusCode.NotFound)
            {
                Content = new StringContent(wabaError, Encoding.UTF8, "application/json")
            };
        };

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "111222333",
            BusinessAccountId: "invalid_waba_888",
            GraphApiVersion: "v25.0",
            AccessToken: "valid_token"
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("WhatsApp Business Account ID validation failed", result.Message);
        Assert.Contains("does not exist", result.Message);
        Assert.Equal(2, handler.RecordedRequests.Count);
    }

    [Fact]
    public async Task TestConnection_IncorrectToken_ReturnsFailure()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        handler.ResponseFactory = req =>
        {
            var authError = JsonSerializer.Serialize(new
            {
                error = new
                {
                    message = "Invalid OAuth access token - Cannot parse access token",
                    type = "OAuthException",
                    code = 190
                }
            });
            return new HttpResponseMessage(HttpStatusCode.Unauthorized)
            {
                Content = new StringContent(authError, Encoding.UTF8, "application/json")
            };
        };

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "111222333",
            BusinessAccountId: "444555666",
            GraphApiVersion: "v25.0",
            AccessToken: "invalid_token_xyz"
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Phone Number ID validation failed", result.Message);
        Assert.Contains("Invalid OAuth access token", result.Message);
    }

    [Fact]
    public async Task TestConnection_SavedConfigurationExists_DifferentFakeFormValues_UsesFormValuesAndFails()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        // Seed DB with valid saved settings
        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "saved_valid_phone_111",
            BusinessAccountId = "saved_valid_waba_222",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt("saved_valid_token_333"),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            // If the service requests saved_valid_phone_111, succeed; but if it requests fake_form_phone_999, return 404
            if (req.RequestUri!.AbsolutePath.Contains("saved_valid_phone_111"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"verified_name\":\"Saved Phone\"}", Encoding.UTF8, "application/json")
                };
            }

            var err = JsonSerializer.Serialize(new
            {
                error = new
                {
                    message = "Object with ID 'fake_form_phone_999' does not exist.",
                    type = "OAuthException",
                    code = 100
                }
            });
            return new HttpResponseMessage(HttpStatusCode.NotFound)
            {
                Content = new StringContent(err, Encoding.UTF8, "application/json")
            };
        };

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        // Form sends deliberately fake phone ID while keeping saved token (blank AccessToken)
        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "fake_form_phone_999",
            BusinessAccountId: "fake_form_waba_888",
            GraphApiVersion: "v25.0",
            AccessToken: null
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Phone Number ID validation failed", result.Message);
        Assert.Contains("fake_form_phone_999", result.Message);

        // Verify that the requested URL contained fake_form_phone_999 and NOT saved_valid_phone_111
        Assert.Single(handler.RecordedRequests);
        Assert.Contains("fake_form_phone_999", handler.RecordedRequests[0].RequestUri!.ToString());
        Assert.DoesNotContain("saved_valid_phone_111", handler.RecordedRequests[0].RequestUri!.ToString());
    }

    [Fact]
    public async Task TestConnection_BlankToken_WithExistingSavedConfiguration_UsesSavedToken()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();

        var savedTokenPlain = "saved_secret_meta_token_777";
        db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            IsEnabled = true,
            PhoneNumberId = "saved_phone_111",
            BusinessAccountId = "saved_waba_222",
            GraphApiVersion = "v25.0",
            AccessTokenEncrypted = enc.Encrypt(savedTokenPlain),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req =>
        {
            if (req.RequestUri!.AbsolutePath.Contains("form_phone_555"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"verified_name\":\"Form Phone\",\"display_phone_number\":\"+919999999999\"}", Encoding.UTF8, "application/json")
                };
            }
            if (req.RequestUri!.AbsolutePath.Contains("form_waba_666"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"name\":\"Form WABA\",\"id\":\"form_waba_666\"}", Encoding.UTF8, "application/json")
                };
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        };

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        // Form has blank token
        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "form_phone_555",
            BusinessAccountId: "form_waba_666",
            GraphApiVersion: "v25.0",
            AccessToken: ""
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(2, handler.RecordedRequests.Count);
        // Verify both requests used the saved decrypted token
        Assert.Equal(savedTokenPlain, handler.RecordedRequests[0].Headers.Authorization?.Parameter);
        Assert.Equal(savedTokenPlain, handler.RecordedRequests[1].Headers.Authorization?.Parameter);
    }

    [Fact]
    public async Task TestConnection_BlankToken_NoSavedConfiguration_FailsGracefully()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "form_phone_555",
            BusinessAccountId: "form_waba_666",
            GraphApiVersion: "v25.0",
            AccessToken: ""
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Access Token is required", result.Message);
        Assert.Empty(handler.RecordedRequests);
    }

    [Fact]
    public async Task TestConnection_MissingPhoneNumberId_ReturnsValidationError()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "   ",
            BusinessAccountId: "waba_123",
            GraphApiVersion: "v25.0",
            AccessToken: "token_abc"
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Phone Number ID is required", result.Message);
        Assert.Empty(handler.RecordedRequests);
    }

    [Fact]
    public async Task TestConnection_MissingWabaId_ReturnsValidationError()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "phone_123",
            BusinessAccountId: "",
            GraphApiVersion: "v25.0",
            AccessToken: "token_abc"
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("WhatsApp Business Account ID is required", result.Message);
        Assert.Empty(handler.RecordedRequests);
    }

    [Fact]
    public async Task TestConnection_InvalidGraphApiVersion_ReturnsValidationError()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "phone_123",
            BusinessAccountId: "waba_123",
            GraphApiVersion: "invalid/version/injection",
            AccessToken: "token_abc"
        );

        // Act
        var result = await service.TestConnectionAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("Invalid Graph API version format", result.Message);
        Assert.Empty(handler.RecordedRequests);
    }

    [Fact]
    public async Task TestConnection_DoesNotMutateDatabase()
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
            InvoiceNotificationsEnabled = false,
            PaymentCompletedNotificationsEnabled = false,
            CreatedAt = DateTime.UtcNow
        };
        db.WhatsAppConfigurations.Add(originalConfig);
        await db.SaveChangesAsync();

        var handler = new MockHttpMessageHandler();
        handler.ResponseFactory = req => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"verified_name\":\"Test\",\"name\":\"Test WABA\"}", Encoding.UTF8, "application/json")
        };

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "new_temp_phone",
            BusinessAccountId: "new_temp_waba",
            GraphApiVersion: "v24.0",
            AccessToken: "new_temp_token"
        );

        // Act
        await service.TestConnectionAsync(request);

        // Assert: Database state must be identical to originalConfig
        var dbConfig = await db.WhatsAppConfigurations.FirstAsync();
        Assert.Equal("orig_phone", dbConfig.PhoneNumberId);
        Assert.Equal("orig_waba", dbConfig.BusinessAccountId);
        Assert.Equal("v25.0", dbConfig.GraphApiVersion);
        Assert.Equal("orig_token", enc.Decrypt(dbConfig.AccessTokenEncrypted));
        Assert.False(dbConfig.IsEnabled);
    }

    [Fact]
    public async Task TestConnection_NeverExposesAccessTokenInMessageOrDetails()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var enc = CreateEncryptionService();
        var handler = new MockHttpMessageHandler();

        var secretToken = "EAAGm0PX4ZCpsBA_SECRET_META_TOKEN_12345";
        handler.ResponseFactory = req =>
        {
            // Simulate Meta error echoing or containing the token
            var metaErrorWithSecret = JsonSerializer.Serialize(new
            {
                error = new
                {
                    message = $"Invalid token: {secretToken} for Bearer {secretToken}",
                    type = "OAuthException",
                    code = 190
                }
            });
            return new HttpResponseMessage(HttpStatusCode.Unauthorized)
            {
                Content = new StringContent(metaErrorWithSecret, Encoding.UTF8, "application/json")
            };
        };

        var httpClient = new HttpClient(handler);
        var config = new ConfigurationBuilder().Build();
        var service = new WhatsAppService(db, httpClient, enc, new NullAuditLogService(), config, NullLogger<WhatsAppService>.Instance);

        var request = new TestWhatsAppConnectionRequest(
            PhoneNumberId: "111222333",
            BusinessAccountId: "444555666",
            GraphApiVersion: "v25.0",
            AccessToken: secretToken
        );

        // Act
        var result = await service.TestConnectionAsync(request);

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
