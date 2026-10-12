/// What the signed-in company's subscription allows (Trovo's platform), from
/// GET /api/subscription/status. On a single-company server [managed] is false.
class SubscriptionStatus {
  final bool managed;
  final String access;
  final String? status;
  final String? planCode;
  final String? planName;
  final Map<String, String> features;
  final int? seatLimit;
  final int seatsUsed;
  final String? bannerLevel;
  final String? bannerMessage;

  const SubscriptionStatus({
    required this.managed,
    required this.access,
    this.status,
    this.planCode,
    this.planName,
    this.features = const {},
    this.seatLimit,
    this.seatsUsed = 0,
    this.bannerLevel,
    this.bannerMessage,
  });

  factory SubscriptionStatus.fromJson(Map<String, dynamic> json) {
    final banner = json['banner'] as Map<String, dynamic>?;
    return SubscriptionStatus(
      managed: json['managed'] as bool? ?? false,
      access: json['access'] as String? ?? 'Full',
      status: json['status'] as String?,
      planCode: json['planCode'] as String?,
      planName: json['planName'] as String?,
      features: (json['features'] as Map<String, dynamic>? ?? const {}).map(
        (key, value) => MapEntry(key, value.toString()),
      ),
      seatLimit: json['seatLimit'] as int?,
      seatsUsed: json['seatsUsed'] as int? ?? 0,
      bannerLevel: banner?['level'] as String?,
      bannerMessage: banner?['message'] as String?,
    );
  }

  bool get isReadOnly => access == 'ReadOnly';
}

/// The plan features the server knows (FeatureKeys on the backend).
class PlanFeatureKeys {
  static const showroom = 'showroom.enabled';
  static const whatsApp = 'whatsapp_automation.enabled';
  static const franchiseNetwork = 'franchise_network.enabled';
  static const outsideJobs = 'outside_jobs.enabled';
  static const staffAdvances = 'staff_advances.enabled';
  static const advancedReports = 'reports.advanced';
  static const auditTrail = 'audit_trail.enabled';
}

/// The company's plan as the app sees it. The server enforces the plan; the app
/// only hides what the plan does not include. Until the subscription is known,
/// or on a single-company server, everything is shown.
class PlanFeatures {
  PlanFeatures._();

  static SubscriptionStatus? _current;

  /// The latest subscription status (null when signed out or not loaded yet).
  static SubscriptionStatus? get current => _current;

  static void update(SubscriptionStatus? status) => _current = status;

  static bool hasFeature(String featureKey) {
    final status = _current;
    if (status == null || !status.managed) return true;
    return status.features[featureKey]?.toLowerCase() == 'true';
  }

  /// False when [permission] belongs to a module outside the company's plan.
  static bool allowsPermission(String permission) {
    final feature = featureForPermission(permission);
    return feature == null || hasFeature(feature);
  }

  /// The plan feature a permission belongs to, or null when every plan has it.
  static String? featureForPermission(String permission) {
    if (permission.startsWith('showroom.') ||
        permission == 'reports.showrooms') {
      return PlanFeatureKeys.showroom;
    }
    if (permission.startsWith('staff_advances.') ||
        permission.startsWith('staff_salary.') ||
        permission == 'reports.staff_advances') {
      return PlanFeatureKeys.staffAdvances;
    }
    if (permission.startsWith('outsidejobs.') ||
        permission.startsWith('vendors.')) {
      return PlanFeatureKeys.outsideJobs;
    }
    if (permission.startsWith('audit.')) return PlanFeatureKeys.auditTrail;
    if (permission == 'reports.gst' ||
        permission == 'reports.job_cards' ||
        permission == 'reports.staff_productivity') {
      return PlanFeatureKeys.advancedReports;
    }
    return null;
  }
}
