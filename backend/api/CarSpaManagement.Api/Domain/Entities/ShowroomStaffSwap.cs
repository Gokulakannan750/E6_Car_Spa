using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomStaffSwap : BaseEntity
{
    [Required, MaxLength(50)]
    public string SwapId { get; set; } = string.Empty; // e.g. "SWP-20260927-0001"

    [Required]
    public DateTime Date { get; set; } // Effective Date normalized to UTC midnight

    [Required]
    public Guid StaffAId { get; set; }

    [ForeignKey(nameof(StaffAId))]
    public Staff StaffA { get; set; } = null!;

    [Required]
    public Guid ShowroomAId { get; set; } // Original Showroom for Staff A

    [ForeignKey(nameof(ShowroomAId))]
    public Showroom ShowroomA { get; set; } = null!;

    [Required]
    public Guid StaffBId { get; set; }

    [ForeignKey(nameof(StaffBId))]
    public Staff StaffB { get; set; } = null!;

    [Required]
    public Guid ShowroomBId { get; set; } // Original Showroom for Staff B

    [ForeignKey(nameof(ShowroomBId))]
    public Showroom ShowroomB { get; set; } = null!;

    public Guid? SessionAId { get; set; } // Resulting session for Staff A at Showroom B

    public Guid? SessionBId { get; set; } // Resulting session for Staff B at Showroom A

    public Guid? PerformedByUserId { get; set; }

    [ForeignKey(nameof(PerformedByUserId))]
    public User? PerformedByUser { get; set; }

    [MaxLength(150)]
    public string? PerformedByName { get; set; }

    [MaxLength(10)]
    public string? CoverageStartTime { get; set; } // e.g. "14:00"

    [MaxLength(10)]
    public string? CoverageEndTime { get; set; } // e.g. "18:00"

    [Column(TypeName = "decimal(5,2)")]
    public decimal? CoverageDurationHours { get; set; } // e.g. 4.00

    [MaxLength(500)]
    public string? Reason { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "Completed"; // "Completed", "Reversed"
}
