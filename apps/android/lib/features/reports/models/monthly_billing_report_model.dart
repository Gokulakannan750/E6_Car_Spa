class DailyTotalsModel {
  final double invoiceTotal;
  final double amountPaid;
  final double amountPending;
  final int jobCardCount;
  final int invoiceCount;
  final int serviceCount;
  final int serviceTotalQuantity;

  const DailyTotalsModel({
    required this.invoiceTotal,
    required this.amountPaid,
    required this.amountPending,
    required this.jobCardCount,
    required this.invoiceCount,
    required this.serviceCount,
    required this.serviceTotalQuantity,
  });

  factory DailyTotalsModel.fromJson(Map<String, dynamic> json) {
    return DailyTotalsModel(
      invoiceTotal:
          (json['invoiceTotal'] as num?)?.toDouble() ??
          (json['InvoiceTotal'] as num?)?.toDouble() ??
          0.0,
      amountPaid:
          (json['amountPaid'] as num?)?.toDouble() ??
          (json['AmountPaid'] as num?)?.toDouble() ??
          0.0,
      amountPending:
          (json['amountPending'] as num?)?.toDouble() ??
          (json['AmountPending'] as num?)?.toDouble() ??
          0.0,
      jobCardCount:
          json['jobCardCount'] as int? ?? json['JobCardCount'] as int? ?? 0,
      invoiceCount:
          json['invoiceCount'] as int? ?? json['InvoiceCount'] as int? ?? 0,
      serviceCount:
          json['serviceCount'] as int? ?? json['ServiceCount'] as int? ?? 0,
      serviceTotalQuantity:
          json['serviceTotalQuantity'] as int? ??
          json['ServiceTotalQuantity'] as int? ??
          0,
    );
  }
}

class DailyJobCardRowModel {
  final String jobCardId;
  final String jobCardNumber;
  final DateTime jobCardDate;
  final String customerName;
  final String vehicleRegistration;
  final String vehicle;
  final String jobCardStatus;
  final int totalServices;
  final double jobCardTotal;

  const DailyJobCardRowModel({
    required this.jobCardId,
    required this.jobCardNumber,
    required this.jobCardDate,
    required this.customerName,
    required this.vehicleRegistration,
    required this.vehicle,
    required this.jobCardStatus,
    required this.totalServices,
    required this.jobCardTotal,
  });

  factory DailyJobCardRowModel.fromJson(Map<String, dynamic> json) {
    return DailyJobCardRowModel(
      jobCardId:
          json['jobCardId']?.toString() ?? json['JobCardId']?.toString() ?? '',
      jobCardNumber:
          json['jobCardNumber']?.toString() ??
          json['JobCardNumber']?.toString() ??
          '',
      jobCardDate:
          DateTime.tryParse(
            json['jobCardDate']?.toString() ??
                json['JobCardDate']?.toString() ??
                '',
          ) ??
          DateTime.now(),
      customerName:
          json['customerName']?.toString() ??
          json['CustomerName']?.toString() ??
          '',
      vehicleRegistration:
          json['vehicleRegistration']?.toString() ??
          json['VehicleRegistration']?.toString() ??
          '',
      vehicle: json['vehicle']?.toString() ?? json['Vehicle']?.toString() ?? '',
      jobCardStatus:
          json['jobCardStatus']?.toString() ??
          json['JobCardStatus']?.toString() ??
          '',
      totalServices:
          json['totalServices'] as int? ?? json['TotalServices'] as int? ?? 0,
      jobCardTotal:
          (json['jobCardTotal'] as num?)?.toDouble() ??
          (json['JobCardTotal'] as num?)?.toDouble() ??
          0.0,
    );
  }
}

class DailyInvoiceRowModel {
  final String invoiceId;
  final String invoiceNumber;
  final DateTime invoiceDate;
  final String jobCardNumber;
  final String customerName;
  final String vehicleRegistration;
  final String invoiceStatus;
  final double invoiceTotal;
  final double amountPaid;
  final double amountPending;

  const DailyInvoiceRowModel({
    required this.invoiceId,
    required this.invoiceNumber,
    required this.invoiceDate,
    required this.jobCardNumber,
    required this.customerName,
    required this.vehicleRegistration,
    required this.invoiceStatus,
    required this.invoiceTotal,
    required this.amountPaid,
    required this.amountPending,
  });

  factory DailyInvoiceRowModel.fromJson(Map<String, dynamic> json) {
    return DailyInvoiceRowModel(
      invoiceId:
          json['invoiceId']?.toString() ?? json['InvoiceId']?.toString() ?? '',
      invoiceNumber:
          json['invoiceNumber']?.toString() ??
          json['InvoiceNumber']?.toString() ??
          '',
      invoiceDate:
          DateTime.tryParse(
            json['invoiceDate']?.toString() ??
                json['InvoiceDate']?.toString() ??
                '',
          ) ??
          DateTime.now(),
      jobCardNumber:
          json['jobCardNumber']?.toString() ??
          json['JobCardNumber']?.toString() ??
          '',
      customerName:
          json['customerName']?.toString() ??
          json['CustomerName']?.toString() ??
          '',
      vehicleRegistration:
          json['vehicleRegistration']?.toString() ??
          json['VehicleRegistration']?.toString() ??
          '',
      invoiceStatus:
          json['invoiceStatus']?.toString() ??
          json['InvoiceStatus']?.toString() ??
          '',
      invoiceTotal:
          (json['invoiceTotal'] as num?)?.toDouble() ??
          (json['InvoiceTotal'] as num?)?.toDouble() ??
          0.0,
      amountPaid:
          (json['amountPaid'] as num?)?.toDouble() ??
          (json['AmountPaid'] as num?)?.toDouble() ??
          0.0,
      amountPending:
          (json['amountPending'] as num?)?.toDouble() ??
          (json['AmountPending'] as num?)?.toDouble() ??
          0.0,
    );
  }
}

class DailyServiceRowModel {
  final String serviceItemId;
  final String jobCardNumber;
  final String? invoiceNumber;
  final String customerName;
  final String serviceName;
  final int quantity;
  final double rate;
  final double amount;

  const DailyServiceRowModel({
    required this.serviceItemId,
    required this.jobCardNumber,
    this.invoiceNumber,
    required this.customerName,
    required this.serviceName,
    required this.quantity,
    required this.rate,
    required this.amount,
  });

  factory DailyServiceRowModel.fromJson(Map<String, dynamic> json) {
    return DailyServiceRowModel(
      serviceItemId:
          json['serviceItemId']?.toString() ??
          json['ServiceItemId']?.toString() ??
          '',
      jobCardNumber:
          json['jobCardNumber']?.toString() ??
          json['JobCardNumber']?.toString() ??
          '',
      invoiceNumber:
          json['invoiceNumber']?.toString() ??
          json['InvoiceNumber']?.toString(),
      customerName:
          json['customerName']?.toString() ??
          json['CustomerName']?.toString() ??
          '',
      serviceName:
          json['serviceName']?.toString() ??
          json['ServiceName']?.toString() ??
          '',
      quantity: json['quantity'] as int? ?? json['Quantity'] as int? ?? 1,
      rate:
          (json['rate'] as num?)?.toDouble() ??
          (json['Rate'] as num?)?.toDouble() ??
          0.0,
      amount:
          (json['amount'] as num?)?.toDouble() ??
          (json['Amount'] as num?)?.toDouble() ??
          0.0,
    );
  }
}

class DailyBillingSheetModel {
  final int day;
  final String date;
  final String dateFormatted;
  final String sheetName;
  final bool hasActivity;
  final DailyTotalsModel totals;
  final List<DailyJobCardRowModel> jobCards;
  final List<DailyInvoiceRowModel> invoices;
  final List<DailyServiceRowModel> services;

  const DailyBillingSheetModel({
    required this.day,
    required this.date,
    required this.dateFormatted,
    required this.sheetName,
    required this.hasActivity,
    required this.totals,
    required this.jobCards,
    required this.invoices,
    required this.services,
  });

  factory DailyBillingSheetModel.fromJson(Map<String, dynamic> json) {
    return DailyBillingSheetModel(
      day: json['day'] as int? ?? json['Day'] as int? ?? 1,
      date: json['date']?.toString() ?? json['Date']?.toString() ?? '',
      dateFormatted:
          json['dateFormatted']?.toString() ??
          json['DateFormatted']?.toString() ??
          '',
      sheetName:
          json['sheetName']?.toString() ?? json['SheetName']?.toString() ?? '',
      hasActivity:
          json['hasActivity'] as bool? ?? json['HasActivity'] as bool? ?? false,
      totals: DailyTotalsModel.fromJson(
        (json['totals'] ?? json['Totals'] ?? {}) as Map<String, dynamic>,
      ),
      jobCards:
          (json['jobCards'] as List<dynamic>?)
              ?.map(
                (e) => DailyJobCardRowModel.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          (json['JobCards'] as List<dynamic>?)
              ?.map(
                (e) => DailyJobCardRowModel.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          [],
      invoices:
          (json['invoices'] as List<dynamic>?)
              ?.map(
                (e) => DailyInvoiceRowModel.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          (json['Invoices'] as List<dynamic>?)
              ?.map(
                (e) => DailyInvoiceRowModel.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          [],
      services:
          (json['services'] as List<dynamic>?)
              ?.map(
                (e) => DailyServiceRowModel.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          (json['Services'] as List<dynamic>?)
              ?.map(
                (e) => DailyServiceRowModel.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          [],
    );
  }
}

class MonthlyBillingSummaryModel {
  final String monthName;
  final String startDate;
  final String endDate;
  final String generatedAt;
  final int totalJobCardsCreated;
  final int totalJobCardsFinished;
  final int totalInvoices;
  final int totalInvoicesPaid;
  final int totalInvoicesPendingPayment;
  final int totalInvoicesDraft;
  final int totalInvoicesCancelled;
  final double totalInvoiceAmount;
  final double totalAmountPaid;
  final double totalAmountPending;
  final int totalServicesPerformed;
  final int totalServiceQuantity;

  const MonthlyBillingSummaryModel({
    required this.monthName,
    required this.startDate,
    required this.endDate,
    required this.generatedAt,
    required this.totalJobCardsCreated,
    required this.totalJobCardsFinished,
    required this.totalInvoices,
    required this.totalInvoicesPaid,
    required this.totalInvoicesPendingPayment,
    required this.totalInvoicesDraft,
    required this.totalInvoicesCancelled,
    required this.totalInvoiceAmount,
    required this.totalAmountPaid,
    required this.totalAmountPending,
    required this.totalServicesPerformed,
    required this.totalServiceQuantity,
  });

  factory MonthlyBillingSummaryModel.fromJson(Map<String, dynamic> json) {
    return MonthlyBillingSummaryModel(
      monthName:
          json['monthName']?.toString() ?? json['MonthName']?.toString() ?? '',
      startDate:
          json['startDate']?.toString() ?? json['StartDate']?.toString() ?? '',
      endDate: json['endDate']?.toString() ?? json['EndDate']?.toString() ?? '',
      generatedAt:
          json['generatedAt']?.toString() ??
          json['GeneratedAt']?.toString() ??
          '',
      totalJobCardsCreated:
          json['totalJobCardsCreated'] as int? ??
          json['TotalJobCardsCreated'] as int? ??
          0,
      totalJobCardsFinished:
          json['totalJobCardsFinished'] as int? ??
          json['TotalJobCardsFinished'] as int? ??
          0,
      totalInvoices:
          json['totalInvoices'] as int? ?? json['TotalInvoices'] as int? ?? 0,
      totalInvoicesPaid:
          json['totalInvoicesPaid'] as int? ??
          json['TotalInvoicesPaid'] as int? ??
          0,
      totalInvoicesPendingPayment:
          json['totalInvoicesPendingPayment'] as int? ??
          json['TotalInvoicesPendingPayment'] as int? ??
          0,
      totalInvoicesDraft:
          json['totalInvoicesDraft'] as int? ??
          json['TotalInvoicesDraft'] as int? ??
          0,
      totalInvoicesCancelled:
          json['totalInvoicesCancelled'] as int? ??
          json['TotalInvoicesCancelled'] as int? ??
          0,
      totalInvoiceAmount:
          (json['totalInvoiceAmount'] as num?)?.toDouble() ??
          (json['TotalInvoiceAmount'] as num?)?.toDouble() ??
          0.0,
      totalAmountPaid:
          (json['totalAmountPaid'] as num?)?.toDouble() ??
          (json['TotalAmountPaid'] as num?)?.toDouble() ??
          0.0,
      totalAmountPending:
          (json['totalAmountPending'] as num?)?.toDouble() ??
          (json['TotalAmountPending'] as num?)?.toDouble() ??
          0.0,
      totalServicesPerformed:
          json['totalServicesPerformed'] as int? ??
          json['TotalServicesPerformed'] as int? ??
          0,
      totalServiceQuantity:
          json['totalServiceQuantity'] as int? ??
          json['TotalServiceQuantity'] as int? ??
          0,
    );
  }
}

class MonthlyBillingReportResponseModel {
  final int year;
  final int month;
  final String monthName;
  final String fromDate;
  final String toDate;
  final int daysInMonth;
  final MonthlyBillingSummaryModel summary;
  final List<DailyBillingSheetModel> dailySheets;

  const MonthlyBillingReportResponseModel({
    required this.year,
    required this.month,
    required this.monthName,
    required this.fromDate,
    required this.toDate,
    required this.daysInMonth,
    required this.summary,
    required this.dailySheets,
  });

  factory MonthlyBillingReportResponseModel.fromJson(
    Map<String, dynamic> json,
  ) {
    return MonthlyBillingReportResponseModel(
      year: json['year'] as int? ?? json['Year'] as int? ?? DateTime.now().year,
      month:
          json['month'] as int? ??
          json['Month'] as int? ??
          DateTime.now().month,
      monthName:
          json['monthName']?.toString() ?? json['MonthName']?.toString() ?? '',
      fromDate:
          json['fromDate']?.toString() ?? json['FromDate']?.toString() ?? '',
      toDate: json['toDate']?.toString() ?? json['ToDate']?.toString() ?? '',
      daysInMonth:
          json['daysInMonth'] as int? ?? json['DaysInMonth'] as int? ?? 30,
      summary: MonthlyBillingSummaryModel.fromJson(
        (json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>,
      ),
      dailySheets:
          (json['dailySheets'] as List<dynamic>?)
              ?.map(
                (e) =>
                    DailyBillingSheetModel.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          (json['DailySheets'] as List<dynamic>?)
              ?.map(
                (e) =>
                    DailyBillingSheetModel.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          [],
    );
  }
}
