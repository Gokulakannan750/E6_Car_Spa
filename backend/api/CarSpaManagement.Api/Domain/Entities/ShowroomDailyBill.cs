using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomDailyBill : BaseEntity
{
    [Required]
    public Guid ShowroomId { get; set; }

    [ForeignKey(nameof(ShowroomId))]
    public Showroom Showroom { get; set; } = null!;

    [Required]
    public DateTime Date { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    [Range(0, 999999999.99)]
    public decimal Amount { get; set; } = 0m;

    [MaxLength(500)]
    public string? Notes { get; set; }

    public List<ShowroomPayment> Payments { get; set; } = new();
}
