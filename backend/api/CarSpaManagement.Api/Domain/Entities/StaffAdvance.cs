using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class StaffAdvance : BaseEntity
{
 [Required]
 public Guid StaffId { get; set; }

 [Required]
 [MaxLength(100)]
 public string StaffName { get; set; } = string.Empty;

 [MaxLength(50)]
 public string? StaffRole { get; set; }

 [Required]
 [MaxLength(20)]
 public string AdvanceType { get; set; } = string.Empty;

 [MaxLength(500)]
 public string? Description { get; set; }

 [Required]
 [Column(TypeName = "decimal(18,2)")]
 public decimal Amount { get; set; }

 [Required]
 [Column(TypeName = "date")]
 public DateTime AdvanceDate { get; set; } = DateTime.UtcNow.Date;

 [MaxLength(50)]
 public string? PaymentMethod { get; set; }

 [MaxLength(20)]
 public string? Status { get; set; } = "Pending";

 [MaxLength(500)]
 public string? Notes { get; set; }

 public Staff Staff { get; set; } = null!;
}
