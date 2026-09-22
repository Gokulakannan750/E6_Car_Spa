using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class StaffDailyAttendanceConfirmation : BaseEntity
{
    [Required]
    [Column(TypeName = "date")]
    public DateTime Date { get; set; }

    public bool IsAttendanceConfirmed { get; set; } = false;

    public DateTime? AttendanceConfirmedAt { get; set; }

    public Guid? AttendanceConfirmedByUserId { get; set; }

    [ForeignKey(nameof(AttendanceConfirmedByUserId))]
    public User? AttendanceConfirmedByUser { get; set; }
}
