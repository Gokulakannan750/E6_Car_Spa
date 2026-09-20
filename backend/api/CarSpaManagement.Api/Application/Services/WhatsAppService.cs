using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Security.Cryptography;
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
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CarSpaManagement.Api.Application.Services;

public class WhatsAppService : IWhatsAppService
{
	private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> _messageLocks = new();

	private readonly AppDbContext _db;
	private readonly HttpClient _httpClient;
	private readonly IAesEncryptionService _encryptionService;
	private readonly IAuditLogService _auditLogService;
	private readonly IConfiguration _configuration;
	private readonly IInvoicePdfGenerator _invoicePdfGenerator;
	private readonly ILogger<WhatsAppService> _logger;

	public WhatsAppService(
		AppDbContext db,
		HttpClient httpClient,
		IAesEncryptionService encryptionService,
		IAuditLogService auditLogService,
		IConfiguration configuration,
		ILogger<WhatsAppService> logger)
		: this(db, httpClient, encryptionService, auditLogService, configuration, new InvoicePdfGenerator(), logger)
	{
	}

	[ActivatorUtilitiesConstructor]
	public WhatsAppService(
		AppDbContext db,
		HttpClient httpClient,
		IAesEncryptionService encryptionService,
		IAuditLogService auditLogService,
		IConfiguration configuration,
		IInvoicePdfGenerator invoicePdfGenerator,
		ILogger<WhatsAppService> logger)
	{
		_db = db;
		_httpClient = httpClient;
		_encryptionService = encryptionService;
		_auditLogService = auditLogService;
		_configuration = configuration;
		_invoicePdfGenerator = invoicePdfGenerator ?? new InvoicePdfGenerator();
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

		var isConfigured = !string.IsNullOrWhiteSpace(config.PhoneNumberId) &&
						   !string.IsNullOrWhiteSpace(config.BusinessAccountId) &&
						   !string.IsNullOrWhiteSpace(config.AccessTokenEncrypted);

		if (!isConfigured)
		{
			config.HealthStatus = WhatsAppHealthStatus.NotConfigured;
			config.LastErrorMessage = "WhatsApp integration is not fully configured.";
		}
		else
		{
			// Reset failure message and mark as pending probe / clean
			config.HealthStatus = WhatsAppHealthStatus.NotConfigured;
			config.LastErrorMessage = null;
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

	private static readonly Regex GraphApiVersionRegex = new(@"^v\d+(\.\d+)?$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

	public async Task<TestWhatsAppConnectionResponse> TestConnectionAsync(TestWhatsAppConnectionRequest? request = null, CancellationToken cancellationToken = default)
	{
		var phoneId = request?.PhoneNumberId?.Trim();
		var wabaId = (!string.IsNullOrWhiteSpace(request?.BusinessAccountId)
			? request.BusinessAccountId
			: request?.WhatsAppBusinessAccountId)?.Trim();
		var graphVersion = !string.IsNullOrWhiteSpace(request?.GraphApiVersion)
			? request.GraphApiVersion.Trim()
			: "v25.0";
		var inputToken = request?.AccessToken?.Trim();

		// Validate Graph API version format
		if (!GraphApiVersionRegex.IsMatch(graphVersion))
		{
			return new TestWhatsAppConnectionResponse(false, "Invalid Graph API version format. Expected format like 'v25.0'.");
		}

		// Phone Number ID is required
		if (string.IsNullOrWhiteSpace(phoneId))
		{
			return new TestWhatsAppConnectionResponse(false, "Phone Number ID is required for testing connection.");
		}

		// WhatsApp Business Account ID is required
		if (string.IsNullOrWhiteSpace(wabaId))
		{
			return new TestWhatsAppConnectionResponse(false, "WhatsApp Business Account ID is required for testing connection.");
		}

		// Token Resolution: supplied token takes precedence; if blank, use saved configured token
		string? token = inputToken;
		if (string.IsNullOrWhiteSpace(token))
		{
			var config = await _db.WhatsAppConfigurations.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
			if (config != null && !string.IsNullOrWhiteSpace(config.AccessTokenEncrypted))
			{
				token = _encryptionService.Decrypt(config.AccessTokenEncrypted);
			}
		}

		if (string.IsNullOrWhiteSpace(token))
		{
			return new TestWhatsAppConnectionResponse(false, "Access Token is required. Please enter an access token or ensure one is configured.");
		}

		try
		{
			// Step 1: Validate Phone Number ID against Meta Graph API
			var phoneUrl = $"https://graph.facebook.com/{graphVersion}/{Uri.EscapeDataString(phoneId)}?fields=verified_name,display_phone_number,quality_rating,platform_type,throughput";
			using var phoneRequest = new HttpRequestMessage(HttpMethod.Get, phoneUrl);
			phoneRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

			var phoneResponse = await _httpClient.SendAsync(phoneRequest, cancellationToken);
			var phoneContent = await phoneResponse.Content.ReadAsStringAsync(cancellationToken);

			if (!phoneResponse.IsSuccessStatusCode)
			{
				var (status, errMessage, errDetails) = ClassifyMetaError((int)phoneResponse.StatusCode, phoneContent, token);
				await UpdateHealthStatusAsync(status, $"Phone Number ID validation failed: {errMessage}", cancellationToken);
				return new TestWhatsAppConnectionResponse(false, $"Phone Number ID validation failed: {errMessage}", errDetails);
			}

			var (verifiedName, displayPhone, qualityRating, platformType) = ParsePhoneNumberDetails(phoneContent, phoneId);

			// Step 2: Validate WhatsApp Business Account ID (WABA) against Meta Graph API
			var wabaUrl = $"https://graph.facebook.com/{graphVersion}/{Uri.EscapeDataString(wabaId)}?fields=id,name,timezone_id,message_template_namespace";
			using var wabaRequest = new HttpRequestMessage(HttpMethod.Get, wabaUrl);
			wabaRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

			var wabaResponse = await _httpClient.SendAsync(wabaRequest, cancellationToken);
			var wabaContent = await wabaResponse.Content.ReadAsStringAsync(cancellationToken);

			if (!wabaResponse.IsSuccessStatusCode)
			{
				var (status, errMessage, errDetails) = ClassifyMetaError((int)wabaResponse.StatusCode, wabaContent, token);
				await UpdateHealthStatusAsync(status, $"WhatsApp Business Account ID validation failed: {errMessage}", cancellationToken);
				return new TestWhatsAppConnectionResponse(false, $"WhatsApp Business Account ID validation failed: {errMessage}", errDetails);
			}

			var (wabaName, wabaIdResult) = ParseWabaDetails(wabaContent, wabaId);

			await UpdateHealthStatusAsync(WhatsAppHealthStatus.Healthy, null, cancellationToken);

			var details = $"Phone: {displayPhone} (Verified Name: {verifiedName}, Quality: {qualityRating}, Platform: {platformType}) | WABA: {wabaName} (ID: {wabaIdResult})";
			return new TestWhatsAppConnectionResponse(true, "Successfully connected to Meta WhatsApp Cloud API.", details);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "WhatsApp test connection failed with exception.");
			var sanitizedEx = SanitizeSecret(ex.Message, token);
			await UpdateHealthStatusAsync(WhatsAppHealthStatus.TemporarilyUnavailable, $"Connection error: {sanitizedEx}", cancellationToken);
			return new TestWhatsAppConnectionResponse(false, $"Connection error: {sanitizedEx}");
		}
	}

	public async Task<MetaWhatsAppTemplatesResponse> GetMetaTemplatesAsync(CancellationToken cancellationToken = default)
	{
		var config = await _db.WhatsAppConfigurations.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
		if (config == null || string.IsNullOrWhiteSpace(config.BusinessAccountId))
		{
			return new MetaWhatsAppTemplatesResponse(false, "WhatsApp Business Account ID is not configured. Please save your WhatsApp settings first.", Array.Empty<MetaWhatsAppTemplateDto>(), 0);
		}

		var graphVersion = !string.IsNullOrWhiteSpace(config.GraphApiVersion)
			? config.GraphApiVersion.Trim()
			: "v25.0";

		if (!GraphApiVersionRegex.IsMatch(graphVersion))
		{
			return new MetaWhatsAppTemplatesResponse(false, "Invalid Graph API version format.", Array.Empty<MetaWhatsAppTemplateDto>(), 0);
		}

		if (string.IsNullOrWhiteSpace(config.AccessTokenEncrypted))
		{
			return new MetaWhatsAppTemplatesResponse(false, "Meta Access Token is not configured. Please save a valid access token first.", Array.Empty<MetaWhatsAppTemplateDto>(), 0);
		}

		var token = _encryptionService.Decrypt(config.AccessTokenEncrypted);
		if (string.IsNullOrWhiteSpace(token))
		{
			await UpdateHealthStatusAsync(WhatsAppHealthStatus.AuthenticationFailed, "Meta Access Token could not be decrypted.", cancellationToken);
			return new MetaWhatsAppTemplatesResponse(false, "Meta Access Token could not be decrypted.", Array.Empty<MetaWhatsAppTemplateDto>(), 0);
		}

		var wabaId = config.BusinessAccountId.Trim();
		var templates = new List<MetaWhatsAppTemplateDto>();
		string? nextUrl = $"https://graph.facebook.com/{graphVersion}/{Uri.EscapeDataString(wabaId)}/message_templates?limit=100";

		try
		{
			while (!string.IsNullOrWhiteSpace(nextUrl))
			{
				using var httpRequest = new HttpRequestMessage(HttpMethod.Get, nextUrl);
				httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

				var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
				var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

				if (!response.IsSuccessStatusCode)
				{
					var (status, metaMsg, metaDetails) = ClassifyMetaError((int)response.StatusCode, responseContent, token);
					await UpdateHealthStatusAsync(status, $"Unable to retrieve WhatsApp templates: {metaMsg}", cancellationToken);
					return new MetaWhatsAppTemplatesResponse(false, $"Unable to retrieve WhatsApp templates from Meta: {metaMsg}", Array.Empty<MetaWhatsAppTemplateDto>(), 0, metaDetails);
				}

				using var doc = JsonDocument.Parse(responseContent);
				var root = doc.RootElement;

				if (root.TryGetProperty("data", out var dataArr) && dataArr.ValueKind == JsonValueKind.Array)
				{
					foreach (var item in dataArr.EnumerateArray())
					{
						var template = ParseTemplateDto(item);
						if (template != null)
						{
							templates.Add(template);
						}
					}
				}

				// Check pagination next URL
				nextUrl = null;
				if (root.TryGetProperty("paging", out var pagingObj) &&
					pagingObj.TryGetProperty("next", out var nextProp) &&
					nextProp.ValueKind == JsonValueKind.String)
				{
					nextUrl = nextProp.GetString();
				}
			}

			return new MetaWhatsAppTemplatesResponse(
				true,
				templates.Count > 0 ? "Templates retrieved successfully." : "No WhatsApp templates found for this Business Account.",
				templates,
				templates.Count
			);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Failed to retrieve Meta WhatsApp templates.");
			return new MetaWhatsAppTemplatesResponse(false, $"Failed to retrieve templates: {SanitizeSecret(ex.Message, token)}", Array.Empty<MetaWhatsAppTemplateDto>(), 0);
		}
	}

	public async Task<SendTestWhatsAppMessageResponse> SendTestTemplateMessageAsync(
		SendTestWhatsAppMessageRequest request,
		CancellationToken cancellationToken = default)
	{
		if (request == null)
		{
			return new SendTestWhatsAppMessageResponse(false, "Request payload is required.");
		}

		// Step 1: Validate request parameters
		var templateName = request.TemplateName?.Trim();
		if (string.IsNullOrWhiteSpace(templateName))
		{
			return new SendTestWhatsAppMessageResponse(false, "Template name is required.");
		}

		var languageCode = request.LanguageCode?.Trim();
		if (string.IsNullOrWhiteSpace(languageCode))
		{
			return new SendTestWhatsAppMessageResponse(false, "Template language code is required.");
		}

		if (string.IsNullOrWhiteSpace(request.RecipientPhoneNumber))
		{
			return new SendTestWhatsAppMessageResponse(false, "Recipient phone number is required.");
		}

		var normalizedPhone = NormalizePhoneNumber(request.RecipientPhoneNumber);
		if (string.IsNullOrWhiteSpace(normalizedPhone))
		{
			return new SendTestWhatsAppMessageResponse(false, "Invalid recipient phone number. Please enter a valid 10-digit number or standard country code format (e.g. +91 75023 87733).");
		}

		// Step 2: Load saved WhatsApp configuration
		var config = await _db.WhatsAppConfigurations.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
		if (config == null || string.IsNullOrWhiteSpace(config.PhoneNumberId))
		{
			return new SendTestWhatsAppMessageResponse(false, "WhatsApp Phone Number ID is not configured. Please save your WhatsApp settings first.");
		}

		var phoneId = config.PhoneNumberId.Trim();
		var graphVersion = !string.IsNullOrWhiteSpace(config.GraphApiVersion)
			? config.GraphApiVersion.Trim()
			: "v25.0";

		if (!GraphApiVersionRegex.IsMatch(graphVersion))
		{
			return new SendTestWhatsAppMessageResponse(false, "Invalid Graph API version format.");
		}

		if (string.IsNullOrWhiteSpace(config.AccessTokenEncrypted))
		{
			return new SendTestWhatsAppMessageResponse(false, "Meta Access Token is not configured. Please save a valid access token first.");
		}

		var token = _encryptionService.Decrypt(config.AccessTokenEncrypted);
		if (string.IsNullOrWhiteSpace(token))
		{
			return new SendTestWhatsAppMessageResponse(false, "Meta Access Token could not be decrypted.");
		}

		// Step 3: Server-side validation against Meta template discovery
		var templatesResponse = await GetMetaTemplatesAsync(cancellationToken);
		if (!templatesResponse.IsSuccess)
		{
			return new SendTestWhatsAppMessageResponse(false, $"Failed to validate template against Meta: {templatesResponse.Message}", null, templatesResponse.Details);
		}

		var targetTemplate = templatesResponse.Templates.FirstOrDefault(t =>
			string.Equals(t.Name, templateName, StringComparison.OrdinalIgnoreCase));

		if (targetTemplate == null)
		{
			return new SendTestWhatsAppMessageResponse(false, $"Template '{templateName}' was not found in your configured WhatsApp Business Account.");
		}

		if (!string.Equals(targetTemplate.Status, "APPROVED", StringComparison.OrdinalIgnoreCase))
		{
			return new SendTestWhatsAppMessageResponse(false, $"Template '{templateName}' cannot be sent because its status is '{targetTemplate.Status}'. Only APPROVED templates can be tested.");
		}

		if (!string.Equals(targetTemplate.Language, languageCode, StringComparison.OrdinalIgnoreCase))
		{
			return new SendTestWhatsAppMessageResponse(false, $"Language mismatch: Template '{templateName}' is configured in '{targetTemplate.Language}', but requested language was '{languageCode}'.");
		}

		// Step 4: Validate components for Step 2 scope (text-only, body variables only)
		var bodyComponent = targetTemplate.Components.FirstOrDefault(c => string.Equals(c.Type, "BODY", StringComparison.OrdinalIgnoreCase));
		var headerComponent = targetTemplate.Components.FirstOrDefault(c => string.Equals(c.Type, "HEADER", StringComparison.OrdinalIgnoreCase));
		var buttonsComponent = targetTemplate.Components.FirstOrDefault(c => string.Equals(c.Type, "BUTTONS", StringComparison.OrdinalIgnoreCase));

		if (headerComponent != null)
		{
			var headerFormat = (headerComponent.Format ?? "TEXT").ToUpperInvariant();
			if (headerFormat != "TEXT" || (headerComponent.Variables != null && headerComponent.Variables.Count > 0))
			{
				return new SendTestWhatsAppMessageResponse(false, "This template contains unsupported parameters for the current test sender. Please select a text-only template.");
			}
		}

		if (buttonsComponent?.Buttons != null && buttonsComponent.Buttons.Any(b => b.Example != null && b.Example.Count > 0))
		{
			return new SendTestWhatsAppMessageResponse(false, "This template contains unsupported parameters for the current test sender. Please select a text-only template.");
		}

		var expectedVarCount = bodyComponent?.Variables?.Count ?? 0;
		var suppliedParams = request.Parameters ?? Array.Empty<string>();

		if (expectedVarCount != suppliedParams.Count)
		{
			return new SendTestWhatsAppMessageResponse(false, $"Template '{templateName}' requires {expectedVarCount} BODY variable(s), but {suppliedParams.Count} were provided.");
		}

		// Step 5: Build Meta Graph API request payload
		object templatePayload;
		if (suppliedParams.Count > 0)
		{
			var bodyParams = suppliedParams.Select(p => new { type = "text", text = p ?? string.Empty }).ToArray();
			templatePayload = new
			{
				messaging_product = "whatsapp",
				to = normalizedPhone,
				type = "template",
				template = new
				{
					name = targetTemplate.Name,
					language = new { code = targetTemplate.Language },
					components = new object[]
					{
						new
						{
							type = "body",
							parameters = bodyParams
						}
					}
				}
			};
		}
		else
		{
			templatePayload = new
			{
				messaging_product = "whatsapp",
				to = normalizedPhone,
				type = "template",
				template = new
				{
					name = targetTemplate.Name,
					language = new { code = targetTemplate.Language }
				}
			};
		}

		// Step 6: Send to Meta Graph API
		try
		{
			var requestUrl = $"https://graph.facebook.com/{graphVersion}/{Uri.EscapeDataString(phoneId)}/messages";
			using var httpRequest = new HttpRequestMessage(HttpMethod.Post, requestUrl);
			httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
			httpRequest.Content = new StringContent(JsonSerializer.Serialize(templatePayload), Encoding.UTF8, "application/json");

			var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
			var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

			if (response.IsSuccessStatusCode)
			{
				string? metaMessageId = null;
				try
				{
					using var respDoc = JsonDocument.Parse(responseBody);
					if (respDoc.RootElement.TryGetProperty("messages", out var msgArr) && msgArr.GetArrayLength() > 0)
					{
						metaMessageId = msgArr[0].GetProperty("id").GetString();
					}
				}
				catch { }

				var details = !string.IsNullOrEmpty(metaMessageId)
					? $"Template {targetTemplate.Name} accepted by Meta for +{normalizedPhone} (Message ID: {metaMessageId})."
					: $"Template {targetTemplate.Name} accepted by Meta for +{normalizedPhone}.";

				return new SendTestWhatsAppMessageResponse(
					true,
					"Message accepted by Meta.",
					metaMessageId,
					details);
			}

			var (errorMsg, errorDetails) = ParseMetaError(responseBody, (int)response.StatusCode, token);
			return new SendTestWhatsAppMessageResponse(
				false,
				$"Meta rejected the template message: {errorMsg}",
				null,
				errorDetails);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "WhatsApp test template message failed with exception.");
			return new SendTestWhatsAppMessageResponse(
				false,
				$"Failed to send test message: {SanitizeSecret(ex.Message, token)}");
		}
	}

	public async Task<WhatsAppMessage?> QueueInvoiceFinalizedNotificationAsync(Guid invoiceId, CancellationToken cancellationToken = default)
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
			.Include(i => i.Vehicle)
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null || invoice.Status == InvoiceStatus.Draft || invoice.Status == InvoiceStatus.Cancelled || invoice.IsDeleted)
		{
			return null;
		}

		var config = await GetOrCreateConfigEntityAsync(cancellationToken);
		var normalizedPhone = NormalizePhoneNumber(invoice.Customer?.PhoneNumber);

		var customerName = invoice.Customer?.Name ?? "Customer";
		var invoiceNumber = invoice.InvoiceNumber ?? "INV-DRAFT";
		var vehicleRegistration = !string.IsNullOrWhiteSpace(invoice.Vehicle?.RegistrationNumber)
			? invoice.Vehicle.RegistrationNumber
			: "N/A";
		var totalAmount = $"{invoice.TotalAmount:N2}";

		var snapshot = new
		{
			customerName,
			invoiceNumber,
			vehicleRegistration,
			totalAmount,
			invoiceDate = invoice.InvoiceDate.ToString("dd/MM/yyyy"),
			parameters = new[]
			{
				customerName,
				invoiceNumber,
				vehicleRegistration,
				totalAmount
			}
		};

		var message = new WhatsAppMessage
		{
			Id = Guid.NewGuid(),
			InvoiceId = invoice.Id,
			CustomerId = invoice.CustomerId,
			MessageType = WhatsAppMessageType.InvoiceFinalized,
			RecipientPhone = normalizedPhone ?? (invoice.Customer?.PhoneNumber ?? string.Empty),
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
			message.ErrorMessage = "Customer phone number unavailable or invalid (Customer WhatsApp number is missing).";
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
			.Include(i => i.Vehicle)
			.Include(i => i.Payments)
			.Include(i => i.PublicLinks)
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null || invoice.Status != InvoiceStatus.Paid || invoice.IsDeleted)
		{
			return null;
		}

		var config = await GetOrCreateConfigEntityAsync(cancellationToken);
		var normalizedPhone = NormalizePhoneNumber(invoice.Customer?.PhoneNumber);

		// Public URL resolution
		var baseUrl = (_configuration["PublicInvoiceBaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
		var publicUrl = !string.IsNullOrWhiteSpace(publicInvoiceUrl)
			? publicInvoiceUrl
			: (invoice.PublicLinks.Any(l => !l.IsRevoked)
				? $"{baseUrl}/invoices/{invoice.Id}"
				: $"{baseUrl}/invoices");

		var snapshot = new
		{
			customerName = invoice.Customer?.Name ?? "Customer",
			invoiceNumber = invoice.InvoiceNumber ?? "INV",
			paymentReceived = $"{paymentReceived:N2}",
			totalPaid = $"{invoice.PaidAmount:N2}",
			balance = $"{invoice.BalanceAmount:N2}",
			vehicleRegistration = invoice.Vehicle?.RegistrationNumber ?? string.Empty,
			paymentDate = DateTime.UtcNow.ToString("dd/MM/yyyy"),
			publicUrl = publicUrl
		};

		var message = new WhatsAppMessage
		{
			Id = Guid.NewGuid(),
			InvoiceId = invoice.Id,
			CustomerId = invoice.CustomerId,
			MessageType = WhatsAppMessageType.PaymentCompleted,
			RecipientPhone = normalizedPhone ?? (invoice.Customer?.PhoneNumber ?? string.Empty),
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
		var semaphore = _messageLocks.GetOrAdd(messageId, _ => new SemaphoreSlim(1, 1));
		if (!await semaphore.WaitAsync(0, cancellationToken))
		{
			_logger.LogInformation("WhatsApp message {MessageId} is already being processed concurrently by another worker. Skipping.", messageId);
			return false;
		}

		try
		{
			var message = await _db.WhatsAppMessages
				.Include(m => m.Invoice)
				.Include(m => m.Customer)
				.FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);

			if (message == null || message.Status == WhatsAppMessageStatus.Sent || message.Status == WhatsAppMessageStatus.Skipped)
			{
				return true;
			}

			var claimTime = DateTime.UtcNow;
			var staleProcessingThreshold = claimTime.AddMinutes(-2);

			if (message.Status == WhatsAppMessageStatus.Processing && message.LastAttemptAtUtc.HasValue && message.LastAttemptAtUtc > staleProcessingThreshold)
			{
				_logger.LogInformation("WhatsApp message {MessageId} is currently under an active processing lease held until {LastAttempt}. Skipping.", messageId, message.LastAttemptAtUtc);
				return false;
			}

			// Claim the message atomically in DB state before starting any network/PDF/media operations
			message.Status = WhatsAppMessageStatus.Processing;
			message.AttemptCount++;
			message.LastAttemptAtUtc = claimTime;
			await _db.SaveChangesAsync(cancellationToken);

			var config = await GetOrCreateConfigEntityAsync(cancellationToken);
			if (!config.IsEnabled)
			{
				message.Status = WhatsAppMessageStatus.Skipped;
				message.ErrorMessage = "WhatsApp integration is disabled.";
				await _db.SaveChangesAsync(cancellationToken);
				return true;
			}

			// Check event-specific toggles
			if (message.MessageType == WhatsAppMessageType.InvoiceFinalized && !config.InvoiceNotificationsEnabled)
			{
				message.Status = WhatsAppMessageStatus.Skipped;
				message.ErrorMessage = "WhatsApp invoice notifications are disabled in settings.";
				await _db.SaveChangesAsync(cancellationToken);
				return true;
			}

			if (message.MessageType == WhatsAppMessageType.PaymentCompleted && !config.PaymentCompletedNotificationsEnabled)
			{
				message.Status = WhatsAppMessageStatus.Skipped;
				message.ErrorMessage = "WhatsApp payment completed notifications are disabled in settings.";
				await _db.SaveChangesAsync(cancellationToken);
				return true;
			}

			// Recipient Phone validation
			var normalizedPhone = NormalizePhoneNumber(message.RecipientPhone);
			if (string.IsNullOrWhiteSpace(normalizedPhone))
			{
				message.Status = WhatsAppMessageStatus.Skipped;
				message.ErrorMessage = "Customer phone number unavailable or invalid (Customer WhatsApp number is missing).";
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

			var templateName = (message.MessageType == WhatsAppMessageType.InvoiceFinalized
				? config.InvoiceTemplateName
				: config.PaymentCompletedTemplateName)?.Trim();

			var templateLang = (message.MessageType == WhatsAppMessageType.InvoiceFinalized
				? config.InvoiceTemplateLanguage
				: config.PaymentCompletedTemplateLanguage)?.Trim();

			if (string.IsNullOrWhiteSpace(templateName))
			{
				message.Status = WhatsAppMessageStatus.Failed;
				message.FailedAtUtc = DateTime.UtcNow;
				message.ErrorMessage = "WhatsApp template name is not configured.";
				await _db.SaveChangesAsync(cancellationToken);
				return false;
			}

			if (string.IsNullOrWhiteSpace(templateLang))
			{
				templateLang = "en";
			}

			try
			{
			// Server-side validation against Meta template discovery
			var templatesResponse = await GetMetaTemplatesAsync(cancellationToken);
			if (!templatesResponse.IsSuccess)
			{
				var isDiscoveryTransient = templatesResponse.Message.Contains("HTTP 429", StringComparison.OrdinalIgnoreCase) ||
								  templatesResponse.Message.Contains("HTTP 5", StringComparison.OrdinalIgnoreCase);

				if (isDiscoveryTransient && message.AttemptCount < 3)
				{
					message.Status = WhatsAppMessageStatus.Pending;
					message.NextAttemptAtUtc = DateTime.UtcNow.AddSeconds(Math.Pow(2, message.AttemptCount) * 10);
					message.ErrorMessage = $"Transient error during template validation: {templatesResponse.Message}";
					await _db.SaveChangesAsync(cancellationToken);
					return false;
				}

				message.Status = WhatsAppMessageStatus.Failed;
				message.FailedAtUtc = DateTime.UtcNow;
				message.ErrorMessage = $"Failed to validate template against Meta: {templatesResponse.Message}";
				await _db.SaveChangesAsync(cancellationToken);

				await _auditLogService.RecordAsync(
					action: AuditActions.WhatsAppNotificationFailed,
					module: AuditModules.WhatsApp,
					description: message.ErrorMessage,
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: message.Invoice?.InvoiceNumber,
					outcome: "Failure",
					cancellationToken: cancellationToken);

				return false;
			}

			var targetTemplate = templatesResponse.Templates.FirstOrDefault(t =>
				string.Equals(t.Name, templateName, StringComparison.OrdinalIgnoreCase));

			if (targetTemplate == null)
			{
				message.Status = WhatsAppMessageStatus.Failed;
				message.FailedAtUtc = DateTime.UtcNow;
				message.ErrorMessage = $"Template '{templateName}' was not found in your configured WhatsApp Business Account.";
				await _db.SaveChangesAsync(cancellationToken);

				await _auditLogService.RecordAsync(
					action: AuditActions.WhatsAppNotificationFailed,
					module: AuditModules.WhatsApp,
					description: message.ErrorMessage,
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: message.Invoice?.InvoiceNumber,
					outcome: "Failure",
					cancellationToken: cancellationToken);

				return false;
			}

			if (!string.Equals(targetTemplate.Status, "APPROVED", StringComparison.OrdinalIgnoreCase))
			{
				message.Status = WhatsAppMessageStatus.Failed;
				message.FailedAtUtc = DateTime.UtcNow;
				message.ErrorMessage = $"WhatsApp notification failed: Template '{templateName}' is not approved (status: {targetTemplate.Status}).";
				await _db.SaveChangesAsync(cancellationToken);

				await _auditLogService.RecordAsync(
					action: AuditActions.WhatsAppNotificationFailed,
					module: AuditModules.WhatsApp,
					description: message.ErrorMessage,
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: message.Invoice?.InvoiceNumber,
					outcome: "Failure",
					cancellationToken: cancellationToken);

				return false;
			}

			if (!string.Equals(targetTemplate.Language, templateLang, StringComparison.OrdinalIgnoreCase))
			{
				message.Status = WhatsAppMessageStatus.Failed;
				message.FailedAtUtc = DateTime.UtcNow;
				message.ErrorMessage = $"Template language mismatch: Template '{templateName}' is configured in '{targetTemplate.Language}', but requested language was '{templateLang}'.";
				await _db.SaveChangesAsync(cancellationToken);

				await _auditLogService.RecordAsync(
					action: AuditActions.WhatsAppNotificationFailed,
					module: AuditModules.WhatsApp,
					description: message.ErrorMessage,
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: message.Invoice?.InvoiceNumber,
					outcome: "Failure",
					cancellationToken: cancellationToken);

				return false;
			}

			// Validate components
			var bodyComponent = targetTemplate.Components.FirstOrDefault(c => string.Equals(c.Type, "BODY", StringComparison.OrdinalIgnoreCase));
			var headerComponent = targetTemplate.Components.FirstOrDefault(c => string.Equals(c.Type, "HEADER", StringComparison.OrdinalIgnoreCase));
			var buttonsComponent = targetTemplate.Components.FirstOrDefault(c => string.Equals(c.Type, "BUTTONS", StringComparison.OrdinalIgnoreCase));

			if (targetTemplate.Components.Any(c => !string.Equals(c.Type, "HEADER", StringComparison.OrdinalIgnoreCase)
				&& !string.Equals(c.Type, "BODY", StringComparison.OrdinalIgnoreCase)
				&& !string.Equals(c.Type, "FOOTER", StringComparison.OrdinalIgnoreCase)
				&& !string.Equals(c.Type, "BUTTONS", StringComparison.OrdinalIgnoreCase)))
			{
				message.Status = WhatsAppMessageStatus.Failed;
				message.FailedAtUtc = DateTime.UtcNow;
				message.ErrorMessage = $"Template '{templateName}' contains unsupported components.";
				await _db.SaveChangesAsync(cancellationToken);

				await _auditLogService.RecordAsync(
					action: AuditActions.WhatsAppNotificationFailed,
					module: AuditModules.WhatsApp,
					description: message.ErrorMessage,
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: message.Invoice?.InvoiceNumber,
					outcome: "Failure",
					cancellationToken: cancellationToken);

				return false;
			}

			var isDocumentHeader = message.MessageType == WhatsAppMessageType.InvoiceFinalized
				&& headerComponent != null
				&& string.Equals(headerComponent.Format, "DOCUMENT", StringComparison.OrdinalIgnoreCase);

			if (headerComponent != null)
			{
				var headerFormat = (headerComponent.Format ?? "TEXT").ToUpperInvariant();
				if (message.MessageType == WhatsAppMessageType.InvoiceFinalized)
				{
					if (headerFormat == "DOCUMENT" || headerFormat == "TEXT")
					{
						if (headerComponent.Variables != null && headerComponent.Variables.Count > 0)
						{
							message.Status = WhatsAppMessageStatus.Failed;
							message.FailedAtUtc = DateTime.UtcNow;
							message.ErrorMessage = $"Template '{templateName}' contains unsupported dynamic parameters in header.";
							await _db.SaveChangesAsync(cancellationToken);

							await _auditLogService.RecordAsync(
								action: AuditActions.WhatsAppNotificationFailed,
								module: AuditModules.WhatsApp,
								description: message.ErrorMessage,
								entityType: "WhatsAppMessage",
								entityId: message.Id,
								entityReference: message.Invoice?.InvoiceNumber,
								outcome: "Failure",
								cancellationToken: cancellationToken);

							return false;
						}
					}
					else
					{
						message.Status = WhatsAppMessageStatus.Failed;
						message.FailedAtUtc = DateTime.UtcNow;
						message.ErrorMessage = $"Template '{templateName}' contains unsupported dynamic parameters in header.";
						await _db.SaveChangesAsync(cancellationToken);

						await _auditLogService.RecordAsync(
							action: AuditActions.WhatsAppNotificationFailed,
							module: AuditModules.WhatsApp,
							description: message.ErrorMessage,
							entityType: "WhatsAppMessage",
							entityId: message.Id,
							entityReference: message.Invoice?.InvoiceNumber,
							outcome: "Failure",
							cancellationToken: cancellationToken);

						return false;
					}
				}
				else
				{
					if (headerFormat != "TEXT" || (headerComponent.Variables != null && headerComponent.Variables.Count > 0))
					{
						message.Status = WhatsAppMessageStatus.Failed;
						message.FailedAtUtc = DateTime.UtcNow;
						message.ErrorMessage = $"Template '{templateName}' contains unsupported dynamic parameters in header.";
						await _db.SaveChangesAsync(cancellationToken);

						await _auditLogService.RecordAsync(
							action: AuditActions.WhatsAppNotificationFailed,
							module: AuditModules.WhatsApp,
							description: message.ErrorMessage,
							entityType: "WhatsAppMessage",
							entityId: message.Id,
							entityReference: message.Invoice?.InvoiceNumber,
							outcome: "Failure",
							cancellationToken: cancellationToken);

						return false;
					}
				}
			}

			var expectedVarCount = bodyComponent?.Variables?.Count ?? 0;

			using var parametersDoc = JsonDocument.Parse(message.TemplateParametersJson ?? "{}");
			var root = parametersDoc.RootElement;

			var resolvedParams = ResolveBodyParameters(
				message.MessageType,
				bodyComponent?.Text,
				expectedVarCount,
				root);

			if (resolvedParams.Count != expectedVarCount || (expectedVarCount > 0 && resolvedParams.Any(string.IsNullOrWhiteSpace)))
			{
				message.Status = WhatsAppMessageStatus.Failed;
				message.FailedAtUtc = DateTime.UtcNow;
				message.ErrorMessage = $"Template '{templateName}' requires {expectedVarCount} BODY variable(s), but could not resolve valid values.";
				await _db.SaveChangesAsync(cancellationToken);

				await _auditLogService.RecordAsync(
					action: AuditActions.WhatsAppNotificationFailed,
					module: AuditModules.WhatsApp,
					description: message.ErrorMessage,
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: message.Invoice?.InvoiceNumber,
					outcome: "Failure",
					cancellationToken: cancellationToken);

				return false;
			}

			var componentsList = new List<object>();
			string? mediaId = null;
			var usedCachedMediaId = false;
			Invoice? invoiceForPdf = null;
			BusinessProfile? businessProfile = null;
			string sanitizedFileName = "Invoice.pdf";

			if (isDocumentHeader)
			{
				invoiceForPdf = await _db.Invoices
					.Include(i => i.Customer)
					.Include(i => i.Vehicle)
					.Include(i => i.InvoiceItems)
					.Include(i => i.Payments)
					.FirstOrDefaultAsync(i => i.Id == message.InvoiceId, cancellationToken);

				if (invoiceForPdf == null)
				{
					message.Status = WhatsAppMessageStatus.Failed;
					message.FailedAtUtc = DateTime.UtcNow;
					message.ErrorMessage = "Associated invoice was not found for PDF generation.";
					await _db.SaveChangesAsync(cancellationToken);
					return false;
				}

				businessProfile = await _db.BusinessProfiles.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
				sanitizedFileName = SanitizeFileName(invoiceForPdf.InvoiceNumber);

				// Step 7: Check TemplateParametersJson for a cached media_id belonging ONLY to this specific WhatsAppMessage/invoice
				var cachedId = GetCachedMediaId(message.TemplateParametersJson);
				if (!string.IsNullOrWhiteSpace(cachedId))
				{
					mediaId = cachedId;
					usedCachedMediaId = true;
				}
				else
				{
					// Step 8: Generate PDF in backend memory -> validate -> upload -> obtain media_id
					var pdfBytes = _invoicePdfGenerator.GenerateInvoicePdf(invoiceForPdf, businessProfile);
					var uploadResult = await UploadWhatsAppDocumentAsync(
						pdfBytes,
						sanitizedFileName,
						config.PhoneNumberId,
						config.GraphApiVersion,
						token,
						cancellationToken);

					if (!uploadResult.Success)
					{
						var uploadStatusCode = uploadResult.StatusCode;
						var uploadErrorMsg = uploadResult.ErrorMessage ?? "Meta media upload failed.";
						var isTransientUpload = uploadStatusCode == 429 || uploadStatusCode >= 500;

						if (isTransientUpload && message.AttemptCount < 3)
						{
							message.Status = WhatsAppMessageStatus.Pending;
							message.NextAttemptAtUtc = DateTime.UtcNow.AddSeconds(Math.Pow(2, message.AttemptCount) * 10);
							message.ErrorMessage = $"Transient media upload error (HTTP {uploadStatusCode}): {uploadErrorMsg}";
							await _db.SaveChangesAsync(cancellationToken);
							return false;
						}

						message.Status = WhatsAppMessageStatus.Failed;
						message.FailedAtUtc = DateTime.UtcNow;
						message.ErrorMessage = uploadErrorMsg;
						await _db.SaveChangesAsync(cancellationToken);

						var invNumber = message.Invoice?.InvoiceNumber ?? "INV";
						await _auditLogService.RecordAsync(
							action: AuditActions.WhatsAppNotificationFailed,
							module: AuditModules.WhatsApp,
							description: $"WhatsApp notification failed for Invoice '{invNumber}': {uploadErrorMsg}",
							entityType: "WhatsAppMessage",
							entityId: message.Id,
							entityReference: invNumber,
							outcome: "Failure",
							cancellationToken: cancellationToken);

						return false;
					}

					mediaId = uploadResult.MediaId!;

					// Step 9: Store media_id strictly as part of this message's snapshot
					message.TemplateParametersJson = SetCachedMediaId(message.TemplateParametersJson, mediaId);
					await _db.SaveChangesAsync(cancellationToken);
				}

				// Step 10: Construct Meta template DOCUMENT header component
				componentsList.Add(new
				{
					type = "header",
					parameters = new object[]
					{
						new
						{
							type = "document",
							document = new
							{
								id = mediaId,
								filename = sanitizedFileName
							}
						}
					}
				});
			}

			if (expectedVarCount > 0)
			{
				var bodyParams = resolvedParams.Select(p => new { type = "text", text = p ?? string.Empty }).ToArray();
				componentsList.Add(new
				{
					type = "body",
					parameters = bodyParams
				});
			}

			// Validate and build dynamic Button Components if required
			if (buttonsComponent?.Buttons != null && buttonsComponent.Buttons.Count > 0)
			{
				for (int i = 0; i < buttonsComponent.Buttons.Count; i++)
				{
					var btn = buttonsComponent.Buttons[i];
					var isDynamicUrl = btn.Type.Equals("URL", StringComparison.OrdinalIgnoreCase) &&
						((btn.Example != null && btn.Example.Count > 0) || (btn.Url != null && btn.Url.Contains("{{")));

					if (isDynamicUrl)
					{
						string? buttonToken = null;
						if (root.TryGetProperty("rawToken", out var rtProp) && !string.IsNullOrWhiteSpace(rtProp.GetString()))
						{
							buttonToken = rtProp.GetString();
						}
						else if (root.TryGetProperty("publicInvoiceToken", out var pitProp) && !string.IsNullOrWhiteSpace(pitProp.GetString()))
						{
							buttonToken = pitProp.GetString();
						}
						else if (root.TryGetProperty("publicUrl", out var puProp))
						{
							var pu = puProp.GetString();
							if (!string.IsNullOrWhiteSpace(pu) && pu.Contains("/i/"))
							{
								buttonToken = pu.Substring(pu.LastIndexOf('/') + 1).Trim();
							}
						}

						if (string.IsNullOrWhiteSpace(buttonToken) && message.InvoiceId != Guid.Empty)
						{
							var activeLink = await _db.InvoicePublicLinks
								.FirstOrDefaultAsync(l => l.InvoiceId == message.InvoiceId && !l.IsRevoked && !l.IsDeleted, cancellationToken);

							if (activeLink != null)
							{
								activeLink.IsRevoked = true;
								activeLink.RevokedAtUtc = DateTime.UtcNow;
								activeLink.UpdatedAt = DateTime.UtcNow;
							}

							buttonToken = GenerateSecureToken();
							var tokenHash = ComputeSha256Hash(buttonToken);
							var now = DateTime.UtcNow;

							var newLink = new InvoicePublicLink
							{
								Id = Guid.NewGuid(),
								InvoiceId = message.InvoiceId,
								TokenHash = tokenHash,
								CreatedAtUtc = now,
								AccessCount = 0,
								IsRevoked = false,
								CreatedAt = now,
								UpdatedAt = now,
								IsDeleted = false
							};

							_db.InvoicePublicLinks.Add(newLink);
							await _db.SaveChangesAsync(cancellationToken);
						}

						if (string.IsNullOrWhiteSpace(buttonToken))
						{
							message.Status = WhatsAppMessageStatus.Failed;
							message.FailedAtUtc = DateTime.UtcNow;
							message.ErrorMessage = $"Template '{templateName}' requires a dynamic URL button parameter, but no valid invoice public token could be resolved.";
							await _db.SaveChangesAsync(cancellationToken);
							return false;
						}

						componentsList.Add(new
						{
							type = "button",
							sub_type = "url",
							index = i.ToString(),
							parameters = new object[]
							{
								new
								{
									type = "text",
									text = buttonToken
								}
							}
						});
					}
					else if (btn.Example != null && btn.Example.Count > 0)
					{
						message.Status = WhatsAppMessageStatus.Failed;
						message.FailedAtUtc = DateTime.UtcNow;
						message.ErrorMessage = $"Template '{templateName}' contains unsupported dynamic parameters in buttons.";
						await _db.SaveChangesAsync(cancellationToken);
						return false;
					}
				}
			}

			object templatePayload;
			if (componentsList.Count > 0)
			{
				templatePayload = new
				{
					messaging_product = "whatsapp",
					to = normalizedPhone,
					type = "template",
					template = new
					{
						name = targetTemplate.Name,
						language = new { code = targetTemplate.Language },
						components = componentsList.ToArray()
					}
				};
			}
			else
			{
				templatePayload = new
				{
					messaging_product = "whatsapp",
					to = normalizedPhone,
					type = "template",
					template = new
					{
						name = targetTemplate.Name,
						language = new { code = targetTemplate.Language }
					}
				};
			}

			var requestUrl = $"https://graph.facebook.com/{config.GraphApiVersion}/{Uri.EscapeDataString(config.PhoneNumberId)}/messages";
			using var httpRequest = new HttpRequestMessage(HttpMethod.Post, requestUrl);
			httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
			httpRequest.Content = new StringContent(JsonSerializer.Serialize(templatePayload), Encoding.UTF8, "application/json");

			var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
			var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

			// Media ID Retry Handling:
			// If cached media_id was rejected by Meta as invalid/expired, clear cache, regenerate PDF, re-upload, and retry send once.
			if (!response.IsSuccessStatusCode && usedCachedMediaId && isDocumentHeader && message.MessageType == WhatsAppMessageType.InvoiceFinalized)
			{
				var testStatusCode = (int)response.StatusCode;
				var (testErrorMsg, _) = ParseMetaError(responseBody, testStatusCode, token);
				if (IsMediaError(testStatusCode, responseBody, testErrorMsg))
				{
					_logger.LogWarning("Cached Meta media_id '{MediaId}' rejected for message {MessageId}. Regenerating PDF and re-uploading...", mediaId, message.Id);

					// 1. Clear cached media_id for that WhatsAppMessage
					message.TemplateParametersJson = SetCachedMediaId(message.TemplateParametersJson, null);
					await _db.SaveChangesAsync(cancellationToken);

					// 2. Regenerate invoice PDF
					var freshPdfBytes = _invoicePdfGenerator.GenerateInvoicePdf(invoiceForPdf!, businessProfile);

					// 3. Upload fresh PDF
					var retryUploadResult = await UploadWhatsAppDocumentAsync(
						freshPdfBytes,
						sanitizedFileName,
						config.PhoneNumberId,
						config.GraphApiVersion,
						token,
						cancellationToken);

					if (!retryUploadResult.Success)
					{
						var retryStatusCode = retryUploadResult.StatusCode;
						var retryErrorMsg = retryUploadResult.ErrorMessage ?? "Meta media upload failed during retry.";
						var isTransientRetry = retryStatusCode == 429 || retryStatusCode >= 500;

						if (isTransientRetry && message.AttemptCount < 3)
						{
							message.Status = WhatsAppMessageStatus.Pending;
							message.NextAttemptAtUtc = DateTime.UtcNow.AddSeconds(Math.Pow(2, message.AttemptCount) * 10);
							message.ErrorMessage = $"Transient media upload error (HTTP {retryStatusCode}): {retryErrorMsg}";
							await _db.SaveChangesAsync(cancellationToken);
							return false;
						}

						message.Status = WhatsAppMessageStatus.Failed;
						message.FailedAtUtc = DateTime.UtcNow;
						message.ErrorMessage = retryErrorMsg;
						await _db.SaveChangesAsync(cancellationToken);

						var invNumber = message.Invoice?.InvoiceNumber ?? "INV";
						await _auditLogService.RecordAsync(
							action: AuditActions.WhatsAppNotificationFailed,
							module: AuditModules.WhatsApp,
							description: $"WhatsApp notification failed for Invoice '{invNumber}': {retryErrorMsg}",
							entityType: "WhatsAppMessage",
							entityId: message.Id,
							entityReference: invNumber,
							outcome: "Failure",
							cancellationToken: cancellationToken);

						return false;
					}

					mediaId = retryUploadResult.MediaId!;

					// 4. Obtain new media_id and store in snapshot
					message.TemplateParametersJson = SetCachedMediaId(message.TemplateParametersJson, mediaId);
					await _db.SaveChangesAsync(cancellationToken);

					// 5. Update header component with new media_id
					componentsList[0] = new
					{
						type = "header",
						parameters = new object[]
						{
							new
							{
								type = "document",
								document = new
								{
									id = mediaId,
									filename = sanitizedFileName
								}
							}
						}
					};

					var retryPayload = new
					{
						messaging_product = "whatsapp",
						to = normalizedPhone,
						type = "template",
						template = new
						{
							name = targetTemplate.Name,
							language = new { code = targetTemplate.Language },
							components = componentsList.ToArray()
						}
					};

					using var retryRequest = new HttpRequestMessage(HttpMethod.Post, requestUrl);
					retryRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
					retryRequest.Content = new StringContent(JsonSerializer.Serialize(retryPayload), Encoding.UTF8, "application/json");

					response = await _httpClient.SendAsync(retryRequest, cancellationToken);
					responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
				}
			}

			var invNum = message.Invoice?.InvoiceNumber ?? "INV";

			if (response.IsSuccessStatusCode)
			{
				await UpdateHealthStatusAsync(WhatsAppHealthStatus.Healthy, null, cancellationToken);

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
					description: $"WhatsApp {message.MessageType} message accepted by Meta for {normalizedPhone}.",
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: invNum,
					newValues: JsonSerializer.Serialize(new
					{
						invoiceNumber = invNum,
						recipientPhone = normalizedPhone,
						metaMessageId = metaId,
						templateName = targetTemplate.Name,
						messageType = message.MessageType.ToString()
					}),
					outcome: "Success",
					cancellationToken: cancellationToken);

				return true;
			}

			// Handle Failures
			var statusCode = (int)response.StatusCode;
			var (healthStatus, errorMsg, errorDetails) = ClassifyMetaError(statusCode, responseBody, token);
			await UpdateHealthStatusAsync(healthStatus, errorMsg, cancellationToken);

			if (healthStatus == WhatsAppHealthStatus.AuthenticationFailed)
			{
				_logger.LogWarning("WhatsApp authentication failed for configured integration: {Error}", errorMsg);
				message.Status = WhatsAppMessageStatus.Failed;
				message.FailedAtUtc = DateTime.UtcNow;
				message.ErrorMessage = $"WhatsApp authentication failed: {errorMsg}";
				await _db.SaveChangesAsync(cancellationToken);

				await _auditLogService.RecordAsync(
					action: AuditActions.WhatsAppNotificationFailed,
					module: AuditModules.WhatsApp,
					description: $"WhatsApp authentication failed for Invoice '{invNum}': {errorMsg}",
					entityType: "WhatsAppMessage",
					entityId: message.Id,
					entityReference: invNum,
					outcome: "Failure",
					cancellationToken: cancellationToken);

				return false;
			}

			var isTransient = healthStatus == WhatsAppHealthStatus.TemporarilyUnavailable || statusCode == 429 || statusCode >= 500;

			if (isTransient && message.AttemptCount < 3)
			{
				message.Status = WhatsAppMessageStatus.Pending;
				message.NextAttemptAtUtc = DateTime.UtcNow.AddSeconds(Math.Pow(2, message.AttemptCount) * 10);
				message.ErrorMessage = $"Transient error (HTTP {statusCode}): {errorMsg}";
				await _db.SaveChangesAsync(cancellationToken);
				return false;
			}

			// Permanent failure or retry limit reached
			message.Status = WhatsAppMessageStatus.Failed;
			message.FailedAtUtc = DateTime.UtcNow;
			message.ErrorMessage = errorMsg;
			await _db.SaveChangesAsync(cancellationToken);

			await _auditLogService.RecordAsync(
				action: AuditActions.WhatsAppNotificationFailed,
				module: AuditModules.WhatsApp,
				description: $"WhatsApp notification failed for Invoice '{invNum}': {errorMsg}",
				entityType: "WhatsAppMessage",
				entityId: message.Id,
				entityReference: invNum,
				outcome: "Failure",
				cancellationToken: cancellationToken);

			return false;
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Exception while sending WhatsApp message {MessageId}", messageId);
			var sanitizedEx = SanitizeSecret(ex.Message, token);
			await UpdateHealthStatusAsync(WhatsAppHealthStatus.TemporarilyUnavailable, $"Network/System error: {sanitizedEx}", cancellationToken);

			if (message.AttemptCount < 3)
			{
				message.Status = WhatsAppMessageStatus.Pending;
				message.NextAttemptAtUtc = DateTime.UtcNow.AddSeconds(Math.Pow(2, message.AttemptCount) * 10);
				message.ErrorMessage = $"Network/System error: {sanitizedEx}";
				await _db.SaveChangesAsync(cancellationToken);
				return false;
			}

			message.Status = WhatsAppMessageStatus.Failed;
			message.FailedAtUtc = DateTime.UtcNow;
			message.ErrorMessage = $"Final failure after {message.AttemptCount} attempts: {sanitizedEx}";
			await _db.SaveChangesAsync(cancellationToken);

			var invNum = message.Invoice?.InvoiceNumber ?? "INV";
			await _auditLogService.RecordAsync(
				action: AuditActions.WhatsAppNotificationFailed,
				module: AuditModules.WhatsApp,
				description: $"WhatsApp notification failed for Invoice '{invNum}'. Error: {message.ErrorMessage}",
				entityType: "WhatsAppMessage",
				entityId: message.Id,
				entityReference: invNum,
				outcome: "Failure",
				cancellationToken: cancellationToken);

			return false;
		}
	}
	finally
	{
		semaphore.Release();
		_messageLocks.TryRemove(KeyValuePair.Create(messageId, semaphore));
	}
}

	public static List<string> ResolveBodyParameters(
		WhatsAppMessageType messageType,
		string? bodyText,
		int expectedVarCount,
		JsonElement root)
	{
		if (expectedVarCount <= 0) return new List<string>();

		var customerName = root.TryGetProperty("customerName", out var c) ? c.GetString() ?? "Customer" : "Customer";
		var invoiceNum = root.TryGetProperty("invoiceNumber", out var inv) ? inv.GetString() ?? "INV" : "INV";
		var totalAmount = root.TryGetProperty("totalAmount", out var ta) ? ta.GetString() ?? "0.00" : "0.00";
		var paymentReceived = root.TryGetProperty("paymentReceived", out var pr) ? pr.GetString() ?? totalAmount : totalAmount;
		var totalPaid = root.TryGetProperty("totalPaid", out var tp) ? tp.GetString() ?? totalAmount : totalAmount;
		var balance = root.TryGetProperty("balance", out var b) ? b.GetString() ?? "0.00" : "0.00";
		var vehicleReg = root.TryGetProperty("vehicleRegistration", out var vr) ? vr.GetString() ?? string.Empty : string.Empty;
		if (string.IsNullOrWhiteSpace(vehicleReg))
		{
			vehicleReg = "N/A";
		}
		var dateVal = root.TryGetProperty("invoiceDate", out var idate) ? idate.GetString() ?? string.Empty :
			(root.TryGetProperty("paymentDate", out var pdate) ? pdate.GetString() ?? string.Empty : string.Empty);
		var publicUrl = root.TryGetProperty("publicUrl", out var pu) ? pu.GetString() ?? string.Empty : string.Empty;

		// 1. Explicit parameters array (if stored in snapshot matching expectedVarCount)
		if (root.TryGetProperty("parameters", out var pProp) && pProp.ValueKind == JsonValueKind.Array)
		{
			var arrayLength = pProp.GetArrayLength();
			if (arrayLength >= expectedVarCount && expectedVarCount > 0)
			{
				var explicitParams = new List<string>();
				foreach (var elem in pProp.EnumerateArray())
				{
					explicitParams.Add(elem.GetString() ?? string.Empty);
					if (explicitParams.Count == expectedVarCount) break;
				}
				if (explicitParams.Count == expectedVarCount && explicitParams.All(s => !string.IsNullOrEmpty(s)))
				{
					return explicitParams;
				}
			}
		}

		// 2. Try contextual parsing if bodyText is present
		if (!string.IsNullOrWhiteSpace(bodyText) && expectedVarCount > 0)
		{
			var pos = new int[expectedVarCount];
			var allFound = true;
			for (int i = 1; i <= expectedVarCount; i++)
			{
				var token = "{{" + i + "}}";
				var idx = bodyText.IndexOf(token, StringComparison.Ordinal);
				if (idx < 0)
				{
					allFound = false;
					break;
				}
				pos[i - 1] = idx;
			}

			if (allFound)
			{
				var detected = new string?[expectedVarCount];
				for (int i = 1; i <= expectedVarCount; i++)
				{
					var prevEnd = i == 1 ? 0 : pos[i - 2] + ("{{" + (i - 1) + "}}").Length;
					var prefix = bodyText.Substring(prevEnd, pos[i - 1] - prevEnd).Trim().ToLowerInvariant();

					var nextStart = pos[i - 1] + ("{{" + i + "}}").Length;
					var nextEnd = i < expectedVarCount ? pos[i] : bodyText.Length;
					var suffix = bodyText.Substring(nextStart, nextEnd - nextStart).Trim().ToLowerInvariant();

					var cleanPrefix = prefix
						.Replace("e6 car spa", "")
						.Replace("e6 carspa", "")
						.Replace("car spa", "")
						.Replace("carspa", "")
						.Trim();
					var prefixWords = cleanPrefix.Split(new[] { ' ', ',', '!', '.', ':', ';', '-', '\t', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
					var immediateWords = prefixWords.Length <= 3 ? prefixWords : prefixWords.TakeLast(3).ToArray();

					var isGreeting = prefixWords.Any(w => w is "hi" or "hello" or "dear" or "namaste" or "hey" or "customer" or "name")
						|| cleanPrefix.Contains("thank you") || cleanPrefix.Contains("thanks");

					// Step A: Evaluate prefix first (label immediately preceding {{i}})
					if (isGreeting || (i == 1 && string.IsNullOrEmpty(cleanPrefix)))
					{
						detected[i - 1] = customerName;
					}
					else if (cleanPrefix.Contains("₹") || cleanPrefix.Contains("rs") || cleanPrefix.Contains("inr") || immediateWords.Any(w => w is "amount" or "payment" or "paid" or "due" or "price" or "total" or "balance"))
					{
						if (messageType == WhatsAppMessageType.InvoiceFinalized)
						{
							detected[i - 1] = totalAmount;
						}
						else
						{
							detected[i - 1] = (immediateWords.Contains("total")) ? totalPaid : paymentReceived;
						}
					}
					else if (prefixWords.Any(w => w is "vehicle" or "car" or "reg" or "registration" or "plate")
						|| cleanPrefix.Contains("vehicle")
						|| cleanPrefix.Contains("registration")
						|| (messageType == WhatsAppMessageType.PaymentCompleted && immediateWords.Contains("for")))
					{
						detected[i - 1] = !string.IsNullOrWhiteSpace(vehicleReg) && vehicleReg != "N/A"
							? vehicleReg
							: (messageType == WhatsAppMessageType.InvoiceFinalized ? "N/A" : invoiceNum);
					}
					else if (prefixWords.Any(w => w is "invoice" or "bill" or "inv" or "order" or "receipt") || cleanPrefix.Contains("invoice") || cleanPrefix.Contains("bill"))
					{
						detected[i - 1] = invoiceNum;
					}
					else if (prefixWords.Any(w => w is "date" or "dated" or "on") || cleanPrefix.Contains("date"))
					{
						detected[i - 1] = !string.IsNullOrEmpty(dateVal) ? dateVal : DateTime.UtcNow.ToString("dd/MM/yyyy");
					}
					else if (prefixWords.Any(w => w is "url" or "link" or "http" or "https" or "view" or "download") || cleanPrefix.Contains("url") || cleanPrefix.Contains("link"))
					{
						detected[i - 1] = publicUrl;
					}
					else
					{
						// Step B: Suffix fallback (inspect only immediate words following {{i}})
						var cleanSuffix = suffix
							.Replace("e6 car spa", "")
							.Replace("e6 carspa", "")
							.Replace("car spa", "")
							.Replace("carspa", "")
							.Trim();
						var suffixWords = cleanSuffix.Split(new[] { ' ', ',', '!', '.', ':', ';', '-', '\t', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
						var immediateSuffixWords = suffixWords.Take(3).ToArray();
						if (immediateSuffixWords.Any(w => w is "₹" or "rs" or "inr" or "amount" or "payment" or "price" or "total"))
						{
							detected[i - 1] = messageType == WhatsAppMessageType.InvoiceFinalized ? totalAmount : paymentReceived;
						}
						else if (immediateSuffixWords.Any(w => w is "vehicle" or "car" or "reg" or "registration"))
						{
							detected[i - 1] = !string.IsNullOrWhiteSpace(vehicleReg) && vehicleReg != "N/A"
								? vehicleReg
								: (messageType == WhatsAppMessageType.InvoiceFinalized ? "N/A" : invoiceNum);
						}
						else if (immediateSuffixWords.Any(w => w is "invoice" or "bill" or "inv" or "order" or "receipt"))
						{
							detected[i - 1] = invoiceNum;
						}
						else if (immediateSuffixWords.Any(w => w is "date" or "dated"))
						{
							detected[i - 1] = !string.IsNullOrEmpty(dateVal) ? dateVal : DateTime.UtcNow.ToString("dd/MM/yyyy");
						}
					}
				}

				// If all slots were resolved, return them
				if (detected.All(d => d != null))
				{
					return detected.Select(d => d!).ToList();
				}
			}
		}

		// 3. Positional fallback mapping
		var list = new List<string>();
		if (messageType == WhatsAppMessageType.InvoiceFinalized)
		{
			var pool = new[]
			{
				customerName,
				invoiceNum,
				!string.IsNullOrWhiteSpace(vehicleReg) ? vehicleReg : "N/A",
				totalAmount,
				!string.IsNullOrEmpty(dateVal) ? dateVal : DateTime.UtcNow.ToString("dd/MM/yyyy"),
				publicUrl
			};

			for (int i = 0; i < expectedVarCount && i < pool.Length; i++)
			{
				list.Add(pool[i]);
			}
		}
		else // PaymentCompleted
		{
			string[] pool;
			if (expectedVarCount == 3 && (!string.IsNullOrEmpty(vehicleReg) || (bodyText != null && (bodyText.Contains("for", StringComparison.OrdinalIgnoreCase) || bodyText.Contains("vehicle", StringComparison.OrdinalIgnoreCase)))))
			{
				// Pattern matching e6_car_spa_app: "Thank you {{1}}! Payment of Rs.{{2}} for {{3}} received."
				pool = new[] { customerName, paymentReceived, !string.IsNullOrEmpty(vehicleReg) ? vehicleReg : invoiceNum };
			}
			else
			{
				pool = new[]
				{
					customerName,
					invoiceNum,
					paymentReceived,
					totalPaid,
					!string.IsNullOrEmpty(vehicleReg) ? vehicleReg : balance,
					!string.IsNullOrEmpty(dateVal) ? dateVal : DateTime.UtcNow.ToString("dd/MM/yyyy"),
					publicUrl
				};
			}

			for (int i = 0; i < expectedVarCount && i < pool.Length; i++)
			{
				list.Add(pool[i]);
			}
		}

		return list;
	}

	public async Task ProcessPendingMessagesAsync(CancellationToken cancellationToken = default)
	{
		var now = DateTime.UtcNow;
		var staleProcessingThreshold = now.AddMinutes(-2);
		var pendingMessages = await _db.WhatsAppMessages
			.Where(m => (m.Status == WhatsAppMessageStatus.Pending
						|| (m.Status == WhatsAppMessageStatus.Processing && (m.LastAttemptAtUtc == null || m.LastAttemptAtUtc <= staleProcessingThreshold)))
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

	private static string GenerateSecureToken()
	{
		var bytes = RandomNumberGenerator.GetBytes(32);
		return Convert.ToHexString(bytes).ToLowerInvariant();
	}

	private static string ComputeSha256Hash(string token)
	{
		var bytes = Encoding.UTF8.GetBytes(token);
		var hashBytes = SHA256.HashData(bytes);
		return Convert.ToHexString(hashBytes).ToLowerInvariant();
	}

	private string GetPublicInvoiceUrl(string rawToken)
	{
		var baseUrl = (_configuration["PublicInvoiceBaseUrl"] ?? "https://invoice.e6carspa.com").TrimEnd('/');
		if (baseUrl.EndsWith("/i", StringComparison.OrdinalIgnoreCase))
		{
			baseUrl = baseUrl.Substring(0, baseUrl.Length - 2).TrimEnd('/');
		}
		return $"{baseUrl}/i/{rawToken}";
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
				InvoiceTemplateLanguage = "en",
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
			c.UpdatedAt,
			c.HealthStatus.ToString(),
			c.LastCheckedAtUtc,
			c.LastSuccessAtUtc,
			c.LastFailureAtUtc,
			c.LastErrorMessage
		);
	}

	public async Task<WhatsAppHealthDto> GetHealthStatusAsync(bool forceProbe = false, CancellationToken cancellationToken = default)
	{
		var config = await GetOrCreateConfigEntityAsync(cancellationToken);

		var isConfigured = !string.IsNullOrWhiteSpace(config.PhoneNumberId) &&
						   !string.IsNullOrWhiteSpace(config.BusinessAccountId) &&
						   !string.IsNullOrWhiteSpace(config.AccessTokenEncrypted);

		if (!isConfigured)
		{
			if (config.HealthStatus != WhatsAppHealthStatus.NotConfigured)
			{
				config.HealthStatus = WhatsAppHealthStatus.NotConfigured;
				config.LastErrorMessage = "WhatsApp integration is not fully configured.";
				await _db.SaveChangesAsync(cancellationToken);
			}

			return new WhatsAppHealthDto(
				WhatsAppHealthStatus.NotConfigured.ToString(),
				config.LastCheckedAtUtc,
				config.LastSuccessAtUtc,
				config.LastFailureAtUtc,
				config.LastErrorMessage ?? "WhatsApp integration is not fully configured.",
				false
			);
		}

		if (forceProbe)
		{
			await ProbeHealthInternalAsync(config, cancellationToken);
		}

		return new WhatsAppHealthDto(
			config.HealthStatus.ToString(),
			config.LastCheckedAtUtc,
			config.LastSuccessAtUtc,
			config.LastFailureAtUtc,
			config.LastErrorMessage,
			true
		);
	}

	public async Task ProbeHealthAsync(CancellationToken cancellationToken = default)
	{
		var config = await _db.WhatsAppConfigurations.FirstOrDefaultAsync(cancellationToken);
		if (config == null || !config.IsEnabled)
			return;

		var isConfigured = !string.IsNullOrWhiteSpace(config.PhoneNumberId) &&
						   !string.IsNullOrWhiteSpace(config.BusinessAccountId) &&
						   !string.IsNullOrWhiteSpace(config.AccessTokenEncrypted);

		if (!isConfigured)
			return;

		await ProbeHealthInternalAsync(config, cancellationToken);
	}

	private async Task ProbeHealthInternalAsync(WhatsAppConfiguration config, CancellationToken cancellationToken)
	{
		var phoneId = config.PhoneNumberId?.Trim();
		var graphVersion = !string.IsNullOrWhiteSpace(config.GraphApiVersion) ? config.GraphApiVersion.Trim() : "v25.0";

		if (string.IsNullOrWhiteSpace(phoneId) || string.IsNullOrWhiteSpace(config.AccessTokenEncrypted))
		{
			await UpdateHealthStatusAsync(WhatsAppHealthStatus.NotConfigured, "Phone Number ID or Access Token missing.", cancellationToken);
			return;
		}

		string? token = null;
		try
		{
			token = _encryptionService.Decrypt(config.AccessTokenEncrypted);
		}
		catch (Exception ex)
		{
			_logger.LogWarning(ex, "Failed to decrypt WhatsApp access token during health probe.");
			await UpdateHealthStatusAsync(WhatsAppHealthStatus.AuthenticationFailed, "Access token decryption failed.", cancellationToken);
			return;
		}

		if (string.IsNullOrWhiteSpace(token))
		{
			await UpdateHealthStatusAsync(WhatsAppHealthStatus.AuthenticationFailed, "Access token is empty.", cancellationToken);
			return;
		}

		try
		{
			var probeUrl = $"https://graph.facebook.com/{graphVersion}/{Uri.EscapeDataString(phoneId)}?fields=id,verified_name";
			using var request = new HttpRequestMessage(HttpMethod.Get, probeUrl);
			request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

			var response = await _httpClient.SendAsync(request, cancellationToken);
			var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

			if (response.IsSuccessStatusCode)
			{
				await UpdateHealthStatusAsync(WhatsAppHealthStatus.Healthy, null, cancellationToken);
			}
			else
			{
				var (status, errorMsg, _) = ClassifyMetaError((int)response.StatusCode, responseBody, token);
				await UpdateHealthStatusAsync(status, errorMsg, cancellationToken);
			}
		}
		catch (Exception ex)
		{
			_logger.LogWarning(ex, "WhatsApp health probe encountered network/system exception.");
			var sanitizedEx = SanitizeSecret(ex.Message, token);
			await UpdateHealthStatusAsync(WhatsAppHealthStatus.TemporarilyUnavailable, $"Network error: {sanitizedEx}", cancellationToken);
		}
	}

	public static (WhatsAppHealthStatus Status, string Message, string? Details) ClassifyMetaError(
		int statusCode,
		string? responseBody,
		string? tokenToMask = null)
	{
		var (cleanMsg, cleanDetails) = ParseMetaError(responseBody, statusCode, tokenToMask);

		if (statusCode == 401)
		{
			return (WhatsAppHealthStatus.AuthenticationFailed, cleanMsg, cleanDetails);
		}

		if (statusCode == 429 || statusCode >= 500)
		{
			return (WhatsAppHealthStatus.TemporarilyUnavailable, cleanMsg, cleanDetails);
		}

		if (!string.IsNullOrWhiteSpace(responseBody))
		{
			try
			{
				using var doc = JsonDocument.Parse(responseBody);
				if (doc.RootElement.TryGetProperty("error", out var errorObj))
				{
					var type = errorObj.TryGetProperty("type", out var t) ? t.GetString() ?? "" : "";
					var code = errorObj.TryGetProperty("code", out var c) ? c.GetInt32() : 0;
					var subcode = errorObj.TryGetProperty("error_subcode", out var sc) ? sc.GetInt32() : 0;
					var msg = errorObj.TryGetProperty("message", out var m) ? m.GetString() ?? "" : "";

					// Authentication failure indicators
					if (string.Equals(type, "OAuthException", StringComparison.OrdinalIgnoreCase) ||
						code == 190 ||
						code == 102 ||
						code == 10 ||
						subcode == 463 ||
						subcode == 467 ||
						subcode == 490 ||
						msg.Contains("access token", StringComparison.OrdinalIgnoreCase) ||
						msg.Contains("OAuth", StringComparison.OrdinalIgnoreCase) ||
						msg.Contains("Session has expired", StringComparison.OrdinalIgnoreCase))
					{
						return (WhatsAppHealthStatus.AuthenticationFailed, cleanMsg, cleanDetails);
					}

					// Configuration invalid indicators
					if (code == 100 ||
						code == 80007 ||
						code == 131008 ||
						code == 131009 ||
						subcode == 33 ||
						msg.Contains("phone number", StringComparison.OrdinalIgnoreCase) ||
						msg.Contains("business account", StringComparison.OrdinalIgnoreCase) ||
						msg.Contains("does not exist", StringComparison.OrdinalIgnoreCase) ||
						msg.Contains("Cannot find", StringComparison.OrdinalIgnoreCase))
					{
						return (WhatsAppHealthStatus.ConfigurationInvalid, cleanMsg, cleanDetails);
					}
				}
			}
			catch { }
		}

		if (statusCode >= 400 && statusCode < 500)
		{
			return (WhatsAppHealthStatus.ConfigurationInvalid, cleanMsg, cleanDetails);
		}

		return (WhatsAppHealthStatus.TemporarilyUnavailable, cleanMsg, cleanDetails);
	}

	private async Task UpdateHealthStatusAsync(
		WhatsAppHealthStatus status,
		string? errorMessage = null,
		CancellationToken cancellationToken = default)
	{
		try
		{
			var config = await _db.WhatsAppConfigurations.FirstOrDefaultAsync(cancellationToken);
			if (config == null) return;

			var now = DateTime.UtcNow;
			config.HealthStatus = status;
			config.LastCheckedAtUtc = now;

			if (status == WhatsAppHealthStatus.Healthy)
			{
				config.LastSuccessAtUtc = now;
				config.LastErrorMessage = null;
			}
			else if (status != WhatsAppHealthStatus.NotConfigured)
			{
				config.LastFailureAtUtc = now;
				config.LastErrorMessage = !string.IsNullOrWhiteSpace(errorMessage)
					? (errorMessage.Length > 500 ? errorMessage[..500] : errorMessage)
					: null;
			}
			else
			{
				config.LastErrorMessage = errorMessage;
			}

			await _db.SaveChangesAsync(cancellationToken);
		}
		catch (Exception ex)
		{
			_logger.LogWarning(ex, "Failed to persist WhatsApp health status update.");
		}
	}

	private static (string verifiedName, string displayPhone, string qualityRating, string platformType) ParsePhoneNumberDetails(string content, string defaultPhoneId)
	{
		try
		{
			using var doc = JsonDocument.Parse(content);
			var root = doc.RootElement;
			var verifiedName = root.TryGetProperty("verified_name", out var vn) ? vn.GetString() ?? "Verified" : "Verified";
			var displayPhone = root.TryGetProperty("display_phone_number", out var dp) ? dp.GetString() ?? defaultPhoneId : defaultPhoneId;
			var quality = root.TryGetProperty("quality_rating", out var qr) ? qr.GetString() ?? "UNKNOWN" : "UNKNOWN";
			var platform = root.TryGetProperty("platform_type", out var pt) ? pt.GetString() ?? "CLOUD_API" : "CLOUD_API";
			return (verifiedName, displayPhone, quality, platform);
		}
		catch
		{
			return ("Verified", defaultPhoneId, "UNKNOWN", "CLOUD_API");
		}
	}

	private static (string wabaName, string wabaId) ParseWabaDetails(string content, string defaultWabaId)
	{
		try
		{
			using var doc = JsonDocument.Parse(content);
			var root = doc.RootElement;
			var name = root.TryGetProperty("name", out var n) ? n.GetString() ?? "WABA" : "WABA";
			var id = root.TryGetProperty("id", out var i) ? i.GetString() ?? defaultWabaId : defaultWabaId;
			return (name, id);
		}
		catch
		{
			return ("WABA", defaultWabaId);
		}
	}

	private static (string Message, string? Details) ParseMetaError(string? responseBody, int statusCode, string? tokenToMask = null)
	{
		if (string.IsNullOrWhiteSpace(responseBody))
		{
			return ($"Meta API returned HTTP {statusCode}.", null);
		}

		try
		{
			using var doc = JsonDocument.Parse(responseBody);
			if (doc.RootElement.TryGetProperty("error", out var errorObj))
			{
				var message = errorObj.TryGetProperty("message", out var m) ? m.GetString() ?? "Unknown error" : "Unknown error";
				var type = errorObj.TryGetProperty("type", out var t) ? t.GetString() ?? "OAuthException" : "OAuthException";
				var code = errorObj.TryGetProperty("code", out var c) ? c.GetInt32().ToString() : null;
				var userMsg = errorObj.TryGetProperty("error_user_msg", out var um) ? um.GetString() : null;
				var userTitle = errorObj.TryGetProperty("error_user_title", out var ut) ? ut.GetString() : null;

				var cleanMsg = SanitizeSecret(userMsg ?? message, tokenToMask);
				var cleanDetails = SanitizeSecret(
					$"Meta Error {(code != null ? $"[{code}] " : "")}{type}: {message}{(userTitle != null ? $" ({userTitle})" : "")}",
					tokenToMask
				);

				return (cleanMsg, cleanDetails);
			}
		}
		catch
		{
			// Non-JSON response body
		}

		var safeBody = SanitizeSecret(responseBody, tokenToMask);
		if (safeBody.Length > 300) safeBody = safeBody[..300] + "...";

		return ($"Meta API error (HTTP {statusCode}).", safeBody);
	}

	private static string SanitizeSecret(string input, string? token)
	{
		if (string.IsNullOrEmpty(input)) return string.Empty;
		if (!string.IsNullOrWhiteSpace(token))
		{
			input = input.Replace(token, "[REDACTED]");
		}
		input = Regex.Replace(input, @"Bearer\s+[A-Za-z0-9_\-\.]+", "Bearer [REDACTED]", RegexOptions.IgnoreCase);
		return input;
	}

	private static readonly Regex VariableRegex = new(@"\{\{(\d+)\}\}", RegexOptions.Compiled);

	private static MetaWhatsAppTemplateDto? ParseTemplateDto(JsonElement item)
	{
		try
		{
			var id = item.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? string.Empty : string.Empty;
			var name = item.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? string.Empty : string.Empty;
			var status = item.TryGetProperty("status", out var statusProp) ? statusProp.GetString() ?? "UNKNOWN" : "UNKNOWN";
			var category = item.TryGetProperty("category", out var catProp) ? catProp.GetString() ?? "UNKNOWN" : "UNKNOWN";
			var language = item.TryGetProperty("language", out var langProp) ? langProp.GetString() ?? "en_US" : "en_US";

			var components = new List<MetaWhatsAppTemplateComponentDto>();
			if (item.TryGetProperty("components", out var compArr) && compArr.ValueKind == JsonValueKind.Array)
			{
				foreach (var comp in compArr.EnumerateArray())
				{
					var parsedComp = ParseComponentDto(comp);
					if (parsedComp != null)
					{
						components.Add(parsedComp);
					}
				}
			}

			return new MetaWhatsAppTemplateDto(id, name, status, category, language, components);
		}
		catch
		{
			return null;
		}
	}

	private static MetaWhatsAppTemplateComponentDto? ParseComponentDto(JsonElement comp)
	{
		try
		{
			var type = comp.TryGetProperty("type", out var typeProp) ? typeProp.GetString() ?? "UNKNOWN" : "UNKNOWN";
			var format = comp.TryGetProperty("format", out var formatProp) ? formatProp.GetString() : null;
			var text = comp.TryGetProperty("text", out var textProp) ? textProp.GetString() : null;

			// Extract variable placeholders from text (e.g. {{1}}, {{2}})
			List<string>? variables = null;
			if (!string.IsNullOrEmpty(text))
			{
				var matches = VariableRegex.Matches(text);
				if (matches.Count > 0)
				{
					variables = matches.Select(m => m.Value).Distinct().ToList();
				}
			}

			// Extract examples if present
			List<string>? examples = null;
			if (comp.TryGetProperty("example", out var exObj) && exObj.ValueKind == JsonValueKind.Object)
			{
				if (exObj.TryGetProperty("body_text", out var bodyTextArr) && bodyTextArr.ValueKind == JsonValueKind.Array)
				{
					examples = new List<string>();
					foreach (var innerArr in bodyTextArr.EnumerateArray())
					{
						if (innerArr.ValueKind == JsonValueKind.Array)
						{
							foreach (var val in innerArr.EnumerateArray())
							{
								if (val.ValueKind == JsonValueKind.String)
								{
									var s = val.GetString();
									if (!string.IsNullOrEmpty(s)) examples.Add(s);
								}
							}
						}
					}
				}
				else if (exObj.TryGetProperty("header_text", out var headerTextArr) && headerTextArr.ValueKind == JsonValueKind.Array)
				{
					examples = new List<string>();
					foreach (var val in headerTextArr.EnumerateArray())
					{
						if (val.ValueKind == JsonValueKind.String)
						{
							var s = val.GetString();
							if (!string.IsNullOrEmpty(s)) examples.Add(s);
						}
					}
				}
			}

			// Extract buttons if present
			List<MetaWhatsAppTemplateButtonDto>? buttons = null;
			if (comp.TryGetProperty("buttons", out var btnArr) && btnArr.ValueKind == JsonValueKind.Array)
			{
				buttons = new List<MetaWhatsAppTemplateButtonDto>();
				foreach (var btn in btnArr.EnumerateArray())
				{
					var btnType = btn.TryGetProperty("type", out var btProp) ? btProp.GetString() ?? "UNKNOWN" : "UNKNOWN";
					var btnText = btn.TryGetProperty("text", out var txtProp) ? txtProp.GetString() : null;
					var btnUrl = btn.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : null;
					var btnPhone = btn.TryGetProperty("phone_number", out var phProp) ? phProp.GetString() : null;

					List<string>? btnExamples = null;
					if (btn.TryGetProperty("example", out var btnEx) && btnEx.ValueKind == JsonValueKind.Array)
					{
						btnExamples = new List<string>();
						foreach (var exVal in btnEx.EnumerateArray())
						{
							if (exVal.ValueKind == JsonValueKind.String)
							{
								var s = exVal.GetString();
								if (!string.IsNullOrEmpty(s)) btnExamples.Add(s);
							}
						}
					}

					buttons.Add(new MetaWhatsAppTemplateButtonDto(btnType, btnText, btnUrl, btnPhone, btnExamples));
				}
			}

			return new MetaWhatsAppTemplateComponentDto(type, format, text, variables, examples, buttons);
		}
		catch
		{
			return null;
		}
	}

	private long GetMaxDocumentSizeBytes()
	{
		var configVal = _configuration["WhatsApp:MaxDocumentSizeBytes"];
		if (long.TryParse(configVal, out var bytes) && bytes > 0)
		{
			return bytes;
		}
		return 100L * 1024 * 1024; // 100MB default Meta limit for documents
	}

	private static string SanitizeFileName(string? invoiceNumber)
	{
		if (string.IsNullOrWhiteSpace(invoiceNumber))
		{
			return "Invoice.pdf";
		}

		var clean = Regex.Replace(invoiceNumber.Trim(), @"[^a-zA-Z0-9_\-\.]", "_");
		if (!clean.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
		{
			clean += ".pdf";
		}
		return clean;
	}

	private async Task<(bool Success, string? MediaId, int StatusCode, string? ErrorMessage)> UploadWhatsAppDocumentAsync(
		byte[] pdfBytes,
		string fileName,
		string phoneNumberId,
		string graphVersion,
		string accessToken,
		CancellationToken cancellationToken = default)
	{
		if (pdfBytes == null || pdfBytes.Length == 0)
		{
			return (false, null, 400, "Generated invoice PDF is empty.");
		}

		if (pdfBytes.Length < 5 ||
			pdfBytes[0] != 0x25 || // '%'
			pdfBytes[1] != 0x50 || // 'P'
			pdfBytes[2] != 0x44 || // 'D'
			pdfBytes[3] != 0x46 || // 'F'
			pdfBytes[4] != 0x2D)   // '-'
		{
			return (false, null, 400, "Generated document does not have a valid PDF header.");
		}

		var maxBytes = GetMaxDocumentSizeBytes();
		if (pdfBytes.Length > maxBytes)
		{
			return (false, null, 400, $"Generated PDF exceeds maximum allowed size of {maxBytes} bytes.");
		}

		var uploadUrl = $"https://graph.facebook.com/{graphVersion}/{Uri.EscapeDataString(phoneNumberId)}/media";
		using var request = new HttpRequestMessage(HttpMethod.Post, uploadUrl);
		request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

		using var content = new MultipartFormDataContent();
		content.Add(new StringContent("whatsapp"), "messaging_product");
		content.Add(new StringContent("application/pdf"), "type");

		var byteContent = new ByteArrayContent(pdfBytes);
		byteContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
		content.Add(byteContent, "file", fileName);

		request.Content = content;

		var response = await _httpClient.SendAsync(request, cancellationToken);
		var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

		if (!response.IsSuccessStatusCode)
		{
			var (errorMsg, _) = ParseMetaError(responseBody, (int)response.StatusCode, accessToken);
			return (false, null, (int)response.StatusCode, errorMsg);
		}

		using var doc = JsonDocument.Parse(responseBody);
		if (!doc.RootElement.TryGetProperty("id", out var idProp) || string.IsNullOrWhiteSpace(idProp.GetString()))
		{
			return (false, null, (int)response.StatusCode, "Meta media upload response did not contain a valid media id.");
		}

		return (true, idProp.GetString()!, (int)response.StatusCode, null);
	}

	private static string? GetCachedMediaId(string? templateParametersJson)
	{
		if (string.IsNullOrWhiteSpace(templateParametersJson))
			return null;

		try
		{
			using var doc = JsonDocument.Parse(templateParametersJson);
			if (doc.RootElement.TryGetProperty("mediaId", out var prop) && !string.IsNullOrWhiteSpace(prop.GetString()))
			{
				return prop.GetString();
			}
		}
		catch { }

		return null;
	}

	private static string SetCachedMediaId(string? templateParametersJson, string? mediaId)
	{
		var dict = new Dictionary<string, object?>();
		if (!string.IsNullOrWhiteSpace(templateParametersJson))
		{
			try
			{
				var existing = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(templateParametersJson);
				if (existing != null)
				{
					foreach (var kvp in existing)
					{
						if (!string.Equals(kvp.Key, "mediaId", StringComparison.OrdinalIgnoreCase))
						{
							dict[kvp.Key] = kvp.Value;
						}
					}
				}
			}
			catch { }
		}

		if (!string.IsNullOrWhiteSpace(mediaId))
		{
			dict["mediaId"] = mediaId;
		}

		return JsonSerializer.Serialize(dict);
	}

	private static bool IsMediaError(int statusCode, string? responseBody, string? errorMsg)
	{
		if (string.IsNullOrWhiteSpace(responseBody) && string.IsNullOrWhiteSpace(errorMsg))
			return false;

		var combined = ((responseBody ?? "") + " " + (errorMsg ?? "")).ToLowerInvariant();
		return combined.Contains("media") ||
			   combined.Contains("131053") ||
			   combined.Contains("131052") ||
			   combined.Contains("131051") ||
			   combined.Contains("cannot download media") ||
			   combined.Contains("invalid media");
	}
}
