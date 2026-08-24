namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record GstReportRowDto(
    Guid InvoiceId,
    string? InvoiceNumber,
    DateTime InvoiceDate,
    string CustomerName,
    string RegistrationNumber,
    bool IsGstEnabled,
    decimal TaxableAmount,
    decimal GstAmount,
    decimal TotalAmount
);

public record GstReportDto(
    int InvoiceCount,
    decimal GrossSubtotal,
    decimal TotalDiscount,
    decimal TaxableBase,
    decimal CgstAmount,
    decimal SgstAmount,
    decimal TotalGstAmount,
    decimal TotalAmount,
    IReadOnlyList<GstReportRowDto> Invoices
);
