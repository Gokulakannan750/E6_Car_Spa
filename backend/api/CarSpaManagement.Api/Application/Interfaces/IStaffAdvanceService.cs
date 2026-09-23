using CarSpaManagement.Api.Application.DTOs.StaffAdvances;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IStaffAdvanceService
{
    Task<StaffAdvanceListResponse> GetAllAsync(int page, int pageSize, Guid? staffId = null, string? status = null, DateTime? fromDate = null, DateTime? toDate = null, string? search = null, CancellationToken cancellationToken = default);
    Task<StaffAdvanceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<StaffAdvanceDto> CreateAsync(CreateStaffAdvanceRequest request, CancellationToken cancellationToken = default);
    Task<StaffAdvanceDto> SettleAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);
    Task<StaffAdvanceDto> ObsoleteAsync(Guid id, ObsoleteStaffAdvanceRequest request, Guid userId, CancellationToken cancellationToken = default);
    Task<StaffAdvanceHistoryDto> GetStaffAdvanceHistoryAsync(Guid staffId, CancellationToken cancellationToken = default);

    // Staff directory management
    Task<IReadOnlyList<StaffDto>> GetStaffAsync(CancellationToken cancellationToken = default);
    Task<StaffDto?> GetStaffByIdAsync(Guid staffId, CancellationToken cancellationToken = default);
    Task<StaffDto> CreateStaffMemberAsync(CreateStaffRequest request, CancellationToken cancellationToken = default);
    Task<StaffDto?> UpdateStaffMemberAsync(Guid staffId, UpdateStaffRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteStaffMemberAsync(Guid staffId, CancellationToken cancellationToken = default);

    // Staff Aadhaar management
    Task<StaffAadhaarRevealDto?> RevealStaffAadhaarAsync(Guid staffId, Guid requestingUserId, CancellationToken cancellationToken = default);
    Task<(byte[] Bytes, string ContentType, string FileName)?> GetStaffAadhaarDocumentAsync(Guid staffId, Guid requestingUserId, CancellationToken cancellationToken = default);
    Task<StaffDto?> UploadStaffAadhaarDocumentAsync(Guid staffId, Microsoft.AspNetCore.Http.IFormFile file, Guid requestingUserId, CancellationToken cancellationToken = default);
    Task<StaffDto?> DeleteStaffAadhaarDocumentAsync(Guid staffId, Guid requestingUserId, CancellationToken cancellationToken = default);
}
