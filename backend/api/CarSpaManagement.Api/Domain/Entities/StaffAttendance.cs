using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class StaffAttendance : BaseEntity, IOrganizationOwned
{
    /// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
    public Guid OrganizationId { get; set; }

    [Required]
    public Guid StaffId { get; set; }

    public Staff Staff { get; set; } = null!;

    [Required]
    [Column(TypeName = "date")]
    public DateTime AttendanceDate { get; set; }

    [Required]
    public StaffAttendanceStatus Status { get; set; } = StaffAttendanceStatus.Present;

    [MaxLength(10)]
    public string? CheckInTime { get; set; }

    [MaxLength(10)]
    public string? CheckOutTime { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public Guid? UpdatedByUserId { get; set; }
    public User? UpdatedByUser { get; set; }
}
