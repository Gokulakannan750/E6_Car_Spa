using CarSpaManagement.Api.Application.DTOs.Settings;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IInvoiceSeriesService
{
    Task<InvoiceSeriesSettingsDto> GetAsync(CancellationToken cancellationToken = default);
    Task<InvoiceSeriesSettingsDto> UpdatePrefixesAsync(UpdateInvoiceSeriesRequest request, CancellationToken cancellationToken = default);
}
