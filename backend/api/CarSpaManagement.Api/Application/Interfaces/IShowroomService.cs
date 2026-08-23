using CarSpaManagement.Api.Application.DTOs.Showrooms;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IShowroomService
{
    // Showroom Master
    Task<IReadOnlyList<ShowroomDto>> GetAllAsync(string? search = null, bool? isActive = null, CancellationToken ct = default);
    Task<ShowroomDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<ShowroomDto> CreateAsync(CreateShowroomRequest request, CancellationToken ct = default);
    Task<ShowroomDto?> UpdateAsync(Guid id, UpdateShowroomRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<bool> ToggleActiveAsync(Guid id, CancellationToken ct = default);

    // Daily Staff Assignment
    Task<DailyStaffResponse?> GetDailyStaffAsync(Guid showroomId, DateTime date, CancellationToken ct = default);
    Task<DailyStaffAssignmentDto> AssignStaffAsync(Guid showroomId, CreateDailyStaffAssignmentRequest request, CancellationToken ct = default);
    Task<DailyStaffAssignmentDto?> UpdateAssignmentVehiclesAsync(Guid assignmentId, int vehiclesAttended, CancellationToken ct = default);
    Task<bool> RemoveAssignmentAsync(Guid assignmentId, CancellationToken ct = default);
}
