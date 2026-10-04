namespace CarSpaManagement.Api.Domain.Enums;

/// <summary>Independent invoice numbering series. Chosen at finalization from Invoice.IsGstEnabled.</summary>
public enum InvoiceSeriesKind
{
	Gst = 1,
	NonGst = 2
}
