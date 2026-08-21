using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class JobCardService : BaseEntity
{
 public Guid JobCardId { get; set; }
 public JobCard JobCard { get; set; } = null!;

 public Guid ServiceId { get; set; }
 public Service Service { get; set; } = null!;

 [MaxLength(100)]
 public string ServiceName { get; set; } = string.Empty;

 [Column(TypeName = "decimal(18,2)")]
 public decimal UnitPrice { get; set; }

 public int Quantity { get; set; } = 1;

 [Column(TypeName = "decimal(5,2)")]
 public decimal TaxPercentage { get; set; }

 [Column(TypeName = "decimal(18,2)")]
 public decimal DiscountAmount { get; set; }

 [Column(TypeName = "decimal(18,2)")]
 public decimal LineTotal { get; set; }
}
