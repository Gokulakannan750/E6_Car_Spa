namespace CarSpaManagement.Api.Application.DTOs.Reports;

public record DateRangeDto(
    DateTime FromDate,
    DateTime ToDate
);

public record JobCardKpisDto(
    int TotalJobCards,
    int NewJobCards,
    int InProgressJobCards,
    int CompletedJobCards,
    int CancelledJobCards,
    int InvoicedJobCards
);

public record VehicleActivityDto(
    int VehiclesServiced,
    int TotalServicesCompleted,
    int UniqueVehiclesServiced
);

public record InvoiceKpisDto(
    int DraftCount,
    int GeneratedCount,
    int PartiallyPaidCount,
    int PaidCount,
    int CancelledCount,
    decimal TotalInvoicedAmount,
    decimal TotalPaidAmount,
    decimal TotalOutstandingAmount
);

public record DashboardSalesDto(
    decimal GrossSubtotal,
    decimal TotalDiscount,
    decimal GstAmount,
    decimal NetSales,
    decimal PaymentCollection,
    decimal Outstanding
);

public record PaymentMethodBreakdownDto(
    string Method,
    int TransactionCount,
    decimal Amount
);

public record DashboardPaymentCollectionDto(
    decimal TotalReceived,
    int TransactionCount,
    List<PaymentMethodBreakdownDto> BreakdownByMethod
);

public record DashboardShowroomDto(
    int ActiveShowroomsCount,
    int StaffAssignmentsCount,
    int VehiclesAttended,
    decimal TotalBilled,
    decimal TotalReceived,
    decimal TotalOutstanding,
    int PaidDaysCount,
    int PartiallyPaidDaysCount,
    int UnpaidDaysCount
);

public record DashboardStaffAdvanceDto(
    int OutstandingCount,
    decimal OutstandingAmount,
    int SettledCount,
    decimal SettledAmount,
    int ObsoleteCount
);

public record DashboardOutstandingDto(
    decimal InvoiceOutstanding,
    decimal ShowroomOutstanding,
    decimal StaffAdvanceOutstanding,
    decimal TotalOutstandingCombined
);

public record RecentActivityItemDto(
    string ActivityType,
    string Title,
    string Description,
    decimal? Amount,
    DateTime Timestamp,
    Guid? ReferenceId,
    string? Status
);

public record DashboardSummaryDto(
    DateRangeDto DateRange,
    JobCardKpisDto JobCardKpis,
    VehicleActivityDto VehicleActivity,
    InvoiceKpisDto InvoiceKpis,
    DashboardSalesDto Sales,
    DashboardPaymentCollectionDto PaymentCollection,
    DashboardShowroomDto Showroom,
    DashboardStaffAdvanceDto StaffAdvances,
    DashboardOutstandingDto Outstanding,
    List<RecentActivityItemDto> RecentActivity
);
