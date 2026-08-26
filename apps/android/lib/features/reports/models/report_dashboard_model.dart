class DateRangeModel {
  final DateTime fromDate;
  final DateTime toDate;

  const DateRangeModel({
    required this.fromDate,
    required this.toDate,
  });

  factory DateRangeModel.fromJson(Map<String, dynamic> json) {
    return DateRangeModel(
      fromDate: DateTime.tryParse(json['fromDate']?.toString() ?? json['FromDate']?.toString() ?? '') ?? DateTime.now(),
      toDate: DateTime.tryParse(json['toDate']?.toString() ?? json['ToDate']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}

class JobCardKpisModel {
  final int totalJobCards;
  final int newJobCards;
  final int inProgressJobCards;
  final int completedJobCards;
  final int cancelledJobCards;
  final int invoicedJobCards;

  const JobCardKpisModel({
    required this.totalJobCards,
    required this.newJobCards,
    required this.inProgressJobCards,
    required this.completedJobCards,
    required this.cancelledJobCards,
    required this.invoicedJobCards,
  });

  factory JobCardKpisModel.fromJson(Map<String, dynamic> json) {
    return JobCardKpisModel(
      totalJobCards: json['totalJobCards'] as int? ?? json['TotalJobCards'] as int? ?? 0,
      newJobCards: json['newJobCards'] as int? ?? json['NewJobCards'] as int? ?? 0,
      inProgressJobCards: json['inProgressJobCards'] as int? ?? json['InProgressJobCards'] as int? ?? 0,
      completedJobCards: json['completedJobCards'] as int? ?? json['CompletedJobCards'] as int? ?? 0,
      cancelledJobCards: json['cancelledJobCards'] as int? ?? json['CancelledJobCards'] as int? ?? 0,
      invoicedJobCards: json['invoicedJobCards'] as int? ?? json['InvoicedJobCards'] as int? ?? 0,
    );
  }
}

class VehicleActivityModel {
  final int vehiclesServiced;
  final int totalServicesCompleted;
  final int uniqueVehiclesServiced;

  const VehicleActivityModel({
    required this.vehiclesServiced,
    required this.totalServicesCompleted,
    required this.uniqueVehiclesServiced,
  });

  factory VehicleActivityModel.fromJson(Map<String, dynamic> json) {
    return VehicleActivityModel(
      vehiclesServiced: json['vehiclesServiced'] as int? ?? json['VehiclesServiced'] as int? ?? 0,
      totalServicesCompleted: json['totalServicesCompleted'] as int? ?? json['TotalServicesCompleted'] as int? ?? 0,
      uniqueVehiclesServiced: json['uniqueVehiclesServiced'] as int? ?? json['UniqueVehiclesServiced'] as int? ?? 0,
    );
  }
}

class InvoiceKpisModel {
  final int draftCount;
  final int generatedCount;
  final int partiallyPaidCount;
  final int paidCount;
  final int cancelledCount;
  final double totalInvoicedAmount;
  final double totalPaidAmount;
  final double totalOutstandingAmount;

  const InvoiceKpisModel({
    required this.draftCount,
    required this.generatedCount,
    required this.partiallyPaidCount,
    required this.paidCount,
    required this.cancelledCount,
    required this.totalInvoicedAmount,
    required this.totalPaidAmount,
    required this.totalOutstandingAmount,
  });

  factory InvoiceKpisModel.fromJson(Map<String, dynamic> json) {
    return InvoiceKpisModel(
      draftCount: json['draftCount'] as int? ?? json['DraftCount'] as int? ?? 0,
      generatedCount: json['generatedCount'] as int? ?? json['GeneratedCount'] as int? ?? 0,
      partiallyPaidCount: json['partiallyPaidCount'] as int? ?? json['PartiallyPaidCount'] as int? ?? 0,
      paidCount: json['paidCount'] as int? ?? json['PaidCount'] as int? ?? 0,
      cancelledCount: json['cancelledCount'] as int? ?? json['CancelledCount'] as int? ?? 0,
      totalInvoicedAmount: ((json['totalInvoicedAmount'] ?? json['TotalInvoicedAmount'] ?? 0.0) as num).toDouble(),
      totalPaidAmount: ((json['totalPaidAmount'] ?? json['TotalPaidAmount'] ?? 0.0) as num).toDouble(),
      totalOutstandingAmount: ((json['totalOutstandingAmount'] ?? json['TotalOutstandingAmount'] ?? 0.0) as num).toDouble(),
    );
  }
}

class DashboardSalesModel {
  final double grossSubtotal;
  final double totalDiscount;
  final double gstAmount;
  final double netSales;
  final double paymentCollection;
  final double outstanding;

  const DashboardSalesModel({
    required this.grossSubtotal,
    required this.totalDiscount,
    required this.gstAmount,
    required this.netSales,
    required this.paymentCollection,
    required this.outstanding,
  });

  factory DashboardSalesModel.fromJson(Map<String, dynamic> json) {
    return DashboardSalesModel(
      grossSubtotal: ((json['grossSubtotal'] ?? json['GrossSubtotal'] ?? 0.0) as num).toDouble(),
      totalDiscount: ((json['totalDiscount'] ?? json['TotalDiscount'] ?? 0.0) as num).toDouble(),
      gstAmount: ((json['gstAmount'] ?? json['GstAmount'] ?? 0.0) as num).toDouble(),
      netSales: ((json['netSales'] ?? json['NetSales'] ?? 0.0) as num).toDouble(),
      paymentCollection: ((json['paymentCollection'] ?? json['PaymentCollection'] ?? 0.0) as num).toDouble(),
      outstanding: ((json['outstanding'] ?? json['Outstanding'] ?? 0.0) as num).toDouble(),
    );
  }
}

class PaymentMethodBreakdownModel {
  final String method;
  final int transactionCount;
  final double amount;

  const PaymentMethodBreakdownModel({
    required this.method,
    required this.transactionCount,
    required this.amount,
  });

  factory PaymentMethodBreakdownModel.fromJson(Map<String, dynamic> json) {
    return PaymentMethodBreakdownModel(
      method: json['method']?.toString() ?? json['Method']?.toString() ?? '',
      transactionCount: json['transactionCount'] as int? ?? json['TransactionCount'] as int? ?? 0,
      amount: ((json['amount'] ?? json['Amount'] ?? 0.0) as num).toDouble(),
    );
  }
}

class DashboardPaymentCollectionModel {
  final double totalReceived;
  final int transactionCount;
  final List<PaymentMethodBreakdownModel> breakdownByMethod;

  const DashboardPaymentCollectionModel({
    required this.totalReceived,
    required this.transactionCount,
    required this.breakdownByMethod,
  });

  factory DashboardPaymentCollectionModel.fromJson(Map<String, dynamic> json) {
    final rawList = json['breakdownByMethod'] as List<dynamic>? ?? json['BreakdownByMethod'] as List<dynamic>? ?? [];
    return DashboardPaymentCollectionModel(
      totalReceived: ((json['totalReceived'] ?? json['TotalReceived'] ?? 0.0) as num).toDouble(),
      transactionCount: json['transactionCount'] as int? ?? json['TransactionCount'] as int? ?? 0,
      breakdownByMethod: rawList
          .map((item) => PaymentMethodBreakdownModel.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class DashboardShowroomModel {
  final int activeShowroomsCount;
  final int staffAssignmentsCount;
  final int vehiclesAttended;
  final double totalBilled;
  final double totalReceived;
  final double totalOutstanding;
  final int paidDaysCount;
  final int partiallyPaidDaysCount;
  final int unpaidDaysCount;

  const DashboardShowroomModel({
    required this.activeShowroomsCount,
    required this.staffAssignmentsCount,
    required this.vehiclesAttended,
    required this.totalBilled,
    required this.totalReceived,
    required this.totalOutstanding,
    required this.paidDaysCount,
    required this.partiallyPaidDaysCount,
    required this.unpaidDaysCount,
  });

  factory DashboardShowroomModel.fromJson(Map<String, dynamic> json) {
    return DashboardShowroomModel(
      activeShowroomsCount: json['activeShowroomsCount'] as int? ?? json['ActiveShowroomsCount'] as int? ?? 0,
      staffAssignmentsCount: json['staffAssignmentsCount'] as int? ?? json['StaffAssignmentsCount'] as int? ?? 0,
      vehiclesAttended: json['vehiclesAttended'] as int? ?? json['VehiclesAttended'] as int? ?? 0,
      totalBilled: ((json['totalBilled'] ?? json['TotalBilled'] ?? 0.0) as num).toDouble(),
      totalReceived: ((json['totalReceived'] ?? json['TotalReceived'] ?? 0.0) as num).toDouble(),
      totalOutstanding: ((json['totalOutstanding'] ?? json['TotalOutstanding'] ?? 0.0) as num).toDouble(),
      paidDaysCount: json['paidDaysCount'] as int? ?? json['PaidDaysCount'] as int? ?? 0,
      partiallyPaidDaysCount: json['partiallyPaidDaysCount'] as int? ?? json['PartiallyPaidDaysCount'] as int? ?? 0,
      unpaidDaysCount: json['unpaidDaysCount'] as int? ?? json['UnpaidDaysCount'] as int? ?? 0,
    );
  }
}

class DashboardStaffAdvanceModel {
  final int outstandingCount;
  final double outstandingAmount;
  final int settledCount;
  final double settledAmount;
  final int obsoleteCount;

  const DashboardStaffAdvanceModel({
    required this.outstandingCount,
    required this.outstandingAmount,
    required this.settledCount,
    required this.settledAmount,
    required this.obsoleteCount,
  });

  factory DashboardStaffAdvanceModel.fromJson(Map<String, dynamic> json) {
    return DashboardStaffAdvanceModel(
      outstandingCount: json['outstandingCount'] as int? ?? json['OutstandingCount'] as int? ?? 0,
      outstandingAmount: ((json['outstandingAmount'] ?? json['OutstandingAmount'] ?? 0.0) as num).toDouble(),
      settledCount: json['settledCount'] as int? ?? json['SettledCount'] as int? ?? 0,
      settledAmount: ((json['settledAmount'] ?? json['SettledAmount'] ?? 0.0) as num).toDouble(),
      obsoleteCount: json['obsoleteCount'] as int? ?? json['ObsoleteCount'] as int? ?? 0,
    );
  }
}

class DashboardOutstandingModel {
  final double invoiceOutstanding;
  final double showroomOutstanding;
  final double staffAdvanceOutstanding;
  final double totalOutstandingCombined;

  const DashboardOutstandingModel({
    required this.invoiceOutstanding,
    required this.showroomOutstanding,
    required this.staffAdvanceOutstanding,
    required this.totalOutstandingCombined,
  });

  factory DashboardOutstandingModel.fromJson(Map<String, dynamic> json) {
    return DashboardOutstandingModel(
      invoiceOutstanding: ((json['invoiceOutstanding'] ?? json['InvoiceOutstanding'] ?? 0.0) as num).toDouble(),
      showroomOutstanding: ((json['showroomOutstanding'] ?? json['ShowroomOutstanding'] ?? 0.0) as num).toDouble(),
      staffAdvanceOutstanding: ((json['staffAdvanceOutstanding'] ?? json['StaffAdvanceOutstanding'] ?? 0.0) as num).toDouble(),
      totalOutstandingCombined: ((json['totalOutstandingCombined'] ?? json['TotalOutstandingCombined'] ?? 0.0) as num).toDouble(),
    );
  }
}

class RecentActivityItemModel {
  final String activityType;
  final String title;
  final String description;
  final double? amount;
  final DateTime timestamp;
  final String? referenceId;
  final String? status;

  const RecentActivityItemModel({
    required this.activityType,
    required this.title,
    required this.description,
    this.amount,
    required this.timestamp,
    this.referenceId,
    this.status,
  });

  factory RecentActivityItemModel.fromJson(Map<String, dynamic> json) {
    return RecentActivityItemModel(
      activityType: json['activityType']?.toString() ?? json['ActivityType']?.toString() ?? '',
      title: json['title']?.toString() ?? json['Title']?.toString() ?? '',
      description: json['description']?.toString() ?? json['Description']?.toString() ?? '',
      amount: json['amount'] != null || json['Amount'] != null ? ((json['amount'] ?? json['Amount']) as num).toDouble() : null,
      timestamp: DateTime.tryParse(json['timestamp']?.toString() ?? json['Timestamp']?.toString() ?? '') ?? DateTime.now(),
      referenceId: json['referenceId']?.toString() ?? json['ReferenceId']?.toString(),
      status: json['status']?.toString() ?? json['Status']?.toString(),
    );
  }
}

class DashboardSummaryModel {
  final DateRangeModel dateRange;
  final JobCardKpisModel jobCardKpis;
  final VehicleActivityModel vehicleActivity;
  final InvoiceKpisModel invoiceKpis;
  final DashboardSalesModel sales;
  final DashboardPaymentCollectionModel paymentCollection;
  final DashboardShowroomModel showroom;
  final DashboardStaffAdvanceModel staffAdvances;
  final DashboardOutstandingModel outstanding;
  final List<RecentActivityItemModel> recentActivity;

  const DashboardSummaryModel({
    required this.dateRange,
    required this.jobCardKpis,
    required this.vehicleActivity,
    required this.invoiceKpis,
    required this.sales,
    required this.paymentCollection,
    required this.showroom,
    required this.staffAdvances,
    required this.outstanding,
    required this.recentActivity,
  });

  factory DashboardSummaryModel.fromJson(Map<String, dynamic> json) {
    final rawRecent = json['recentActivity'] as List<dynamic>? ?? json['RecentActivity'] as List<dynamic>? ?? [];
    return DashboardSummaryModel(
      dateRange: DateRangeModel.fromJson((json['dateRange'] ?? json['DateRange'] ?? {}) as Map<String, dynamic>),
      jobCardKpis: JobCardKpisModel.fromJson((json['jobCardKpis'] ?? json['JobCardKpis'] ?? {}) as Map<String, dynamic>),
      vehicleActivity: VehicleActivityModel.fromJson((json['vehicleActivity'] ?? json['VehicleActivity'] ?? {}) as Map<String, dynamic>),
      invoiceKpis: InvoiceKpisModel.fromJson((json['invoiceKpis'] ?? json['InvoiceKpis'] ?? {}) as Map<String, dynamic>),
      sales: DashboardSalesModel.fromJson((json['sales'] ?? json['Sales'] ?? {}) as Map<String, dynamic>),
      paymentCollection: DashboardPaymentCollectionModel.fromJson((json['paymentCollection'] ?? json['PaymentCollection'] ?? {}) as Map<String, dynamic>),
      showroom: DashboardShowroomModel.fromJson((json['showroom'] ?? json['Showroom'] ?? {}) as Map<String, dynamic>),
      staffAdvances: DashboardStaffAdvanceModel.fromJson((json['staffAdvances'] ?? json['StaffAdvances'] ?? {}) as Map<String, dynamic>),
      outstanding: DashboardOutstandingModel.fromJson((json['outstanding'] ?? json['Outstanding'] ?? {}) as Map<String, dynamic>),
      recentActivity: rawRecent
          .map((item) => RecentActivityItemModel.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}
