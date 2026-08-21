using CarSpaManagement.Api.Application.DTOs.StaffAdvances;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IStaffAdvanceService
{
 Task<IReadOnlyList<StaffAdvanceDto>> GetAllAsync(int page, int pageSize, Guid? staffId = null, string? status = null, DateTime? fromDate = null, DateTime? toDate = null, string? search = null, CancellationToken cancellationToken = default);
 Task<int> GetTotalCountAsync(Guid? staffId = null, string? status = null, DateTime? fromDate = null, DateTime? toDate = null, string? search = null, CancellationToken cancellationToken = default);
 Task<StaffAdvanceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
 Task<StaffAdvanceDto> CreateAsync(CreateStaffAdvanceRequest request, CancellationToken cancellationToken = default);
 Task<StaffAdvanceDto?> UpdateAsync(Guid id, UpdateStaffAdvanceRequest request, CancellationToken cancellationToken = default);
 Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<StaffDto>> GetStaffAsync(CancellationToken cancellationToken = default);
 Task<StaffDto?> GetStaffByIdAsync(Guid staffId, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<StaffAdvanceDto>> GetByStaffIdAsync(Guid staffId, CancellationToken cancellationToken = default);
}
