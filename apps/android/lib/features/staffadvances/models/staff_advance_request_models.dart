import 'package:flutter/foundation.dart';

@immutable
class CreateStaffAdvanceRequest {
  final String staffId;
  final double amount;
  final DateTime advanceDate;
  final String reason;
  final String? notes;

  const CreateStaffAdvanceRequest({
    required this.staffId,
    required this.amount,
    required this.advanceDate,
    required this.reason,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
    'staffId': staffId,
    'amount': amount,
    'advanceDate': advanceDate.toIso8601String(),
    'reason': reason.trim(),
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
  };
}

@immutable
class ObsoleteStaffAdvanceRequest {
  final String reason;

  const ObsoleteStaffAdvanceRequest({
    required this.reason,
  });

  Map<String, dynamic> toJson() => {
    'reason': reason.trim(),
  };
}
