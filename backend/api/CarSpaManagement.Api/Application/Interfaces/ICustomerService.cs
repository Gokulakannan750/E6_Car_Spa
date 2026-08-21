using CarSpaManagement.Api.Application.DTOs.Customers;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface ICustomerService
{
 Task<CustomerDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
 Task<CustomerDto?> GetByPhoneAsync(string phoneNumber, CancellationToken cancellationToken = default);
 Task<CustomerDto?> GetByRegistrationAsync(string registrationNumber, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<CustomerDto>> GetAllAsync(int page, int pageSize, string? search = null, CancellationToken cancellationToken = default);
 Task<int> GetTotalCountAsync(string? search = null, CancellationToken cancellationToken = default);
 Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken cancellationToken = default);
 Task<CustomerDto?> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken = default);
 Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
 Task<bool> PhoneExistsAsync(string phoneNumber, Guid? excludeId = null, CancellationToken cancellationToken = default);
 Task<CustomerHistoryResponse> GetHistoryAsync(Guid customerId, CancellationToken cancellationToken = default);
}
