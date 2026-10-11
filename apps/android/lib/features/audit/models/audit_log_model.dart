import 'dart:convert';

/// One recorded action: who did what, to which record, when, and whether it worked.
class AuditLogEntry {
  final String id;
  final DateTime timestamp;
  final String? userName;
  final String? userRole;
  final String action;
  final String module;
  final String? entityType;
  final String? entityReference;
  final String description;
  final String? oldValues;
  final String? newValues;
  final String? metadata;
  final String? ipAddress;
  final String outcome;

  const AuditLogEntry({
    required this.id,
    required this.timestamp,
    required this.action,
    required this.module,
    required this.description,
    required this.outcome,
    this.userName,
    this.userRole,
    this.entityType,
    this.entityReference,
    this.oldValues,
    this.newValues,
    this.metadata,
    this.ipAddress,
  });

  bool get isFailure => outcome.toLowerCase() == 'failure';

  factory AuditLogEntry.fromJson(Map<String, dynamic> json) => AuditLogEntry(
    id: json['id']?.toString() ?? '',
    timestamp:
        DateTime.tryParse(json['timestampUtc'] as String? ?? '')?.toLocal() ??
        DateTime.fromMillisecondsSinceEpoch(0),
    userName: json['userName'] as String?,
    userRole: json['userRole'] as String?,
    action: json['action'] as String? ?? '',
    module: json['module'] as String? ?? '',
    entityType: json['entityType'] as String?,
    entityReference: json['entityReference'] as String?,
    description: json['description'] as String? ?? '',
    oldValues: json['oldValues'] as String?,
    newValues: json['newValues'] as String?,
    metadata: json['metadata'] as String?,
    ipAddress: json['ipAddress'] as String?,
    outcome: json['outcome'] as String? ?? 'Success',
  );

  /// Stored values are JSON text; this lays them out for reading, or returns the text unchanged when it is not JSON.
  static String prettyValues(String? raw) {
    if (raw == null || raw.trim().isEmpty) return '';
    try {
      return const JsonEncoder.withIndent('  ').convert(jsonDecode(raw));
    } catch (_) {
      return raw;
    }
  }
}

class AuditLogPage {
  final List<AuditLogEntry> items;
  final int totalCount;
  final int page;
  final int totalPages;

  const AuditLogPage({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.totalPages,
  });

  factory AuditLogPage.fromJson(Map<String, dynamic> json) => AuditLogPage(
    items: (json['items'] as List<dynamic>? ?? [])
        .map((e) => AuditLogEntry.fromJson(e as Map<String, dynamic>))
        .toList(),
    totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
    page: (json['page'] as num?)?.toInt() ?? 1,
    totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
  );
}

/// What to look for. Empty values mean "any".
class AuditFilters {
  final String search;
  final String module;
  final String outcome;
  final DateTime? from;
  final DateTime? to;

  const AuditFilters({
    this.search = '',
    this.module = '',
    this.outcome = '',
    this.from,
    this.to,
  });

  bool get isEmpty =>
      search.isEmpty &&
      module.isEmpty &&
      outcome.isEmpty &&
      from == null &&
      to == null;

  AuditFilters copyWith({
    String? search,
    String? module,
    String? outcome,
    DateTime? from,
    DateTime? to,
    bool clearDates = false,
  }) => AuditFilters(
    search: search ?? this.search,
    module: module ?? this.module,
    outcome: outcome ?? this.outcome,
    from: clearDates ? null : (from ?? this.from),
    to: clearDates ? null : (to ?? this.to),
  );
}

/// The areas the audit log can be narrowed to (same list as Windows, plus Franchise).
const auditModuleOptions = <({String label, String value})>[
  (label: 'All modules', value: ''),
  (label: 'Authentication', value: 'Authentication'),
  (label: 'Users', value: 'Users'),
  (label: 'Invoices', value: 'Invoices'),
  (label: 'Payments', value: 'Payments'),
  (label: 'Showrooms', value: 'Showrooms'),
  (label: 'Staff advances', value: 'StaffAdvances'),
  (label: 'Settings', value: 'Settings'),
  (label: 'Customers', value: 'Customers'),
  (label: 'Vehicles', value: 'Vehicles'),
  (label: 'Job cards', value: 'JobCards'),
  (label: 'Franchise', value: 'Franchise'),
];
