using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class StaffAdvance : BaseEntity
{
    [Required]
    public Guid StaffId { get; set; }

    public Staff Staff { get; set; } = null!;

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    [Required]
    [Column(TypeName = "date")]
    public DateTime AdvanceDate { get; set; } = DateTime.UtcNow.Date;

    [MaxLength(200)]
    public string Reason { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Notes { get; set; }

    public StaffAdvanceStatus Status { get; set; } = StaffAdvanceStatus.Outstanding;

    public DateTime? SettledAt { get; set; }
    public Guid? SettledByUserId { get; set; }
    public User? SettledByUser { get; set; }

    public DateTime? ObsoletedAt { get; set; }
    public Guid? ObsoletedByUserId { get; set; }
    public User? ObsoletedByUser { get; set; }

    [MaxLength(500)]
    public string? ObsoleteReason { get; set; }

    // Legacy fields preserved for schema compatibility
    [MaxLength(100)]
    public string? StaffName { get; set; }

    [MaxLength(50)]
    public string? StaffRole { get; set; }

    [MaxLength(50)]
    public string? AdvanceType { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? PaymentMethod { get; set; }
}
