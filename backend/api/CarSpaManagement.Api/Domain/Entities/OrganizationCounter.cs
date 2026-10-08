using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Common;

namespace CarSpaManagement.Api.Domain.Entities;

/// <summary>
/// A named running counter that belongs to one company (for example its job-card numbers), so every company
/// numbers from 1 independently. Incremented atomically in the database; <see cref="Value"/> is the last number
/// issued.
/// </summary>
public class OrganizationCounter : IOrganizationOwned
{
    public Guid OrganizationId { get; set; }

    [Required, MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    /// <summary>The last number handed out. The next one is Value + 1.</summary>
    public long Value { get; set; }

    public const string JobCard = "JobCard";
}
