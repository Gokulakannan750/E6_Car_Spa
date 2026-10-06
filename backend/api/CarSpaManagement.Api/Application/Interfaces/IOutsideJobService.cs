using CarSpaManagement.Api.Application.DTOs.OutsideJobs;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IOutsideJobService
{
    Task<OutsideJobDto> CreateOutsideJobAsync(Guid jobCardId, CreateOutsideJobRequest request, Guid? userId = null, string? userName = null, CancellationToken cancellationToken = default);
    Task<OutsideJobDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<OutsideJobDto>> GetByJobCardIdAsync(Guid jobCardId, CancellationToken cancellationToken = default);
    Task<OutsideJobListResponse> GetAllAsync(int page, int pageSize, OutsideJobStatus? status = null, bool? isOverdue = null, Guid? vendorId = null, Guid? vehicleId = null, string? search = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default);
    Task<OutsideJobDto> MarkReturnedAsync(Guid id, MarkOutsideJobReturnedRequest request, Guid? userId = null, string? userName = null, CancellationToken cancellationToken = default);
    Task<OutsideJobDto> CancelAsync(Guid id, CancelOutsideJobRequest request, Guid? userId = null, string? userName = null, CancellationToken cancellationToken = default);
    Task<OutsideJobDto?> UpdateAsync(Guid id, UpdateOutsideJobRequest request, CancellationToken cancellationToken = default);
    Task<OutsideJobDto> UpdateCostAsync(Guid id, UpdateOutsideJobCostRequest request, Guid? userId = null, string? userName = null, CancellationToken cancellationToken = default, bool canModifyDraftInvoice = false);
    Task<bool> DeleteAsync(Guid id, Guid? userId = null, string? userName = null, CancellationToken cancellationToken = default, bool canModifyDraftInvoice = false);
    Task<VehicleLocationDto> GetVehicleLocationByJobCardIdAsync(Guid jobCardId, CancellationToken cancellationToken = default);
    Task<VehicleLocationDto> GetVehicleLocationByVehicleIdAsync(Guid vehicleId, CancellationToken cancellationToken = default);
}
