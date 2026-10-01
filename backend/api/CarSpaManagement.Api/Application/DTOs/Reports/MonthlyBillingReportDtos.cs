using System;
using System.Collections.Generic;

namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record MonthlyBillingReportResponse(
    int Year,
    int Month,
    string MonthName,
    DateTime FromDate,
    DateTime ToDate,
    int DaysInMonth,
    MonthlyBillingSummaryDto Summary,
    List<DailyBillingSheetDto> DailySheets
);

public record MonthlyBillingSummaryDto(
    string MonthName,
    DateTime StartDate,
    DateTime EndDate,
    DateTime GeneratedAt,
    // Job Card Summary
    int TotalJobCardsCreated,
    int TotalJobCardsFinished,
    // Invoice Summary
    int TotalInvoices,
    int TotalInvoicesPaid,
    int TotalInvoicesPendingPayment,
    int TotalInvoicesDraft,
    int TotalInvoicesCancelled,
    decimal TotalInvoiceAmount,
    decimal TotalAmountPaid,
    decimal TotalAmountPending,
    // Service Summary
    int TotalServicesPerformed,
    int TotalServiceQuantity
);

public record DailyBillingSheetDto(
    int Day,
    DateTime Date,
    string DateFormatted,
    string SheetName,
    bool HasActivity,
    DailyTotalsDto Totals,
    List<DailyJobCardRowDto> JobCards,
    List<DailyInvoiceRowDto> Invoices,
    List<DailyServiceRowDto> Services
);

public record DailyTotalsDto(
    decimal JobCardTotal,
    decimal InvoiceTotal,
    decimal AmountPaid,
    decimal AmountPending,
    int JobCardCount,
    int InvoiceCount,
    int ServiceCount,
    int ServiceTotalQuantity
);

public record DailyJobCardRowDto(
    Guid JobCardId,
    string JobCardNumber,
    DateTime JobCardDate,
    string CustomerName,
    string VehicleRegistration,
    string Vehicle,
    string JobCardStatus,
    int TotalServices,
    decimal JobCardTotal
);

public record DailyInvoiceRowDto(
    Guid InvoiceId,
    string InvoiceNumber,
    DateTime InvoiceDate,
    string JobCardNumber,
    string CustomerName,
    string VehicleRegistration,
    string InvoiceStatus,
    decimal InvoiceTotal,
    decimal AmountPaid,
    decimal AmountPending
);

public record DailyServiceRowDto(
    Guid ServiceItemId,
    string JobCardNumber,
    string? InvoiceNumber,
    string CustomerName,
    string ServiceName,
    int Quantity,
    decimal Rate,
    decimal Amount
);
