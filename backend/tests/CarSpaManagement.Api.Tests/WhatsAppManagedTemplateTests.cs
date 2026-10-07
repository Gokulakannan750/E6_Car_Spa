using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>Managed WhatsApp template pack: catalog mapping, provisioning on Meta, status and activation.</summary>
public class WhatsAppManagedTemplateTests
{
    private const string Token = "secret_meta_token_value_123";
    private const string WabaId = "waba_555";
    private const string AppId = "app_777";

    private sealed record Call(HttpMethod Method, string Url, string? Authorization, string? FileOffset, string Body);

    private sealed class FakeMeta : HttpMessageHandler
    {
        public List<Call> Calls { get; } = new();
        public List<object> Templates { get; } = new();
        public HttpStatusCode CreateStatus { get; set; } = HttpStatusCode.OK;
        public string CreateErrorBody { get; set; } = "{}";

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct);
            var url = request.RequestUri!.ToString();
            Calls.Add(new Call(request.Method, url, request.Headers.Authorization?.ToString(),
                request.Headers.TryGetValues("file_offset", out var offs) ? offs.First() : null, body));

            if (request.Method == HttpMethod.Get && url.Contains("/message_templates"))
                return Json(new { data = Templates });
            if (request.Method == HttpMethod.Post && url.Contains($"/{AppId}/uploads"))
                return Json(new { id = "upload:session_1" });
            if (request.Method == HttpMethod.Post && url.Contains("/upload:session_1"))
                return Json(new { h = "handle_abc" });
            if (request.Method == HttpMethod.Post && url.Contains("/message_templates"))
                return CreateStatus == HttpStatusCode.OK
                    ? Json(new { id = "tpl_1", status = "PENDING", category = "UTILITY" })
                    : new HttpResponseMessage(CreateStatus) { Content = new StringContent(CreateErrorBody, Encoding.UTF8, "application/json") };
            if (request.Method == HttpMethod.Post && url.Contains("/messages"))
                return Json(new { messages = new[] { new { id = "wamid.MANAGED_1" } } });
            return new HttpResponseMessage(HttpStatusCode.NotFound) { Content = new StringContent("{}") };
        }

        private static HttpResponseMessage Json(object payload) => new(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
    }

    private sealed class RecordingAudit : IAuditLogService
    {
        public List<(string Action, string Outcome, string? NewValues)> Entries { get; } = new();

        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default)
        {
            Entries.Add((action, outcome, newValues));
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            Task.FromResult(new PagedResult<AuditLogDto>());
    }

    private sealed record Env(AppDbContext Db, IAesEncryptionService Enc, FakeMeta Meta, RecordingAudit Audit, WhatsAppTemplateProvisioningService Service);

    private static async Task<Env> CreateAsync(string? metaAppId = AppId, bool configured = true)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var enc = new AesEncryptionService(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["WhatsApp:EncryptionKey"] = "12345678901234567890123456789012" })
            .Build());
        if (configured)
        {
            db.WhatsAppConfigurations.Add(new WhatsAppConfiguration
            {
                Id = Guid.NewGuid(),
                SingletonKey = 1,
                IsEnabled = true,
                PhoneNumberId = "phone_111",
                BusinessAccountId = WabaId,
                GraphApiVersion = "v25.0",
                MetaAppId = metaAppId,
                AccessTokenEncrypted = enc.Encrypt(Token),
                InvoiceTemplateName = "e6_carspa_invoice_generated",
                InvoiceTemplateLanguage = "en",
                PaymentCompletedTemplateName = "e6_carspa_payment_completed",
                PaymentCompletedTemplateLanguage = "en_US",
            });
            await db.SaveChangesAsync();
        }
        var meta = new FakeMeta();
        var audit = new RecordingAudit();
        var service = new WhatsAppTemplateProvisioningService(db, new HttpClient(meta), enc, audit,
            NullLogger<WhatsAppTemplateProvisioningService>.Instance);
        return new Env(db, enc, meta, audit, service);
    }

    private static object Remote(ManagedWhatsAppTemplate t, string status, string? rejected = null) =>
        new { name = t.Name, language = t.Language, status, rejected_reason = rejected ?? "NONE" };

    // ── Catalog ─────────────────────────────────────────────────────────────

    [Fact]
    public void Catalog_ResolvesParametersInTemplateOrder_WithSafeFallbacks()
    {
        Assert.True(WhatsAppTemplateCatalog.TryGet("TROVO_PAYMENT_RECEIVED_V1", out var payment));
        Assert.Equal(WhatsAppMessageType.PaymentCompleted, payment.MessageType);
        Assert.False(WhatsAppTemplateCatalog.TryGet("e6_carspa_payment_completed", out _));

        using var snapshot = JsonDocument.Parse("""{"invoiceNumber":"GST/0009","customerName":"Ravi","paymentReceived":"500.00","balance":""}""");
        Assert.Equal(["Ravi", "500.00", "GST/0009", "0.00"], payment.ResolveParameters(snapshot.RootElement));

        using var invoiceSnapshot = JsonDocument.Parse("""{"customerName":"Ravi","invoiceNumber":"BILL/0002","totalAmount":"1,180.00"}""");
        Assert.Equal(["Ravi", "BILL/0002", "N/A", "1,180.00"],
            WhatsAppTemplateCatalog.InvoiceReady.ResolveParameters(invoiceSnapshot.RootElement));
    }

    [Fact]
    public void Catalog_BodyVariableCountsMatchParameterKeysAndExamples()
    {
        foreach (var t in WhatsAppTemplateCatalog.All)
        {
            var vars = System.Text.RegularExpressions.Regex.Matches(t.BodyText, @"\{\{\d+\}\}").Count;
            Assert.Equal(vars, t.ParameterKeys.Count);
            Assert.Equal(vars, t.BodyExamples.Count);
        }
    }

    // ── Status ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Status_WhenNotConfigured_ReportsNotCreatedWithoutCallingMeta()
    {
        var env = await CreateAsync(configured: false);
        var result = await env.Service.GetManagedTemplatesAsync();

        Assert.False(result.IsSuccess);
        Assert.All(result.Templates, t => Assert.Equal("NOT_CREATED", t.Status));
        Assert.Empty(env.Meta.Calls);
    }

    [Fact]
    public async Task Status_MapsMetaStatus_RejectionReason_ActiveFlag_AndCanActivate()
    {
        var env = await CreateAsync();
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.InvoiceReady, "REJECTED", "INVALID_FORMAT"));

        var result = await env.Service.GetManagedTemplatesAsync();

        Assert.True(result.IsSuccess);
        Assert.False(result.CanActivate);
        var invoice = result.Templates.Single(t => t.Name == WhatsAppTemplateCatalog.InvoiceReady.Name);
        Assert.Equal("REJECTED", invoice.Status);
        Assert.Equal("INVALID_FORMAT", invoice.RejectedReason);
        Assert.False(invoice.IsActive);
        Assert.Equal("NOT_CREATED", result.Templates.Single(t => t.Name == WhatsAppTemplateCatalog.PaymentReceived.Name).Status);

        env.Meta.Templates.Clear();
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.InvoiceReady, "APPROVED"));
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.PaymentReceived, "APPROVED"));
        Assert.True((await env.Service.GetManagedTemplatesAsync()).CanActivate);
    }

    // ── Provision ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Provision_UploadsSamplePdf_AndCreatesBothTemplates()
    {
        var env = await CreateAsync();

        var result = await env.Service.ProvisionAsync();

        Assert.True(result.IsSuccess);
        Assert.All(result.Results, r => Assert.Equal("Created", r.Outcome));

        // Resumable upload: session on the app, then the bytes with OAuth auth and file_offset 0.
        var start = env.Meta.Calls.Single(c => c.Url.Contains($"/{AppId}/uploads"));
        Assert.Contains("file_type=application/pdf", start.Url);
        var upload = env.Meta.Calls.Single(c => c.Url.Contains("/upload:session_1"));
        Assert.Equal($"OAuth {Token}", upload.Authorization);
        Assert.Equal("0", upload.FileOffset);
        Assert.StartsWith("%PDF", upload.Body);

        var creates = env.Meta.Calls.Where(c => c.Method == HttpMethod.Post && c.Url.EndsWith($"/{WabaId}/message_templates")).ToList();
        Assert.Equal(2, creates.Count);

        using var invoiceDoc = JsonDocument.Parse(creates.Single(c => c.Body.Contains(WhatsAppTemplateCatalog.InvoiceReady.Name)).Body);
        var inv = invoiceDoc.RootElement;
        Assert.Equal("UTILITY", inv.GetProperty("category").GetString());
        Assert.Equal("en", inv.GetProperty("language").GetString());
        var header = inv.GetProperty("components")[0];
        Assert.Equal("DOCUMENT", header.GetProperty("format").GetString());
        Assert.Equal("handle_abc", header.GetProperty("example").GetProperty("header_handle")[0].GetString());
        var body = inv.GetProperty("components")[1];
        Assert.Equal(WhatsAppTemplateCatalog.InvoiceReady.BodyText, body.GetProperty("text").GetString());
        Assert.Equal(4, body.GetProperty("example").GetProperty("body_text")[0].GetArrayLength());

        using var paymentDoc = JsonDocument.Parse(creates.Single(c => c.Body.Contains(WhatsAppTemplateCatalog.PaymentReceived.Name)).Body);
        var paymentComponents = paymentDoc.RootElement.GetProperty("components");
        Assert.Equal(1, paymentComponents.GetArrayLength());
        Assert.Equal("BODY", paymentComponents[0].GetProperty("type").GetString());

        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.WhatsAppTemplatesProvisioned && e.Outcome == "Success");
    }

    [Fact]
    public async Task Provision_SkipsTemplatesThatAlreadyExist()
    {
        var env = await CreateAsync();
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.InvoiceReady, "PENDING"));
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.PaymentReceived, "APPROVED"));

        var result = await env.Service.ProvisionAsync();

        Assert.True(result.IsSuccess);
        Assert.All(result.Results, r => Assert.Equal("AlreadyExists", r.Outcome));
        Assert.DoesNotContain(env.Meta.Calls, c => c.Method == HttpMethod.Post);
    }

    [Fact]
    public async Task Provision_WithoutAppId_FailsOnlyTheDocumentTemplate()
    {
        var env = await CreateAsync(metaAppId: null);

        var result = await env.Service.ProvisionAsync();

        Assert.False(result.IsSuccess);
        var invoice = result.Results.Single(r => r.Name == WhatsAppTemplateCatalog.InvoiceReady.Name);
        Assert.Equal("Failed", invoice.Outcome);
        Assert.Contains("Meta App ID", invoice.Error);
        Assert.Equal("Created", result.Results.Single(r => r.Name == WhatsAppTemplateCatalog.PaymentReceived.Name).Outcome);
        Assert.DoesNotContain(env.Meta.Calls, c => c.Url.Contains("/uploads"));
        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.WhatsAppTemplatesProvisioned && e.Outcome == "Failure");
    }

    [Fact]
    public async Task Provision_MetaError_IsReported_WithoutLeakingTheToken()
    {
        var env = await CreateAsync();
        env.Meta.CreateStatus = HttpStatusCode.BadRequest;
        env.Meta.CreateErrorBody = JsonSerializer.Serialize(new
        {
            error = new { message = $"Invalid parameter for token {Token}", type = "OAuthException", code = 100 },
        });

        var result = await env.Service.ProvisionAsync();

        Assert.False(result.IsSuccess);
        Assert.All(result.Results, r =>
        {
            Assert.Equal("Failed", r.Outcome);
            Assert.False(string.IsNullOrWhiteSpace(r.Error));
            Assert.DoesNotContain(Token, r.Error);
        });
        Assert.DoesNotContain(Token, result.Message);
        Assert.All(env.Audit.Entries, e => Assert.DoesNotContain(Token, e.NewValues ?? string.Empty));
    }

    // ── Activate ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Activate_IsRefused_UntilBothTemplatesAreApproved()
    {
        var env = await CreateAsync();
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.InvoiceReady, "APPROVED"));
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.PaymentReceived, "PENDING"));

        var result = await env.Service.ActivateAsync();

        Assert.False(result.IsSuccess);
        Assert.Contains(WhatsAppTemplateCatalog.PaymentReceived.Name, result.Message);
        var config = await env.Db.WhatsAppConfigurations.AsNoTracking().SingleAsync();
        Assert.Equal("e6_carspa_invoice_generated", config.InvoiceTemplateName);
        Assert.Equal("e6_carspa_payment_completed", config.PaymentCompletedTemplateName);
        Assert.DoesNotContain(env.Audit.Entries, e => e.Action == AuditActions.WhatsAppTemplatesActivated);
    }

    [Fact]
    public async Task Activate_WhenApproved_SwitchesConfiguration_AndIsAudited()
    {
        var env = await CreateAsync();
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.InvoiceReady, "APPROVED"));
        env.Meta.Templates.Add(Remote(WhatsAppTemplateCatalog.PaymentReceived, "APPROVED"));

        var result = await env.Service.ActivateAsync();

        Assert.True(result.IsSuccess);
        var config = await env.Db.WhatsAppConfigurations.AsNoTracking().SingleAsync();
        Assert.Equal(WhatsAppTemplateCatalog.InvoiceReady.Name, config.InvoiceTemplateName);
        Assert.Equal("en", config.InvoiceTemplateLanguage);
        Assert.Equal(WhatsAppTemplateCatalog.PaymentReceived.Name, config.PaymentCompletedTemplateName);
        Assert.Equal("en", config.PaymentCompletedTemplateLanguage);
        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.WhatsAppTemplatesActivated);
        Assert.All((await env.Service.GetManagedTemplatesAsync()).Templates, t => Assert.True(t.IsActive));
    }

    // ── Sending with a managed template ─────────────────────────────────────

    [Fact]
    public async Task PaymentMessage_WithManagedTemplate_SendsParametersInCatalogOrder()
    {
        var env = await CreateAsync();
        var config = await env.Db.WhatsAppConfigurations.SingleAsync();
        config.PaymentCompletedTemplateName = WhatsAppTemplateCatalog.PaymentReceived.Name;
        config.PaymentCompletedTemplateLanguage = "en";

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Ravi Kumar", PhoneNumber = "9876543210" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), RegistrationNumber = "TN33AB1234", Make = "Hyundai", Model = "i20", CustomerId = customer.Id };
        var jobCard = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-1", CustomerId = customer.Id, VehicleId = vehicle.Id, Status = JobCardStatus.Ready };
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(), InvoiceNumber = "GST/0009", CustomerId = customer.Id, VehicleId = vehicle.Id, JobCardId = jobCard.Id,
            TotalAmount = 5000m, PaidAmount = 5000m, BalanceAmount = 0m, Status = InvoiceStatus.Paid,
        };
        env.Db.AddRange(customer, vehicle, jobCard, invoice);
        await env.Db.SaveChangesAsync();

        // Meta template listing used by the sender (body variables parsed from the text).
        env.Meta.Templates.Add(new
        {
            id = "tpl_pay",
            name = WhatsAppTemplateCatalog.PaymentReceived.Name,
            language = "en",
            status = "APPROVED",
            category = "UTILITY",
            components = new object[] { new { type = "BODY", text = WhatsAppTemplateCatalog.PaymentReceived.BodyText } },
        });

        var sender = new WhatsAppService(env.Db, new HttpClient(env.Meta), env.Enc, env.Audit,
            new ConfigurationBuilder().Build(), NullLogger<WhatsAppService>.Instance);
        var queued = await sender.QueuePaymentCompletedNotificationAsync(invoice.Id, 5000m);
        Assert.NotNull(queued);

        Assert.True(await sender.ProcessMessageAsync(queued.Id));

        var send = env.Meta.Calls.Single(c => c.Method == HttpMethod.Post && c.Url.EndsWith("/messages"));
        using var doc = JsonDocument.Parse(send.Body);
        var template = doc.RootElement.GetProperty("template");
        Assert.Equal(WhatsAppTemplateCatalog.PaymentReceived.Name, template.GetProperty("name").GetString());
        var parameters = template.GetProperty("components")[0].GetProperty("parameters");
        Assert.Equal(["Ravi Kumar", "5,000.00", "GST/0009", "0.00"],
            parameters.EnumerateArray().Select(p => p.GetProperty("text").GetString()!).ToArray());
    }

    // ── Authorization ───────────────────────────────────────────────────────

    [Theory]
    [InlineData(nameof(WhatsAppSettingsController.GetManagedTemplates), "settings.view")]
    [InlineData(nameof(WhatsAppSettingsController.ProvisionManagedTemplates), "settings.business")]
    [InlineData(nameof(WhatsAppSettingsController.ActivateManagedTemplates), "settings.business")]
    public void Endpoints_RequireTheExpectedPermission(string action, string permission)
    {
        var attribute = typeof(WhatsAppSettingsController).GetMethod(action)!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal(RequirePermissionAttribute.PolicyPrefix + permission, attribute.Policy);
    }
}
