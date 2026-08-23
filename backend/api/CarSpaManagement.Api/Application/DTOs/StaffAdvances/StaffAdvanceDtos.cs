using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.StaffAdvances;

public record StaffAdvanceDto(
 Guid Id,
 string StaffId,
 string StaffName,
 string? StaffRole,
 string AdvanceType,
 string? Description,
 decimal Amount,
 DateTime AdvanceDate,
 string? PaymentMethod,
 string Status,
 string? Notes,
 DateTime CreatedAt);

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
	[Required, MaxLength(15)] public string PhoneNumber { get; init; } = string.Empty;
	[MaxLength(100)] public string? Email { get; init; }
	[MaxLength(200)] public string? Address { get; init; }
	[MaxLength(50)] public string? Role { get; init; }
	public bool IsActive { get; init; } = true;
}

public record UpdateStaffRequest
{
	[MaxLength(100)] public string? Name { get; init; }
	[MaxLength(15)] public string? PhoneNumber { get; init; }
	[MaxLength(100)] public string? Email { get; init; }
	[MaxLength(200)] public string? Address { get; init; }
	[MaxLength(50)] public string? Role { get; init; }
	public bool? IsActive { get; init; }
}

public record CreateStaffAdvanceRequest
{
 [Required, MaxLength(100)] public string StaffName { get; init; } = string.Empty;
 [MaxLength(50)] public string? StaffRole { get; init; }

 [Required, MaxLength(20)]
 public string AdvanceType { get; init; } = string.Empty;

 [MaxLength(500)] public string? Description { get; init; }

 [Required, Range(0.01, 999999.99)]
 public decimal Amount { get; init; }

 [Required] public DateTime AdvanceDate { get; init; } = DateTime.UtcNow.Date;

 [MaxLength(50)] public string? PaymentMethod { get; init; }
 [MaxLength(500)] public string? Notes { get; init; }
}

public record UpdateStaffAdvanceRequest
{
 [MaxLength(100)] public string? StaffName { get; init; }
 [MaxLength(50)] public string? StaffRole { get; init; }
 [MaxLength(20)] public string? AdvanceType { get; init; }
 [MaxLength(500)] public string? Description { get; init; }
 [Range(0.01, 999999.99)] public decimal? Amount { get; init; }
 public DateTime? AdvanceDate { get; init; }
 [MaxLength(50)] public string? PaymentMethod { get; init; }
 [MaxLength(20)] public string? Status { get; init; }
 [MaxLength(500)] public string? Notes { get; init; }
}

public record StaffAdvanceListResponse(
 IReadOnlyList<StaffAdvanceDto> Items,
 int TotalCount,
 int Page,
 int PageSize);
