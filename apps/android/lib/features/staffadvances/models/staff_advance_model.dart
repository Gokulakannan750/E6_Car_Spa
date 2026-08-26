import 'package:flutter/foundation.dart';

enum StaffAdvanceStatus {
  outstanding('Outstanding'),
  settled('Settled'),
  obsolete('Obsolete');

  final String label;
  const StaffAdvanceStatus(this.label);

  static StaffAdvanceStatus fromString(String? status) {
    if (status == null) return StaffAdvanceStatus.outstanding;
    final lower = status.trim().toLowerCase();
    if (lower == 'settled') return StaffAdvanceStatus.settled;
    if (lower == 'obsolete') return StaffAdvanceStatus.obsolete;
    return StaffAdvanceStatus.outstanding;
  }
}

@immutable
class StaffAdvance {
  final String id;
  final String staffId;
  final String staffName;
  final String? staffPhone;
  final String? staffRole;
  final double amount;
  final DateTime advanceDate;
  final String reason;
  final String? notes;
  final StaffAdvanceStatus status;
  final DateTime? settledAt;
  final String? settledByUserId;
  final String? settledByName;
  final DateTime? obsoletedAt;
  final String? obsoletedByUserId;
  final String? obsoletedByName;
  final String? obsoleteReason;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const StaffAdvance({
    required this.id,
    required this.staffId,
    required this.staffName,
    this.staffPhone,
    this.staffRole,
    required this.amount,
    required this.advanceDate,
    required this.reason,
    this.notes,
    required this.status,
    this.settledAt,
    this.settledByUserId,
    this.settledByName,
    this.obsoletedAt,
    this.obsoletedByUserId,
    this.obsoletedByName,
    this.obsoleteReason,
    required this.createdAt,
    this.updatedAt,
  });

  bool get isOutstanding => status == StaffAdvanceStatus.outstanding;
  bool get isSettled => status == StaffAdvanceStatus.settled;
  bool get isObsolete => status == StaffAdvanceStatus.obsolete;

  factory StaffAdvance.fromJson(Map<String, dynamic> json) {
    return StaffAdvance(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      staffPhone: json['staffPhone'] as String? ?? json['StaffPhone'] as String?,
      staffRole: json['staffRole'] as String? ?? json['StaffRole'] as String?,
      amount: ((json['amount'] ?? json['Amount'] ?? 0.0) as num).toDouble(),
      advanceDate: json['advanceDate'] != null
          ? DateTime.tryParse(json['advanceDate'].toString()) ?? DateTime.now()
          : (json['AdvanceDate'] != null
              ? DateTime.tryParse(json['AdvanceDate'].toString()) ?? DateTime.now()
              : DateTime.now()),
      reason: json['reason'] as String? ?? json['Reason'] as String? ?? '',
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      status: StaffAdvanceStatus.fromString(
        json['status'] as String? ?? json['Status'] as String?,
      ),
      settledAt: json['settledAt'] != null
          ? DateTime.tryParse(json['settledAt'].toString())
          : (json['SettledAt'] != null ? DateTime.tryParse(json['SettledAt'].toString()) : null),
      settledByUserId: json['settledByUserId'] as String? ?? json['SettledByUserId'] as String?,
      settledByName: json['settledByName'] as String? ?? json['SettledByName'] as String?,
      obsoletedAt: json['obsoletedAt'] != null
          ? DateTime.tryParse(json['obsoletedAt'].toString())
          : (json['ObsoletedAt'] != null ? DateTime.tryParse(json['ObsoletedAt'].toString()) : null),
      obsoletedByUserId: json['obsoletedByUserId'] as String? ?? json['ObsoletedByUserId'] as String?,
      obsoletedByName: json['obsoletedByName'] as String? ?? json['ObsoletedByName'] as String?,
      obsoleteReason: json['obsoleteReason'] as String? ?? json['ObsoleteReason'] as String?,
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

  Map<String, dynamic> toJson() => {
    'id': id,
    'staffId': staffId,
    'staffName': staffName,
    'staffPhone': staffPhone,
    'staffRole': staffRole,
    'amount': amount,
    'advanceDate': advanceDate.toIso8601String(),
    'reason': reason,
    'notes': notes,
    'status': status.label,
    'settledAt': settledAt?.toIso8601String(),
    'settledByUserId': settledByUserId,
    'settledByName': settledByName,
    'obsoletedAt': obsoletedAt?.toIso8601String(),
    'obsoletedByUserId': obsoletedByUserId,
    'obsoletedByName': obsoletedByName,
    'obsoleteReason': obsoleteReason,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt?.toIso8601String(),
  };
}

@immutable
class StaffAdvanceSummary {
  final int outstandingCount;
  final double outstandingAmount;
  final int settledCount;
  final double settledAmount;
  final int totalActiveCount;
  final double totalActiveAmount;

  const StaffAdvanceSummary({
    this.outstandingCount = 0,
    this.outstandingAmount = 0.0,
    this.settledCount = 0,
    this.settledAmount = 0.0,
    this.totalActiveCount = 0,
    this.totalActiveAmount = 0.0,
  });

  factory StaffAdvanceSummary.fromJson(Map<String, dynamic> json) {
    return StaffAdvanceSummary(
      outstandingCount: (json['outstandingCount'] ?? json['OutstandingCount'] ?? 0) as int,
      outstandingAmount: ((json['outstandingAmount'] ?? json['OutstandingAmount'] ?? 0.0) as num).toDouble(),
      settledCount: (json['settledCount'] ?? json['SettledCount'] ?? 0) as int,
      settledAmount: ((json['settledAmount'] ?? json['SettledAmount'] ?? 0.0) as num).toDouble(),
      totalActiveCount: (json['totalActiveCount'] ?? json['TotalActiveCount'] ?? 0) as int,
      totalActiveAmount: ((json['totalActiveAmount'] ?? json['TotalActiveAmount'] ?? 0.0) as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
    'outstandingCount': outstandingCount,
    'outstandingAmount': outstandingAmount,
    'settledCount': settledCount,
    'settledAmount': settledAmount,
    'totalActiveCount': totalActiveCount,
    'totalActiveAmount': totalActiveAmount,
  };
}

@immutable
class StaffAdvanceListResponse {
  final List<StaffAdvance> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final StaffAdvanceSummary summary;

  const StaffAdvanceListResponse({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
    required this.summary,
  });

  factory StaffAdvanceListResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    final rawSummary = (json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>;

    return StaffAdvanceListResponse(
      items: rawItems.map((e) => StaffAdvance.fromJson(e as Map<String, dynamic>)).toList(),
      totalCount: (json['totalCount'] ?? json['TotalCount'] ?? 0) as int,
      page: (json['page'] ?? json['Page'] ?? 1) as int,
      pageSize: (json['pageSize'] ?? json['PageSize'] ?? 20) as int,
      summary: StaffAdvanceSummary.fromJson(rawSummary),
    );
  }
}

@immutable
class StaffAdvanceHistory {
  final String staffId;
  final String staffName;
  final String? staffPhone;
  final String? staffRole;
  final double totalAdvancesAmount;
  final double outstandingAmount;
  final double settledAmount;
  final List<StaffAdvance> advances;

  const StaffAdvanceHistory({
    required this.staffId,
    required this.staffName,
    this.staffPhone,
    this.staffRole,
    required this.totalAdvancesAmount,
    required this.outstandingAmount,
    required this.settledAmount,
    required this.advances,
  });

  factory StaffAdvanceHistory.fromJson(Map<String, dynamic> json) {
    final rawAdvances = json['advances'] as List<dynamic>? ?? json['Advances'] as List<dynamic>? ?? [];

    return StaffAdvanceHistory(
      staffId: json['staffId'] as String? ?? json['StaffId'] as String? ?? '',
      staffName: json['staffName'] as String? ?? json['StaffName'] as String? ?? '',
      staffPhone: json['staffPhone'] as String? ?? json['StaffPhone'] as String?,
      staffRole: json['staffRole'] as String? ?? json['StaffRole'] as String?,
      totalAdvancesAmount: ((json['totalAdvancesAmount'] ?? json['TotalAdvancesAmount'] ?? 0.0) as num).toDouble(),
      outstandingAmount: ((json['outstandingAmount'] ?? json['OutstandingAmount'] ?? 0.0) as num).toDouble(),
      settledAmount: ((json['settledAmount'] ?? json['SettledAmount'] ?? 0.0) as num).toDouble(),
      advances: rawAdvances.map((e) => StaffAdvance.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
