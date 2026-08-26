import '../../invoices/models/invoice_model.dart';
import '../../jobcards/models/job_card_model.dart';

JobCardStatus _parseJobCardStatus(dynamic val) {
  if (val == null) return JobCardStatus.draft;
  if (val is int) return JobCardStatus.fromValue(val);
  if (val is String) {
    final parsedInt = int.tryParse(val);
    if (parsedInt != null) return JobCardStatus.fromValue(parsedInt);
    return JobCardStatus.fromString(val);
  }
  return JobCardStatus.draft;
}

InvoiceStatus _parseInvoiceStatus(dynamic val) {
  if (val == null) return InvoiceStatus.draft;
  if (val is int) return InvoiceStatus.fromValue(val);
  if (val is String) {
    final parsedInt = int.tryParse(val);
    if (parsedInt != null) return InvoiceStatus.fromValue(parsedInt);
    return InvoiceStatus.fromString(val);
  }
  return InvoiceStatus.draft;
}

class JobCardReportRowModel {
  final String jobCardId;
  final String jobCardNumber;
  final DateTime date;
  final String customerName;
  final String customerPhone;
  final String vehicleRegistration;
  final String vehicleDetails;
  final JobCardStatus status;
  final double totalAmount;
  final String? invoiceId;
  final String? invoiceNumber;
  final InvoiceStatus? invoiceStatus;

  const JobCardReportRowModel({
    required this.jobCardId,
    required this.jobCardNumber,
    required this.date,
    required this.customerName,
    required this.customerPhone,
    required this.vehicleRegistration,
    required this.vehicleDetails,
    required this.status,
    required this.totalAmount,
    this.invoiceId,
    this.invoiceNumber,
    this.invoiceStatus,
  });

  factory JobCardReportRowModel.fromJson(Map<String, dynamic> json) {
    return JobCardReportRowModel(
      jobCardId: json['jobCardId']?.toString() ?? json['JobCardId']?.toString() ?? '',
      jobCardNumber: json['jobCardNumber']?.toString() ?? json['JobCardNumber']?.toString() ?? '',
      date: DateTime.tryParse(json['date']?.toString() ?? json['Date']?.toString() ?? '') ?? DateTime.now(),
      customerName: json['customerName']?.toString() ?? json['CustomerName']?.toString() ?? '',
      customerPhone: json['customerPhone']?.toString() ?? json['CustomerPhone']?.toString() ?? '',
      vehicleRegistration: json['vehicleRegistration']?.toString() ?? json['VehicleRegistration']?.toString() ?? '',
      vehicleDetails: json['vehicleDetails']?.toString() ?? json['VehicleDetails']?.toString() ?? '',
      status: _parseJobCardStatus(json['status'] ?? json['Status']),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
      invoiceId: json['invoiceId']?.toString() ?? json['InvoiceId']?.toString(),
      invoiceNumber: json['invoiceNumber']?.toString() ?? json['InvoiceNumber']?.toString(),
      invoiceStatus: json['invoiceStatus'] != null || json['InvoiceStatus'] != null
          ? _parseInvoiceStatus(json['invoiceStatus'] ?? json['InvoiceStatus'])
          : null,
    );
  }
}

class JobCardReportSummaryModel {
  final int totalCount;
  final int draftCount;
  final int inProgressCount;
  final int completedCount;
  final int cancelledCount;
  final int invoicedCount;
  final double totalRevenue;

  const JobCardReportSummaryModel({
    required this.totalCount,
    required this.draftCount,
    required this.inProgressCount,
    required this.completedCount,
    required this.cancelledCount,
    required this.invoicedCount,
    required this.totalRevenue,
  });

  factory JobCardReportSummaryModel.fromJson(Map<String, dynamic> json) {
    return JobCardReportSummaryModel(
      totalCount: json['totalCount'] as int? ?? json['TotalCount'] as int? ?? 0,
      draftCount: json['draftCount'] as int? ?? json['DraftCount'] as int? ?? 0,
      inProgressCount: json['inProgressCount'] as int? ?? json['InProgressCount'] as int? ?? 0,
      completedCount: json['completedCount'] as int? ?? json['CompletedCount'] as int? ?? 0,
      cancelledCount: json['cancelledCount'] as int? ?? json['CancelledCount'] as int? ?? 0,
      invoicedCount: json['invoicedCount'] as int? ?? json['InvoicedCount'] as int? ?? 0,
      totalRevenue: ((json['totalRevenue'] ?? json['TotalRevenue'] ?? 0.0) as num).toDouble(),
    );
  }
}

class JobCardReportResponseModel {
  final List<JobCardReportRowModel> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final JobCardReportSummaryModel summary;

  const JobCardReportResponseModel({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
    required this.summary,
  });

  factory JobCardReportResponseModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return JobCardReportResponseModel(
      items: rawItems.map((item) => JobCardReportRowModel.fromJson(item as Map<String, dynamic>)).toList(),
      totalCount: json['totalCount'] as int? ?? json['TotalCount'] as int? ?? 0,
      page: json['page'] as int? ?? json['Page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? json['PageSize'] as int? ?? 20,
      summary: JobCardReportSummaryModel.fromJson((json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>),
    );
  }
}
