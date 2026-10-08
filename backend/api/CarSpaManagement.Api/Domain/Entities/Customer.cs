using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class Customer : BaseEntity, IOrganizationOwned
{
	/// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
	public Guid OrganizationId { get; set; }

 [MaxLength(100)]
 public string Name { get; set; } = string.Empty;

 [MaxLength(20)]
 public string PhoneNumber { get; set; } = string.Empty;

 [MaxLength(100)]
 public string? Email { get; set; }

 [MaxLength(500)]
 public string? Address { get; set; }

 public List<Vehicle> Vehicles { get; set; } = new();
 public List<JobCard> JobCards { get; set; } = new();
}
