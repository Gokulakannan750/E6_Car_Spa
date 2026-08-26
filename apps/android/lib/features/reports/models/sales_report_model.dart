import '../../invoices/models/invoice_model.dart';

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

class SalesReportRowModel {
  final String invoiceId;
  final String? invoiceNumber;
  final DateTime invoiceDate;
  final String customerName;
  final String customerPhone;
  final String registrationNumber;
  final double subtotal;
  final double discount;
  final double gst;
  final double totalAmount;
  final double paidAmount;
  final double balanceAmount;
  final InvoiceStatus status;

  const SalesReportRowModel({
    required this.invoiceId,
    this.invoiceNumber,
    required this.invoiceDate,
    required this.customerName,
    required this.customerPhone,
    required this.registrationNumber,
    required this.subtotal,
    required this.discount,
    required this.gst,
    required this.totalAmount,
    required this.paidAmount,
    required this.balanceAmount,
    required this.status,
  });

  factory SalesReportRowModel.fromJson(Map<String, dynamic> json) {
    return SalesReportRowModel(
      invoiceId: json['invoiceId']?.toString() ?? json['InvoiceId']?.toString() ?? '',
      invoiceNumber: json['invoiceNumber']?.toString() ?? json['InvoiceNumber']?.toString(),
      invoiceDate: DateTime.tryParse(json['invoiceDate']?.toString() ?? json['InvoiceDate']?.toString() ?? '') ?? DateTime.now(),
      customerName: json['customerName']?.toString() ?? json['CustomerName']?.toString() ?? '',
      customerPhone: json['customerPhone']?.toString() ?? json['CustomerPhone']?.toString() ?? '',
      registrationNumber: json['registrationNumber']?.toString() ?? json['RegistrationNumber']?.toString() ?? '',
      subtotal: ((json['subtotal'] ?? json['Subtotal'] ?? 0.0) as num).toDouble(),
      discount: ((json['discount'] ?? json['Discount'] ?? 0.0) as num).toDouble(),
      gst: ((json['gst'] ?? json['Gst'] ?? 0.0) as num).toDouble(),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
      paidAmount: ((json['paidAmount'] ?? json['PaidAmount'] ?? 0.0) as num).toDouble(),
      balanceAmount: ((json['balanceAmount'] ?? json['BalanceAmount'] ?? 0.0) as num).toDouble(),
      status: _parseInvoiceStatus(json['status'] ?? json['Status']),
    );
  }
}

class SalesReportSummaryModel {
  final double totalSubtotal;
  final double totalDiscount;
  final double totalGst;
  final double totalAmount;
  final double totalPaid;
  final double totalBalance;
  final int invoiceCount;

  const SalesReportSummaryModel({
    required this.totalSubtotal,
    required this.totalDiscount,
    required this.totalGst,
    required this.totalAmount,
    required this.totalPaid,
    required this.totalBalance,
    required this.invoiceCount,
  });

  factory SalesReportSummaryModel.fromJson(Map<String, dynamic> json) {
    return SalesReportSummaryModel(
      totalSubtotal: ((json['totalSubtotal'] ?? json['TotalSubtotal'] ?? 0.0) as num).toDouble(),
      totalDiscount: ((json['totalDiscount'] ?? json['TotalDiscount'] ?? 0.0) as num).toDouble(),
      totalGst: ((json['totalGst'] ?? json['TotalGst'] ?? 0.0) as num).toDouble(),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
      totalPaid: ((json['totalPaid'] ?? json['TotalPaid'] ?? 0.0) as num).toDouble(),
      totalBalance: ((json['totalBalance'] ?? json['TotalBalance'] ?? 0.0) as num).toDouble(),
      invoiceCount: json['invoiceCount'] as int? ?? json['InvoiceCount'] as int? ?? 0,
    );
  }
}

class SalesReportResponseModel {
  final List<SalesReportRowModel> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final SalesReportSummaryModel summary;

  const SalesReportResponseModel({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
    required this.summary,
  });

  factory SalesReportResponseModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return SalesReportResponseModel(
      items: rawItems.map((item) => SalesReportRowModel.fromJson(item as Map<String, dynamic>)).toList(),
      totalCount: json['totalCount'] as int? ?? json['TotalCount'] as int? ?? 0,
      page: json['page'] as int? ?? json['Page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? json['PageSize'] as int? ?? 20,
      summary: SalesReportSummaryModel.fromJson((json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>),
    );
  }
}
