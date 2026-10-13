import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/api_exception.dart';
import '../../core/network/dio_client.dart';

/// User licences per app type.
class LicenceCounts {
  final int android;
  final int windows;
  final int both;

  const LicenceCounts({this.android = 0, this.windows = 0, this.both = 0});

  int get total => android + windows + both;

  int of(String key) => switch (key) {
    'android' => android,
    'windows' => windows,
    _ => both,
  };

  LicenceCounts withValue(String key, int value) => LicenceCounts(
    android: key == 'android' ? value : android,
    windows: key == 'windows' ? value : windows,
    both: key == 'both' ? value : both,
  );

  Map<String, dynamic> toJson() => {
    'android': android,
    'windows': windows,
    'both': both,
  };

  factory LicenceCounts.fromJson(Map<String, dynamic> json) => LicenceCounts(
    android: json['android'] as int? ?? 0,
    windows: json['windows'] as int? ?? 0,
    both: json['both'] as int? ?? 0,
  );

  @override
  bool operator ==(Object other) =>
      other is LicenceCounts &&
      other.android == android &&
      other.windows == windows &&
      other.both == both;

  @override
  int get hashCode => Object.hash(android, windows, both);
}

class CatalogPrices {
  final int bothUserPriceMinor;
  final int windowsUserPriceMinor;
  final int androidUserPriceMinor;

  const CatalogPrices({
    required this.bothUserPriceMinor,
    required this.windowsUserPriceMinor,
    required this.androidUserPriceMinor,
  });

  int forLicence(String key) => switch (key) {
    'android' => androidUserPriceMinor,
    'windows' => windowsUserPriceMinor,
    _ => bothUserPriceMinor,
  };

  static CatalogPrices? fromJson(Object? json) => json is Map<String, dynamic>
      ? CatalogPrices(
          bothUserPriceMinor: json['bothUserPriceMinor'] as int? ?? 0,
          windowsUserPriceMinor: json['windowsUserPriceMinor'] as int? ?? 0,
          androidUserPriceMinor: json['androidUserPriceMinor'] as int? ?? 0,
        )
      : null;
}

class CatalogPlan {
  final String code;
  final String name;
  final int minimumLicences;
  final List<String> modules;
  final CatalogPrices? monthly;
  final CatalogPrices? yearly;

  const CatalogPlan({
    required this.code,
    required this.name,
    required this.minimumLicences,
    required this.modules,
    this.monthly,
    this.yearly,
  });

  CatalogPrices? pricesFor(String interval) =>
      interval == 'Year' ? yearly : monthly;

  factory CatalogPlan.fromJson(Map<String, dynamic> json) => CatalogPlan(
    code: json['code'] as String,
    name: json['name'] as String? ?? '',
    minimumLicences: json['minimumLicences'] as int? ?? 1,
    modules: (json['modules'] as List<dynamic>? ?? const []).cast<String>(),
    monthly: CatalogPrices.fromJson(json['monthly']),
    yearly: CatalogPrices.fromJson(json['yearly']),
  );
}

class CatalogAddOn {
  final String code;
  final String name;
  final String featureKey;
  final bool isPack;
  final int? monthlyPriceMinor;
  final int? yearlyPriceMinor;

  const CatalogAddOn({
    required this.code,
    required this.name,
    required this.featureKey,
    required this.isPack,
    this.monthlyPriceMinor,
    this.yearlyPriceMinor,
  });

  int? priceFor(String interval) =>
      interval == 'Year' ? yearlyPriceMinor : monthlyPriceMinor;

  /// A module the plan already includes is not sold separately.
  bool includedIn(CatalogPlan? plan) =>
      !isPack && (plan?.modules.contains(featureKey) ?? false);

  factory CatalogAddOn.fromJson(Map<String, dynamic> json) => CatalogAddOn(
    code: json['code'] as String,
    name: json['name'] as String? ?? '',
    featureKey: json['featureKey'] as String? ?? '',
    isPack: json['isPack'] as bool? ?? false,
    monthlyPriceMinor: json['monthlyPriceMinor'] as int?,
    yearlyPriceMinor: json['yearlyPriceMinor'] as int?,
  );
}

/// A plan, billing interval, user licences and add-ons.
class OwnerChoice {
  final String planCode;
  final String interval;
  final LicenceCounts licences;
  final Map<String, int> addOns;

  const OwnerChoice({
    required this.planCode,
    required this.interval,
    required this.licences,
    required this.addOns,
  });

  OwnerChoice copyWith({
    String? planCode,
    String? interval,
    LicenceCounts? licences,
    Map<String, int>? addOns,
  }) => OwnerChoice(
    planCode: planCode ?? this.planCode,
    interval: interval ?? this.interval,
    licences: licences ?? this.licences,
    addOns: addOns ?? this.addOns,
  );

  /// What to send: no add-on the plan includes, none without a price for the interval.
  OwnerChoice cleaned(List<CatalogPlan> plans, List<CatalogAddOn> catalog) {
    final plan = plans.where((p) => p.code == planCode).firstOrNull;
    return copyWith(
      addOns: Map.fromEntries(
        addOns.entries.where((e) {
          final addOn = catalog.where((a) => a.code == e.key).firstOrNull;
          return e.value > 0 &&
              addOn != null &&
              !addOn.includedIn(plan) &&
              addOn.priceFor(interval) != null;
        }),
      ),
    );
  }

  String get key {
    final sorted = addOns.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return '$planCode|$interval|${licences.android}|${licences.windows}|${licences.both}|'
        '${sorted.map((e) => '${e.key}=${e.value}').join(',')}';
  }

  Map<String, dynamic> toJson() => {
    'planCode': planCode,
    'interval': interval,
    'licences': licences.toJson(),
    'addOns': addOns,
  };

  factory OwnerChoice.fromJson(Map<String, dynamic> json) => OwnerChoice(
    planCode: json['planCode'] as String,
    interval: json['interval'] as String? ?? 'Month',
    licences: LicenceCounts.fromJson(json['licences'] as Map<String, dynamic>),
    addOns: (json['addOns'] as Map<String, dynamic>? ?? const {}).map(
      (k, v) => MapEntry(k, v as int),
    ),
  );
}

class OwnerSubscription {
  final List<CatalogPlan> plans;
  final List<CatalogAddOn> addOns;
  final OwnerChoice current;
  final LicenceCounts licencesInUse;
  final String status;
  final DateTime currentPeriodEnd;
  final bool cancelAtPeriodEnd;
  final bool canPayOnline;
  final bool testPayments;

  const OwnerSubscription({
    required this.plans,
    required this.addOns,
    required this.current,
    required this.licencesInUse,
    required this.status,
    required this.currentPeriodEnd,
    required this.cancelAtPeriodEnd,
    required this.canPayOnline,
    required this.testPayments,
  });

  factory OwnerSubscription.fromJson(Map<String, dynamic> json) {
    final catalog = json['catalog'] as Map<String, dynamic>;
    return OwnerSubscription(
      plans: (catalog['plans'] as List<dynamic>)
          .map((e) => CatalogPlan.fromJson(e as Map<String, dynamic>))
          .toList(),
      addOns: (catalog['addOns'] as List<dynamic>)
          .map((e) => CatalogAddOn.fromJson(e as Map<String, dynamic>))
          .toList(),
      current: OwnerChoice.fromJson(json['current'] as Map<String, dynamic>),
      licencesInUse: LicenceCounts.fromJson(
        json['licencesInUse'] as Map<String, dynamic>,
      ),
      status: json['status'] as String? ?? '',
      currentPeriodEnd: DateTime.parse(
        json['currentPeriodEnd'] as String,
      ).toLocal(),
      cancelAtPeriodEnd: json['cancelAtPeriodEnd'] as bool? ?? false,
      canPayOnline: json['canPayOnline'] as bool? ?? false,
      testPayments: json['testPayments'] as bool? ?? false,
    );
  }
}

class ChangePreview {
  /// Now, NowWithCharge or AtPeriodEnd.
  final String timing;
  final int currentPeriodPriceMinor;
  final int newPeriodPriceMinor;
  final int amountNowMinor;
  final DateTime effectiveAt;

  const ChangePreview({
    required this.timing,
    required this.currentPeriodPriceMinor,
    required this.newPeriodPriceMinor,
    required this.amountNowMinor,
    required this.effectiveAt,
  });

  factory ChangePreview.fromJson(Map<String, dynamic> json) => ChangePreview(
    timing: json['timing'] as String? ?? 'Now',
    currentPeriodPriceMinor: json['currentPeriodPriceMinor'] as int? ?? 0,
    newPeriodPriceMinor: json['newPeriodPriceMinor'] as int? ?? 0,
    amountNowMinor: json['amountNowMinor'] as int? ?? 0,
    effectiveAt: DateTime.parse(json['effectiveAt'] as String).toLocal(),
  );
}

class ChangeResult {
  final String status;
  final DateTime effectiveAt;
  final int amountNowMinor;
  final String? invoiceNumber;

  const ChangeResult({
    required this.status,
    required this.effectiveAt,
    required this.amountNowMinor,
    this.invoiceNumber,
  });

  factory ChangeResult.fromJson(Map<String, dynamic> json) => ChangeResult(
    status: json['status'] as String? ?? 'Applied',
    effectiveAt: DateTime.parse(json['effectiveAt'] as String).toLocal(),
    amountNowMinor: json['amountNowMinor'] as int? ?? 0,
    invoiceNumber: json['invoiceNumber'] as String?,
  );
}

class OwnerInvoice {
  final String id;
  final String invoiceNumber;
  final String kind;
  final String status;
  final DateTime issuedAt;
  final DateTime dueAt;
  final DateTime? periodStart;
  final DateTime? periodEnd;
  final int totalMinor;
  final int amountDueMinor;

  const OwnerInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.kind,
    required this.status,
    required this.issuedAt,
    required this.dueAt,
    this.periodStart,
    this.periodEnd,
    required this.totalMinor,
    required this.amountDueMinor,
  });

  bool get payable => status == 'Open' && amountDueMinor > 0;

  factory OwnerInvoice.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => json[key] is String
        ? DateTime.parse(json[key] as String).toLocal()
        : null;
    return OwnerInvoice(
      id: json['id'] as String,
      invoiceNumber: json['invoiceNumber'] as String? ?? '',
      kind: json['kind'] as String? ?? 'Period',
      status: json['status'] as String? ?? 'Open',
      issuedAt: date('issuedAt')!,
      dueAt: date('dueAt')!,
      periodStart: date('periodStart'),
      periodEnd: date('periodEnd'),
      totalMinor: json['totalMinor'] as int? ?? 0,
      amountDueMinor: json['amountDueMinor'] as int? ?? 0,
    );
  }
}

/// /api/subscription/self… (the Owner only).
class OwnerSubscriptionApi {
  final Dio _dio;

  OwnerSubscriptionApi(this._dio);

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<OwnerSubscription> load() => _guard(
    () async => OwnerSubscription.fromJson(
      (await _dio.get('/subscription/self')).data as Map<String, dynamic>,
    ),
  );

  Future<ChangePreview> preview(OwnerChoice choice) => _guard(
    () async => ChangePreview.fromJson(
      (await _dio.post(
            '/subscription/self/preview',
            data: choice.toJson(),
          )).data
          as Map<String, dynamic>,
    ),
  );

  Future<ChangeResult> change(OwnerChoice choice) => _guard(
    () async => ChangeResult.fromJson(
      (await _dio.post('/subscription/self/change', data: choice.toJson())).data
          as Map<String, dynamic>,
    ),
  );

  Future<List<OwnerInvoice>> invoices() => _guard(
    () async =>
        ((await _dio.get('/subscription/self/invoices')).data as List<dynamic>)
            .map((e) => OwnerInvoice.fromJson(e as Map<String, dynamic>))
            .toList(),
  );

  Future<void> pay(String id) =>
      _guard(() => _dio.post('/subscription/self/invoices/$id/pay'));

  Future<void> renew() => _guard(() => _dio.post('/subscription/self/renew'));

  Future<void> cancel(String? reason) => _guard(
    () => _dio.post('/subscription/self/cancel', data: {'reason': reason}),
  );

  Future<void> resume() => _guard(() => _dio.post('/subscription/self/resume'));
}

final ownerSubscriptionApiProvider = Provider<OwnerSubscriptionApi>(
  (ref) => OwnerSubscriptionApi(ref.watch(dioProvider)),
);
