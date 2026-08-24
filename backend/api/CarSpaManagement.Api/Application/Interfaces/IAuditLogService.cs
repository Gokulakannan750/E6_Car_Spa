using CarSpaManagement.Api.Application.DTOs.Audit;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IAuditLogService
{
    Task RecordAsync(
        string action,
        string module,
        string description,
        Guid? userId = null,
        string? userName = null,
        string? userRole = null,
        string? entityType = null,
        Guid? entityId = null,
        string? entityReference = null,
        string? oldValues = null,
        string? newValues = null,
        string? metadata = null,
        string outcome = "Success",
        CancellationToken cancellationToken = default);

    Task<PagedResult<AuditLogDto>> GetLogsAsync(
        AuditLogQueryParameters query,
        CancellationToken cancellationToken = default);
}
