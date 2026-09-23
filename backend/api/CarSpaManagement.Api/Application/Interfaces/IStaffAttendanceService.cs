using CarSpaManagement.Api.Application.DTOs.StaffAttendance;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IStaffAttendanceService
{
    Task<DailyAttendanceResponse> GetDailyAttendanceAsync(DateTime date, CancellationToken ct = default);

    Task<DateRangeAttendanceResponse> GetDateRangeAttendanceAsync(
        DateTime fromDate,
        DateTime toDate,
        Guid? staffId = null,
        string? status = null,
        string? search = null,
        CancellationToken ct = default);

    Task<MonthlyAttendanceReportResponse> GetMonthlyAttendanceReportAsync(
        int year,
        int month,
        Guid? staffId = null,
        string? status = null,
        string? search = null,
        CancellationToken ct = default);

    Task<StaffAttendanceDto> UpsertAttendanceAsync(UpsertStaffAttendanceRequest request, Guid userId, bool isOwner = false, CancellationToken ct = default);

    Task<bool> DeleteAttendanceAsync(Guid id, Guid userId, bool isOwner = false, CancellationToken ct = default);

    Task<DailyAttendanceResponse> ConfirmAttendanceAsync(DateTime date, Guid userId, CancellationToken ct = default);

    Task<DailyAttendanceResponse> UnlockAttendanceAsync(DateTime date, Guid userId, bool isOwner, CancellationToken ct = default);
}
