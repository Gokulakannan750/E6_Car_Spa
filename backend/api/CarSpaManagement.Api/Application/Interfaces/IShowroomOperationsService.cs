using CarSpaManagement.Api.Application.DTOs.Showrooms;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IShowroomOperationsService
{
    // ── Vehicle Types ───────────────────────────────────────────────────────
    Task<IReadOnlyList<ShowroomVehicleTypeDto>> GetVehicleTypesAsync(bool? isActive = null, CancellationToken ct = default);
    Task<ShowroomVehicleTypeDto?> GetVehicleTypeByIdAsync(Guid id, CancellationToken ct = default);
    Task<ShowroomVehicleTypeDto> CreateVehicleTypeAsync(CreateShowroomVehicleTypeRequest request, CancellationToken ct = default);
    Task<ShowroomVehicleTypeDto?> UpdateVehicleTypeAsync(Guid id, UpdateShowroomVehicleTypeRequest request, CancellationToken ct = default);
    Task<bool> ToggleVehicleTypeActiveAsync(Guid id, CancellationToken ct = default);

    // ── Work Types ──────────────────────────────────────────────────────────
    Task<IReadOnlyList<ShowroomWorkTypeDto>> GetWorkTypesAsync(bool? isActive = null, CancellationToken ct = default);
    Task<ShowroomWorkTypeDto?> GetWorkTypeByIdAsync(Guid id, CancellationToken ct = default);
    Task<ShowroomWorkTypeDto> CreateWorkTypeAsync(CreateShowroomWorkTypeRequest request, CancellationToken ct = default);
    Task<ShowroomWorkTypeDto?> UpdateWorkTypeAsync(Guid id, UpdateShowroomWorkTypeRequest request, CancellationToken ct = default);
    Task<bool> ToggleWorkTypeActiveAsync(Guid id, CancellationToken ct = default);

    // ── Staff Work Sessions ─────────────────────────────────────────────────
    Task<IReadOnlyList<ShowroomStaffWorkSessionDto>> GetWorkSessionsAsync(
        Guid showroomId,
        DateTime? date = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        Guid? staffId = null,
        CancellationToken ct = default);

    Task<ShowroomStaffWorkSessionDto?> GetWorkSessionByIdAsync(Guid showroomId, Guid sessionId, CancellationToken ct = default);
    Task<ShowroomStaffWorkSessionDto> CreateWorkSessionAsync(Guid showroomId, CreateShowroomStaffWorkSessionRequest request, CancellationToken ct = default);
    Task<ShowroomStaffWorkSessionDto?> UpdateWorkSessionAsync(Guid showroomId, Guid sessionId, UpdateShowroomStaffWorkSessionRequest request, CancellationToken ct = default);
    Task<ShowroomStaffWorkSessionDto?> CloseWorkSessionAsync(Guid showroomId, Guid sessionId, CloseShowroomStaffWorkSessionRequest? request = null, CancellationToken ct = default);

    // ── Vehicle Work & Items ────────────────────────────────────────────────
    Task<IReadOnlyList<ShowroomVehicleWorkDto>> GetVehicleWorksAsync(
        Guid showroomId,
        DateTime? date = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        Guid? staffId = null,
        Guid? vehicleTypeId = null,
        CancellationToken ct = default);

    Task<ShowroomVehicleWorkDto?> GetVehicleWorkByIdAsync(Guid showroomId, Guid id, CancellationToken ct = default);
    Task<ShowroomVehicleWorkDto> CreateVehicleWorkAsync(Guid showroomId, CreateShowroomVehicleWorkRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ShowroomVehicleWorkDto>> CreateBatchVehicleWorkAsync(Guid showroomId, CreateBatchShowroomVehicleWorkRequest request, CancellationToken ct = default);
    Task<ShowroomVehicleWorkDto?> UpdateVehicleWorkAsync(Guid showroomId, Guid id, UpdateShowroomVehicleWorkRequest request, CancellationToken ct = default);

    // ── Operations Summary ──────────────────────────────────────────────────
    Task<ShowroomOperationsSummaryDto> GetOperationsSummaryAsync(Guid showroomId, DateTime fromDate, DateTime toDate, CancellationToken ct = default);

    // ── Staff Default Showroom ──────────────────────────────────────────────
    Task<StaffDefaultShowroomDto?> GetStaffDefaultShowroomAsync(Guid staffId, CancellationToken ct = default);
    Task<StaffDefaultShowroomDto> SetStaffDefaultShowroomAsync(Guid staffId, Guid? defaultShowroomId, CancellationToken ct = default);
}
