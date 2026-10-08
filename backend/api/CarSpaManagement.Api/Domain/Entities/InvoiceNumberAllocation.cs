using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Domain.Entities;

/// <summary>
/// Append-only ledger of every invoice number ever issued. A number recorded here is permanently
/// consumed and is never issued again — not by the series counter and not by a manual change —
/// regardless of later renames or prefix changes. Deliberately not a BaseEntity: rows are never
/// soft-deleted, updated or removed, so no query filter can hide a reservation.
/// </summary>
public class InvoiceNumberAllocation : IOrganizationOwned
{
	/// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
	public Guid OrganizationId { get; set; }

	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid InvoiceId { get; set; }
	public Invoice Invoice { get; set; } = null!;

	/// <summary>The number exactly as it was issued.</summary>
	public string InvoiceNumber { get; set; } = string.Empty;

	/// <summary>Trimmed, upper-invariant form. Unique: this is the permanent reservation.</summary>
	public string NormalizedNumber { get; set; } = string.Empty;

	public InvoiceSeriesKind SeriesKind { get; set; }

	public InvoiceNumberAllocationType AllocationType { get; set; }

	/// <summary>Series counter value for automatic numbers and recognised legacy numbers.</summary>
	public long? CounterValue { get; set; }

	public DateTime AllocatedAtUtc { get; set; } = DateTime.UtcNow;

	public Guid? AllocatedByUserId { get; set; }
}
