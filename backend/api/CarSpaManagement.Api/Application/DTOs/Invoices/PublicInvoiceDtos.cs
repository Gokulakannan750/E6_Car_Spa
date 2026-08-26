namespace CarSpaManagement.Api.Application.DTOs.Invoices;

public record InvoicePublicLinkResponse(
    string Url,
    DateTime CreatedAtUtc,
    bool IsActive
);

public record InvoicePublicLinkStatusResponse(
    bool HasActiveLink,
    DateTime? CreatedAtUtc,
    int AccessCount,
    DateTime? LastAccessedAtUtc
);

public record PublicBusinessDto(
    string BusinessName,
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? State,
    string? PostalCode,
    string? Phone,
    string? Email,
    string? Gstin,
    string? LogoUrl
);

public record PublicCustomerDto(
    string CustomerName,
    string VehicleName,
    string RegistrationNumber
);

public record PublicInvoiceItemDto(
    string Description,
    int Quantity,
    decimal Rate,
    decimal Amount,
    string? HsnSac
);

public record PublicFinancialsDto(
    decimal Subtotal,
    decimal Discount,
    decimal? TaxableValue,
    decimal? Cgst,
    decimal? Sgst,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal BalanceAmount
);

public record PublicInvoiceDto(
    string InvoiceNumber,
    DateTime InvoiceDate,
    string Status,
    bool IsGstEnabled,
    PublicBusinessDto Business,
    PublicCustomerDto Customer,
    List<PublicInvoiceItemDto> Items,
    PublicFinancialsDto Financials,
    string? Notes,
    string? TermsAndConditions
);
