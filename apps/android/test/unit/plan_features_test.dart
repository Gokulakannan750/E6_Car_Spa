import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/subscription/plan_features.dart';
import 'package:e6_car_spa/features/subscription/subscription_provider.dart';
import 'package:e6_car_spa/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

SubscriptionStatus starter({String? bannerLevel, String? bannerMessage}) =>
    SubscriptionStatus.fromJson({
      'managed': true,
      'access': bannerLevel == 'error' ? 'ReadOnly' : 'Full',
      'status': 'Active',
      'planCode': 'starter',
      'features': {
        PlanFeatureKeys.showroom: 'false',
        PlanFeatureKeys.whatsApp: 'false',
        PlanFeatureKeys.staffAdvances: 'false',
        PlanFeatureKeys.auditTrail: 'false',
        PlanFeatureKeys.advancedReports: 'false',
      },
      'seatLimit': 3,
      'seatsUsed': 1,
      if (bannerMessage != null)
        'banner': {'level': bannerLevel, 'message': bannerMessage},
    });

const owner = AuthUser(
  id: 'o',
  fullName: 'Owner',
  username: 'owner',
  role: 'Owner',
  isOwner: true,
);

void main() {
  tearDown(() => PlanFeatures.update(null));

  group('PlanFeatures', () {
    test('everything is allowed until the subscription is known', () {
      expect(PlanFeatures.hasFeature(PlanFeatureKeys.showroom), isTrue);
      expect(PlanFeatures.allowsPermission('showroom.view'), isTrue);
      expect(owner.hasPermission('showroom.view'), isTrue);
    });

    test('a single-company server allows everything', () {
      PlanFeatures.update(
        const SubscriptionStatus(managed: false, access: 'Full'),
      );
      expect(PlanFeatures.allowsPermission('audit.view'), isTrue);
    });

    test('modules outside the plan are hidden, for the Owner too', () {
      PlanFeatures.update(starter());

      expect(owner.hasPermission('showroom.view'), isFalse);
      expect(owner.hasPermission('staff_salary.view'), isFalse);
      expect(owner.hasPermission('audit.view'), isFalse);
      expect(owner.hasPermission('reports.gst'), isFalse);
      expect(owner.hasPermission('customers.view'), isTrue);
      expect(owner.hasPermission('reports.sales'), isTrue);
      expect(owner.hasPermission('reports.invoices'), isTrue);
    });

    test('maps permissions to the plan feature they belong to', () {
      expect(
        PlanFeatures.featureForPermission('vendors.manage'),
        PlanFeatureKeys.outsideJobs,
      );
      expect(
        PlanFeatures.featureForPermission('reports.showrooms'),
        PlanFeatureKeys.showroom,
      );
      expect(PlanFeatures.featureForPermission('jobcards.view'), isNull);
    });

    test('reads the server status, including the banner', () {
      final status = starter(
        bannerLevel: 'error',
        bannerMessage: 'Read-only until payment',
      );
      expect(status.isReadOnly, isTrue);
      expect(status.seatLimit, 3);
      expect(status.bannerLevel, 'error');
      expect(status.bannerMessage, 'Read-only until payment');
    });
  });

  group('SubscriptionNotifier', () {
    test('loading the status updates the plan; clearing forgets it', () async {
      final notifier = SubscriptionNotifier(() async => starter());

      await notifier.load();
      expect(notifier.state?.planCode, 'starter');
      expect(PlanFeatures.hasFeature(PlanFeatureKeys.showroom), isFalse);

      notifier.clear();
      expect(notifier.state, isNull);
      expect(PlanFeatures.hasFeature(PlanFeatureKeys.showroom), isTrue);
    });

    test('a failed load keeps the app usable', () async {
      final notifier = SubscriptionNotifier(() async => throw Exception('x'));
      await notifier.load();
      expect(notifier.state, isNull);
      expect(PlanFeatures.hasFeature(PlanFeatureKeys.showroom), isTrue);
    });
  });

  group('Subscription banner', () {
    Future<void> pumpShell(WidgetTester tester, SubscriptionStatus? status) {
      final notifier = SubscriptionNotifier(null)..state = status;
      return tester.pumpWidget(
        ProviderScope(
          overrides: [
            subscriptionStatusProvider.overrideWith((ref) => notifier),
          ],
          child: const MaterialApp(
            home: AppShell(child: Scaffold(body: Text('screen'))),
          ),
        ),
      );
    }

    testWidgets('shows the server message above the screen', (tester) async {
      await pumpShell(
        tester,
        starter(bannerLevel: 'warning', bannerMessage: 'Payment is overdue'),
      );
      expect(find.byKey(const Key('subscription_banner')), findsOneWidget);
      expect(find.text('Payment is overdue'), findsOneWidget);
      expect(find.text('screen'), findsOneWidget);
    });

    testWidgets('shows nothing extra without a message', (tester) async {
      await pumpShell(tester, starter());
      expect(find.byKey(const Key('subscription_banner')), findsNothing);
      expect(find.text('screen'), findsOneWidget);
    });
  });
}
