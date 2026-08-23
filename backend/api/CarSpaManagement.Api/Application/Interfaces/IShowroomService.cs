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

    // Daily Staff Assignment & Attendance Confirmation
    Task<DailyStaffResponse?> GetDailyStaffAsync(Guid showroomId, DateTime date, CancellationToken ct = default);
    Task<DailyStaffResponse> ConfirmAttendanceAsync(Guid showroomId, DateTime date, Guid userId, CancellationToken ct = default);
    Task<DailyStaffResponse> UnlockAttendanceAsync(Guid showroomId, DateTime date, Guid userId, bool isOwner, CancellationToken ct = default);
    Task<DailyStaffAssignmentDto> AssignStaffAsync(Guid showroomId, CreateDailyStaffAssignmentRequest request, bool isOwner = false, CancellationToken ct = default);
    Task<DailyStaffAssignmentDto?> UpdateAssignmentVehiclesAsync(Guid assignmentId, int vehiclesAttended, bool isOwner = false, CancellationToken ct = default);
    Task<bool> RemoveAssignmentAsync(Guid assignmentId, bool isOwner = false, CancellationToken ct = default);

    // Daily Showroom Billing & Payments
    Task<ShowroomDailyBillDto?> GetDailyBillAsync(Guid showroomId, DateTime date, CancellationToken ct = default);
    Task<ShowroomDailyBillDto> SetDailyBillAsync(Guid showroomId, DateTime date, SetShowroomDailyBillRequest request, CancellationToken ct = default);
    Task<ShowroomDailyBillDto> RecordPaymentAsync(Guid showroomId, DateTime date, RecordShowroomPaymentRequest request, CancellationToken ct = default);
    Task<bool> DeletePaymentAsync(Guid paymentId, CancellationToken ct = default);

    // History & Financial Summary
    Task<ShowroomSummaryDto?> GetShowroomSummaryAsync(Guid showroomId, DateTime fromDate, DateTime toDate, CancellationToken ct = default);
    Task<IReadOnlyList<ShowroomOutstandingOverviewDto>> GetOutstandingOverviewAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default);
}
