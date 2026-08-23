using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomStaffAssignment : BaseEntity
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
    public DateTime Date { get; set; }

    [Range(0, 99999)]
    public int VehiclesAttended { get; set; } = 0;
}
