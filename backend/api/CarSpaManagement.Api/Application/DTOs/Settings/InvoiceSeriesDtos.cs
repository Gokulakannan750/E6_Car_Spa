namespace CarSpaManagement.Api.Application.DTOs.Settings;

/// <summary>One invoice numbering series as shown in Settings. The counter is read-only.</summary>
public record InvoiceSeriesDto(
    string SeriesKind,
    string Prefix,
    int MinDigits,
    long NextNumber,
    string NextNumberDisplay,
    string NextInvoiceNumber);

public record InvoiceSeriesSettingsDto(
    InvoiceSeriesDto Gst,
    InvoiceSeriesDto NonGst);

/// <summary>Owner only. Only prefixes can be changed; the counters are controlled by the server.</summary>
public record UpdateInvoiceSeriesRequest(
    string GstPrefix,
    string NonGstPrefix);
