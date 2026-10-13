/// The kinds of information a franchisor can ask a franchisee to share, in the order they are offered.
class FranchiseScopeOption {
  final String scope;
  final String label;

  const FranchiseScopeOption(this.scope, this.label);
}

const franchiseScopeOptions = <FranchiseScopeOption>[
  FranchiseScopeOption(
    'financial_totals',
    'Financial totals (revenue, collections, jobs, invoices)',
  ),
  FranchiseScopeOption('invoice_list', 'Invoice list'),
  FranchiseScopeOption('staff', 'Staff and attendance'),
  FranchiseScopeOption('customers', 'Customers'),
];

/// What the signed-in company can do in the franchise network. Drives what the app shows.
class FranchiseAccess {
  /// The company has the Franchise add-on, so it can invite companies and see their approved figures.
  final bool canActAsFranchisor;

  /// The company has an active link to a franchisor.
  final bool isFranchisee;

  const FranchiseAccess({
    required this.canActAsFranchisor,
    required this.isFranchisee,
  });

  static const none = FranchiseAccess(
    canActAsFranchisor: false,
    isFranchisee: false,
  );

  factory FranchiseAccess.fromJson(Map<String, dynamic> json) =>
      FranchiseAccess(
        canActAsFranchisor: json['canActAsFranchisor'] as bool? ?? false,
        isFranchisee: json['isFranchisee'] as bool? ?? false,
      );
}

class FranchiseScope {
  final String scope;
  final String label;

  /// Requested, Granted or Denied.
  final String status;

  const FranchiseScope({
    required this.scope,
    required this.label,
    required this.status,
  });

  bool get isGranted => status == 'Granted';
  bool get isRequested => status == 'Requested';
  bool get isDenied => status == 'Denied';

  factory FranchiseScope.fromJson(Map<String, dynamic> json) => FranchiseScope(
    scope: json['scope'] as String? ?? '',
    label: json['label'] as String? ?? '',
    status: json['status'] as String? ?? '',
  );
}

/// One link as seen by one of its two companies. [role] is the viewer's own role in the link.
class FranchiseLink {
  final String id;
  final String role;

  /// The other company's code with the middle hidden, for example "0••1". The full code is never sent.
  final String partnerCodeHint;
  final String partnerName;

  /// Pending, Active, Declined, Cancelled, Expired or Ended.
  final String status;
  final DateTime? invitedAt;
  final DateTime? expiresAt;
  final DateTime? respondedAt;
  final DateTime? endedAt;
  final List<FranchiseScope> scopes;

  const FranchiseLink({
    required this.id,
    required this.role,
    required this.partnerCodeHint,
    required this.partnerName,
    required this.status,
    this.invitedAt,
    this.expiresAt,
    this.respondedAt,
    this.endedAt,
    this.scopes = const [],
  });

  bool get isPending => status == 'Pending';
  bool get isActive => status == 'Active';
  bool get hasOpenRequest => scopes.any((s) => s.isRequested);

  factory FranchiseLink.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => json[key] is String
        ? DateTime.tryParse(json[key] as String)?.toLocal()
        : null;

    return FranchiseLink(
      id: json['id']?.toString() ?? '',
      role: json['role'] as String? ?? '',
      partnerCodeHint: json['partnerCodeHint'] as String? ?? '',
      partnerName: json['partnerName'] as String? ?? '',
      status: json['status'] as String? ?? '',
      invitedAt: date('invitedAt'),
      expiresAt: date('expiresAt'),
      respondedAt: date('respondedAt'),
      endedAt: date('endedAt'),
      scopes: (json['scopes'] as List<dynamic>? ?? [])
          .map((e) => FranchiseScope.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class FranchiseNetwork {
  final bool franchiseEnabled;

  /// Links where this company is the franchisor (the companies it franchises).
  final List<FranchiseLink> franchisees;

  /// Links where this company is the franchisee (the companies that franchise it).
  final List<FranchiseLink> franchisors;
  final int pendingInvitations;

  const FranchiseNetwork({
    required this.franchiseEnabled,
    required this.franchisees,
    required this.franchisors,
    required this.pendingInvitations,
  });

  factory FranchiseNetwork.fromJson(Map<String, dynamic> json) {
    List<FranchiseLink> links(String key) => (json[key] as List<dynamic>? ?? [])
        .map((e) => FranchiseLink.fromJson(e as Map<String, dynamic>))
        .toList();

    return FranchiseNetwork(
      franchiseEnabled: json['franchiseEnabled'] as bool? ?? false,
      franchisees: links('franchisees'),
      franchisors: links('franchisors'),
      pendingInvitations: (json['pendingInvitations'] as num?)?.toInt() ?? 0,
    );
  }
}

/// A link for the franchisee to answer through, shown once to the franchisor to pass on.
class FranchiseLinkAccess {
  final FranchiseLink link;
  final String? accessLink;
  final DateTime? accessLinkExpiresAt;

  const FranchiseLinkAccess({
    required this.link,
    this.accessLink,
    this.accessLinkExpiresAt,
  });

  factory FranchiseLinkAccess.fromJson(Map<String, dynamic> json) =>
      FranchiseLinkAccess(
        link: FranchiseLink.fromJson(json['link'] as Map<String, dynamic>),
        accessLink: json['accessLink'] as String?,
        accessLinkExpiresAt: json['accessLinkExpiresAt'] is String
            ? DateTime.tryParse(json['accessLinkExpiresAt'] as String)
            : null,
      );
}

class FranchiseInviteResult {
  final String message;
  final String inviteLink;

  const FranchiseInviteResult({
    required this.message,
    required this.inviteLink,
  });

  factory FranchiseInviteResult.fromJson(Map<String, dynamic> json) =>
      FranchiseInviteResult(
        message: json['message'] as String? ?? '',
        inviteLink: json['inviteLink'] as String? ?? '',
      );
}

class FranchiseDailyPoint {
  final String date;
  final double invoiced;
  final double collected;

  const FranchiseDailyPoint({
    required this.date,
    required this.invoiced,
    required this.collected,
  });

  factory FranchiseDailyPoint.fromJson(Map<String, dynamic> json) =>
      FranchiseDailyPoint(
        date: json['date'] as String? ?? '',
        invoiced: (json['invoiced'] as num?)?.toDouble() ?? 0,
        collected: (json['collected'] as num?)?.toDouble() ?? 0,
      );
}

/// A franchisee's approved financial figures for a period: totals and a daily series, never individual records.
class FranchiseTotals {
  final int invoiceCount;
  final double invoicedAmount;
  final double collectedAmount;
  final double outstandingAmount;
  final int jobCardCount;
  final List<FranchiseDailyPoint> daily;

  const FranchiseTotals({
    required this.invoiceCount,
    required this.invoicedAmount,
    required this.collectedAmount,
    required this.outstandingAmount,
    required this.jobCardCount,
    this.daily = const [],
  });

  factory FranchiseTotals.fromJson(Map<String, dynamic> json) =>
      FranchiseTotals(
        invoiceCount: (json['invoiceCount'] as num?)?.toInt() ?? 0,
        invoicedAmount: (json['invoicedAmount'] as num?)?.toDouble() ?? 0,
        collectedAmount: (json['collectedAmount'] as num?)?.toDouble() ?? 0,
        outstandingAmount: (json['outstandingAmount'] as num?)?.toDouble() ?? 0,
        jobCardCount: (json['jobCardCount'] as num?)?.toInt() ?? 0,
        daily: (json['daily'] as List<dynamic>? ?? [])
            .map((e) => FranchiseDailyPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// One franchisee on the dashboard. [totals] is null when the franchisee has not allowed the financial totals.
class FranchiseeFinancials {
  final String linkId;
  final String partnerCodeHint;
  final String partnerName;
  final bool financialTotalsAllowed;
  final List<String> allowedItems;
  final FranchiseTotals? totals;

  const FranchiseeFinancials({
    required this.linkId,
    required this.partnerCodeHint,
    required this.partnerName,
    required this.financialTotalsAllowed,
    this.allowedItems = const [],
    this.totals,
  });

  factory FranchiseeFinancials.fromJson(Map<String, dynamic> json) =>
      FranchiseeFinancials(
        linkId: json['linkId']?.toString() ?? '',
        partnerCodeHint: json['partnerCodeHint'] as String? ?? '',
        partnerName: json['partnerName'] as String? ?? '',
        financialTotalsAllowed:
            json['financialTotalsAllowed'] as bool? ?? false,
        allowedItems: (json['allowedItems'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList(),
        totals: json['totals'] is Map<String, dynamic>
            ? FranchiseTotals.fromJson(json['totals'] as Map<String, dynamic>)
            : null,
      );
}

class FranchiseDashboard {
  final String from;
  final String to;
  final FranchiseTotals network;
  final List<FranchiseeFinancials> franchisees;

  const FranchiseDashboard({
    required this.from,
    required this.to,
    required this.network,
    required this.franchisees,
  });

  /// The companies that share their totals, and the ones that do not.
  List<FranchiseeFinancials> get sharing =>
      franchisees.where((f) => f.totals != null).toList();
  List<FranchiseeFinancials> get notSharing =>
      franchisees.where((f) => f.totals == null).toList();

  factory FranchiseDashboard.fromJson(Map<String, dynamic> json) =>
      FranchiseDashboard(
        from: json['from'] as String? ?? '',
        to: json['to'] as String? ?? '',
        network: FranchiseTotals.fromJson(
          json['network'] as Map<String, dynamic>? ?? {},
        ),
        franchisees: (json['franchisees'] as List<dynamic>? ?? [])
            .map(
              (e) => FranchiseeFinancials.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
      );
}

/// The period shown on the dashboard, as yyyy-MM-dd dates. A record, so two equal periods are the same provider key.
typedef FranchisePeriod = ({String from, String to});

/// A franchise sign-up code as the franchisor sees it. The code itself is shown only once, when made.
class FranchiseSignupCode {
  final String id;
  final String? label;
  final List<FranchiseScope> scopes;

  /// Open, Reserved, Used, Expired or Cancelled.
  final String status;
  final DateTime? createdAt;
  final DateTime? expiresAt;
  final String? usedByCompanyName;

  const FranchiseSignupCode({
    required this.id,
    required this.label,
    required this.scopes,
    required this.status,
    required this.createdAt,
    required this.expiresAt,
    required this.usedByCompanyName,
  });

  bool get canWithdraw => status == 'Open' || status == 'Reserved';

  String get statusLabel => switch (status) {
    'Reserved' => 'In use (awaiting payment)',
    'Cancelled' => 'Withdrawn',
    _ => status,
  };

  factory FranchiseSignupCode.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => json[key] is String
        ? DateTime.tryParse(json[key] as String)?.toLocal()
        : null;
    return FranchiseSignupCode(
      id: json['id'] as String? ?? '',
      label: json['label'] as String?,
      scopes: (json['scopes'] as List<dynamic>? ?? [])
          .map((e) => FranchiseScope.fromJson(e as Map<String, dynamic>))
          .toList(),
      status: json['status'] as String? ?? '',
      createdAt: date('createdAt'),
      expiresAt: date('expiresAt'),
      usedByCompanyName: json['usedByCompanyName'] as String?,
    );
  }
}

/// The franchisor's codes. [available] is false on a single-company server (there is no sign-up website).
class FranchiseSignupCodes {
  final bool available;
  final int lifetimeMinutes;
  final List<FranchiseSignupCode> codes;

  const FranchiseSignupCodes({
    required this.available,
    required this.lifetimeMinutes,
    required this.codes,
  });

  static const unavailable = FranchiseSignupCodes(
    available: false,
    lifetimeMinutes: 0,
    codes: [],
  );

  factory FranchiseSignupCodes.fromJson(Map<String, dynamic> json) =>
      FranchiseSignupCodes(
        available: json['available'] as bool? ?? false,
        lifetimeMinutes: json['lifetimeMinutes'] as int? ?? 0,
        codes: (json['codes'] as List<dynamic>? ?? [])
            .map((e) => FranchiseSignupCode.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// A new code: [code] is shown once.
class CreatedFranchiseSignupCode {
  final String code;
  final FranchiseSignupCode item;

  const CreatedFranchiseSignupCode({required this.code, required this.item});

  factory CreatedFranchiseSignupCode.fromJson(Map<String, dynamic> json) =>
      CreatedFranchiseSignupCode(
        code: json['code'] as String? ?? '',
        item: FranchiseSignupCode.fromJson(
          json['item'] as Map<String, dynamic>? ?? const {},
        ),
      );
}
