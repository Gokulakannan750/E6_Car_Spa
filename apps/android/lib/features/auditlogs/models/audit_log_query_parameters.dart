class AuditLogQueryParameters {
  final DateTime? fromDate;
  final DateTime? toDate;
  final String? userId;
  final String? module;
  final String? action;
  final String? entityType;
  final String? outcome;
  final String? search;
  final int page;
  final int pageSize;

  const AuditLogQueryParameters({
    this.fromDate,
    this.toDate,
    this.userId,
    this.module,
    this.action,
    this.entityType,
    this.outcome,
    this.search,
    this.page = 1,
    this.pageSize = 50,
  });

  AuditLogQueryParameters copyWith({
    DateTime? fromDate,
    DateTime? toDate,
    String? userId,
    String? module,
    String? action,
    String? entityType,
    String? outcome,
    String? search,
    int? page,
    int? pageSize,
    bool clearDates = false,
    bool clearModule = false,
    bool clearOutcome = false,
    bool clearSearch = false,
  }) {
    return AuditLogQueryParameters(
      fromDate: clearDates ? null : (fromDate ?? this.fromDate),
      toDate: clearDates ? null : (toDate ?? this.toDate),
      userId: userId ?? this.userId,
      module: clearModule ? null : (module ?? this.module),
      action: action ?? this.action,
      entityType: entityType ?? this.entityType,
      outcome: clearOutcome ? null : (outcome ?? this.outcome),
      search: clearSearch ? null : (search ?? this.search),
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
    );
  }

  Map<String, dynamic> toQueryParameters() {
    final params = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };

    if (fromDate != null) {
      params['fromDate'] =
          "${fromDate!.year.toString().padLeft(4, '0')}-${fromDate!.month.toString().padLeft(2, '0')}-${fromDate!.day.toString().padLeft(2, '0')}";
    }
    if (toDate != null) {
      params['toDate'] =
          "${toDate!.year.toString().padLeft(4, '0')}-${toDate!.month.toString().padLeft(2, '0')}-${toDate!.day.toString().padLeft(2, '0')}";
    }
    if (userId != null && userId!.isNotEmpty) {
      params['userId'] = userId;
    }
    if (module != null && module!.isNotEmpty) {
      params['module'] = module;
    }
    if (action != null && action!.isNotEmpty) {
      params['action'] = action;
    }
    if (entityType != null && entityType!.isNotEmpty) {
      params['entityType'] = entityType;
    }
    if (outcome != null && outcome!.isNotEmpty) {
      params['outcome'] = outcome;
    }
    if (search != null && search!.trim().isNotEmpty) {
      params['search'] = search!.trim();
    }

    return params;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuditLogQueryParameters &&
          runtimeType == other.runtimeType &&
          page == other.page &&
          pageSize == other.pageSize &&
          search == other.search &&
          module == other.module &&
          outcome == other.outcome &&
          fromDate == other.fromDate &&
          toDate == other.toDate;

  @override
  int get hashCode =>
      page.hashCode ^
      pageSize.hashCode ^
      (search?.hashCode ?? 0) ^
      (module?.hashCode ?? 0) ^
      (outcome?.hashCode ?? 0);
}
