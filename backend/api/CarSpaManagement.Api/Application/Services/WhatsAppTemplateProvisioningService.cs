using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CarSpaManagement.Api.Application.Services;

/// <summary>
/// Creates the managed template pack (<see cref="WhatsAppTemplateCatalog"/>) on the configured WhatsApp Business
/// Account through Meta's Graph API, reports approval status, and switches the app to the approved templates.
/// Templates are only created, never edited or deleted, and the token is never returned or logged.
/// </summary>
public class WhatsAppTemplateProvisioningService : IWhatsAppTemplateProvisioningService
{
	private const string GraphBase = "https://graph.facebook.com";
	private const string NotCreated = "NOT_CREATED";
	private const string Approved = "APPROVED";

	private readonly AppDbContext _db;
	private readonly HttpClient _httpClient;
	private readonly IAesEncryptionService _encryptionService;
	private readonly IAuditLogService _auditLogService;
	private readonly ILogger<WhatsAppTemplateProvisioningService> _logger;

	public WhatsAppTemplateProvisioningService(
		AppDbContext db,
		HttpClient httpClient,
		IAesEncryptionService encryptionService,
		IAuditLogService auditLogService,
		ILogger<WhatsAppTemplateProvisioningService> logger)
	{
		_db = db;
		_httpClient = httpClient;
		_encryptionService = encryptionService;
		_auditLogService = auditLogService;
		_logger = logger;
	}

	private sealed record MetaContext(WhatsAppConfiguration Config, string GraphVersion, string WabaId, string Token);

	private sealed record RemoteTemplate(string Name, string Language, string Status, string? RejectedReason);

	public async Task<ManagedWhatsAppTemplatesResponse> GetManagedTemplatesAsync(CancellationToken cancellationToken = default)
	{
		var (ctx, error) = await LoadContextAsync(tracking: false, cancellationToken);
		if (ctx is null)
			return new ManagedWhatsAppTemplatesResponse(false, error!, BuildStatuses(null, []), false);

		var (remote, fetchError, details) = await FetchTemplatesAsync(ctx, cancellationToken);
		if (remote is null)
			return new ManagedWhatsAppTemplatesResponse(false, fetchError!, BuildStatuses(ctx.Config, []), false, details);

		var statuses = BuildStatuses(ctx.Config, remote);
		var canActivate = statuses.All(s => s.Status == Approved);
		return new ManagedWhatsAppTemplatesResponse(true, "Template status retrieved.", statuses, canActivate);
	}

	public async Task<ProvisionManagedTemplatesResponse> ProvisionAsync(CancellationToken cancellationToken = default)
	{
		var (ctx, error) = await LoadContextAsync(tracking: false, cancellationToken);
		if (ctx is null)
			return new ProvisionManagedTemplatesResponse(false, error!, []);

		var (remote, fetchError, _) = await FetchTemplatesAsync(ctx, cancellationToken);
		if (remote is null)
			return new ProvisionManagedTemplatesResponse(false, fetchError!, []);

		var results = new List<ManagedTemplateProvisionResultDto>();
		foreach (var template in WhatsAppTemplateCatalog.All)
		{
			var existing = FindRemote(remote, template);
			if (existing is not null)
			{
				results.Add(new ManagedTemplateProvisionResultDto(template.Name, "AlreadyExists", existing.Status));
				continue;
			}

			results.Add(await CreateTemplateAsync(ctx, template, cancellationToken));
		}

		var failed = results.Count(r => r.Outcome == "Failed");
		var message = failed == 0
			? "Standard templates submitted to Meta. Approval usually takes a few minutes and can take up to a day."
			: $"{failed} template(s) could not be created. See the details for each template.";

		await _auditLogService.RecordAsync(
			action: AuditActions.WhatsAppTemplatesProvisioned,
			module: AuditModules.WhatsApp,
			description: message,
			entityType: "WhatsAppConfiguration",
			entityId: ctx.Config.Id,
			newValues: JsonSerializer.Serialize(results.Select(r => new { r.Name, r.Outcome, r.Status })),
			outcome: failed == 0 ? "Success" : "Failure",
			cancellationToken: cancellationToken);

		return new ProvisionManagedTemplatesResponse(failed == 0, message, results);
	}

	public async Task<ActivateManagedTemplatesResponse> ActivateAsync(CancellationToken cancellationToken = default)
	{
		var (ctx, error) = await LoadContextAsync(tracking: true, cancellationToken);
		if (ctx is null)
			return new ActivateManagedTemplatesResponse(false, error!);

		var (remote, fetchError, _) = await FetchTemplatesAsync(ctx, cancellationToken);
		if (remote is null)
			return new ActivateManagedTemplatesResponse(false, fetchError!);

		var notApproved = WhatsAppTemplateCatalog.All
			.Where(t => FindRemote(remote, t)?.Status != Approved)
			.Select(t => t.Name)
			.ToList();
		if (notApproved.Count > 0)
			return new ActivateManagedTemplatesResponse(false,
				$"Templates can be used once Meta approves them. Not yet approved: {string.Join(", ", notApproved)}.");

		var config = ctx.Config;
		var oldValues = JsonSerializer.Serialize(new
		{
			invoiceTemplate = $"{config.InvoiceTemplateName} ({config.InvoiceTemplateLanguage})",
			paymentTemplate = $"{config.PaymentCompletedTemplateName} ({config.PaymentCompletedTemplateLanguage})",
		});

		config.InvoiceTemplateName = WhatsAppTemplateCatalog.InvoiceReady.Name;
		config.InvoiceTemplateLanguage = WhatsAppTemplateCatalog.InvoiceReady.Language;
		config.PaymentCompletedTemplateName = WhatsAppTemplateCatalog.PaymentReceived.Name;
		config.PaymentCompletedTemplateLanguage = WhatsAppTemplateCatalog.PaymentReceived.Language;
		config.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: AuditActions.WhatsAppTemplatesActivated,
			module: AuditModules.WhatsApp,
			description: "Switched WhatsApp notifications to the approved standard templates.",
			entityType: "WhatsAppConfiguration",
			entityId: config.Id,
			oldValues: oldValues,
			newValues: JsonSerializer.Serialize(new
			{
				invoiceTemplate = $"{config.InvoiceTemplateName} ({config.InvoiceTemplateLanguage})",
				paymentTemplate = $"{config.PaymentCompletedTemplateName} ({config.PaymentCompletedTemplateLanguage})",
			}),
			cancellationToken: cancellationToken);

		return new ActivateManagedTemplatesResponse(true, "WhatsApp notifications now use the standard templates.");
	}

	// ── Meta calls ──────────────────────────────────────────────────────────

	private async Task<ManagedTemplateProvisionResultDto> CreateTemplateAsync(
		MetaContext ctx, ManagedWhatsAppTemplate template, CancellationToken cancellationToken)
	{
		try
		{
			var components = new List<object>();
			if (string.Equals(template.HeaderFormat, "DOCUMENT", StringComparison.OrdinalIgnoreCase))
			{
				if (string.IsNullOrWhiteSpace(ctx.Config.MetaAppId))
					return new ManagedTemplateProvisionResultDto(template.Name, "Failed",
						Error: "Meta App ID is required to create this template (Meta needs a sample PDF for its review). Save the App ID in WhatsApp settings and try again.");

				var (handle, uploadError) = await UploadSampleDocumentAsync(ctx, cancellationToken);
				if (handle is null)
					return new ManagedTemplateProvisionResultDto(template.Name, "Failed", Error: uploadError);

				components.Add(new { type = "HEADER", format = "DOCUMENT", example = new { header_handle = new[] { handle } } });
			}

			components.Add(new
			{
				type = "BODY",
				text = template.BodyText,
				example = new { body_text = new[] { template.BodyExamples.ToArray() } },
			});

			var payload = JsonSerializer.Serialize(new
			{
				name = template.Name,
				language = template.Language,
				category = template.Category,
				components,
			});

			using var request = new HttpRequestMessage(HttpMethod.Post,
				$"{GraphBase}/{ctx.GraphVersion}/{Uri.EscapeDataString(ctx.WabaId)}/message_templates");
			request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ctx.Token);
			request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

			var response = await _httpClient.SendAsync(request, cancellationToken);
			var body = await response.Content.ReadAsStringAsync(cancellationToken);
			if (!response.IsSuccessStatusCode)
			{
				var (_, metaMessage, details) = WhatsAppService.ClassifyMetaError((int)response.StatusCode, body, ctx.Token);
				return new ManagedTemplateProvisionResultDto(template.Name, "Failed",
					Error: string.IsNullOrWhiteSpace(details) ? metaMessage : $"{metaMessage} {details}");
			}

			using var doc = JsonDocument.Parse(body);
			var status = doc.RootElement.TryGetProperty("status", out var s) ? s.GetString() : "PENDING";
			return new ManagedTemplateProvisionResultDto(template.Name, "Created", status ?? "PENDING");
		}
		catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
		{
			_logger.LogError("Creating WhatsApp template {Template} failed: {Error}", template.Name,
				WhatsAppService.SanitizeSecret(ex.Message, ctx.Token));
			return new ManagedTemplateProvisionResultDto(template.Name, "Failed",
				Error: $"Could not reach Meta: {WhatsAppService.SanitizeSecret(ex.Message, ctx.Token)}");
		}
	}

	/// <summary>Meta's Resumable Upload API: start an upload session on the app, upload the bytes, get a file handle.</summary>
	private async Task<(string? Handle, string? Error)> UploadSampleDocumentAsync(MetaContext ctx, CancellationToken cancellationToken)
	{
		var bytes = BuildSampleInvoicePdf();
		var appId = Uri.EscapeDataString(ctx.Config.MetaAppId!.Trim());

		using var start = new HttpRequestMessage(HttpMethod.Post,
			$"{GraphBase}/{ctx.GraphVersion}/{appId}/uploads?file_name=sample-invoice.pdf&file_length={bytes.Length}&file_type=application/pdf");
		start.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ctx.Token);
		var startResponse = await _httpClient.SendAsync(start, cancellationToken);
		var startBody = await startResponse.Content.ReadAsStringAsync(cancellationToken);
		if (!startResponse.IsSuccessStatusCode)
		{
			var (_, metaMessage, _) = WhatsAppService.ClassifyMetaError((int)startResponse.StatusCode, startBody, ctx.Token);
			return (null, $"Could not start the sample PDF upload: {metaMessage} Check the Meta App ID.");
		}

		string? sessionId;
		using (var startDoc = JsonDocument.Parse(startBody))
			sessionId = startDoc.RootElement.TryGetProperty("id", out var id) ? id.GetString() : null;
		if (string.IsNullOrWhiteSpace(sessionId))
			return (null, "Meta did not return an upload session.");

		using var upload = new HttpRequestMessage(HttpMethod.Post, $"{GraphBase}/{ctx.GraphVersion}/{sessionId}");
		upload.Headers.Authorization = new AuthenticationHeaderValue("OAuth", ctx.Token);
		upload.Headers.Add("file_offset", "0");
		upload.Content = new ByteArrayContent(bytes);
		var uploadResponse = await _httpClient.SendAsync(upload, cancellationToken);
		var uploadBody = await uploadResponse.Content.ReadAsStringAsync(cancellationToken);
		if (!uploadResponse.IsSuccessStatusCode)
		{
			var (_, metaMessage, _) = WhatsAppService.ClassifyMetaError((int)uploadResponse.StatusCode, uploadBody, ctx.Token);
			return (null, $"Could not upload the sample PDF: {metaMessage}");
		}

		using var uploadDoc = JsonDocument.Parse(uploadBody);
		var handle = uploadDoc.RootElement.TryGetProperty("h", out var h) ? h.GetString() : null;
		return string.IsNullOrWhiteSpace(handle) ? (null, "Meta did not return a file handle for the sample PDF.") : (handle, null);
	}

	private async Task<(List<RemoteTemplate>? Templates, string? Error, string? Details)> FetchTemplatesAsync(
		MetaContext ctx, CancellationToken cancellationToken)
	{
		var templates = new List<RemoteTemplate>();
		string? nextUrl = $"{GraphBase}/{ctx.GraphVersion}/{Uri.EscapeDataString(ctx.WabaId)}/message_templates"
			+ "?fields=name,status,language,rejected_reason&limit=100";
		try
		{
			while (!string.IsNullOrWhiteSpace(nextUrl))
			{
				using var request = new HttpRequestMessage(HttpMethod.Get, nextUrl);
				request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ctx.Token);
				var response = await _httpClient.SendAsync(request, cancellationToken);
				var body = await response.Content.ReadAsStringAsync(cancellationToken);
				if (!response.IsSuccessStatusCode)
				{
					var (_, metaMessage, details) = WhatsAppService.ClassifyMetaError((int)response.StatusCode, body, ctx.Token);
					return (null, $"Unable to read templates from Meta: {metaMessage}", details);
				}

				using var doc = JsonDocument.Parse(body);
				if (doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
				{
					foreach (var item in data.EnumerateArray())
					{
						var name = item.TryGetProperty("name", out var n) ? n.GetString() : null;
						if (string.IsNullOrWhiteSpace(name)) continue;
						var rejected = item.TryGetProperty("rejected_reason", out var r) ? r.GetString() : null;
						templates.Add(new RemoteTemplate(
							name,
							item.TryGetProperty("language", out var l) ? l.GetString() ?? string.Empty : string.Empty,
							item.TryGetProperty("status", out var s) ? (s.GetString() ?? string.Empty).ToUpperInvariant() : string.Empty,
							string.IsNullOrWhiteSpace(rejected) || rejected == "NONE" ? null : rejected));
					}
				}

				nextUrl = doc.RootElement.TryGetProperty("paging", out var paging)
					&& paging.TryGetProperty("next", out var next) && next.ValueKind == JsonValueKind.String
						? next.GetString()
						: null;
			}
			return (templates, null, null);
		}
		catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
		{
			_logger.LogError("Reading WhatsApp templates failed: {Error}", WhatsAppService.SanitizeSecret(ex.Message, ctx.Token));
			return (null, $"Could not reach Meta: {WhatsAppService.SanitizeSecret(ex.Message, ctx.Token)}", null);
		}
	}

	// ── Helpers ─────────────────────────────────────────────────────────────

	private async Task<(MetaContext? Context, string? Error)> LoadContextAsync(bool tracking, CancellationToken cancellationToken)
	{
		var query = tracking ? _db.WhatsAppConfigurations : _db.WhatsAppConfigurations.AsNoTracking();
		var config = await query.FirstOrDefaultAsync(cancellationToken);
		if (config is null || string.IsNullOrWhiteSpace(config.BusinessAccountId))
			return (null, "WhatsApp Business Account ID is not configured. Save your WhatsApp settings first.");
		if (string.IsNullOrWhiteSpace(config.AccessTokenEncrypted))
			return (null, "Meta Access Token is not configured. Save a valid access token first.");

		var graphVersion = string.IsNullOrWhiteSpace(config.GraphApiVersion) ? "v25.0" : config.GraphApiVersion.Trim();
		if (!WhatsAppService.GraphApiVersionRegex.IsMatch(graphVersion))
			return (null, "Invalid Graph API version format.");

		var token = _encryptionService.Decrypt(config.AccessTokenEncrypted);
		if (string.IsNullOrWhiteSpace(token))
			return (null, "Meta Access Token could not be decrypted. Save the access token again.");

		return (new MetaContext(config, graphVersion, config.BusinessAccountId.Trim(), token), null);
	}

	private static RemoteTemplate? FindRemote(IEnumerable<RemoteTemplate> remote, ManagedWhatsAppTemplate template) =>
		remote.FirstOrDefault(r =>
			string.Equals(r.Name, template.Name, StringComparison.OrdinalIgnoreCase)
			&& string.Equals(r.Language, template.Language, StringComparison.OrdinalIgnoreCase));

	private static List<ManagedWhatsAppTemplateDto> BuildStatuses(WhatsAppConfiguration? config, IReadOnlyCollection<RemoteTemplate> remote) =>
		WhatsAppTemplateCatalog.All.Select(t =>
		{
			var match = FindRemote(remote, t);
			var activeName = t.MessageType == WhatsAppMessageType.InvoiceFinalized
				? config?.InvoiceTemplateName
				: config?.PaymentCompletedTemplateName;
			return new ManagedWhatsAppTemplateDto(
				t.MessageType.ToString(),
				t.Purpose,
				t.Name,
				t.Language,
				t.Category,
				match?.Status is { Length: > 0 } status ? status : NotCreated,
				match?.RejectedReason,
				string.Equals(activeName, t.Name, StringComparison.OrdinalIgnoreCase));
		}).ToList();

	/// <summary>A one-page placeholder invoice Meta reviewers see as the document-header example.</summary>
	internal static byte[] BuildSampleInvoicePdf()
	{
		QuestPDF.Settings.License = LicenseType.Community;
		return Document.Create(container => container.Page(page =>
		{
			page.Size(PageSizes.A5);
			page.Margin(30);
			page.Content().Column(column =>
			{
				column.Spacing(8);
				column.Item().Text("TAX INVOICE (SAMPLE)").FontSize(18).Bold();
				column.Item().Text("Invoice: GST/0001");
				column.Item().Text("Customer: Ravi    Vehicle: TN33AB1234");
				column.Item().Text("Exterior wash and interior cleaning ........ ₹1,000.00");
				column.Item().Text("GST 18% ........ ₹180.00");
				column.Item().Text("Total ........ ₹1,180.00").Bold();
			});
		})).GeneratePdf();
	}
}
