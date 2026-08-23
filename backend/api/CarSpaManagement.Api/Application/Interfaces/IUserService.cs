using CarSpaManagement.Api.Application.DTOs;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IUserService
{
    Task<List<UserDto>> GetUsersAsync(CancellationToken cancellationToken = default);
    Task<UserDto> GetUserByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<UserDto> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserDto> UpdateUserAsync(Guid id, UpdateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserDto> ToggleUserStatusAsync(Guid id, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<List<PermissionGroupDto>> GetAvailablePermissionsAsync(CancellationToken cancellationToken = default);
}
