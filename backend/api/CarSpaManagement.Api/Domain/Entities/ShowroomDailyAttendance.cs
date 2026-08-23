using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomDailyAttendance : BaseEntity
{
    [Required]
    public Guid ShowroomId { get; set; }

    [ForeignKey(nameof(ShowroomId))]
    public Showroom Showroom { get; set; } = null!;

    [Required]
    public DateTime Date { get; set; }

    public bool IsAttendanceConfirmed { get; set; } = false;

    public DateTime? AttendanceConfirmedAt { get; set; }

    public Guid? AttendanceConfirmedByUserId { get; set; }

    [ForeignKey(nameof(AttendanceConfirmedByUserId))]
    public User? AttendanceConfirmedByUser { get; set; }
}
