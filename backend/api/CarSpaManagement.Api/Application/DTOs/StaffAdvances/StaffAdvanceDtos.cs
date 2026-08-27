using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.StaffAdvances;

public record StaffAdvanceDto(
    Guid Id,
    Guid StaffId,
    string StaffName,
    string? StaffPhone,
    string? StaffRole,
    decimal Amount,
    DateTime AdvanceDate,
    string Reason,
    string? Notes,
    string Status,
    DateTime? SettledAt,
    Guid? SettledByUserId,
    string? SettledByName,
    DateTime? ObsoletedAt,
    Guid? ObsoletedByUserId,
    string? ObsoletedByName,
    string? ObsoleteReason,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateStaffAdvanceRequest
{
    [Required]
    public Guid StaffId { get; init; }

    [Required, Range(0.01, 999999999.99)]
    public decimal Amount { get; init; }

    [Required]
    public DateTime AdvanceDate { get; init; } = DateTime.UtcNow.Date;

    [Required, MaxLength(200)]
    public string Reason { get; init; } = string.Empty;

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record ObsoleteStaffAdvanceRequest
{
    [Required, MinLength(3), MaxLength(500)]
    public string Reason { get; init; } = string.Empty;
}

public record StaffAdvanceSummaryDto(
    int OutstandingCount,
    decimal OutstandingAmount,
    int SettledCount,
    decimal SettledAmount,
    int TotalActiveCount,
    decimal TotalActiveAmount);

public record StaffAdvanceListResponse(
    IReadOnlyList<StaffAdvanceDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    StaffAdvanceSummaryDto Summary);

public record StaffAdvanceHistoryDto(
    Guid StaffId,
    string StaffName,
    string? StaffPhone,
    string? StaffRole,
    decimal TotalAdvancesAmount,
    decimal OutstandingAmount,
    decimal SettledAmount,
    IReadOnlyList<StaffAdvanceDto> Advances);

public record StaffDto(
    Guid Id,
    string Name,
    string PhoneNumber,
    string? Email,
    string? Address,
    string? Role,
    bool IsActive,
    int TotalAdvances,
    decimal TotalAdvanceAmount);

public record CreateStaffRequest
{
    [Required, MaxLength(100)] public string Name { get; init; } = string.Empty;
    [Required, RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must be exactly 10 digits without country code."), MaxLength(10)] public string PhoneNumber { get; init; } = string.Empty;
    [MaxLength(100)] public string? Email { get; init; }
    [MaxLength(200)] public string? Address { get; init; }
    [MaxLength(50)] public string? Role { get; init; }
    public bool IsActive { get; init; } = true;
}

public record UpdateStaffRequest
{
    [MaxLength(100)] public string? Name { get; init; }
    [RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must be exactly 10 digits without country code."), MaxLength(10)] public string? PhoneNumber { get; init; }
    [MaxLength(100)] public string? Email { get; init; }
    [MaxLength(200)] public string? Address { get; init; }
    [MaxLength(50)] public string? Role { get; init; }
    public bool? IsActive { get; init; }
}
