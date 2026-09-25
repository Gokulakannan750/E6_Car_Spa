using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomVehicleWork : BaseEntity
{
    [Required]
    public Guid ShowroomId { get; set; }

    [ForeignKey(nameof(ShowroomId))]
    public Showroom Showroom { get; set; } = null!;

    [Required]
    public Guid StaffId { get; set; }

    [ForeignKey(nameof(StaffId))]
    public Staff Staff { get; set; } = null!;

    [Required]
    public Guid VehicleTypeId { get; set; }

    [ForeignKey(nameof(VehicleTypeId))]
    public ShowroomVehicleType VehicleType { get; set; } = null!;

    public Guid? ShowroomStaffWorkSessionId { get; set; }

    [ForeignKey(nameof(ShowroomStaffWorkSessionId))]
    public ShowroomStaffWorkSession? ShowroomStaffWorkSession { get; set; }

    [Range(1, 9999)]
    public int VehicleQuantity { get; set; } = 1;

    [Required]
    public DateTime Date { get; set; }

    [MaxLength(10)]
    public string? TimeRecorded { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public List<ShowroomVehicleWorkItem> ServiceItems { get; set; } = new();
}
