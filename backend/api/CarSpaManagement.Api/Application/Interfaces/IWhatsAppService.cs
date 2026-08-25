using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Domain.Entities;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IWhatsAppService
{
	Task<WhatsAppConfigResponse> GetConfigurationAsync(CancellationToken cancellationToken = default);
	Task<WhatsAppConfigResponse> UpdateConfigurationAsync(UpdateWhatsAppConfigRequest request, Guid? userId = null, CancellationToken cancellationToken = default);
	Task<TestWhatsAppConnectionResponse> TestConnectionAsync(TestWhatsAppConnectionRequest? request = null, CancellationToken cancellationToken = default);
	Task<WhatsAppMessage?> QueueInvoiceFinalizedNotificationAsync(Guid invoiceId, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default);
	Task<WhatsAppMessage?> QueuePaymentCompletedNotificationAsync(Guid invoiceId, decimal paymentReceived, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default);
	Task<bool> ProcessMessageAsync(Guid messageId, CancellationToken cancellationToken = default);
	Task ProcessPendingMessagesAsync(CancellationToken cancellationToken = default);
	Task<IReadOnlyList<InvoiceWhatsAppStatusDto>> GetInvoiceWhatsAppStatusAsync(Guid invoiceId, CancellationToken cancellationToken = default);
	string? NormalizePhoneNumber(string? phone);
}
