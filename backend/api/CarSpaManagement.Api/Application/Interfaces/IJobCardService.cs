using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IJobCardService
{
 Task<JobCardDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
 Task<JobCardPrintDto?> GetForPrintAsync(Guid id, CancellationToken cancellationToken = default);
 Task<JobCardDto?> GetByNumberAsync(string jobCardNumber, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<JobCardListDto>> GetAllAsync(int page, int pageSize, JobCardStatus? status = null, Guid? customerId = null, Guid? vehicleId = null, string? search = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default);
 Task<int> GetTotalCountAsync(JobCardStatus? status = null, Guid? customerId = null, Guid? vehicleId = null, string? search = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<JobCardListDto>> GetByCustomerIdAsync(Guid customerId, int page, int pageSize, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<JobCardListDto>> GetByVehicleIdAsync(Guid vehicleId, int page, int pageSize, CancellationToken cancellationToken = default);
 Task<JobCardDto> CreateAsync(CreateJobCardRequest request, CancellationToken cancellationToken = default);
 Task<JobCardDto?> UpdateServicesAsync(Guid id, UpdateJobCardServicesRequest request, CancellationToken cancellationToken = default);
 Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
