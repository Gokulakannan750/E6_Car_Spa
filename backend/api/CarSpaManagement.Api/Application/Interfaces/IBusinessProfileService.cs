using CarSpaManagement.Api.Application.DTOs.Settings;
using Microsoft.AspNetCore.Http;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IBusinessProfileService
{
    Task<BusinessProfileDto> GetProfileAsync(CancellationToken ct = default);
    Task<BusinessProfileDto> UpdateProfileAsync(UpdateBusinessProfileRequest request, CancellationToken ct = default);
    Task<LogoUploadResponse> UploadLogoAsync(IFormFile file, CancellationToken ct = default);
    Task<BusinessProfileDto> RemoveLogoAsync(CancellationToken ct = default);
}
