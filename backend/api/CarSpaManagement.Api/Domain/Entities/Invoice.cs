using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class Invoice : BaseEntity
{
	[MaxLength(30)]
	public string? InvoiceNumber { get; set; }

	public Guid JobCardId { get; set; }
	public JobCard JobCard { get; set; } = null!;

	public Guid CustomerId { get; set; }
	public Customer Customer { get; set; } = null!;

	public Guid VehicleId { get; set; }
	public Vehicle Vehicle { get; set; } = null!;

	[Column(TypeName = "date")]
	public DateTime InvoiceDate { get; set; } = DateTime.UtcNow.Date;

	[Column(TypeName = "decimal(18,2)")]
	public decimal Subtotal { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal Discount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal TaxableAmount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal GstAmount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal TotalAmount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal PaidAmount { get; set; }

	[Column(TypeName = "decimal(18,2)")]
	public decimal BalanceAmount { get; set; }

	public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;

	public bool IsGstEnabled { get; set; } = true;

	[MaxLength(500)]
	public string? Notes { get; set; }

	public List<InvoiceItem> InvoiceItems { get; set; } = new();

	public List<Payment> Payments { get; set; } = new();

	public List<InvoicePublicLink> PublicLinks { get; set; } = new();
	public List<WhatsAppMessage> WhatsAppMessages { get; set; } = new();
}
