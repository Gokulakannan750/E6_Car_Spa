import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/subscription/owner_subscription.dart';
import 'package:e6_car_spa/features/subscription/subscription_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../franchise/franchise_fakes.dart';

final data = OwnerSubscription.fromJson({
  'catalog': {
    'plans': [
      {
        'code': 'starter',
        'name': 'Starter',
        'minimumLicences': 1,
        'modules': <String>[],
        'monthly': {
          'bothUserPriceMinor': 99900,
          'windowsUserPriceMinor': 69900,
          'androidUserPriceMinor': 49900,
        },
        'yearly': {
          'bothUserPriceMinor': 999000,
          'windowsUserPriceMinor': 699000,
          'androidUserPriceMinor': 499000,
        },
      },
      {
        'code': 'professional',
        'name': 'Professional',
        'minimumLicences': 1,
        'modules': ['outside_jobs.enabled'],
        'monthly': {
          'bothUserPriceMinor': 149900,
          'windowsUserPriceMinor': 119900,
          'androidUserPriceMinor': 79900,
        },
        'yearly': {
          'bothUserPriceMinor': 1499000,
          'windowsUserPriceMinor': 1199000,
          'androidUserPriceMinor': 799000,
        },
      },
    ],
    'addOns': [
      {
        'code': 'outside_jobs',
        'name': 'Outside jobs & vendors',
        'featureKey': 'outside_jobs.enabled',
        'isPack': false,
        'monthlyPriceMinor': 29900,
        'yearlyPriceMinor': 299000,
      },
    ],
  },
  'current': {
    'planCode': 'starter',
    'interval': 'Year',
    'licences': {'android': 0, 'windows': 0, 'both': 1},
    'addOns': <String, int>{},
  },
  'licencesInUse': {'android': 0, 'windows': 0, 'both': 1},
  'status': 'Active',
  'currentPeriodEnd': '2027-10-13T00:00:00Z',
  'cancelAtPeriodEnd': false,
  'canPayOnline': true,
  'testPayments': true,
});

class FakeOwnerApi extends OwnerSubscriptionApi {
  FakeOwnerApi() : super(Dio());

  final List<String> calls = [];

  @override
  Future<ChangePreview> preview(OwnerChoice choice) async {
    calls.add('preview:${choice.key}');
    return ChangePreview.fromJson({
      'timing': 'NowWithCharge',
      'currentPeriodPriceMinor': 999000,
      'newPeriodPriceMinor': 1698000,
      'amountNowMinor': 349500,
      'effectiveAt': '2026-10-13T00:00:00Z',
    });
  }

  @override
  Future<ChangeResult> change(OwnerChoice choice) async {
    calls.add('change:${choice.key}');
    return ChangeResult.fromJson({
      'status': 'Applied',
      'effectiveAt': '2026-10-13T00:00:00Z',
      'amountNowMinor': 349500,
      'invoiceNumber': 'TROVO/2026-27/0011',
    });
  }
}

Widget app(FakeOwnerApi api) => ProviderScope(
  overrides: [
    authNotifierProvider.overrideWith(
      (ref) => TestAuthNotifier(const Authenticated(owner)),
    ),
    ownerSubscriptionApiProvider.overrideWithValue(api),
  ],
  child: MaterialApp(
    home: Scaffold(body: ChangePlanSheet(data: data)),
  ),
);

void main() {
  setUpAll(disableFontDownloads);

  testWidgets(
    'adding a Windows licence shows the price to pay now, then changes the plan',
    (tester) async {
      useTallScreen(tester);
      final api = FakeOwnerApi();
      await tester.pumpWidget(app(api));

      // The Owner's own licence is in use: Windows + Android cannot go below 1.
      expect(
        tester
            .widget<IconButton>(find.byKey(const Key('fewer_both')))
            .onPressed,
        isNull,
      );
      expect(
        find.text('Change something above to see the price.'),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('more_windows')));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      expect(api.calls, ['preview:starter|Year|0|1|1|']);
      expect(find.textContaining('You pay ₹3,495.00 today'), findsOneWidget);

      await tester.tap(find.byKey(const Key('change_plan_confirm')));
      await tester.pumpAndSettle();
      expect(api.calls.last, 'change:starter|Year|0|1|1|');
    },
  );

  testWidgets('an add-on the chosen plan includes is not offered', (
    tester,
  ) async {
    useTallScreen(tester);
    await tester.pumpWidget(app(FakeOwnerApi()));
    expect(find.byKey(const Key('addon_outside_jobs')), findsOneWidget);
    await tester.tap(find.byKey(const Key('plan_professional')));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('addon_outside_jobs')), findsNothing);
    expect(find.text('Included in Professional'), findsOneWidget);
  });
}
