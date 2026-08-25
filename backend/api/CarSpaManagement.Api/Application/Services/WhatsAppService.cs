using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CarSpaManagement.Api.Application.Services;

public class WhatsAppService : IWhatsAppService
{
	private readonly AppDbContext _db;
	private readonly HttpClient _httpClient;
	private readonly IAesEncryptionService _encryptionService;
	private readonly IAuditLogService _auditLogService;
	private readonly IConfiguration _configuration;
	private readonly ILogger<WhatsAppService> _logger;

	public WhatsAppService(
		AppDbContext db,
		HttpClient httpClient,
		IAesEncryptionService encryptionService,
		IAuditLogService auditLogService,
		IConfiguration configuration,
		ILogger<WhatsAppService> logger)
	{
		_db = db;
		_httpClient = httpClient;
		_encryptionService = encryptionService;
		_auditLogService = auditLogService;
		_configuration = configuration;
		_logger = logger;
	}

	public async Task<WhatsAppConfigResponse> GetConfigurationAsync(CancellationToken cancellationToken = default)
	{
		var config = await GetOrCreateConfigEntityAsync(cancellationToken);
		return ToDto(config);
	}

	public async Task<WhatsAppConfigResponse> UpdateConfigurationAsync(UpdateWhatsAppConfigRequest request, Guid? userId = null, CancellationToken cancellationToken = default)
	{
		var config = await GetOrCreateConfigEntityAsync(cancellationToken);

		config.IsEnabled = request.IsEnabled;
		config.PhoneNumberId = (request.PhoneNumberId ?? string.Empty).Trim();
		config.BusinessAccountId = (request.BusinessAccountId ?? string.Empty).Trim();
		config.GraphApiVersion = string.IsNullOrWhiteSpace(request.GraphApiVersion) ? "v25.0" : request.GraphApiVersion.Trim();
		config.InvoiceNotificationsEnabled = request.InvoiceNotificationsEnabled;
		config.PaymentCompletedNotificationsEnabled = request.PaymentCompletedNotificationsEnabled;

		if (!string.IsNullOrWhiteSpace(request.InvoiceTemplateName))
			config.InvoiceTemplateName = request.InvoiceTemplateName.Trim();

		if (!string.IsNullOrWhiteSpace(request.InvoiceTemplateLanguage))
			config.InvoiceTemplateLanguage = request.InvoiceTemplateLanguage.Trim();

		if (!string.IsNullOrWhiteSpace(request.PaymentCompletedTemplateName))
			config.PaymentCompletedTemplateName = request.PaymentCompletedTemplateName.Trim();

		if (!string.IsNullOrWhiteSpace(request.PaymentCompletedTemplateLanguage))
			config.PaymentCompletedTemplateLanguage = request.PaymentCompletedTemplateLanguage.Trim();

		if (!string.IsNullOrWhiteSpace(request.AccessToken))
		{
			config.AccessTokenEncrypted = _encryptionService.Encrypt(request.AccessToken.Trim());
		}

		config.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: AuditActions.WhatsAppConfigUpdated,
			module: AuditModules.WhatsApp,
			description: "WhatsApp Business integration settings updated.",
			entityType: "WhatsAppConfiguration",
			entityId: config.Id,
			newValues: JsonSerializer.Serialize(new
			{
				isEnabled = config.IsEnabled,
				phoneNumberId = config.PhoneNumberId,
				businessAccountId = config.BusinessAccountId,
				graphApiVersion = config.GraphApiVersion,
				hasAccessToken = !string.IsNullOrEmpty(config.AccessTokenEncrypted),
				invoiceNotificationsEnabled = config.InvoiceNotificationsEnabled,
				paymentCompletedNotificationsEnabled = config.PaymentCompletedNotificationsEnabled
			}),
			outcome: "Success",
			cancellationToken: cancellationToken);

		return ToDto(config);
	}

	public async Task<TestWhatsAppConnectionResponse> TestConnectionAsync(TestWhatsAppConnectionRequest? request = null, CancellationToken cancellationToken = default)
	{
		var config = await GetOrCreateConfigEntityAsync(cancellationToken);

		var phoneId = !string.IsNullOrWhiteSpace(request?.PhoneNumberId) ? request.PhoneNumberId.Trim() : config.PhoneNumberId;
		var graphVersion = !string.IsNullOrWhiteSpace(request?.GraphApiVersion) ? request.GraphApiVersion.Trim() : config.GraphApiVersion;
		var token = !string.IsNullOrWhiteSpace(request?.AccessToken)
			? request.AccessToken.Trim()
			: _encryptionService.Decrypt(config.AccessTokenEncrypted);

		if (string.IsNullOrWhiteSpace(phoneId))
		{
			return new TestWhatsAppConnectionResponse(false, "Phone Number ID is missing.");
		}

		if (string.IsNullOrWhiteSpace(token))
		{
			return new TestWhatsAppConnectionResponse(false, "Access Token is missing.");
		}

		try
		{
			var requestUrl = $"https://graph.facebook.com/{graphVersion}/{phoneId}";
			using var httpRequest = new HttpRequestMessage(HttpMethod.Get, requestUrl);
			httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

			var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
			var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

			if (response.IsSuccessStatusCode)
			{
				return new TestWhatsAppConnectionResponse(true, "Successfully connected to Meta WhatsApp Cloud API.", responseContent);
			}

			return new TestWhatsAppConnectionResponse(false, $"Meta connection test failed with status {(int)response.StatusCode}.", responseContent);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "WhatsApp test connection failed with exception.");
			return new TestWhatsAppConnectionResponse(false, $"Connection error: {ex.Message}");
		}
	}

	public async Task<WhatsAppMessage?> QueueInvoiceFinalizedNotificationAsync(Guid invoiceId, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default)
	{
		// Idempotency: Check if an active message already exists for this invoice and type
		var existing = await _db.WhatsAppMessages
			.FirstOrDefaultAsync(m => m.InvoiceId == invoiceId && m.MessageType == WhatsAppMessageType.InvoiceFinalized, cancellationToken);

		if (existing != null)
		{
			return existing;
		}

		var invoice = await _db.Invoices
			.Include(i => i.Customer)
			.Include(i => i.PublicLinks)
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null || invoice.Status == InvoiceStatus.Draft || invoice.Status == InvoiceStatus.Cancelled || invoice.IsDeleted)
		{
			return null;
		}

		var config = await GetOrCreateConfigEntityAsync(cancellationToken);
		var normalizedPhone = NormalizePhoneNumber(invoice.Customer.PhoneNumber);

		// Public URL resolution
		var baseUrl = (_configuration["PublicInvoiceBaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
		var publicUrl = !string.IsNullOrWhiteSpace(publicInvoiceUrl)
			? publicInvoiceUrl
			: (invoice.PublicLinks.Any(l => !l.IsRevoked)
				? $"{baseUrl}/invoices/{invoice.Id}"
				: $"{baseUrl}/invoices");

		var snapshot = new
		{
			customerName = invoice.Customer.Name,
			invoiceNumber = invoice.InvoiceNumber ?? "INV-DRAFT",
			totalAmount = $"{invoice.TotalAmount:N2}",
			publicUrl = publicUrl
		};

		var message = new WhatsAppMessage
		{
			Id = Guid.NewGuid(),
			InvoiceId = invoice.Id,
			CustomerId = invoice.CustomerId,
			MessageType = WhatsAppMessageType.InvoiceFinalized,
			RecipientPhone = normalizedPhone ?? (invoice.Customer.PhoneNumber ?? string.Empty),
			Status = WhatsAppMessageStatus.Pending,
			TemplateParametersJson = JsonSerializer.Serialize(snapshot),
			CreatedAt = DateTime.UtcNow
		};

		if (!config.IsEnabled || !config.InvoiceNotificationsEnabled)
		{
			message.Status = WhatsAppMessageStatus.Skipped;
			message.ErrorMessage = "WhatsApp invoice notifications are disabled in settings.";
		}
		else if (string.IsNullOrWhiteSpace(normalizedPhone))
		{
			message.Status = WhatsAppMessageStatus.Skipped;
			message.ErrorMessage = "Customer phone number unavailable or invalid.";
		}

		_db.WhatsAppMessages.Add(message);
		await _db.SaveChangesAsync(cancellationToken);

		return message;
	}

	public async Task<WhatsAppMessage?> QueuePaymentCompletedNotificationAsync(Guid invoiceId, decimal paymentReceived, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default)
	{
		// Idempotency: Check if an active message already exists for this invoice and type
		var existing = await _db.WhatsAppMessages
			.FirstOrDefaultAsync(m => m.InvoiceId == invoiceId && m.MessageType == WhatsAppMessageType.PaymentCompleted, cancellationToken);

		if (existing != null)
		{
			return existing;
		}

		var invoice = await _db.Invoices
			.Include(i => i.Customer)
			.Include(i => i.PublicLinks)
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null || invoice.Status != InvoiceStatus.Paid || invoice.IsDeleted)
		{
			return null;
		}

		var config = await GetOrCreateConfigEntityAsync(cancellationToken);
		var normalizedPhone = NormalizePhoneNumber(invoice.Customer.PhoneNumber);

		// Public URL resolution
		var baseUrl = (_configuration["PublicInvoiceBaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
		var publicUrl = !string.IsNullOrWhiteSpace(publicInvoiceUrl)
			? publicInvoiceUrl
			: (invoice.PublicLinks.Any(l => !l.IsRevoked)
				? $"{baseUrl}/invoices/{invoice.Id}"
				: $"{baseUrl}/invoices");

		var snapshot = new
		{
			customerName = invoice.Customer.Name,
			invoiceNumber = invoice.InvoiceNumber ?? "INV",
			paymentReceived = $"{paymentReceived:N2}",
			totalPaid = $"{invoice.PaidAmount:N2}",
			balance = "0.00",
			publicUrl = publicUrl
		};

		var message = new WhatsAppMessage
		{
			Id = Guid.NewGuid(),
			InvoiceId = invoice.Id,
			CustomerId = invoice.CustomerId,
			MessageType = WhatsAppMessageType.PaymentCompleted,
			RecipientPhone = normalizedPhone ?? (invoice.Customer.PhoneNumber ?? string.Empty),
			Status = WhatsAppMessageStatus.Pending,
			TemplateParametersJson = JsonSerializer.Serialize(snapshot),
			CreatedAt = DateTime.UtcNow
		};

		if (!config.IsEnabled || !config.PaymentCompletedNotificationsEnabled)
		{
			message.Status = WhatsAppMessageStatus.Skipped;
			message.ErrorMessage = "WhatsApp payment completed notifications are disabled in settings.";
		}
		else if (string.IsNullOrWhiteSpace(normalizedPhone))
		{
			message.Status = WhatsAppMessageStatus.Skipped;
			message.ErrorMessage = "Customer phone number unavailable or invalid.";
		}

		_db.WhatsAppMessages.Add(message);
		await _db.SaveChangesAsync(cancellationToken);

		return message;
	}

	public async Task<bool> ProcessMessageAsync(Guid messageId, CancellationToken cancellationToken = default)
	{
		var message = await _db.WhatsAppMessages
			.Include(m => m.Invoice)
			.Include(m => m.Customer)
			.FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);

		if (message == null || message.Status == WhatsAppMessageStatus.Sent || message.Status == WhatsAppMessageStatus.Skipped)
		{
			return true;
		}

		var config = await GetOrCreateConfigEntityAsync(cancellationToken);
		if (!config.IsEnabled)
		{
			message.Status = WhatsAppMessageStatus.Skipped;
			message.ErrorMessage = "WhatsApp integration is disabled.";
			await _db.SaveChangesAsync(cancellationToken);
			return true;
		}

		var token = _encryptionService.Decrypt(config.AccessTokenEncrypted);
		if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(config.PhoneNumberId))
		{
			message.Status = WhatsAppMessageStatus.Failed;
			message.FailedAtUtc = DateTime.UtcNow;
			message.ErrorMessage = "WhatsApp configuration is incomplete (missing Phone Number ID or Access Token).";
			await _db.SaveChangesAsync(cancellationToken);
			return false;
		}

		message.AttemptCount++;
		message.LastAttemptAtUtc = DateTime.UtcNow;

		try
		{
			var templateName = message.MessageType == WhatsAppMessageType.InvoiceFinalized
				? config.InvoiceTemplateName
				: config.PaymentCompletedTemplateName;

			var templateLang = message.MessageType == WhatsAppMessageType.InvoiceFinalized
				? config.InvoiceTemplateLanguage
				: config.PaymentCompletedTemplateLanguage;

			var parametersDoc = JsonDocument.Parse(message.TemplateParametersJson ?? "{}");
			var root = parametersDoc.RootElement;

			var customerName = root.TryGetProperty("customerName", out var cProp) ? cProp.GetString() ?? "Customer" : "Customer";
			var invoiceNum = root.TryGetProperty("invoiceNumber", out var iProp) ? iProp.GetString() ?? "INV" : "INV";
			var publicUrl = root.TryGetProperty("publicUrl", out var uProp) ? uProp.GetString() ?? "" : "";

			object templatePayload;

			if (string.Equals(templateName, "hello_world", StringComparison.OrdinalIgnoreCase))
			{
				templatePayload = new
				{
					messaging_product = "whatsapp",
					recipient_type = "individual",
					to = message.RecipientPhone,
					type = "template",
					template = new
					{
						name = templateName,
						language = new { code = templateLang }
					}
				};
			}
			else if (message.MessageType == WhatsAppMessageType.InvoiceFinalized)
			{
				var totalAmount = root.TryGetProperty("totalAmount", out var tProp) ? tProp.GetString() ?? "0.00" : "0.00";
				templatePayload = new
				{
					messaging_product = "whatsapp",
					recipient_type = "individual",
					to = message.RecipientPhone,
					type = "template",
					template = new
					{
						name = templateName,
						language = new { code = templateLang },
						components = new object[]
						{
							new
							{
								type = "body",
								parameters = new object[]
								{
									new { type = "text", text = customerName },
									new { type = "text", text = invoiceNum },
									new { type = "text", text = totalAmount }
								}
							},
							new
							{
								type = "button",
								sub_type = "url",
								index = "0",
								parameters = new object[]
								{
									new { type = "text", text = publicUrl }
								}
							}
						}
					}
				};
			}
			else
			{
				var paymentReceived = root.TryGetProperty("paymentReceived", out var prProp) ? prProp.GetString() ?? "0.00" : "0.00";
				var totalPaid = root.TryGetProperty("totalPaid", out var tpProp) ? tpProp.GetString() ?? "0.00" : "0.00";
				templatePayload = new
				{
					messaging_product = "whatsapp",
					recipient_type = "individual",
					to = message.RecipientPhone,
					type = "template",
					template = new
					{
						name = templateName,
						language = new { code = templateLang },
						components = new object[]
						{
							new
							{
								type = "body",
								parameters = new object[]
								{
									new { type = "text", text = customerName },
									new { type = "text", text = invoiceNum },
									new { type = "text", text = paymentReceived },
									new { type = "text", text = totalPaid }
								}
							},
							new
							{
								type = "button",
								sub_type = "url",
								index = "0",
								parameters = new object[]
								{
									new { type = "text", text = publicUrl }
								}
							}
						}
					}
				};
			}

			var requestUrl = $"https://graph.facebook.com/{config.GraphApiVersion}/{config.PhoneNumberId}/messages";
			using var httpRequest = new HttpRequestMessage(HttpMethod.Post, requestUrl);
			httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
			httpRequest.Content = new StringContent(JsonSerializer.Serialize(templatePayload), Encoding.UTF8, "application/json");

			var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
			var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

			if (response.IsSuccessStatusCode)
			{
				string? metaId = null;
				try
				{
					using var respDoc = JsonDocument.Parse(responseBody);
					if (respDoc.RootElement.TryGetProperty("messages", out var msgArr) && msgArr.GetArrayLength() > 0)
					{
						metaId = msgArr[0].GetProperty("id").GetString();
					}
				}
				catch { }

				message.Status = WhatsAppMessageStatus.Sent;
				message.SentAtUtc = DateTime.UtcNow;
				message.MetaMessageId = metaId;
				message.ErrorMessage = null;
				await _db.SaveChangesAsync(cancellationToken);

				// Audit Success
				var actionName = message.MessageType == WhatsAppMessageType.InvoiceFinalized
					? AuditActions.WhatsAppInvoiceSent
					: AuditActions.WhatsAppPaymentCompletedSent;

				await _auditLogService.RecordAsync(
					action: actionName,
					module: AuditModules.WhatsApp,
					description: $"WhatsApp {message.MessageType} message sent successfully to {message.RecipientPhone}.",
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: invoiceNum,
					newValues: JsonSerializer.Serialize(new
					{
						invoiceNumber = invoiceNum,
						recipientPhone = message.RecipientPhone,
						metaMessageId = metaId,
						messageType = message.MessageType.ToString()
					}),
					outcome: "Success",
					cancellationToken: cancellationToken);

				return true;
			}

			// Handle Failures
			var statusCode = (int)response.StatusCode;
			var isTransient = statusCode == 429 || statusCode >= 500;

			if (isTransient && message.AttemptCount < 3)
			{
				message.Status = WhatsAppMessageStatus.Pending;
				message.NextAttemptAtUtc = DateTime.UtcNow.AddSeconds(Math.Pow(2, message.AttemptCount) * 10);
				message.ErrorMessage = $"Transient error (HTTP {statusCode}): {responseBody}";
				await _db.SaveChangesAsync(cancellationToken);
				return false;
			}

			// Permanent failure or retry limit reached
			message.Status = WhatsAppMessageStatus.Failed;
			message.FailedAtUtc = DateTime.UtcNow;
			message.ErrorMessage = $"Meta API error (HTTP {statusCode}): {responseBody}";
			await _db.SaveChangesAsync(cancellationToken);

			await _auditLogService.RecordAsync(
				action: AuditActions.WhatsAppNotificationFailed,
				module: AuditModules.WhatsApp,
				description: $"WhatsApp notification failed for Invoice '{invoiceNum}'. Error: {message.ErrorMessage}",
				entityType: "WhatsAppMessage",
				entityId: message.Id,
				entityReference: invoiceNum,
				outcome: "Failure",
				cancellationToken: cancellationToken);

			return false;
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Exception while sending WhatsApp message {MessageId}", messageId);

			if (message.AttemptCount < 3)
			{
				message.Status = WhatsAppMessageStatus.Pending;
				message.NextAttemptAtUtc = DateTime.UtcNow.AddSeconds(Math.Pow(2, message.AttemptCount) * 10);
				message.ErrorMessage = $"Network/System error: {ex.Message}";
				await _db.SaveChangesAsync(cancellationToken);
				return false;
			}

			message.Status = WhatsAppMessageStatus.Failed;
			message.FailedAtUtc = DateTime.UtcNow;
			message.ErrorMessage = $"Final failure after {message.AttemptCount} attempts: {ex.Message}";
			await _db.SaveChangesAsync(cancellationToken);

			var invNum = message.Invoice?.InvoiceNumber ?? "INV";
			await _auditLogService.RecordAsync(
				action: AuditActions.WhatsAppNotificationFailed,
				module: AuditModules.WhatsApp,
				description: $"WhatsApp notification failed for Invoice '{invNum}'. Error: {ex.Message}",
				entityType: "WhatsAppMessage",
				entityId: message.Id,
				entityReference: invNum,
				outcome: "Failure",
				cancellationToken: cancellationToken);

			return false;
		}
	}

	public async Task ProcessPendingMessagesAsync(CancellationToken cancellationToken = default)
	{
		var now = DateTime.UtcNow;
		var pendingMessages = await _db.WhatsAppMessages
			.Where(m => (m.Status == WhatsAppMessageStatus.Pending || m.Status == WhatsAppMessageStatus.Processing)
				&& (m.NextAttemptAtUtc == null || m.NextAttemptAtUtc <= now)
				&& m.AttemptCount < 3
				&& !m.IsDeleted)
			.OrderBy(m => m.CreatedAt)
			.Take(20)
			.ToListAsync(cancellationToken);

		foreach (var msg in pendingMessages)
		{
			if (cancellationToken.IsCancellationRequested) break;
			await ProcessMessageAsync(msg.Id, cancellationToken);
		}
	}

	public async Task<IReadOnlyList<InvoiceWhatsAppStatusDto>> GetInvoiceWhatsAppStatusAsync(Guid invoiceId, CancellationToken cancellationToken = default)
	{
		var messages = await _db.WhatsAppMessages
			.Where(m => m.InvoiceId == invoiceId && !m.IsDeleted)
			.OrderByDescending(m => m.CreatedAt)
			.ToListAsync(cancellationToken);

		return messages.Select(m => new InvoiceWhatsAppStatusDto(
			m.MessageType.ToString(),
			m.Status.ToString(),
			m.MetaMessageId,
			m.SentAtUtc,
			m.FailedAtUtc,
			m.ErrorMessage,
			m.AttemptCount
		)).ToList();
	}

	public string? NormalizePhoneNumber(string? phone)
	{
		if (string.IsNullOrWhiteSpace(phone)) return null;

		var digits = Regex.Replace(phone, @"\D", "");
		if (string.IsNullOrWhiteSpace(digits) || digits.Length < 10)
		{
			return null;
		}

		if (digits.Length == 11 && digits.StartsWith("0"))
		{
			digits = digits[1..];
		}

		if (digits.Length == 10)
		{
			return "91" + digits;
		}

		if (digits.Length == 12 && digits.StartsWith("91"))
		{
			return digits;
		}

		// Invalid format for Indian standard
		return null;
	}

	private async Task<WhatsAppConfiguration> GetOrCreateConfigEntityAsync(CancellationToken cancellationToken)
	{
		var config = await _db.WhatsAppConfigurations.FirstOrDefaultAsync(cancellationToken);
		if (config == null)
		{
			config = new WhatsAppConfiguration
			{
				Id = Guid.NewGuid(),
				SingletonKey = 1,
				IsEnabled = false,
				PhoneNumberId = string.Empty,
				BusinessAccountId = string.Empty,
				GraphApiVersion = "v25.0",
				InvoiceNotificationsEnabled = true,
				PaymentCompletedNotificationsEnabled = true,
				InvoiceTemplateName = "e6_carspa_invoice_generated",
				InvoiceTemplateLanguage = "en_US",
				PaymentCompletedTemplateName = "e6_carspa_payment_completed",
				PaymentCompletedTemplateLanguage = "en_US",
				CreatedAt = DateTime.UtcNow
			};
			_db.WhatsAppConfigurations.Add(config);
			await _db.SaveChangesAsync(cancellationToken);
		}

		return config;
	}

	private static WhatsAppConfigResponse ToDto(WhatsAppConfiguration c)
	{
		return new WhatsAppConfigResponse(
			c.IsEnabled,
			c.PhoneNumberId,
			c.BusinessAccountId,
			c.GraphApiVersion,
			!string.IsNullOrEmpty(c.AccessTokenEncrypted),
			c.InvoiceNotificationsEnabled,
			c.PaymentCompletedNotificationsEnabled,
			c.InvoiceTemplateName,
			c.InvoiceTemplateLanguage,
			c.PaymentCompletedTemplateName,
			c.PaymentCompletedTemplateLanguage,
			c.UpdatedAt
		);
	}
}
