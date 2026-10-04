using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Domain.Entities;

/// <summary>
/// Counter and prefix for one invoice numbering series (exactly one active row per <see cref="InvoiceSeriesKind"/>).
/// Numbers are formatted as Prefix + NextNumber zero-padded to MinDigits, e.g. "GST/0001".
/// Future extension points: FinancialYear and BranchId columns (unique per kind + year + branch).
/// </summary>
public class InvoiceNumberSeries : BaseEntity
{
	public InvoiceSeriesKind SeriesKind { get; set; }

	public string Prefix { get; set; } = string.Empty;

	public int MinDigits { get; set; } = 4;

	/// <summary>The next counter value to try. Controlled only by the server; never decreases.</summary>
	public long NextNumber { get; set; } = 1;
}
