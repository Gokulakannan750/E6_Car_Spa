import 'package:flutter/foundation.dart';

@immutable
class StaffSalaryItem {
  final String staffId;
  final String staffName;
  final String? staffRole;
  final String staffPhoneNumber;
  final bool isActive;
  final String periodFrom;
  final String periodTo;
  final double? enteredSalary;
  final double outstandingAdvance;
  final double? advanceDeduction;
  final double? finalSalary;
  final double? remainingAdvance;
  final String status; // 'NotEntered', 'Ready', 'Settled'
  final DateTime? settledAt;
  final String? settledByName;
  final String? notes;
  final String? settlementId;

  const StaffSalaryItem({
    required this.staffId,
    required this.staffName,
    this.staffRole,
    required this.staffPhoneNumber,
    this.isActive = true,
    required this.periodFrom,
    required this.periodTo,
    this.enteredSalary,
    this.outstandingAdvance = 0.0,
    this.advanceDeduction,
    this.finalSalary,
    this.remainingAdvance,
    required this.status,
    this.settledAt,
    this.settledByName,
    this.notes,
    this.settlementId,
  });

  bool get isSettled => status == 'Settled' || settlementId != null;
  bool get isReady => status == 'Ready';
  bool get isNotEntered => status == 'NotEntered' || enteredSalary == null;

  factory StaffSalaryItem.fromJson(Map<String, dynamic> json) {
    DateTime? parsedSettledAt;
    final rawSettledAt = json['settledAt'] ?? json['SettledAt'];
    if (rawSettledAt != null && rawSettledAt is String) {
      parsedSettledAt = DateTime.tryParse(rawSettledAt);
    }

    return StaffSalaryItem(
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      staffRole: json['staffRole'] as String? ?? json['StaffRole'] as String?,
      staffPhoneNumber: json['staffPhoneNumber'] as String? ?? json['StaffPhoneNumber'] as String? ?? '',
      isActive: (json['isActive'] ?? json['IsActive'] ?? true) as bool,
      periodFrom: json['periodFrom'] as String? ?? json['PeriodFrom'] as String? ?? '',
      periodTo: json['periodTo'] as String? ?? json['PeriodTo'] as String? ?? '',
      enteredSalary: (json['enteredSalary'] ?? json['EnteredSalary'] as num?)?.toDouble(),
      outstandingAdvance: ((json['outstandingAdvance'] ?? json['OutstandingAdvance'] ?? 0.0) as num).toDouble(),
      advanceDeduction: (json['advanceDeduction'] ?? json['AdvanceDeduction'] as num?)?.toDouble(),
      finalSalary: (json['finalSalary'] ?? json['FinalSalary'] as num?)?.toDouble(),
      remainingAdvance: (json['remainingAdvance'] ?? json['RemainingAdvance'] as num?)?.toDouble(),
      status: json['status'] as String? ?? json['Status'] as String? ?? 'NotEntered',
      settledAt: parsedSettledAt,
      settledByName: json['settledByName'] as String? ?? json['SettledByName'] as String?,
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      settlementId: json['settlementId'] as String? ?? json['SettlementId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'staffId': staffId,
    'staffName': staffName,
    'staffRole': staffRole,
    'staffPhoneNumber': staffPhoneNumber,
    'isActive': isActive,
    'periodFrom': periodFrom,
    'periodTo': periodTo,
    'enteredSalary': enteredSalary,
    'outstandingAdvance': outstandingAdvance,
    'advanceDeduction': advanceDeduction,
    'finalSalary': finalSalary,
    'remainingAdvance': remainingAdvance,
    'status': status,
    'settledAt': settledAt?.toIso8601String(),
    'settledByName': settledByName,
    'notes': notes,
    'settlementId': settlementId,
  };
}

@immutable
class StaffSalaryRosterResponse {
  final String periodFrom;
  final String periodTo;
  final int totalStaffCount;
  final int notEnteredCount;
  final int readyCount;
  final int settledCount;
  final double totalEnteredSalary;
  final double totalAdvanceDeductions;
  final double totalFinalSalary;
  final List<StaffSalaryItem> items;

  const StaffSalaryRosterResponse({
    required this.periodFrom,
    required this.periodTo,
    this.totalStaffCount = 0,
    this.notEnteredCount = 0,
    this.readyCount = 0,
    this.settledCount = 0,
    this.totalEnteredSalary = 0.0,
    this.totalAdvanceDeductions = 0.0,
    this.totalFinalSalary = 0.0,
    this.items = const [],
  });

  factory StaffSalaryRosterResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] ?? json['Items']) as List<dynamic>? ?? [];
    return StaffSalaryRosterResponse(
      periodFrom: json['periodFrom'] as String? ?? json['PeriodFrom'] as String? ?? '',
      periodTo: json['periodTo'] as String? ?? json['PeriodTo'] as String? ?? '',
      totalStaffCount: (json['totalStaffCount'] ?? json['TotalStaffCount'] ?? 0) as int,
      notEnteredCount: (json['notEnteredCount'] ?? json['NotEnteredCount'] ?? 0) as int,
      readyCount: (json['readyCount'] ?? json['ReadyCount'] ?? 0) as int,
      settledCount: (json['settledCount'] ?? json['SettledCount'] ?? 0) as int,
      totalEnteredSalary: ((json['totalEnteredSalary'] ?? json['TotalEnteredSalary'] ?? 0.0) as num).toDouble(),
      totalAdvanceDeductions: ((json['totalAdvanceDeductions'] ?? json['TotalAdvanceDeductions'] ?? 0.0) as num).toDouble(),
      totalFinalSalary: ((json['totalFinalSalary'] ?? json['TotalFinalSalary'] ?? 0.0) as num).toDouble(),
      items: rawItems.map((e) => StaffSalaryItem.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

@immutable
class StaffSalaryPreviewResponse {
  final String staffId;
  final String staffName;
  final String? staffRole;
  final String periodFrom;
  final String periodTo;
  final double enteredSalary;
  final double outstandingAdvance;
  final double advanceDeduction;
  final double finalSalary;
  final double remainingAdvance;
  final String status;

  const StaffSalaryPreviewResponse({
    required this.staffId,
    required this.staffName,
    this.staffRole,
    required this.periodFrom,
    required this.periodTo,
    required this.enteredSalary,
    required this.outstandingAdvance,
    required this.advanceDeduction,
    required this.finalSalary,
    required this.remainingAdvance,
    required this.status,
  });

  factory StaffSalaryPreviewResponse.fromJson(Map<String, dynamic> json) {
    return StaffSalaryPreviewResponse(
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      staffRole: json['staffRole'] as String? ?? json['StaffRole'] as String?,
      periodFrom: json['periodFrom'] as String? ?? json['PeriodFrom'] as String? ?? '',
      periodTo: json['periodTo'] as String? ?? json['PeriodTo'] as String? ?? '',
      enteredSalary: ((json['enteredSalary'] ?? json['EnteredSalary'] ?? 0.0) as num).toDouble(),
      outstandingAdvance: ((json['outstandingAdvance'] ?? json['OutstandingAdvance'] ?? 0.0) as num).toDouble(),
      advanceDeduction: ((json['advanceDeduction'] ?? json['AdvanceDeduction'] ?? 0.0) as num).toDouble(),
      finalSalary: ((json['finalSalary'] ?? json['FinalSalary'] ?? 0.0) as num).toDouble(),
      remainingAdvance: ((json['remainingAdvance'] ?? json['RemainingAdvance'] ?? 0.0) as num).toDouble(),
      status: json['status'] as String? ?? json['Status'] as String? ?? 'Ready',
    );
  }
}

@immutable
class StaffSalarySettlement {
  final String id;
  final String staffId;
  final String staffName;
  final String? staffRole;
  final String periodFrom;
  final String periodTo;
  final double enteredSalary;
  final double outstandingAdvanceBeforeSettlement;
  final double advanceDeduction;
  final double remainingAdvanceAfterSettlement;
  final double finalSalary;
  final String status;
  final DateTime? settledAt;
  final String? settledByName;
  final String? notes;
  final DateTime createdAt;

  const StaffSalarySettlement({
    required this.id,
    required this.staffId,
    required this.staffName,
    this.staffRole,
    required this.periodFrom,
    required this.periodTo,
    required this.enteredSalary,
    required this.outstandingAdvanceBeforeSettlement,
    required this.advanceDeduction,
    required this.remainingAdvanceAfterSettlement,
    required this.finalSalary,
    required this.status,
    this.settledAt,
    this.settledByName,
    this.notes,
    required this.createdAt,
  });

  factory StaffSalarySettlement.fromJson(Map<String, dynamic> json) {
    DateTime? parsedSettledAt;
    final rawSettledAt = json['settledAt'] ?? json['SettledAt'];
    if (rawSettledAt != null && rawSettledAt is String) {
      parsedSettledAt = DateTime.tryParse(rawSettledAt);
    }

    DateTime parsedCreatedAt = DateTime.now();
    final rawCreated = json['createdAt'] ?? json['CreatedAt'];
    if (rawCreated != null && rawCreated is String) {
      parsedCreatedAt = DateTime.tryParse(rawCreated) ?? DateTime.now();
    }

    return StaffSalarySettlement(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      staffRole: json['staffRole'] as String? ?? json['StaffRole'] as String?,
      periodFrom: json['periodFrom'] as String? ?? json['PeriodFrom'] as String? ?? '',
      periodTo: json['periodTo'] as String? ?? json['PeriodTo'] as String? ?? '',
      enteredSalary: ((json['enteredSalary'] ?? json['EnteredSalary'] ?? 0.0) as num).toDouble(),
      outstandingAdvanceBeforeSettlement: ((json['outstandingAdvanceBeforeSettlement'] ?? json['OutstandingAdvanceBeforeSettlement'] ?? 0.0) as num).toDouble(),
      advanceDeduction: ((json['advanceDeduction'] ?? json['AdvanceDeduction'] ?? 0.0) as num).toDouble(),
      remainingAdvanceAfterSettlement: ((json['remainingAdvanceAfterSettlement'] ?? json['RemainingAdvanceAfterSettlement'] ?? 0.0) as num).toDouble(),
      finalSalary: ((json['finalSalary'] ?? json['FinalSalary'] ?? 0.0) as num).toDouble(),
      status: json['status'] as String? ?? json['Status'] as String? ?? 'Settled',
      settledAt: parsedSettledAt,
      settledByName: json['settledByName'] as String? ?? json['SettledByName'] as String?,
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      createdAt: parsedCreatedAt,
    );
  }
}
