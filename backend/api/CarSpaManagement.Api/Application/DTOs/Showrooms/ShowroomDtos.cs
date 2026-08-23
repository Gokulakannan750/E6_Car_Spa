using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Showrooms;

public record ShowroomDto(
    Guid Id,
    string Name,
    string Address,
    string? Phone,
    bool IsActive,
    int ActiveStaffCountToday,
    int TotalVehiclesToday,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateShowroomRequest
{
    [Required, MaxLength(150)]
    public string Name { get; init; } = string.Empty;

    [Required, MaxLength(500)]
    public string Address { get; init; } = string.Empty;

    [MaxLength(20)]
    public string? Phone { get; init; }

    public bool IsActive { get; init; } = true;
}

public record UpdateShowroomRequest
{
    [MaxLength(150)]
    public string? Name { get; init; }

    [MaxLength(500)]
    public string? Address { get; init; }

    [MaxLength(20)]
    public string? Phone { get; init; }

    public bool? IsActive { get; init; }
}

public record DailyStaffAssignmentDto(
    Guid Id,
    Guid ShowroomId,
    string ShowroomName,
    Guid StaffId,
    string StaffName,
    string StaffPhone,
    string? StaffRole,
    DateTime Date,
    int VehiclesAttended,
    DateTime CreatedAt);

public record DailyStaffResponse(
    Guid ShowroomId,
    string ShowroomName,
    DateTime Date,
    int TotalVehiclesAttended,
    IReadOnlyList<DailyStaffAssignmentDto> StaffAssignments);

public record CreateDailyStaffAssignmentRequest
{
    [Required]
    public Guid StaffId { get; init; }

    [Required]
    public DateTime Date { get; init; }

    [Range(0, 99999)]
    public int VehiclesAttended { get; init; } = 0;
}

public record UpdateDailyStaffAssignmentRequest
{
    [Range(0, 99999)]
    public int VehiclesAttended { get; init; }
}
