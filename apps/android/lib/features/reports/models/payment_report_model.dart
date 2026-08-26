class PaymentReportRowModel {
  final String paymentId;
  final String invoiceId;
  final String? invoiceNumber;
  final String customerName;
  final DateTime paymentDate;
  final String paymentMethod;
  final String? reference;
  final double amount;
  final bool isVoided;
  final DateTime? voidedAt;

  const PaymentReportRowModel({
    required this.paymentId,
    required this.invoiceId,
    this.invoiceNumber,
    required this.customerName,
    required this.paymentDate,
    required this.paymentMethod,
    this.reference,
    required this.amount,
    required this.isVoided,
    this.voidedAt,
  });

  factory PaymentReportRowModel.fromJson(Map<String, dynamic> json) {
    return PaymentReportRowModel(
      paymentId: json['paymentId']?.toString() ?? json['PaymentId']?.toString() ?? '',
      invoiceId: json['invoiceId']?.toString() ?? json['InvoiceId']?.toString() ?? '',
      invoiceNumber: json['invoiceNumber']?.toString() ?? json['InvoiceNumber']?.toString(),
      customerName: json['customerName']?.toString() ?? json['CustomerName']?.toString() ?? '',
      paymentDate: DateTime.tryParse(json['paymentDate']?.toString() ?? json['PaymentDate']?.toString() ?? '') ?? DateTime.now(),
      paymentMethod: json['paymentMethod']?.toString() ?? json['PaymentMethod']?.toString() ?? '',
      reference: json['reference']?.toString() ?? json['Reference']?.toString(),
      amount: ((json['amount'] ?? json['Amount'] ?? 0.0) as num).toDouble(),
      isVoided: json['isVoided'] as bool? ?? json['IsVoided'] as bool? ?? false,
      voidedAt: json['voidedAt'] != null || json['VoidedAt'] != null
          ? DateTime.tryParse(json['voidedAt']?.toString() ?? json['VoidedAt']?.toString() ?? '')
          : null,
    );
  }
}

class PaymentReportSummaryModel {
  final double totalCollected;
  final int transactionCount;
  final double cashAmount;
  final double upiAmount;
  final double cardAmount;
  final double bankTransferAmount;
  final int voidedTransactionCount;
  final double voidedAmount;

  const PaymentReportSummaryModel({
    required this.totalCollected,
    required this.transactionCount,
    required this.cashAmount,
    required this.upiAmount,
    required this.cardAmount,
    required this.bankTransferAmount,
    required this.voidedTransactionCount,
    required this.voidedAmount,
  });

  factory PaymentReportSummaryModel.fromJson(Map<String, dynamic> json) {
    return PaymentReportSummaryModel(
      totalCollected: ((json['totalCollected'] ?? json['TotalCollected'] ?? 0.0) as num).toDouble(),
      transactionCount: json['transactionCount'] as int? ?? json['TransactionCount'] as int? ?? 0,
      cashAmount: ((json['cashAmount'] ?? json['CashAmount'] ?? 0.0) as num).toDouble(),
      upiAmount: ((json['upiAmount'] ?? json['UpiAmount'] ?? 0.0) as num).toDouble(),
      cardAmount: ((json['cardAmount'] ?? json['CardAmount'] ?? 0.0) as num).toDouble(),
      bankTransferAmount: ((json['bankTransferAmount'] ?? json['BankTransferAmount'] ?? 0.0) as num).toDouble(),
      voidedTransactionCount: json['voidedTransactionCount'] as int? ?? json['VoidedTransactionCount'] as int? ?? 0,
      voidedAmount: ((json['voidedAmount'] ?? json['VoidedAmount'] ?? 0.0) as num).toDouble(),
    );
  }
}

class PaymentReportResponseModel {
  final List<PaymentReportRowModel> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final PaymentReportSummaryModel summary;

  const PaymentReportResponseModel({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
    required this.summary,
  });

  factory PaymentReportResponseModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return PaymentReportResponseModel(
      items: rawItems.map((item) => PaymentReportRowModel.fromJson(item as Map<String, dynamic>)).toList(),
      totalCount: json['totalCount'] as int? ?? json['TotalCount'] as int? ?? 0,
      page: json['page'] as int? ?? json['Page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? json['PageSize'] as int? ?? 20,
      summary: PaymentReportSummaryModel.fromJson((json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>),
    );
  }
}
