using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class InvoiceItem : BaseEntity, IOrganizationOwned
{
	/// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
	public Guid OrganizationId { get; set; }

	public Guid InvoiceId { get; set; }
	public Invoice Invoice { get; set; } = null!;

	public Guid? ServiceId { get; set; }
	public Service? Service { get; set; }

	public Guid? OutsideJobId { get; set; }
	public OutsideJob? OutsideJob { get; set; }

	[Required]
	[MaxLength(100)]
	public string Description { get; set; } = string.Empty;

	public int Quantity { get; set; } = 1;

	[Column(TypeName = "decimal(18,2)")]
	public decimal UnitPrice { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal Discount { get; set; }

	/// <summary>
	/// GST rate applied to this line when the amounts were calculated (0 on a non-GST invoice). Frozen with the
	/// invoice on finalization. Null only for legacy lines whose rate could not be proven from their stored amounts.
	/// </summary>
	[Column(TypeName = "decimal(5,2)")]
	public decimal? TaxRatePercent { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal TaxableAmount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal TaxAmount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal TotalAmount { get; set; }
}
