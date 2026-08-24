using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record PaymentReportRowDto(
    Guid PaymentId,
    Guid InvoiceId,
    string? InvoiceNumber,
    string CustomerName,
    DateTime PaymentDate,
    string PaymentMethod,
    string? Reference,
    decimal Amount,
    bool IsVoided,
    DateTime? VoidedAt
);

public record PaymentReportSummaryDto(
    decimal TotalCollected,
    int TransactionCount,
    decimal CashAmount,
    decimal UpiAmount,
    decimal CardAmount,
    decimal BankTransferAmount,
    int VoidedTransactionCount,
    decimal VoidedAmount
);

public record PaymentReportResponse(
    IReadOnlyList<PaymentReportRowDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    PaymentReportSummaryDto Summary
);
