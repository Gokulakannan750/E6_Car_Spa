using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class StaffDailyAttendanceConfirmation : BaseEntity, IOrganizationOwned
{
    /// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
    public Guid OrganizationId { get; set; }

    [Required]
    [Column(TypeName = "date")]
    public DateTime Date { get; set; }

    public bool IsAttendanceConfirmed { get; set; } = false;

    public DateTime? AttendanceConfirmedAt { get; set; }

    public Guid? AttendanceConfirmedByUserId { get; set; }

    [ForeignKey(nameof(AttendanceConfirmedByUserId))]
    public User? AttendanceConfirmedByUser { get; set; }
}
