using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Tests.TestSupport;

/// <summary>Audit log double that records actions so tests can assert security events were logged.</summary>
internal sealed class RecordingAuditLogService : IAuditLogService
{
    public List<(string Action, string Module, Guid? EntityId, string Outcome)> Entries { get; } = new();

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
        lock (Entries) Entries.Add((action, module, entityId, outcome));
        return Task.CompletedTask;
    }

    public Task<PagedResult<AuditLogDto>> GetLogsAsync(AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
        throw new NotImplementedException();
}

internal sealed class NoopWhatsAppService : IWhatsAppService
{
    public Task<WhatsAppConfigResponse> GetConfigurationAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(new WhatsAppConfigResponse(false, "", "", "v25.0", false, false, false, "", "en", "", "en", DateTime.UtcNow));
    public Task<WhatsAppConfigResponse> UpdateConfigurationAsync(UpdateWhatsAppConfigRequest request, Guid? userId = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
    public Task<TestWhatsAppConnectionResponse> TestConnectionAsync(TestWhatsAppConnectionRequest? request = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
    public Task<WhatsAppMessage?> QueueInvoiceFinalizedNotificationAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult<WhatsAppMessage?>(null);
    public Task<WhatsAppMessage?> QueuePaymentCompletedNotificationAsync(Guid invoiceId, decimal paymentAmount, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default) => Task.FromResult<WhatsAppMessage?>(null);
    public Task<IReadOnlyList<InvoiceWhatsAppStatusDto>> GetInvoiceWhatsAppStatusAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<InvoiceWhatsAppStatusDto>>(new List<InvoiceWhatsAppStatusDto>());
    public Task<MetaWhatsAppTemplatesResponse> GetMetaTemplatesAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
    public Task<SendTestWhatsAppMessageResponse> SendTestTemplateMessageAsync(SendTestWhatsAppMessageRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
    public Task<bool> ProcessMessageAsync(Guid messageId, CancellationToken cancellationToken = default) => Task.FromResult(true);
    public Task ProcessPendingMessagesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppMessageLogResponse> GetMessageLogAsync(string? status = null, int? year = null, int? month = null, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default) =>
        Task.FromResult(new CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppMessageLogResponse(Array.Empty<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppMessageLogItemDto>(), 0, page, pageSize));

    public Task<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageResponse> GetUsageAsync(int months = 6, CancellationToken cancellationToken = default) =>
        Task.FromResult(new CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageResponse(Array.Empty<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageMonthDto>()));

    public Task<WhatsAppHealthDto> GetHealthStatusAsync(bool forceProbe = false, CancellationToken cancellationToken = default) =>
        Task.FromResult(new WhatsAppHealthDto(WhatsAppHealthStatus.NotConfigured.ToString(), null, null, null, null, false));
    public Task ProbeHealthAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    public string? NormalizePhoneNumber(string? phone) => phone;
}
