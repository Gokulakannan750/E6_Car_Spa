using CarSpaManagement.Api.Application.DTOs.WhatsApp;

namespace CarSpaManagement.Api.Application.Interfaces;

/// <summary>Creates and activates the managed WhatsApp template pack on the configured WhatsApp Business Account.</summary>
public interface IWhatsAppTemplateProvisioningService
{
	Task<ManagedWhatsAppTemplatesResponse> GetManagedTemplatesAsync(CancellationToken cancellationToken = default);
	Task<ProvisionManagedTemplatesResponse> ProvisionAsync(CancellationToken cancellationToken = default);
	Task<ActivateManagedTemplatesResponse> ActivateAsync(CancellationToken cancellationToken = default);
}
