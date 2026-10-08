using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class Vehicle : BaseEntity, IOrganizationOwned
{
	/// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
	public Guid OrganizationId { get; set; }

 [MaxLength(20)]
 public string RegistrationNumber { get; set; } = string.Empty;

 [MaxLength(50)]
 public string Make { get; set; } = string.Empty;

 [MaxLength(50)]
 public string Model { get; set; } = string.Empty;

 [MaxLength(50)]
 public string? Variant { get; set; }

 [MaxLength(30)]
 public string? Color { get; set; }

 public Guid CustomerId { get; set; }
 public Customer Customer { get; set; } = null!;

 public List<JobCard> JobCards { get; set; } = new();
}
