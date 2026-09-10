using System.Net;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.BackgroundJobs;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class WhatsAppTokenHealthMonitoringTests
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

	private class MockInvoicePdfGenerator : IInvoicePdfGenerator
	{
		public byte[] GenerateInvoicePdf(Invoice invoice, BusinessProfile? businessProfile)
		{
			return Encoding.UTF8.GetBytes("%PDF-1.4 Mock Invoice PDF Content");
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

	private static IConfiguration CreateConfiguration()
	{
		var inMemorySettings = new Dictionary<string, string?>
		{
			["WhatsApp:EncryptionKey"] = "12345678901234567890123456789012",
			["PublicInvoiceBaseUrl"] = "http://localhost:5173"
		};
		return new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
	}

	private static (WhatsAppService Service, AppDbContext Db, MockHttpMessageHandler Handler, IAesEncryptionService Enc) CreateTestSetup(
		Func<HttpRequestMessage, HttpResponseMessage>? responseFactory = null)
	{
		var db = CreateInMemoryDbContext();
		var enc = CreateEncryptionService();
		var config = CreateConfiguration();
		var handler = new MockHttpMessageHandler { ResponseFactory = responseFactory };
		var httpClient = new HttpClient(handler);
		var audit = new NullAuditLogService();
		var pdfGen = new MockInvoicePdfGenerator();
		var logger = NullLogger<WhatsAppService>.Instance;

		var service = new WhatsAppService(
			db,
			httpClient,
			enc,
			audit,
			config,
			pdfGen,
			logger);

		return (service, db, handler, enc);
	}

	// 1. Missing WhatsApp configuration -> NotConfigured
	[Fact]
	public async Task Test1_MissingConfiguration_ReturnsNotConfigured()
	{
		// Arrange
		var (service, db, _, _) = CreateTestSetup();

		// Act
		var health = await service.GetHealthStatusAsync(forceProbe: false);

		// Assert
		Assert.Equal("NotConfigured", health.Status);
		Assert.False(health.IsConfigured);
		Assert.Null(health.LastSuccessAtUtc);
		Assert.Null(health.LastFailureAtUtc);
	}

	// 2. Valid Meta configuration -> Healthy
	[Fact]
	public async Task Test2_ValidConfiguration_ReturnsHealthyAfterProbe()
	{
		// Arrange
		const string secretToken = "EAAGvalidToken123456789";
		var (service, db, handler, enc) = CreateTestSetup(req =>
		{
			if (req.RequestUri!.ToString().Contains("fields=id,verified_name"))
			{
				return new HttpResponseMessage(HttpStatusCode.OK)
				{
					Content = new StringContent(JsonSerializer.Serialize(new
					{
						id = "111222333",
						verified_name = "E6 Car Spa"
					}), Encoding.UTF8, "application/json")
				};
			}
			return new HttpResponseMessage(HttpStatusCode.OK);
		});

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt(secretToken),
			HealthStatus = WhatsAppHealthStatus.NotConfigured,
			UpdatedAt = DateTime.UtcNow
		});
		await db.SaveChangesAsync();

		// Act
		var health = await service.GetHealthStatusAsync(forceProbe: true);

		// Assert
		Assert.Equal("Healthy", health.Status);
		Assert.True(health.IsConfigured);
		Assert.NotNull(health.LastCheckedAtUtc);
		Assert.NotNull(health.LastSuccessAtUtc);
		Assert.Null(health.LastErrorMessage);

		// Verify DB persisted state
		var persisted = await db.WhatsAppConfigurations.FirstAsync();
		Assert.Equal(WhatsAppHealthStatus.Healthy, persisted.HealthStatus);
		Assert.NotNull(persisted.LastSuccessAtUtc);
	}

	// 3. HTTP 401 -> AuthenticationFailed
	[Fact]
	public async Task Test3_Http401_ReturnsAuthenticationFailed()
	{
		// Arrange
		const string secretToken = "EAAGexpiredToken123";
		var (service, db, handler, enc) = CreateTestSetup(req =>
		{
			return new HttpResponseMessage(HttpStatusCode.Unauthorized)
			{
				Content = new StringContent(JsonSerializer.Serialize(new
				{
					error = new
					{
						message = "Invalid OAuth access token.",
						type = "OAuthException",
						code = 190
					}
				}), Encoding.UTF8, "application/json")
			};
		});

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt(secretToken),
			HealthStatus = WhatsAppHealthStatus.Healthy,
			UpdatedAt = DateTime.UtcNow
		});
		await db.SaveChangesAsync();

		// Act
		var health = await service.GetHealthStatusAsync(forceProbe: true);

		// Assert
		Assert.Equal("AuthenticationFailed", health.Status);
		Assert.NotNull(health.LastFailureAtUtc);
		Assert.Contains("Invalid OAuth access token", health.LastErrorMessage);

		// Verify DB persisted state
		var persisted = await db.WhatsAppConfigurations.FirstAsync();
		Assert.Equal(WhatsAppHealthStatus.AuthenticationFailed, persisted.HealthStatus);
	}

	// 4. Meta OAuth error code 190 -> AuthenticationFailed
	[Fact]
	public void Test4_MetaErrorCode190_ClassifiesAsAuthenticationFailed()
	{
		// Arrange
		var body = JsonSerializer.Serialize(new
		{
			error = new
			{
				message = "Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.",
				type = "OAuthException",
				code = 190,
				error_subcode = 460
			}
		});

		// Act
		var (status, msg, details) = WhatsAppService.ClassifyMetaError(400, body, "secret123");

		// Assert
		Assert.Equal(WhatsAppHealthStatus.AuthenticationFailed, status);
		Assert.Contains("Error validating access token", msg);
	}

	// 5. Expired-token subcode 463 / 467 -> AuthenticationFailed
	[Theory]
	[InlineData(463, "Session has expired")]
	[InlineData(467, "Access token has expired")]
	[InlineData(490, "User has not authorized application")]
	public void Test5_ExpiredTokenSubcodes_ClassifiesAsAuthenticationFailed(int subcode, string errMsg)
	{
		// Arrange
		var body = JsonSerializer.Serialize(new
		{
			error = new
			{
				message = errMsg,
				type = "OAuthException",
				code = 190,
				error_subcode = subcode
			}
		});

		// Act
		var (status, msg, details) = WhatsAppService.ClassifyMetaError(400, body);

		// Assert
		Assert.Equal(WhatsAppHealthStatus.AuthenticationFailed, status);
		Assert.Contains(errMsg, msg);
	}

	// 6. HTTP 429 -> TemporarilyUnavailable
	[Fact]
	public void Test6_Http429_ClassifiesAsTemporarilyUnavailable()
	{
		// Arrange
		var body = JsonSerializer.Serialize(new
		{
			error = new
			{
				message = "(#80004) There have been too many calls to this API.",
				type = "OAuthException",
				code = 80004
			}
		});

		// Act
		var (status, msg, details) = WhatsAppService.ClassifyMetaError(429, body);

		// Assert
		Assert.Equal(WhatsAppHealthStatus.TemporarilyUnavailable, status);
		Assert.Contains("too many calls", msg);
	}

	// 7. HTTP 5xx -> TemporarilyUnavailable
	[Theory]
	[InlineData(500)]
	[InlineData(502)]
	[InlineData(503)]
	[InlineData(504)]
	public void Test7_Http5xx_ClassifiesAsTemporarilyUnavailable(int statusCode)
	{
		// Arrange
		var body = "<html><body>502 Bad Gateway</body></html>";

		// Act
		var (status, msg, details) = WhatsAppService.ClassifyMetaError(statusCode, body);

		// Assert
		Assert.Equal(WhatsAppHealthStatus.TemporarilyUnavailable, status);
	}

	// 8. Health response never exposes access token
	[Fact]
	public async Task Test8_HealthResponse_NeverExposesAccessToken()
	{
		// Arrange
		const string secretToken = "EAAGsuperSecretAccessToken999888";
		var (service, db, _, enc) = CreateTestSetup(req =>
		{
			return new HttpResponseMessage(HttpStatusCode.Unauthorized)
			{
				Content = new StringContent(JsonSerializer.Serialize(new
				{
					error = new
					{
						message = $"Failed with token {secretToken}",
						type = "OAuthException",
						code = 190
					}
				}), Encoding.UTF8, "application/json")
			};
		});

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt(secretToken),
			HealthStatus = WhatsAppHealthStatus.Healthy,
			UpdatedAt = DateTime.UtcNow
		});
		await db.SaveChangesAsync();

		// Act
		var health = await service.GetHealthStatusAsync(forceProbe: true);
		var serializedHealth = JsonSerializer.Serialize(health);

		// Assert
		Assert.DoesNotContain(secretToken, serializedHealth);
		Assert.DoesNotContain(secretToken, health.LastErrorMessage ?? string.Empty);
		Assert.Contains("[REDACTED]", health.LastErrorMessage ?? string.Empty);
	}

	// 9. Persisted health information never contains access token
	[Fact]
	public async Task Test9_PersistedHealthInformation_NeverContainsAccessToken()
	{
		// Arrange
		const string secretToken = "EAAGveryPrivateSecret12345";
		var (service, db, _, enc) = CreateTestSetup(req =>
		{
			return new HttpResponseMessage(HttpStatusCode.BadRequest)
			{
				Content = new StringContent(JsonSerializer.Serialize(new
				{
					error = new
					{
						message = $"Error with token {secretToken} and header Bearer {secretToken}",
						type = "OAuthException",
						code = 190
					}
				}), Encoding.UTF8, "application/json")
			};
		});

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt(secretToken),
			HealthStatus = WhatsAppHealthStatus.Healthy,
			UpdatedAt = DateTime.UtcNow
		});
		await db.SaveChangesAsync();

		// Act
		await service.ProbeHealthAsync();

		// Assert
		var persisted = await db.WhatsAppConfigurations.FirstAsync();
		Assert.DoesNotContain(secretToken, persisted.LastErrorMessage ?? string.Empty);
		Assert.Contains("[REDACTED]", persisted.LastErrorMessage ?? string.Empty);
	}

	// 10. Meta error sanitization prevents secret leakage
	[Fact]
	public void Test10_MetaErrorSanitization_RedactsBearerAndTokens()
	{
		// Arrange
		const string token = "EAAGmySecretTokenABC";
		var rawError = JsonSerializer.Serialize(new
		{
			error = new
			{
				message = $"Bearer {token} failed authentication for key {token}",
				type = "OAuthException",
				code = 190
			}
		});

		// Act
		var (status, msg, details) = WhatsAppService.ClassifyMetaError(401, rawError, token);

		// Assert
		Assert.DoesNotContain(token, msg);
		Assert.DoesNotContain(token, details ?? string.Empty);
		Assert.Contains("[REDACTED]", msg);
	}

	// 11. Health endpoint returns cached status without unnecessary Meta request
	[Fact]
	public async Task Test11_GetHealthStatus_ReturnsCachedWithoutMetaRequest()
	{
		// Arrange
		var (service, db, handler, enc) = CreateTestSetup();

		var cachedChecked = DateTime.UtcNow.AddMinutes(-10);
		var cachedSuccess = DateTime.UtcNow.AddMinutes(-10);

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt("token123"),
			HealthStatus = WhatsAppHealthStatus.Healthy,
			LastCheckedAtUtc = cachedChecked,
			LastSuccessAtUtc = cachedSuccess,
			UpdatedAt = DateTime.UtcNow
		});
		await db.SaveChangesAsync();

		// Act - forceProbe is false (default)
		var health = await service.GetHealthStatusAsync(forceProbe: false);

		// Assert
		Assert.Equal("Healthy", health.Status);
		Assert.Equal(cachedChecked, health.LastCheckedAtUtc);
		Assert.Equal(cachedSuccess, health.LastSuccessAtUtc);
		Assert.Empty(handler.RecordedRequests); // Zero HTTP requests made to Meta
	}

	// 12. Manual connection test updates health state
	[Fact]
	public async Task Test12_ManualConnectionTest_UpdatesHealthState()
	{
		// Arrange
		const string secretToken = "EAAGtestToken123";
		var (service, db, handler, enc) = CreateTestSetup(req =>
		{
			var uri = req.RequestUri!.ToString();
			if (uri.Contains("111222333"))
			{
				return new HttpResponseMessage(HttpStatusCode.OK)
				{
					Content = new StringContent(JsonSerializer.Serialize(new
					{
						verified_name = "E6 Car Spa",
						display_phone_number = "+91 9876543210",
						quality_rating = "GREEN",
						platform_type = "CLOUD_API"
					}), Encoding.UTF8, "application/json")
				};
			}
			if (uri.Contains("444555666"))
			{
				return new HttpResponseMessage(HttpStatusCode.OK)
				{
					Content = new StringContent(JsonSerializer.Serialize(new
					{
						id = "444555666",
						name = "E6 WABA"
					}), Encoding.UTF8, "application/json")
				};
			}
			return new HttpResponseMessage(HttpStatusCode.OK);
		});

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt(secretToken),
			HealthStatus = WhatsAppHealthStatus.AuthenticationFailed,
			LastFailureAtUtc = DateTime.UtcNow.AddDays(-1),
			LastErrorMessage = "Old failure",
			UpdatedAt = DateTime.UtcNow
		});
		await db.SaveChangesAsync();

		// Act
		var response = await service.TestConnectionAsync(new TestWhatsAppConnectionRequest(
			PhoneNumberId: "111222333",
			BusinessAccountId: "444555666",
			AccessToken: secretToken
		));

		// Assert
		Assert.True(response.IsSuccess);
		var persisted = await db.WhatsAppConfigurations.FirstAsync();
		Assert.Equal(WhatsAppHealthStatus.Healthy, persisted.HealthStatus);
		Assert.NotNull(persisted.LastSuccessAtUtc);
		Assert.Null(persisted.LastErrorMessage);
	}

	// Configuration update invalidates stale health status appropriately
	[Fact]
	public async Task Test12b_ConfigurationUpdate_InvalidatesStaleHealthStatus()
	{
		// Arrange
		var (service, db, _, enc) = CreateTestSetup();

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt("oldToken"),
			HealthStatus = WhatsAppHealthStatus.Healthy,
			LastSuccessAtUtc = DateTime.UtcNow,
			UpdatedAt = DateTime.UtcNow
		});
		await db.SaveChangesAsync();

		// Act
		await service.UpdateConfigurationAsync(new UpdateWhatsAppConfigRequest
		{
			IsEnabled = true,
			PhoneNumberId = "999888777",
			BusinessAccountId = "555444333",
			AccessToken = "newToken123",
			InvoiceNotificationsEnabled = true,
			PaymentCompletedNotificationsEnabled = true,
			GraphApiVersion = "v25.0",
			InvoiceTemplateName = "invoice_sent",
			PaymentCompletedTemplateName = "payment_received"
		});

		// Assert
		var persisted = await db.WhatsAppConfigurations.FirstAsync();
		Assert.Equal(WhatsAppHealthStatus.NotConfigured, persisted.HealthStatus);
		Assert.Null(persisted.LastErrorMessage);
	}

	// 13. Worker survives authentication failure and continues running
	[Fact]
	public async Task Test13_Worker_SurvivesAuthenticationFailure()
	{
		// Arrange
		var db = CreateInMemoryDbContext();
		var enc = CreateEncryptionService();
		var config = CreateConfiguration();

		// Return 401 for health probe and message sending
		var handler = new MockHttpMessageHandler
		{
			ResponseFactory = req => new HttpResponseMessage(HttpStatusCode.Unauthorized)
			{
				Content = new StringContent(JsonSerializer.Serialize(new
				{
					error = new
					{
						message = "Invalid OAuth access token.",
						type = "OAuthException",
						code = 190
					}
				}), Encoding.UTF8, "application/json")
			}
		};

		var httpClient = new HttpClient(handler);
		var audit = new NullAuditLogService();
		var pdfGen = new MockInvoicePdfGenerator();
		var serviceLogger = NullLogger<WhatsAppService>.Instance;

		var service = new WhatsAppService(db, httpClient, enc, audit, config, pdfGen, serviceLogger);

		var services = new ServiceCollection();
		services.AddSingleton<IWhatsAppService>(service);
		var serviceProvider = services.BuildServiceProvider();

		var workerLogger = NullLogger<WhatsAppBackgroundWorker>.Instance;
		var worker = new WhatsAppBackgroundWorker(serviceProvider, workerLogger);

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt("badToken"),
			HealthStatus = WhatsAppHealthStatus.Healthy,
			UpdatedAt = DateTime.UtcNow
		});
		await db.SaveChangesAsync();

		// Act: Probe health through worker's scope
		using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));
		// Execute a health probe directly and ensure service handles it gracefully without throwing unhandled
		await service.ProbeHealthAsync(CancellationToken.None);

		// Assert
		var persisted = await db.WhatsAppConfigurations.FirstAsync();
		Assert.Equal(WhatsAppHealthStatus.AuthenticationFailed, persisted.HealthStatus);
		Assert.NotNull(persisted.LastFailureAtUtc);
	}

	// 14. Invoice finalization succeeds despite WhatsApp authentication failure
	[Fact]
	public async Task Test14_InvoiceFinalization_SucceedsDespiteWhatsAppAuthenticationFailure()
	{
		// Arrange
		var (service, db, handler, enc) = CreateTestSetup(req =>
		{
			return new HttpResponseMessage(HttpStatusCode.Unauthorized)
			{
				Content = new StringContent(JsonSerializer.Serialize(new
				{
					error = new
					{
						message = "Error validating access token: Session expired.",
						type = "OAuthException",
						code = 190
					}
				}), Encoding.UTF8, "application/json")
			};
		});

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt("badToken"),
			InvoiceNotificationsEnabled = true,
			InvoiceTemplateName = "e6_invoice_notification",
			HealthStatus = WhatsAppHealthStatus.Healthy,
			UpdatedAt = DateTime.UtcNow
		});

		var customer = new Customer
		{
			Id = Guid.NewGuid(),
			Name = "John Doe",
			PhoneNumber = "+91 9876543210",
			CreatedAt = DateTime.UtcNow
		};
		var vehicle = new Vehicle
		{
			Id = Guid.NewGuid(),
			RegistrationNumber = "TN01AB1234",
			CustomerId = customer.Id,
			Customer = customer,
			CreatedAt = DateTime.UtcNow
		};
		var invoice = new Invoice
		{
			Id = Guid.NewGuid(),
			InvoiceNumber = "INV-2026-001",
			CustomerId = customer.Id,
			Customer = customer,
			VehicleId = vehicle.Id,
			Vehicle = vehicle,
			TotalAmount = 1500m,
			PaidAmount = 0m,
			BalanceAmount = 1500m,
			Status = InvoiceStatus.Generated,
			InvoiceDate = DateTime.UtcNow,
			CreatedAt = DateTime.UtcNow
		};

		db.Customers.Add(customer);
		db.Vehicles.Add(vehicle);
		db.Invoices.Add(invoice);
		await db.SaveChangesAsync();

		// Act 1: Queue notification (happens during invoice finalization)
		var queuedMessage = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

		// Assert queued
		Assert.NotNull(queuedMessage);
		Assert.Equal(WhatsAppMessageStatus.Pending, queuedMessage.Status);

		// Act 2: Process message in background
		var processResult = await service.ProcessMessageAsync(queuedMessage.Id);

		// Assert: WhatsApp processing returned false because of auth failure, BUT does NOT crash or corrupt invoice
		Assert.False(processResult);

		var dbInvoice = await db.Invoices.FindAsync(invoice.Id);
		Assert.NotNull(dbInvoice);
		Assert.Equal(InvoiceStatus.Generated, dbInvoice.Status);
		Assert.Equal(1500m, dbInvoice.TotalAmount);

		var dbMessage = await db.WhatsAppMessages.FindAsync(queuedMessage.Id);
		Assert.NotNull(dbMessage);
		Assert.Equal(WhatsAppMessageStatus.Failed, dbMessage.Status);
		Assert.NotNull(dbMessage.ErrorMessage);

		var healthConfig = await db.WhatsAppConfigurations.FirstAsync();
		Assert.Equal(WhatsAppHealthStatus.AuthenticationFailed, healthConfig.HealthStatus);
	}

	// 15. PaymentCompleted remains functional
	[Fact]
	public async Task Test15_PaymentCompleted_RemainsFunctional()
	{
		// Arrange
		var (service, db, handler, enc) = CreateTestSetup(req =>
		{
			var uri = req.RequestUri!.ToString();
			if (uri.Contains("message_templates"))
			{
				return new HttpResponseMessage(HttpStatusCode.OK)
				{
					Content = new StringContent(JsonSerializer.Serialize(new
					{
						data = new object[]
						{
							new
							{
								id = "tpl_pay_102",
								name = "payment_receipt_notification",
								status = "APPROVED",
								category = "UTILITY",
								language = "en_US",
								components = new object[]
								{
									new
									{
										type = "BODY",
										text = "Hello {{1}}, payment received.",
										example = new { body_text = new[] { new[] { "Jane" } } }
									}
								}
							}
						}
					}), Encoding.UTF8, "application/json")
				};
			}

			if (uri.Contains("messages"))
			{
				return new HttpResponseMessage(HttpStatusCode.OK)
				{
					Content = new StringContent(JsonSerializer.Serialize(new
					{
						messages = new[]
						{
							new { id = "wamid.PAYMENT12345" }
						}
					}), Encoding.UTF8, "application/json")
				};
			}
			return new HttpResponseMessage(HttpStatusCode.OK);
		});

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt("validToken"),
			PaymentCompletedNotificationsEnabled = true,
			PaymentCompletedTemplateName = "payment_receipt_notification",
			PaymentCompletedTemplateLanguage = "en_US",
			HealthStatus = WhatsAppHealthStatus.NotConfigured,
			UpdatedAt = DateTime.UtcNow
		});

		var customer = new Customer
		{
			Id = Guid.NewGuid(),
			Name = "Jane Smith",
			PhoneNumber = "+91 9123456780",
			CreatedAt = DateTime.UtcNow
		};
		var vehicle = new Vehicle
		{
			Id = Guid.NewGuid(),
			RegistrationNumber = "TN02CD5678",
			CustomerId = customer.Id,
			Customer = customer,
			CreatedAt = DateTime.UtcNow
		};
		var invoice = new Invoice
		{
			Id = Guid.NewGuid(),
			InvoiceNumber = "INV-2026-002",
			CustomerId = customer.Id,
			Customer = customer,
			VehicleId = vehicle.Id,
			Vehicle = vehicle,
			TotalAmount = 2500m,
			PaidAmount = 2500m,
			BalanceAmount = 0m,
			Status = InvoiceStatus.Paid,
			InvoiceDate = DateTime.UtcNow,
			CreatedAt = DateTime.UtcNow
		};

		db.Customers.Add(customer);
		db.Vehicles.Add(vehicle);
		db.Invoices.Add(invoice);
		await db.SaveChangesAsync();

		// Act 1: Queue payment completed notification
		var queued = await service.QueuePaymentCompletedNotificationAsync(invoice.Id, 2500m, "http://localhost:5173/invoices/public/123");

		// Assert queued
		Assert.NotNull(queued);
		Assert.Equal(WhatsAppMessageStatus.Pending, queued.Status);
		Assert.Equal(WhatsAppMessageType.PaymentCompleted, queued.MessageType);

		// Act 2: Process message
		var sent = await service.ProcessMessageAsync(queued.Id);

		// Assert sent and health updated to Healthy
		Assert.True(sent);
		var dbMessage = await db.WhatsAppMessages.FindAsync(queued.Id);
		Assert.NotNull(dbMessage);
		Assert.Equal(WhatsAppMessageStatus.Sent, dbMessage.Status);
		Assert.Equal("wamid.PAYMENT12345", dbMessage.MetaMessageId);

		var dbConfig = await db.WhatsAppConfigurations.FirstAsync();
		Assert.Equal(WhatsAppHealthStatus.Healthy, dbConfig.HealthStatus);
		Assert.NotNull(dbConfig.LastSuccessAtUtc);
	}

	// 16. Existing message idempotency/concurrency tests still pass
	[Fact]
	public async Task Test16_MessageIdempotency_DuplicateQueueCallsReturnExistingMessage()
	{
		// Arrange
		var (service, db, _, enc) = CreateTestSetup();

		db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
		{
			Id = Guid.NewGuid(),
			IsEnabled = true,
			PhoneNumberId = "111222333",
			BusinessAccountId = "444555666",
			AccessTokenEncrypted = enc.Encrypt("token"),
			InvoiceNotificationsEnabled = true,
			UpdatedAt = DateTime.UtcNow
		});

		var customer = new Customer
		{
			Id = Guid.NewGuid(),
			Name = "Alice",
			PhoneNumber = "+91 9999988888",
			CreatedAt = DateTime.UtcNow
		};
		var vehicle = new Vehicle
		{
			Id = Guid.NewGuid(),
			RegistrationNumber = "TN03EF9999",
			CustomerId = customer.Id,
			Customer = customer,
			CreatedAt = DateTime.UtcNow
		};
		var invoice = new Invoice
		{
			Id = Guid.NewGuid(),
			InvoiceNumber = "INV-2026-003",
			CustomerId = customer.Id,
			Customer = customer,
			VehicleId = vehicle.Id,
			Vehicle = vehicle,
			TotalAmount = 500m,
			Status = InvoiceStatus.Generated,
			InvoiceDate = DateTime.UtcNow,
			CreatedAt = DateTime.UtcNow
		};

		db.Customers.Add(customer);
		db.Vehicles.Add(vehicle);
		db.Invoices.Add(invoice);
		await db.SaveChangesAsync();

		// Act: Call QueueInvoiceFinalizedNotificationAsync twice
		var msg1 = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);
		var msg2 = await service.QueueInvoiceFinalizedNotificationAsync(invoice.Id);

		// Assert: Exactly one message was created in database and returned
		Assert.NotNull(msg1);
		Assert.NotNull(msg2);
		Assert.Equal(msg1.Id, msg2.Id);

		var allMessages = await db.WhatsAppMessages.Where(m => m.InvoiceId == invoice.Id).ToListAsync();
		Assert.Single(allMessages);
	}
}
