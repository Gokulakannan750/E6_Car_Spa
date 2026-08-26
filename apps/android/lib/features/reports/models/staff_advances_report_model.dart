class StaffAdvanceReportRowModel {
  final String id;
  final String staffId;
  final String staffName;
  final String? staffPhone;
  final String? staffRole;
  final DateTime advanceDate;
  final double amount;
  final String reason;
  final String? notes;
  final String status;
  final DateTime? settledAt;
  final String? settledByName;
  final DateTime? obsoletedAt;
  final String? obsoletedByName;
  final String? obsoleteReason;

  const StaffAdvanceReportRowModel({
    required this.id,
    required this.staffId,
    required this.staffName,
    this.staffPhone,
    this.staffRole,
    required this.advanceDate,
    required this.amount,
    required this.reason,
    this.notes,
    required this.status,
    this.settledAt,
    this.settledByName,
    this.obsoletedAt,
    this.obsoletedByName,
    this.obsoleteReason,
  });

  factory StaffAdvanceReportRowModel.fromJson(Map<String, dynamic> json) {
    return StaffAdvanceReportRowModel(
      id: json['id']?.toString() ?? json['Id']?.toString() ?? '',
      staffId: json['staffId']?.toString() ?? json['StaffId']?.toString() ?? '',
      staffName: json['staffName']?.toString() ?? json['StaffName']?.toString() ?? '',
      staffPhone: json['staffPhone']?.toString() ?? json['StaffPhone']?.toString(),
      staffRole: json['staffRole']?.toString() ?? json['StaffRole']?.toString(),
      advanceDate: DateTime.tryParse(json['advanceDate']?.toString() ?? json['AdvanceDate']?.toString() ?? '') ?? DateTime.now(),
      amount: ((json['amount'] ?? json['Amount'] ?? 0.0) as num).toDouble(),
      reason: json['reason']?.toString() ?? json['Reason']?.toString() ?? '',
      notes: json['notes']?.toString() ?? json['Notes']?.toString(),
      status: json['status']?.toString() ?? json['Status']?.toString() ?? 'Outstanding',
      settledAt: json['settledAt'] != null || json['SettledAt'] != null
          ? DateTime.tryParse(json['settledAt']?.toString() ?? json['SettledAt']?.toString() ?? '')
          : null,
      settledByName: json['settledByName']?.toString() ?? json['SettledByName']?.toString(),
      obsoletedAt: json['obsoletedAt'] != null || json['ObsoletedAt'] != null
          ? DateTime.tryParse(json['obsoletedAt']?.toString() ?? json['ObsoletedAt']?.toString() ?? '')
          : null,
      obsoletedByName: json['obsoletedByName']?.toString() ?? json['ObsoletedByName']?.toString(),
      obsoleteReason: json['obsoleteReason']?.toString() ?? json['ObsoleteReason']?.toString(),
    );
  }
}

class StaffAdvanceReportSummaryModel {
  final double outstandingAmount;
  final double settledAmount;
  final double obsoleteAmount;
  final int outstandingCount;
  final int settledCount;
  final int obsoleteCount;

  const StaffAdvanceReportSummaryModel({
    required this.outstandingAmount,
    required this.settledAmount,
    required this.obsoleteAmount,
    required this.outstandingCount,
    required this.settledCount,
    required this.obsoleteCount,
  });

  factory StaffAdvanceReportSummaryModel.fromJson(Map<String, dynamic> json) {
    return StaffAdvanceReportSummaryModel(
      outstandingAmount: ((json['outstandingAmount'] ?? json['OutstandingAmount'] ?? 0.0) as num).toDouble(),
      settledAmount: ((json['settledAmount'] ?? json['SettledAmount'] ?? 0.0) as num).toDouble(),
      obsoleteAmount: ((json['obsoleteAmount'] ?? json['ObsoleteAmount'] ?? 0.0) as num).toDouble(),
      outstandingCount: json['outstandingCount'] as int? ?? json['OutstandingCount'] as int? ?? 0,
      settledCount: json['settledCount'] as int? ?? json['SettledCount'] as int? ?? 0,
      obsoleteCount: json['obsoleteCount'] as int? ?? json['ObsoleteCount'] as int? ?? 0,
    );
  }
}

class StaffAdvanceReportResponseModel {
  final List<StaffAdvanceReportRowModel> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final StaffAdvanceReportSummaryModel summary;

  const StaffAdvanceReportResponseModel({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
    required this.summary,
  });

  factory StaffAdvanceReportResponseModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return StaffAdvanceReportResponseModel(
      items: rawItems.map((item) => StaffAdvanceReportRowModel.fromJson(item as Map<String, dynamic>)).toList(),
      totalCount: json['totalCount'] as int? ?? json['TotalCount'] as int? ?? 0,
      page: json['page'] as int? ?? json['Page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? json['PageSize'] as int? ?? 20,
      summary: StaffAdvanceReportSummaryModel.fromJson((json['summary'] ?? json['Summary'] ?? {}) as Map<String, dynamic>),
    );
  }
}
