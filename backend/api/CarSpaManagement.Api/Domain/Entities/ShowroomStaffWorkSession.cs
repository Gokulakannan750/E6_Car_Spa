using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomStaffWorkSession : BaseEntity
{
    [Required]
    public Guid StaffId { get; set; }

    [ForeignKey(nameof(StaffId))]
    public Staff Staff { get; set; } = null!;

    [Required]
    public Guid HomeShowroomId { get; set; }

    [ForeignKey(nameof(HomeShowroomId))]
    public Showroom HomeShowroom { get; set; } = null!;

    [Required]
    public Guid WorkingShowroomId { get; set; }

    [ForeignKey(nameof(WorkingShowroomId))]
    public Showroom WorkingShowroom { get; set; } = null!;

    [Required]
    public DateTime Date { get; set; }

    public ShowroomStaffSessionType SessionType { get; set; } = ShowroomStaffSessionType.FullDay;

    public StaffAttendanceStatus AttendanceStatus { get; set; } = StaffAttendanceStatus.Present;

    [MaxLength(10)]
    public string? StartTime { get; set; }

    [MaxLength(10)]
    public string? EndTime { get; set; }

    [MaxLength(255)]
    public string? TransferReason { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public List<ShowroomVehicleWork> VehicleWorks { get; set; } = new();
}
