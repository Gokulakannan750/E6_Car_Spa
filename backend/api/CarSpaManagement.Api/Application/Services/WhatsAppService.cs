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
				var err = ParseMetaError(phoneContent, (int)phoneResponse.StatusCode, token);
				return new TestWhatsAppConnectionResponse(false, $"Phone Number ID validation failed: {err.Message}", err.Details);
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
				var err = ParseMetaError(wabaContent, (int)wabaResponse.StatusCode, token);
				return new TestWhatsAppConnectionResponse(false, $"WhatsApp Business Account ID validation failed: {err.Message}", err.Details);
			}

			var (wabaName, wabaIdResult) = ParseWabaDetails(wabaContent, wabaId);

			var details = $"Phone: {displayPhone} (Verified Name: {verifiedName}, Quality: {qualityRating}, Platform: {platformType}) | WABA: {wabaName} (ID: {wabaIdResult})";
			return new TestWhatsAppConnectionResponse(true, "Successfully connected to Meta WhatsApp Cloud API.", details);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "WhatsApp test connection failed with exception.");
			return new TestWhatsAppConnectionResponse(false, $"Connection error: {SanitizeSecret(ex.Message, token)}");
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
					var (metaMsg, metaDetails) = ParseMetaError(responseContent, (int)response.StatusCode, token);
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
}
