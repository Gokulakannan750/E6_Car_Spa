import 'package:flutter/material.dart';

enum InvoiceStatus {
  draft(0, 'Draft'),
  sent(1, 'Sent'),
  paid(2, 'Paid'),
  partiallyPaid(3, 'Partially Paid'),
  cancelled(4, 'Cancelled'),
  overdue(5, 'Overdue'),
  generated(6, 'Generated');

  final int value;
  final String label;

  const InvoiceStatus(this.value, this.label);

  static InvoiceStatus fromValue(int value) {
    return InvoiceStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => InvoiceStatus.draft,
    );
  }

  static InvoiceStatus fromInt(int value) => fromValue(value);

  static InvoiceStatus fromString(String name) {
    final clean = name.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
    for (final s in InvoiceStatus.values) {
      final sClean = s.name.toLowerCase();
      if (sClean == clean || s.label.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '') == clean) {
        return s;
      }
    }
    return InvoiceStatus.draft;
  }
}

enum PaymentMethod {
  cash('Cash', 'Cash', Icons.wallet_rounded),
  upi('UPI', 'UPI / QR', Icons.qr_code_rounded),
  card('Card', 'Card', Icons.credit_card_rounded),
  bankTransfer('BankTransfer', 'Bank Transfer', Icons.account_balance_rounded);

  final String value;
  final String label;
  final IconData icon;

  const PaymentMethod(this.value, this.label, this.icon);

  static PaymentMethod fromString(String name) {
    final clean = name.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
    for (final m in PaymentMethod.values) {
      if (m.name.toLowerCase() == clean ||
          m.value.toLowerCase() == clean ||
          m.label.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '') == clean) {
        return m;
      }
    }
    return PaymentMethod.cash;
  }
}

@immutable
class InvoiceItem {
  final String id;
  final String? serviceId;
  final String description;
  final int quantity;
  final double unitPrice;
  final double discount;
  final double taxableAmount;
  final double taxAmount;
  final double totalAmount;

  const InvoiceItem({
    required this.id,
    this.serviceId,
    required this.description,
    required this.quantity,
    required this.unitPrice,
    this.discount = 0.0,
    required this.taxableAmount,
    required this.taxAmount,
    required this.totalAmount,
  });

  factory InvoiceItem.fromJson(Map<String, dynamic> json) {
    return InvoiceItem(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      serviceId: json['serviceId'] as String? ?? json['ServiceId'] as String?,
      description: json['description'] as String? ?? json['Description'] as String? ?? '',
      quantity: (json['quantity'] ?? json['Quantity'] ?? 1) as int,
      unitPrice: ((json['unitPrice'] ?? json['UnitPrice'] ?? 0.0) as num).toDouble(),
      discount: ((json['discount'] ?? json['Discount'] ?? 0.0) as num).toDouble(),
      taxableAmount: ((json['taxableAmount'] ?? json['TaxableAmount'] ?? 0.0) as num).toDouble(),
      taxAmount: ((json['taxAmount'] ?? json['TaxAmount'] ?? 0.0) as num).toDouble(),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    if (serviceId != null) 'serviceId': serviceId,
    'description': description,
    'quantity': quantity,
    'unitPrice': unitPrice,
    'discount': discount,
    'taxableAmount': taxableAmount,
    'taxAmount': taxAmount,
    'totalAmount': totalAmount,
  };
}

@immutable
class PaymentDto {
  final String id;
  final String invoiceId;
  final double amount;
  final String paymentMethod;
  final String? reference;
  final DateTime paymentDate;
  final DateTime createdAt;

  const PaymentDto({
    required this.id,
    required this.invoiceId,
    required this.amount,
    required this.paymentMethod,
    this.reference,
    required this.paymentDate,
    required this.createdAt,
  });

  PaymentMethod get method => PaymentMethod.fromString(paymentMethod);

  factory PaymentDto.fromJson(Map<String, dynamic> json) {
    return PaymentDto(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      invoiceId: json['invoiceId'] as String? ?? json['InvoiceId'] as String? ?? '',
      amount: ((json['amount'] ?? json['Amount'] ?? 0.0) as num).toDouble(),
      paymentMethod: json['paymentMethod'] as String? ?? json['PaymentMethod'] as String? ?? 'Cash',
      reference: json['reference'] as String? ?? json['Reference'] as String?,
      paymentDate: json['paymentDate'] != null
          ? DateTime.tryParse(json['paymentDate'].toString()) ?? DateTime.now()
          : (json['PaymentDate'] != null
              ? DateTime.tryParse(json['PaymentDate'].toString()) ?? DateTime.now()
              : DateTime.now()),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'invoiceId': invoiceId,
    'amount': amount,
    'paymentMethod': paymentMethod,
    if (reference != null) 'reference': reference,
    'paymentDate': paymentDate.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
  };
}

@immutable
class Invoice {
  final String id;
  final String? invoiceNumber;
  final String jobCardId;
  final String jobCardNumber;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String vehicleId;
  final String registrationNumber;
  final String vehicleMake;
  final String vehicleModel;
  final String? vehicleVariant;
  final String? vehicleColor;
  final DateTime invoiceDate;
  final double subtotal;
  final double discount;
  final double taxableAmount;
  final double gstAmount;
  final double totalAmount;
  final double paidAmount;
  final double balanceAmount;
  final InvoiceStatus status;
  final String? notes;
  final bool isGstEnabled;
  final List<InvoiceItem> items;
  final List<PaymentDto> payments;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const Invoice({
    required this.id,
    this.invoiceNumber,
    required this.jobCardId,
    required this.jobCardNumber,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.vehicleId,
    required this.registrationNumber,
    required this.vehicleMake,
    required this.vehicleModel,
    this.vehicleVariant,
    this.vehicleColor,
    required this.invoiceDate,
    required this.subtotal,
    this.discount = 0.0,
    required this.taxableAmount,
    required this.gstAmount,
    required this.totalAmount,
    this.paidAmount = 0.0,
    required this.balanceAmount,
    required this.status,
    this.notes,
    this.isGstEnabled = true,
    required this.items,
    this.payments = const [],
    required this.createdAt,
    this.updatedAt,
  });

  bool get isDraft => invoiceNumber == null || invoiceNumber!.trim().isEmpty || status == InvoiceStatus.draft;
  bool get isPaid => status == InvoiceStatus.paid || (paidAmount >= totalAmount && totalAmount > 0);
  bool get isPartiallyPaid => status == InvoiceStatus.partiallyPaid || (paidAmount > 0 && paidAmount < totalAmount);
  bool get isCancelled => status == InvoiceStatus.cancelled;
  bool get isFinalized => !isDraft && !isCancelled;

  String get vehicleDisplayName {
    final buffer = StringBuffer('$vehicleMake $vehicleModel');
    if (vehicleVariant != null && vehicleVariant!.trim().isNotEmpty) {
      buffer.write(' ($vehicleVariant)');
    }
    return buffer.toString().trim();
  }

  factory Invoice.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    final rawPayments = json['payments'] as List<dynamic>? ?? json['Payments'] as List<dynamic>? ?? [];
    final statusRaw = json['status'] ?? json['Status'] ?? 0;
    final statusInt = statusRaw is int ? statusRaw : (int.tryParse(statusRaw.toString()) ?? 0);

    return Invoice(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      invoiceNumber: json['invoiceNumber'] as String? ?? json['InvoiceNumber'] as String?,
      jobCardId: json['jobCardId'] as String? ?? json['JobCardId'] as String? ?? '',
      jobCardNumber: json['jobCardNumber'] as String? ?? json['JobCardNumber'] as String? ?? '',
      customerId: json['customerId'] as String? ?? json['CustomerId'] as String? ?? '',
      customerName: json['customerName'] as String? ?? json['CustomerName'] as String? ?? '',
      customerPhone: json['customerPhone'] as String? ?? json['CustomerPhone'] as String? ?? '',
      vehicleId: json['vehicleId'] as String? ?? json['VehicleId'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String? ?? json['RegistrationNumber'] as String? ?? '',
      vehicleMake: json['vehicleMake'] as String? ?? json['VehicleMake'] as String? ?? '',
      vehicleModel: json['vehicleModel'] as String? ?? json['VehicleModel'] as String? ?? '',
      vehicleVariant: json['vehicleVariant'] as String? ?? json['VehicleVariant'] as String?,
      vehicleColor: json['vehicleColor'] as String? ?? json['VehicleColor'] as String?,
      invoiceDate: json['invoiceDate'] != null
          ? DateTime.tryParse(json['invoiceDate'].toString()) ?? DateTime.now()
          : (json['InvoiceDate'] != null
              ? DateTime.tryParse(json['InvoiceDate'].toString()) ?? DateTime.now()
              : DateTime.now()),
      subtotal: ((json['subtotal'] ?? json['Subtotal'] ?? 0.0) as num).toDouble(),
      discount: ((json['discount'] ?? json['Discount'] ?? 0.0) as num).toDouble(),
      taxableAmount: ((json['taxableAmount'] ?? json['TaxableAmount'] ?? 0.0) as num).toDouble(),
      gstAmount: ((json['gstAmount'] ?? json['GstAmount'] ?? 0.0) as num).toDouble(),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
      paidAmount: ((json['paidAmount'] ?? json['PaidAmount'] ?? 0.0) as num).toDouble(),
      balanceAmount: ((json['balanceAmount'] ?? json['BalanceAmount'] ?? 0.0) as num).toDouble(),
      status: InvoiceStatus.fromValue(statusInt),
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      isGstEnabled: (json['isGstEnabled'] ?? json['IsGstEnabled'] ?? true) as bool,
      items: rawItems.map((e) => InvoiceItem.fromJson(e as Map<String, dynamic>)).toList(),
      payments: rawPayments.map((e) => PaymentDto.fromJson(e as Map<String, dynamic>)).toList(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : (json['UpdatedAt'] != null ? DateTime.tryParse(json['UpdatedAt'].toString()) : null),
    );
  }
}

@immutable
class InvoiceListItem {
  final String id;
  final String? invoiceNumber;
  final String jobCardNumber;
  final String customerName;
  final String customerPhone;
  final String registrationNumber;
  final String vehicle;
  final DateTime invoiceDate;
  final double totalAmount;
  final double paidAmount;
  final double balanceAmount;
  final InvoiceStatus status;
  final DateTime createdAt;

  const InvoiceListItem({
    required this.id,
    this.invoiceNumber,
    required this.jobCardNumber,
    required this.customerName,
    required this.customerPhone,
    required this.registrationNumber,
    required this.vehicle,
    required this.invoiceDate,
    required this.totalAmount,
    this.paidAmount = 0.0,
    required this.balanceAmount,
    required this.status,
    required this.createdAt,
  });

  bool get isDraft => invoiceNumber == null || invoiceNumber!.trim().isEmpty || status == InvoiceStatus.draft;

  factory InvoiceListItem.fromJson(Map<String, dynamic> json) {
    final statusRaw = json['status'] ?? json['Status'] ?? 0;
    final statusInt = statusRaw is int ? statusRaw : (int.tryParse(statusRaw.toString()) ?? 0);

    return InvoiceListItem(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      invoiceNumber: json['invoiceNumber'] as String? ?? json['InvoiceNumber'] as String?,
      jobCardNumber: json['jobCardNumber'] as String? ?? json['JobCardNumber'] as String? ?? '',
      customerName: json['customerName'] as String? ?? json['CustomerName'] as String? ?? '',
      customerPhone: json['customerPhone'] as String? ?? json['CustomerPhone'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String? ?? json['RegistrationNumber'] as String? ?? '',
      vehicle: json['vehicle'] as String? ?? json['Vehicle'] as String? ?? '',
      invoiceDate: json['invoiceDate'] != null
          ? DateTime.tryParse(json['invoiceDate'].toString()) ?? DateTime.now()
          : (json['InvoiceDate'] != null
              ? DateTime.tryParse(json['InvoiceDate'].toString()) ?? DateTime.now()
              : DateTime.now()),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
      paidAmount: ((json['paidAmount'] ?? json['PaidAmount'] ?? 0.0) as num).toDouble(),
      balanceAmount: ((json['balanceAmount'] ?? json['BalanceAmount'] ?? 0.0) as num).toDouble(),
      status: InvoiceStatus.fromValue(statusInt),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
    );
  }
}

@immutable
class InvoiceListResponse {
  final List<InvoiceListItem> items;
  final int totalCount;
  final int page;
  final int pageSize;

  const InvoiceListResponse({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
  });

  factory InvoiceListResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return InvoiceListResponse(
      items: rawItems.map((e) => InvoiceListItem.fromJson(e as Map<String, dynamic>)).toList(),
      totalCount: (json['totalCount'] ?? json['TotalCount'] ?? 0) as int,
      page: (json['page'] ?? json['Page'] ?? 1) as int,
      pageSize: (json['pageSize'] ?? json['PageSize'] ?? 20) as int,
    );
  }
}
