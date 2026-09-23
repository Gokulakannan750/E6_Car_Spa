using CarSpaManagement.Api.Application.DTOs.StaffSalary;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IStaffSalaryService
{
    Task<StaffSalaryRosterResponse> GetSalaryRosterAsync(
        DateTime fromDate,
        DateTime toDate,
        Guid? staffId = null,
        string? status = null,
        string? search = null,
        CancellationToken cancellationToken = default);

    Task<StaffSalaryPreviewResponse> GetSalaryPreviewAsync(
        Guid staffId,
        DateTime fromDate,
        DateTime toDate,
        decimal enteredSalary,
        CancellationToken cancellationToken = default);

    Task<StaffSalaryItemDto> SaveEnteredSalaryAsync(
        SaveEnteredSalaryRequest request,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<StaffSalarySettlementDto> SettleSalaryAsync(
        SettleStaffSalaryRequest request,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<StaffSalarySettlementDto>> GetSettlementHistoryAsync(
        Guid staffId,
        CancellationToken cancellationToken = default);
}
