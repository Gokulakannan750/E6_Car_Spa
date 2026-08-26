class GstReportRowModel {
  final String invoiceId;
  final String? invoiceNumber;
  final DateTime invoiceDate;
  final String customerName;
  final String registrationNumber;
  final bool isGstEnabled;
  final double taxableAmount;
  final double gstAmount;
  final double totalAmount;

  const GstReportRowModel({
    required this.invoiceId,
    this.invoiceNumber,
    required this.invoiceDate,
    required this.customerName,
    required this.registrationNumber,
    required this.isGstEnabled,
    required this.taxableAmount,
    required this.gstAmount,
    required this.totalAmount,
  });

  factory GstReportRowModel.fromJson(Map<String, dynamic> json) {
    return GstReportRowModel(
      invoiceId: json['invoiceId']?.toString() ?? json['InvoiceId']?.toString() ?? '',
      invoiceNumber: json['invoiceNumber']?.toString() ?? json['InvoiceNumber']?.toString(),
      invoiceDate: DateTime.tryParse(json['invoiceDate']?.toString() ?? json['InvoiceDate']?.toString() ?? '') ?? DateTime.now(),
      customerName: json['customerName']?.toString() ?? json['CustomerName']?.toString() ?? '',
      registrationNumber: json['registrationNumber']?.toString() ?? json['RegistrationNumber']?.toString() ?? '',
      isGstEnabled: json['isGstEnabled'] as bool? ?? json['IsGstEnabled'] as bool? ?? true,
      taxableAmount: ((json['taxableAmount'] ?? json['TaxableAmount'] ?? 0.0) as num).toDouble(),
      gstAmount: ((json['gstAmount'] ?? json['GstAmount'] ?? 0.0) as num).toDouble(),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
    );
  }
}

class GstReportModel {
  final int invoiceCount;
  final double grossSubtotal;
  final double totalDiscount;
  final double taxableBase;
  final double cgstAmount;
  final double sgstAmount;
  final double totalGstAmount;
  final double totalAmount;
  final List<GstReportRowModel> invoices;

  const GstReportModel({
    required this.invoiceCount,
    required this.grossSubtotal,
    required this.totalDiscount,
    required this.taxableBase,
    required this.cgstAmount,
    required this.sgstAmount,
    required this.totalGstAmount,
    required this.totalAmount,
    required this.invoices,
  });

  factory GstReportModel.fromJson(Map<String, dynamic> json) {
    final rawInvoices = json['invoices'] as List<dynamic>? ?? json['Invoices'] as List<dynamic>? ?? [];
    return GstReportModel(
      invoiceCount: json['invoiceCount'] as int? ?? json['InvoiceCount'] as int? ?? 0,
      grossSubtotal: ((json['grossSubtotal'] ?? json['GrossSubtotal'] ?? 0.0) as num).toDouble(),
      totalDiscount: ((json['totalDiscount'] ?? json['TotalDiscount'] ?? 0.0) as num).toDouble(),
      taxableBase: ((json['taxableBase'] ?? json['TaxableBase'] ?? 0.0) as num).toDouble(),
      cgstAmount: ((json['cgstAmount'] ?? json['CgstAmount'] ?? 0.0) as num).toDouble(),
      sgstAmount: ((json['sgstAmount'] ?? json['SgstAmount'] ?? 0.0) as num).toDouble(),
      totalGstAmount: ((json['totalGstAmount'] ?? json['TotalGstAmount'] ?? 0.0) as num).toDouble(),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
      invoices: rawInvoices.map((item) => GstReportRowModel.fromJson(item as Map<String, dynamic>)).toList(),
    );
  }
}
