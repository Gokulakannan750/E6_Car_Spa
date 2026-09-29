using CarSpaManagement.Api.Application.DTOs.Vendors;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IVendorService
{
    Task<IReadOnlyList<VendorDto>> GetAllAsync(bool activeOnly = false, CancellationToken cancellationToken = default);
    Task<VendorDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<VendorDto> CreateAsync(CreateVendorRequest request, CancellationToken cancellationToken = default);
    Task<VendorDto?> UpdateAsync(Guid id, UpdateVendorRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
