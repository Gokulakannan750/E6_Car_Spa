using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.StaffSalary;

public record StaffSalaryItemDto(
    Guid StaffId,
    string StaffName,
    string? StaffRole,
    string StaffPhoneNumber,
    bool IsActive,
    string PeriodFrom,
    string PeriodTo,
    decimal? EnteredSalary,
    decimal OutstandingAdvance,
    decimal? AdvanceDeduction,
    decimal? FinalSalary,
    decimal? RemainingAdvance,
    string Status,
    DateTime? SettledAt,
    string? SettledByName,
    string? Notes,
    Guid? SettlementId
);

public record StaffSalaryRosterResponse(
    string PeriodFrom,
    string PeriodTo,
    int TotalStaffCount,
    int NotEnteredCount,
    int ReadyCount,
    int SettledCount,
    decimal TotalEnteredSalary,
    decimal TotalAdvanceDeductions,
    decimal TotalFinalSalary,
    List<StaffSalaryItemDto> Items
);

public record StaffSalaryPreviewResponse(
    Guid StaffId,
    string StaffName,
    string? StaffRole,
    string PeriodFrom,
    string PeriodTo,
    decimal EnteredSalary,
    decimal OutstandingAdvance,
    decimal AdvanceDeduction,
    decimal FinalSalary,
    decimal RemainingAdvance,
    string Status
);

public record SaveEnteredSalaryRequest
{
    [Required]
    public Guid StaffId { get; init; }

    [Required]
    [RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = "PeriodFrom must be in format YYYY-MM-DD.")]
    public string PeriodFrom { get; init; } = string.Empty;

    [Required]
    [RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = "PeriodTo must be in format YYYY-MM-DD.")]
    public string PeriodTo { get; init; } = string.Empty;

    [Required]
    [Range(0, 999999999.99, ErrorMessage = "Entered salary cannot be negative.")]
    public decimal EnteredSalary { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record SettleStaffSalaryRequest
{
    [Required]
    public Guid StaffId { get; init; }

    [Required]
    [RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = "PeriodFrom must be in format YYYY-MM-DD.")]
    public string PeriodFrom { get; init; } = string.Empty;

    [Required]
    [RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = "PeriodTo must be in format YYYY-MM-DD.")]
    public string PeriodTo { get; init; } = string.Empty;

    [Required]
    [Range(0, 999999999.99, ErrorMessage = "Entered salary cannot be negative.")]
    public decimal EnteredSalary { get; init; }

    [MaxLength(500)]
    public string? Notes { get; init; }
}

public record StaffSalarySettlementDto(
    Guid Id,
    Guid StaffId,
    string StaffName,
    string? StaffRole,
    string PeriodFrom,
    string PeriodTo,
    decimal EnteredSalary,
    decimal OutstandingAdvanceBeforeSettlement,
    decimal AdvanceDeduction,
    decimal RemainingAdvanceAfterSettlement,
    decimal FinalSalary,
    string Status,
    DateTime? SettledAt,
    Guid? SettledByUserId,
    string? SettledByName,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
