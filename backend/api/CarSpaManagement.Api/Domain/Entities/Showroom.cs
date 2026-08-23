using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class Showroom : BaseEntity
{
    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string Address { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Phone { get; set; }

    public bool IsActive { get; set; } = true;

    public List<ShowroomStaffAssignment> StaffAssignments { get; set; } = new();
    public List<ShowroomDailyBill> DailyBills { get; set; } = new();
}
