using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomStaffAssignment : BaseEntity, IOrganizationOwned
{
    /// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
    public Guid OrganizationId { get; set; }

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
