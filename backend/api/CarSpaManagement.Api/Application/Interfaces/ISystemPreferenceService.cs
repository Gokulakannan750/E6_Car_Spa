using CarSpaManagement.Api.Application.DTOs.Settings;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface ISystemPreferenceService
{
    Task<SystemPreferenceDto> GetPreferencesAsync(CancellationToken ct = default);
    Task<SystemPreferenceDto> UpdatePreferencesAsync(UpdateSystemPreferenceRequest request, Guid? userId = null, CancellationToken ct = default);
}
