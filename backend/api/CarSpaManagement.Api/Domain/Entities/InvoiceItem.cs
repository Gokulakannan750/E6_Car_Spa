using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class InvoiceItem : BaseEntity
{
	public Guid InvoiceId { get; set; }
	public Invoice Invoice { get; set; } = null!;

	public Guid? ServiceId { get; set; }
	public Service? Service { get; set; }

	[Required]
	[MaxLength(100)]
	public string Description { get; set; } = string.Empty;

	public int Quantity { get; set; } = 1;

	[Column(TypeName = "decimal(18,2)")]
	public decimal UnitPrice { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal Discount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal TaxableAmount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal TaxAmount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal TotalAmount { get; set; }
}
