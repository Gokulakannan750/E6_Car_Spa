using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class StaffSalarySettlement : BaseEntity
{
    [Required]
    public Guid StaffId { get; set; }

    public Staff Staff { get; set; } = null!;

    [Required]
    [Column(TypeName = "date")]
    public DateTime PeriodFrom { get; set; }

    [Required]
    [Column(TypeName = "date")]
    public DateTime PeriodTo { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal EnteredSalary { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal OutstandingAdvanceBeforeSettlement { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal AdvanceDeduction { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal RemainingAdvanceAfterSettlement { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal FinalSalary { get; set; }

    public StaffSalaryStatus Status { get; set; } = StaffSalaryStatus.Ready;

    public DateTime? SettledAt { get; set; }

    public Guid? SettledByUserId { get; set; }

    [ForeignKey(nameof(SettledByUserId))]
    public User? SettledByUser { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public List<StaffAdvance> RecoveredAdvances { get; set; } = new();
}
