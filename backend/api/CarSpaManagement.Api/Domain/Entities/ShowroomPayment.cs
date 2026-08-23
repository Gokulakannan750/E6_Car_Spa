using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomPayment : BaseEntity
{
    [Required]
    public Guid ShowroomDailyBillId { get; set; }

    [ForeignKey(nameof(ShowroomDailyBillId))]
    public ShowroomDailyBill ShowroomDailyBill { get; set; } = null!;

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    [Range(0.01, 999999999.99)]
    public decimal Amount { get; set; }

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;

    [MaxLength(100)]
    public string? Reference { get; set; }

    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

    [MaxLength(500)]
    public string? Notes { get; set; }
}
