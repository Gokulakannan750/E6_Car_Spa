using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Common;

namespace CarSpaManagement.Api.Domain.Entities;

public class Vendor : BaseEntity
{
    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? ContactPerson { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? ServiceSpecialty { get; set; }

    public bool IsActive { get; set; } = true;

    public List<OutsideJob> OutsideJobs { get; set; } = new();
}
