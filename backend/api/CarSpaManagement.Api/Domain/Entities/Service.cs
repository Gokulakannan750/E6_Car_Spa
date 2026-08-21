using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class Service : BaseEntity
{
 [MaxLength(100)]
 public string Name { get; set; } = string.Empty;

 [MaxLength(500)]
 public string? Description { get; set; }

 [MaxLength(50)]
 public string? Category { get; set; }

 [Column(TypeName = "decimal(18,2)")]
 public decimal Price { get; set; }

 [Column(TypeName = "decimal(5,2)")]
 public decimal TaxPercentage { get; set; }

 public int? DurationMinutes { get; set; }

 public bool IsActive { get; set; } = true;

 public List<JobCardService> JobCardServices { get; set; } = new();
}
