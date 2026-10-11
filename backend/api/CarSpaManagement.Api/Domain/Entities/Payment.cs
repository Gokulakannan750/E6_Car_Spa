using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarSpaManagement.Api.Domain.Entities;

public class Payment : BaseEntity, IOrganizationOwned
{
	/// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
	public Guid OrganizationId { get; set; }

	public Guid InvoiceId { get; set; }
	public Invoice Invoice { get; set; } = null!;

	[Column(TypeName = "decimal(18,2)")]
	public decimal Amount { get; set; }

	public PaymentMethod PaymentMethod { get; set; }

	[MaxLength(100)]
	public string? Reference { get; set; }

	public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
}
