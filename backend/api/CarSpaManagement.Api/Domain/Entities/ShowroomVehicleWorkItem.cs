using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomVehicleWorkItem : BaseEntity
{
    [Required]
    public Guid ShowroomVehicleWorkId { get; set; }

    [ForeignKey(nameof(ShowroomVehicleWorkId))]
    public ShowroomVehicleWork ShowroomVehicleWork { get; set; } = null!;

    [Required]
    public Guid WorkTypeId { get; set; }

    [ForeignKey(nameof(WorkTypeId))]
    public ShowroomWorkType WorkType { get; set; } = null!;

    [Range(1, 9999)]
    public int Quantity { get; set; } = 1;

    [MaxLength(500)]
    public string? Notes { get; set; }
}
