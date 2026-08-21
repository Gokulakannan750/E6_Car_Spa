using CarSpaManagement.Api.Application.DTOs.Vehicles;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IVehicleService
{
 Task<VehicleDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<VehicleDto>> GetByCustomerIdAsync(Guid customerId, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<VehicleDto>> GetAllAsync(int page, int pageSize, string? search = null, CancellationToken cancellationToken = default);
 Task<int> GetTotalCountAsync(string? search = null, CancellationToken cancellationToken = default);
 Task<VehicleDto> CreateAsync(CreateVehicleRequest request, CancellationToken cancellationToken = default);
 Task<VehicleDto?> UpdateAsync(Guid id, UpdateVehicleRequest request, CancellationToken cancellationToken = default);
 Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
 Task<bool> RegistrationNumberExistsAsync(string registrationNumber, Guid? excludeId = null, CancellationToken cancellationToken = default);
}
