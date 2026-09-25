using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Showrooms;

// ── Showroom Vehicle Types ──────────────────────────────────────────────────

public record ShowroomVehicleTypeDto(
    Guid Id,
    string Code,
    string Name,
    int DisplayOrder,
    bool IsActive,
    DateTime CreatedAt);

public record CreateShowroomVehicleTypeRequest
{
    [Required, MaxLength(50)]
    public string Code { get; init; } = string.Empty;

    [Required, MaxLength(100)]
    public string Name { get; init; } = string.Empty;

    public int DisplayOrder { get; init; } = 0;

    public bool IsActive { get; init; } = true;
}

public record UpdateShowroomVehicleTypeRequest
{
    [MaxLength(50)]
    public string? Code { get; init; }

    [MaxLength(100)]
    public string? Name { get; init; }

    public int? DisplayOrder { get; init; }

    public bool? IsActive { get; init; }
}

// ── Showroom Work Types ─────────────────────────────────────────────────────

public record ShowroomWorkTypeDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    int DisplayOrder,
    bool IsActive,
    DateTime CreatedAt);

public record CreateShowroomWorkTypeRequest
{
    [Required, MaxLength(50)]
    public string Code { get; init; } = string.Empty;

    [Required, MaxLength(100)]
    public string Name { get; init; } = string.Empty;

    [MaxLength(255)]
    public string? Description { get; init; }

    public int DisplayOrder { get; init; } = 0;

    public bool IsActive { get; init; } = true;
}

public record UpdateShowroomWorkTypeRequest
{
    [MaxLength(50)]
    public string? Code { get; init; }

    [MaxLength(100)]
    public string? Name { get; init; }

    [MaxLength(255)]
    public string? Description { get; init; }

    public int? DisplayOrder { get; init; }

    public bool? IsActive { get; init; }
}

// ── Showroom Staff Work Sessions ────────────────────────────────────────────

public record ShowroomStaffWorkSessionDto(
    Guid Id,
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    string? StaffPhone,
    string? StaffRole,
    Guid HomeShowroomId,
    string HomeShowroomMasterId,
    string HomeShowroomName,
    Guid WorkingShowroomId,
    string WorkingShowroomMasterId,
    string WorkingShowroomName,
    DateTime Date,
    ShowroomStaffSessionType SessionType,
    string SessionTypeName,
    StaffAttendanceStatus AttendanceStatus,
    string AttendanceStatusName,
    string? StartTime,
    string? EndTime,
    string? TransferReason,
    string? Notes,
    int VehicleWorkCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateShowroomStaffWorkSessionRequest
{
    [Required]
    public Guid StaffId { get; init; }

    public Guid? HomeShowroomId { get; init; }

    [Required]
    public DateTime Date { get; init; }

    public ShowroomStaffSessionType SessionType { get; init; } = ShowroomStaffSessionType.FullDay;

    public StaffAttendanceStatus AttendanceStatus { get; init; } = StaffAttendanceStatus.Present;

    [MaxLength(10)]
    public string? StartTime { get; init; }

    [MaxLength(10)]
    public string? EndTime { get; init; }

    [MaxLength(255)]
    public string? TransferReason { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record UpdateShowroomStaffWorkSessionRequest
{
    public ShowroomStaffSessionType? SessionType { get; init; }

    public StaffAttendanceStatus? AttendanceStatus { get; init; }

    [MaxLength(10)]
    public string? StartTime { get; init; }

    [MaxLength(10)]
    public string? EndTime { get; init; }

    [MaxLength(255)]
    public string? TransferReason { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record CloseShowroomStaffWorkSessionRequest
{
    [MaxLength(10)]
    public string? EndTime { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }
}

// ── Showroom Vehicle Work & Work Items ──────────────────────────────────────

public record ShowroomVehicleWorkItemDto(
    Guid Id,
    Guid ShowroomVehicleWorkId,
    Guid WorkTypeId,
    string WorkTypeCode,
    string WorkTypeName,
    int Quantity,
    string? Notes,
    DateTime CreatedAt);

public record CreateShowroomVehicleWorkItemRequest
{
    [Required]
    public Guid WorkTypeId { get; init; }

    [Range(1, 9999)]
    public int Quantity { get; init; } = 1;

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record ShowroomVehicleWorkDto(
    Guid Id,
    Guid ShowroomId,
    string ShowroomMasterId,
    string ShowroomName,
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    Guid VehicleTypeId,
    string VehicleTypeCode,
    string VehicleTypeName,
    Guid? ShowroomStaffWorkSessionId,
    int VehicleQuantity,
    DateTime Date,
    string? TimeRecorded,
    string? Notes,
    IReadOnlyList<ShowroomVehicleWorkItemDto> ServiceItems,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateShowroomVehicleWorkRequest
{
    [Required]
    public Guid StaffId { get; init; }

    [Required]
    public Guid VehicleTypeId { get; init; }

    public Guid? ShowroomStaffWorkSessionId { get; init; }

    [Range(1, 9999)]
    public int VehicleQuantity { get; init; } = 1;

    [Required]
    public DateTime Date { get; init; }

    [MaxLength(10)]
    public string? TimeRecorded { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }

    public List<CreateShowroomVehicleWorkItemRequest>? ServiceItems { get; init; }
}

public record UpdateShowroomVehicleWorkRequest
{
    public Guid? StaffId { get; init; }

    public Guid? VehicleTypeId { get; init; }

    public Guid? ShowroomStaffWorkSessionId { get; init; }

    [Range(1, 9999)]
    public int? VehicleQuantity { get; init; }

    public DateTime? Date { get; init; }

    [MaxLength(10)]
    public string? TimeRecorded { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }

    public List<CreateShowroomVehicleWorkItemRequest>? ServiceItems { get; init; }
}

public record IndividualVehicleWorkEntry
{
    [Required]
    public Guid VehicleTypeId { get; init; }

    [Required, MinLength(1)]
    public List<Guid> WorkTypeIds { get; init; } = new();

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record CreateBatchShowroomVehicleWorkRequest
{
    [Required]
    public Guid StaffId { get; init; }

    public Guid? ShowroomStaffWorkSessionId { get; init; }

    [Required]
    public DateTime Date { get; init; }

    [MaxLength(10)]
    public string? TimeRecorded { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }

    [Required, MinLength(1)]
    public List<IndividualVehicleWorkEntry> Vehicles { get; init; } = new();
}

// ── Showroom Operations Aggregates & Summaries ──────────────────────────────

public record VehicleTypeWorkSummaryDto(
    Guid VehicleTypeId,
    string VehicleTypeCode,
    string VehicleTypeName,
    int TotalVehicles);

public record WorkTypeWorkSummaryDto(
    Guid WorkTypeId,
    string WorkTypeCode,
    string WorkTypeName,
    int TotalQuantity);

public record StaffWorkSummaryDto(
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    int TotalSessions,
    int TotalVehiclesHandled,
    int TotalServicesPerformed);

public record ShowroomOperationsSummaryDto(
    Guid ShowroomId,
    string ShowroomMasterId,
    string ShowroomName,
    DateTime FromDate,
    DateTime ToDate,
    int TotalVehiclesHandled,
    int TotalServicesPerformed,
    int TotalActiveStaffSessions,
    IReadOnlyList<VehicleTypeWorkSummaryDto> VehicleTypeBreakdown,
    IReadOnlyList<WorkTypeWorkSummaryDto> WorkTypeBreakdown,
    IReadOnlyList<StaffWorkSummaryDto> StaffProductivityBreakdown);

// ── Staff Default Showroom ──────────────────────────────────────────────────

public record StaffDefaultShowroomDto(
    Guid StaffId,
    string StaffMasterId,
    string StaffName,
    Guid? DefaultShowroomId,
    string? DefaultShowroomMasterId,
    string? DefaultShowroomName);

public record SetStaffDefaultShowroomRequest
{
    public Guid? DefaultShowroomId { get; init; }
}
