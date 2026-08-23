using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class Staff : BaseEntity
{
 [Required]
 [MaxLength(100)]
 public string Name { get; set; } = string.Empty;

 [Required]
 [MaxLength(15)]
 public string PhoneNumber { get; set; } = string.Empty;

 [MaxLength(100)]
 public string? Email { get; set; }

 [MaxLength(200)]
 public string? Address { get; set; }

 [MaxLength(50)]
 public string? Role { get; set; }

 public bool IsActive { get; set; } = true;

 public List<StaffAdvance> StaffAdvances { get; set; } = new();
 public List<ShowroomStaffAssignment> ShowroomAssignments { get; set; } = new();
}
