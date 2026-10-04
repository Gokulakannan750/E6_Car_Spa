namespace CarSpaManagement.Api.Domain.Enums;

/// <summary>How an invoice number came to be issued.</summary>
public enum InvoiceNumberAllocationType
{
	/// <summary>Issued before invoice number series existed (backfilled by migration).</summary>
	Legacy = 1,
	/// <summary>Issued by the series counter at finalization.</summary>
	Automatic = 2,
	/// <summary>Chosen by the Owner for a fully paid GST invoice.</summary>
	Manual = 3
}
