import 'package:flutter/foundation.dart';
import 'invoice_model.dart';

@immutable
class UpdateInvoiceRequest {
  final double? discount;
  final String? notes;
  final InvoiceStatus? status;
  final bool? isGstEnabled;

  const UpdateInvoiceRequest({
    this.discount,
    this.notes,
    this.status,
    this.isGstEnabled,
  });

  Map<String, dynamic> toJson() => {
    if (discount != null) 'discount': discount,
    if (notes != null) 'notes': notes!.trim(),
    if (status != null) 'status': status!.value,
    if (isGstEnabled != null) 'isGstEnabled': isGstEnabled,
  };
}

@immutable
class RecordPaymentRequest {
  final double amount;
  final String paymentMethod;
  final String? reference;
  final DateTime? paymentDate;

  const RecordPaymentRequest({
    required this.amount,
    required this.paymentMethod,
    this.reference,
    this.paymentDate,
  });

  Map<String, dynamic> toJson() => {
    'amount': amount,
    'paymentMethod': paymentMethod,
    if (reference != null && reference!.trim().isNotEmpty) 'reference': reference!.trim(),
    if (paymentDate != null) 'paymentDate': paymentDate!.toIso8601String(),
  };
}
