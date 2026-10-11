/// The company's WhatsApp connection as the server reports it. The access token is never sent back: only whether one
/// is saved.
class WhatsAppConfig {
  final bool isEnabled;
  final String phoneNumberId;
  final String businessAccountId;
  final String graphApiVersion;
  final bool hasAccessToken;
  final bool invoiceNotificationsEnabled;
  final bool paymentCompletedNotificationsEnabled;
  final String invoiceTemplateName;
  final String invoiceTemplateLanguage;
  final String paymentCompletedTemplateName;
  final String paymentCompletedTemplateLanguage;
  final String healthStatus;
  final DateTime? lastCheckedAt;
  final DateTime? lastSuccessAt;
  final DateTime? lastFailureAt;
  final String? lastErrorMessage;
  final String? metaAppId;

  const WhatsAppConfig({
    this.isEnabled = false,
    this.phoneNumberId = '',
    this.businessAccountId = '',
    this.graphApiVersion = 'v25.0',
    this.hasAccessToken = false,
    this.invoiceNotificationsEnabled = true,
    this.paymentCompletedNotificationsEnabled = true,
    this.invoiceTemplateName = '',
    this.invoiceTemplateLanguage = '',
    this.paymentCompletedTemplateName = '',
    this.paymentCompletedTemplateLanguage = '',
    this.healthStatus = 'NotConfigured',
    this.lastCheckedAt,
    this.lastSuccessAt,
    this.lastFailureAt,
    this.lastErrorMessage,
    this.metaAppId,
  });

  bool get isHealthy => healthStatus.toLowerCase() == 'healthy';

  factory WhatsAppConfig.fromJson(Map<String, dynamic> json) => WhatsAppConfig(
    isEnabled: json['isEnabled'] as bool? ?? false,
    phoneNumberId: json['phoneNumberId'] as String? ?? '',
    businessAccountId: json['businessAccountId'] as String? ?? '',
    graphApiVersion: json['graphApiVersion'] as String? ?? 'v25.0',
    hasAccessToken: json['hasAccessToken'] as bool? ?? false,
    invoiceNotificationsEnabled:
        json['invoiceNotificationsEnabled'] as bool? ?? true,
    paymentCompletedNotificationsEnabled:
        json['paymentCompletedNotificationsEnabled'] as bool? ?? true,
    invoiceTemplateName: json['invoiceTemplateName'] as String? ?? '',
    invoiceTemplateLanguage: json['invoiceTemplateLanguage'] as String? ?? '',
    paymentCompletedTemplateName:
        json['paymentCompletedTemplateName'] as String? ?? '',
    paymentCompletedTemplateLanguage:
        json['paymentCompletedTemplateLanguage'] as String? ?? '',
    healthStatus: json['healthStatus'] as String? ?? 'NotConfigured',
    lastCheckedAt: DateTime.tryParse(
      json['lastCheckedAtUtc'] as String? ?? '',
    )?.toLocal(),
    lastSuccessAt: DateTime.tryParse(
      json['lastSuccessAtUtc'] as String? ?? '',
    )?.toLocal(),
    lastFailureAt: DateTime.tryParse(
      json['lastFailureAtUtc'] as String? ?? '',
    )?.toLocal(),
    lastErrorMessage: json['lastErrorMessage'] as String?,
    metaAppId: json['metaAppId'] as String?,
  );
}

/// What the person typed on the connection form. A blank access token means "keep the saved one".
class WhatsAppConfigInput {
  final bool isEnabled;
  final String phoneNumberId;
  final String businessAccountId;
  final String graphApiVersion;
  final String accessToken;
  final String metaAppId;
  final bool invoiceNotificationsEnabled;
  final bool paymentCompletedNotificationsEnabled;
  final String invoiceTemplateName;
  final String invoiceTemplateLanguage;
  final String paymentCompletedTemplateName;
  final String paymentCompletedTemplateLanguage;

  const WhatsAppConfigInput({
    required this.isEnabled,
    required this.phoneNumberId,
    required this.businessAccountId,
    required this.graphApiVersion,
    required this.accessToken,
    required this.metaAppId,
    required this.invoiceNotificationsEnabled,
    required this.paymentCompletedNotificationsEnabled,
    required this.invoiceTemplateName,
    required this.invoiceTemplateLanguage,
    required this.paymentCompletedTemplateName,
    required this.paymentCompletedTemplateLanguage,
  });

  Map<String, dynamic> toJson() => {
    'isEnabled': isEnabled,
    'phoneNumberId': phoneNumberId.trim(),
    'businessAccountId': businessAccountId.trim(),
    'graphApiVersion': graphApiVersion.trim(),
    if (accessToken.trim().isNotEmpty) 'accessToken': accessToken.trim(),
    'metaAppId': metaAppId.trim(),
    'invoiceNotificationsEnabled': invoiceNotificationsEnabled,
    'paymentCompletedNotificationsEnabled':
        paymentCompletedNotificationsEnabled,
    'invoiceTemplateName': invoiceTemplateName.trim(),
    'invoiceTemplateLanguage': invoiceTemplateLanguage.trim(),
    'paymentCompletedTemplateName': paymentCompletedTemplateName.trim(),
    'paymentCompletedTemplateLanguage': paymentCompletedTemplateLanguage.trim(),
  };
}

class WhatsAppActionResult {
  final bool isSuccess;
  final String message;
  final String? details;

  const WhatsAppActionResult({
    required this.isSuccess,
    required this.message,
    this.details,
  });

  factory WhatsAppActionResult.fromJson(Map<String, dynamic> json) =>
      WhatsAppActionResult(
        isSuccess: json['isSuccess'] as bool? ?? false,
        message: json['message'] as String? ?? '',
        details: json['details'] as String?,
      );
}

class ManagedTemplate {
  final String messageType;
  final String purpose;
  final String name;
  final String language;
  final String category;
  final String status;
  final String? rejectedReason;
  final bool isActive;

  const ManagedTemplate({
    required this.messageType,
    required this.purpose,
    required this.name,
    required this.language,
    required this.category,
    required this.status,
    this.rejectedReason,
    this.isActive = false,
  });

  bool get isApproved => status.toUpperCase() == 'APPROVED';

  /// "NOT_CREATED" -> "Not created", "APPROVED" -> "Approved".
  String get statusLabel {
    final s = status.replaceAll('_', ' ').toLowerCase();
    return s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
  }

  factory ManagedTemplate.fromJson(Map<String, dynamic> json) =>
      ManagedTemplate(
        messageType: json['messageType'] as String? ?? '',
        purpose: json['purpose'] as String? ?? '',
        name: json['name'] as String? ?? '',
        language: json['language'] as String? ?? '',
        category: json['category'] as String? ?? '',
        status: json['status'] as String? ?? 'NOT_CREATED',
        rejectedReason: json['rejectedReason'] as String?,
        isActive: json['isActive'] as bool? ?? false,
      );
}

class ManagedTemplates {
  final bool isSuccess;
  final String message;
  final List<ManagedTemplate> templates;
  final bool canActivate;
  final String? details;

  const ManagedTemplates({
    required this.isSuccess,
    required this.message,
    required this.templates,
    required this.canActivate,
    this.details,
  });

  factory ManagedTemplates.fromJson(Map<String, dynamic> json) =>
      ManagedTemplates(
        isSuccess: json['isSuccess'] as bool? ?? false,
        message: json['message'] as String? ?? '',
        templates: (json['templates'] as List<dynamic>? ?? [])
            .map((e) => ManagedTemplate.fromJson(e as Map<String, dynamic>))
            .toList(),
        canActivate: json['canActivate'] as bool? ?? false,
        details: json['details'] as String?,
      );
}

class WhatsAppUsageMonth {
  final int year;
  final int month;
  final int total;
  final int sent;
  final int failed;
  final int skipped;
  final int pending;

  const WhatsAppUsageMonth({
    required this.year,
    required this.month,
    required this.total,
    required this.sent,
    required this.failed,
    required this.skipped,
    required this.pending,
  });

  factory WhatsAppUsageMonth.fromJson(Map<String, dynamic> json) =>
      WhatsAppUsageMonth(
        year: (json['year'] as num?)?.toInt() ?? 0,
        month: (json['month'] as num?)?.toInt() ?? 0,
        total: (json['total'] as num?)?.toInt() ?? 0,
        sent: (json['sent'] as num?)?.toInt() ?? 0,
        failed: (json['failed'] as num?)?.toInt() ?? 0,
        skipped: (json['skipped'] as num?)?.toInt() ?? 0,
        pending: (json['pending'] as num?)?.toInt() ?? 0,
      );
}

/// A message that was not sent, with who it was for and why.
class WhatsAppLogItem {
  final String id;
  final DateTime createdAt;
  final String messageType;
  final String status;
  final String customerName;
  final String recipientPhone;
  final String? invoiceNumber;
  final String? reason;
  final int attemptCount;

  const WhatsAppLogItem({
    required this.id,
    required this.createdAt,
    required this.messageType,
    required this.status,
    required this.customerName,
    required this.recipientPhone,
    this.invoiceNumber,
    this.reason,
    this.attemptCount = 0,
  });

  String get typeLabel =>
      messageType == 'PaymentCompleted' ? 'Payment receipt' : 'Invoice';

  factory WhatsAppLogItem.fromJson(Map<String, dynamic> json) =>
      WhatsAppLogItem(
        id: json['id']?.toString() ?? '',
        createdAt:
            DateTime.tryParse(
              json['createdAtUtc'] as String? ?? '',
            )?.toLocal() ??
            DateTime.fromMillisecondsSinceEpoch(0),
        messageType: json['messageType'] as String? ?? '',
        status: json['status'] as String? ?? '',
        customerName: json['customerName'] as String? ?? '',
        recipientPhone: json['recipientPhone'] as String? ?? '',
        invoiceNumber: json['invoiceNumber'] as String?,
        reason: json['reason'] as String?,
        attemptCount: (json['attemptCount'] as num?)?.toInt() ?? 0,
      );
}

class WhatsAppLogPage {
  final List<WhatsAppLogItem> items;
  final int totalCount;
  final int page;
  final int pageSize;

  const WhatsAppLogPage({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
  });

  bool get hasMore => page * pageSize < totalCount;

  factory WhatsAppLogPage.fromJson(Map<String, dynamic> json) =>
      WhatsAppLogPage(
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => WhatsAppLogItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
        page: (json['page'] as num?)?.toInt() ?? 1,
        pageSize: (json['pageSize'] as num?)?.toInt() ?? 20,
      );
}

/// 919876543210 shows as +91 98765 43210; anything else is shown as stored.
String formatWhatsAppPhone(String phone) {
  if (RegExp(r'^91\d{10}$').hasMatch(phone)) {
    return '+91 ${phone.substring(2, 7)} ${phone.substring(7)}';
  }
  return phone;
}
