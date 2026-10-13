import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/subscription/plan_change.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../franchise/franchise_fakes.dart';

PlanChangeProposal proposal({
  String timing = 'NowWithCharge',
  int amount = 250000,
}) => PlanChangeProposal.fromJson({
  'id': 'p1',
  'status': 'Pending',
  'timing': timing,
  'from': {
    'planName': 'Starter',
    'interval': 'Year',
    'bothLicences': 1,
    'addOns': <String>[],
  },
  'to': {
    'planName': 'Professional',
    'interval': 'Year',
    'bothLicences': 1,
    'addOns': ['Showroom / B2B module'],
  },
  'currentPeriodPriceMinor': 999000,
  'newPeriodPriceMinor': 1499000,
  'amountNowMinor': amount,
  'effectiveAt': '2027-04-13T00:00:00Z',
  'expiresAt': '2026-10-21T00:00:00Z',
  'reason': 'Owner asked on the phone',
});

/// Answers like the server and remembers what was asked.
class FakePlanChangeApi extends PlanChangeApi {
  FakePlanChangeApi(this.current) : super(Dio());

  PlanChangeProposal? current;
  final List<String> calls = [];

  @override
  Future<PlanChangeProposal?> open() async => current;

  @override
  Future<PlanChangeProposal?> approve(String id) async {
    calls.add('approve:$id');
    return null;
  }

  @override
  Future<void> decline(String id) async => calls.add('decline:$id');
}

Widget sheetApp(FakePlanChangeApi api, {bool isOwner = true}) => ProviderScope(
  overrides: [
    authNotifierProvider.overrideWith(
      (ref) => TestAuthNotifier(Authenticated(isOwner ? owner : viewer)),
    ),
    planChangeApiProvider.overrideWithValue(api),
  ],
  child: const MaterialApp(home: Scaffold(body: PlanChangeSheet())),
);

void main() {
  setUpAll(disableFontDownloads);

  test('the explanation says what is paid now, or when a downgrade starts', () {
    expect(
      planChangeExplanation(proposal()),
      contains('invoice for ₹2,500.00'),
    );
    expect(
      planChangeExplanation(proposal(timing: 'AtPeriodEnd', amount: 0)),
      contains('13 Apr 2027, when your paid period ends. Nothing is refunded'),
    );
    expect(
      planChangeExplanation(proposal(timing: 'Now', amount: 0)),
      contains('Nothing to pay now'),
    );
  });

  testWidgets('the Owner sees the change and approves it', (tester) async {
    useTallScreen(tester);
    final api = FakePlanChangeApi(proposal());
    await tester.pumpWidget(sheetApp(api));
    await tester.pumpAndSettle();

    expect(
      find.text('Trovo has proposed a change to your plan'),
      findsOneWidget,
    );
    expect(find.text('Professional yearly'), findsOneWidget);
    await tester.tap(find.byKey(const Key('plan_change_approve')));
    await tester.pumpAndSettle();
    expect(api.calls, ['approve:p1']);
    expect(find.text('Approved. Your new plan is in effect.'), findsOneWidget);
    expect(find.byKey(const Key('plan_change_approve')), findsNothing);
  });

  testWidgets('someone other than the Owner cannot answer', (tester) async {
    useTallScreen(tester);
    await tester.pumpWidget(
      sheetApp(FakePlanChangeApi(proposal()), isOwner: false),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Only the Owner can approve or decline this.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('plan_change_approve')), findsNothing);
  });
}
