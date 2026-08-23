using CarSpaManagement.Api.Application.DTOs;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IAuthService
{
    Task<AuthStatusDto> GetStatusAsync(CancellationToken cancellationToken = default);
    Task<AuthUserDto> BootstrapOwnerAsync(BootstrapOwnerRequest request, CancellationToken cancellationToken = default);
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthUserDto> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
