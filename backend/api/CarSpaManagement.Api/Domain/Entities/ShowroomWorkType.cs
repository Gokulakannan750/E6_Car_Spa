using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class ShowroomWorkType : BaseEntity, IOrganizationOwned
{
    /// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
    public Guid OrganizationId { get; set; }

    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Description { get; set; }

    public int DisplayOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Marks the free-text "Other" work type, which requires a description of the work performed.
    /// Identified by this flag rather than by name or code, so renaming it does not break the rule.
    /// </summary>
    public bool IsOther { get; set; }

    public List<ShowroomVehicleWorkItem> WorkItems { get; set; } = new();
}
