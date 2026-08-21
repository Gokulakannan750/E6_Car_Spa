using CarSpaManagement.Api.Application.DTOs.Services;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IServiceService
{
 Task<ServiceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<ServiceDto>> GetAllAsync(bool? isActive = null, int page = 1, int pageSize = 50, string? search = null, string? category = null, CancellationToken cancellationToken = default);
 Task<int> GetTotalCountAsync(bool? isActive = null, string? search = null, string? category = null, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<string>> GetCategoriesAsync(CancellationToken cancellationToken = default);
 Task<ServiceDto> CreateAsync(CreateServiceRequest request, CancellationToken cancellationToken = default);
 Task<ServiceDto?> UpdateAsync(Guid id, UpdateServiceRequest request, CancellationToken cancellationToken = default);
 Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
 Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken cancellationToken = default);
}
