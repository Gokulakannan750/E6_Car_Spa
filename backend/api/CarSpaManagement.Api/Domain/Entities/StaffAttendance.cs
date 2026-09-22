using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class StaffAttendance : BaseEntity
{
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
