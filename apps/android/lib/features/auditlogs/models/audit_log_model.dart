class AuditLogModel {
  final String id;
  final DateTime timestampUtc;
  final String? userId;
  final String? userName;
  final String? userRole;
  final String action;
  final String module;
  final String? entityType;
  final String? entityId;
  final String? entityReference;
  final String description;
  final String? oldValues;
  final String? newValues;
  final String? metadata;
  final String? ipAddress;
  final String outcome;
  final DateTime createdAt;

  const AuditLogModel({
    required this.id,
    required this.timestampUtc,
    this.userId,
    this.userName,
    this.userRole,
    required this.action,
    required this.module,
    this.entityType,
    this.entityId,
    this.entityReference,
    required this.description,
    this.oldValues,
    this.newValues,
    this.metadata,
    this.ipAddress,
    this.outcome = 'Success',
    required this.createdAt,
  });

  bool get isSuccess => outcome.toLowerCase() == 'success';

  factory AuditLogModel.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic value) {
      if (value is String) {
        return DateTime.tryParse(value)?.toUtc() ?? DateTime.now().toUtc();
      }
      return DateTime.now().toUtc();
    }

    return AuditLogModel(
      id: json['id']?.toString() ?? '',
      timestampUtc: parseDate(json['timestampUtc']),
      userId: json['userId']?.toString(),
      userName: json['userName'] as String?,
      userRole: json['userRole'] as String?,
      action: json['action'] as String? ?? '',
      module: json['module'] as String? ?? '',
      entityType: json['entityType'] as String?,
      entityId: json['entityId']?.toString(),
      entityReference: json['entityReference'] as String?,
      description: json['description'] as String? ?? '',
      oldValues: json['oldValues'] as String?,
      newValues: json['newValues'] as String?,
      metadata: json['metadata'] as String?,
      ipAddress: json['ipAddress'] as String?,
      outcome: json['outcome'] as String? ?? 'Success',
      createdAt: parseDate(json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'timestampUtc': timestampUtc.toIso8601String(),
      'userId': userId,
      'userName': userName,
      'userRole': userRole,
      'action': action,
      'module': module,
      'entityType': entityType,
      'entityId': entityId,
      'entityReference': entityReference,
      'description': description,
      'oldValues': oldValues,
      'newValues': newValues,
      'metadata': metadata,
      'ipAddress': ipAddress,
      'outcome': outcome,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuditLogModel &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

class PagedAuditLogsModel {
  final List<AuditLogModel> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final int totalPages;

  const PagedAuditLogsModel({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  bool get hasNextPage => page < totalPages;
  bool get hasPreviousPage => page > 1;

  factory PagedAuditLogsModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    final items = rawItems
        .map((e) => AuditLogModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final totalCount = json['totalCount'] as int? ?? 0;
    final page = json['page'] as int? ?? 1;
    final pageSize = json['pageSize'] as int? ?? 50;
    final totalPages = json['totalPages'] as int? ??
        (pageSize > 0 ? (totalCount / pageSize).ceil() : 0);

    return PagedAuditLogsModel(
      items: items,
      totalCount: totalCount,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PagedAuditLogsModel &&
          runtimeType == other.runtimeType &&
          page == other.page &&
          totalCount == other.totalCount;

  @override
  int get hashCode => page.hashCode ^ totalCount.hashCode;
}
