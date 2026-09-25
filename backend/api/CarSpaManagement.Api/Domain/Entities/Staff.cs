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

    /// <summary>
    /// Human-readable, immutable business identifier. Format: [A-Z]{2}[0-9]{3}[A-Z] (e.g. GO001L).
    /// Generated automatically on creation. Must not be changed after assignment.
    /// </summary>
    [Required]
    [StringLength(6, MinimumLength = 6)]
    public string StaffMasterId { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? AadhaarNumberEncrypted { get; set; }

    [MaxLength(500)]
    public string? AadhaarDocumentPath { get; set; }

    [MaxLength(255)]
    public string? AadhaarDocumentFileName { get; set; }

    [MaxLength(100)]
    public string? AadhaarDocumentContentType { get; set; }

    public long? AadhaarDocumentSize { get; set; }

    public Guid? DefaultShowroomId { get; set; }

    [ForeignKey(nameof(DefaultShowroomId))]
    public Showroom? DefaultShowroom { get; set; }

    public List<StaffAdvance> StaffAdvances { get; set; } = new();
    public List<ShowroomStaffAssignment> ShowroomAssignments { get; set; } = new();
    public List<StaffAttendance> Attendances { get; set; } = new();
    public List<ShowroomStaffWorkSession> ShowroomWorkSessions { get; set; } = new();
    public List<ShowroomVehicleWork> ShowroomVehicleWorks { get; set; } = new();
}

