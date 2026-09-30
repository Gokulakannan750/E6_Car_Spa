import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/billing/presentation/pages/billing_screen.dart';
import 'package:e6_car_spa/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  FakeAuthNotifier(super.initial);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const ownerUser = AuthUser(
    id: 'owner-1',
    username: 'owner',
    fullName: 'Owner User',
    role: 'Owner',
    isOwner: true,
    permissions: ['*'],
  );

  final testTabs = [
    const BillingTabDefinition(
      label: 'Customers',
      icon: Icons.people_outline_rounded,
      permission: 'customers.view',
      widget: Scaffold(body: Text('Customers Content')),
    ),
    const BillingTabDefinition(
      label: 'Job Cards',
      icon: Icons.assignment_outlined,
      permission: 'jobcards.view',
      widget: Scaffold(body: Text('Job Cards Content')),
    ),
    const BillingTabDefinition(
      label: 'Invoices',
      icon: Icons.receipt_long_outlined,
      permission: 'invoices.view',
      widget: Scaffold(body: Text('Invoices Content')),
    ),
    const BillingTabDefinition(
      label: 'Catalogue / Services',
      icon: Icons.inventory_2_outlined,
      permission: 'catalogue.view',
      widget: Scaffold(body: Text('Catalogue Content')),
    ),
  ];

  Widget createTestApp({
    required AuthUser user,
    String initialLocation = AppRoutes.billing,
  }) {
    final router = GoRouter(
      initialLocation: initialLocation,
      routes: [
        ShellRoute(
          builder: (context, state, child) =>
              AppShell(currentLocation: state.matchedLocation, child: child),
          routes: [
            GoRoute(
              path: AppRoutes.dashboard,
              builder: (context, state) =>
                  const Scaffold(body: Text('Suite Launcher Content')),
            ),
            GoRoute(
              path: AppRoutes.billing,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 0, tabs: testTabs),
            ),
            GoRoute(
              path: AppRoutes.jobCards,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 1, tabs: testTabs),
            ),
            GoRoute(
              path: AppRoutes.customers,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 0, tabs: testTabs),
            ),
            GoRoute(
              path: AppRoutes.quotationsInvoices,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 2, tabs: testTabs),
            ),
            GoRoute(
              path: AppRoutes.catalogue,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 3, tabs: testTabs),
            ),
            GoRoute(
              path: AppRoutes.staff,
              builder: (context, state) => const Scaffold(
                appBar: PreferredSize(
                  preferredSize: Size.fromHeight(kToolbarHeight),
                  child: Text('Staff Suite'),
                ),
                body: Text('Staff Content'),
              ),
            ),
          ],
        ),
      ],
    );

    return ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(user),
        authNotifierProvider.overrideWith(
          (ref) => FakeAuthNotifier(Authenticated(user)),
        ),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  group('Billing Suite top-tab navigation', () {
    testWidgets(
      'shows Billing Suite header and exactly four top tabs without bottom nav',
      (tester) async {
        await tester.pumpWidget(createTestApp(user: ownerUser));
        await tester.pumpAndSettle();

        expect(find.text('Billing Suite'), findsOneWidget);
        expect(find.text('Customers'), findsOneWidget);
        expect(find.text('Job Cards'), findsOneWidget);
        expect(find.text('Invoices'), findsOneWidget);
        expect(find.text('Catalogue / Services'), findsOneWidget);
        expect(find.text('Dashboard'), findsNothing);
        expect(find.text('More'), findsNothing);
        expect(find.byType(BottomNavigationBar), findsNothing);
        expect(
          find.byKey(const Key('billing_suite_back_button')),
          findsOneWidget,
        );
        expect(find.byTooltip('Sign Out'), findsOneWidget);
      },
    );

    testWidgets(
      'switches between existing billing module routes using top tabs',
      (tester) async {
        await tester.pumpWidget(createTestApp(user: ownerUser));
        await tester.pumpAndSettle();
        expect(find.text('Customers Content'), findsOneWidget);

        await tester.tap(find.text('Job Cards'));
        await tester.pumpAndSettle();
        expect(find.text('Job Cards Content'), findsOneWidget);
        expect(find.text('Billing Suite'), findsOneWidget);

        await tester.tap(find.text('Invoices'));
        await tester.pumpAndSettle();
        expect(find.text('Invoices Content'), findsOneWidget);

        await tester.tap(find.text('Catalogue / Services'));
        await tester.pumpAndSettle();
        expect(find.text('Catalogue Content'), findsOneWidget);

        await tester.tap(find.text('Customers'));
        await tester.pumpAndSettle();
        expect(find.text('Customers Content'), findsOneWidget);
      },
    );

    testWidgets('back button returns to the Suite Launcher', (tester) async {
      await tester.pumpWidget(createTestApp(user: ownerUser));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('billing_suite_back_button')));
      await tester.pumpAndSettle();

      expect(find.text('Suite Launcher Content'), findsOneWidget);
      expect(find.text('Billing Suite'), findsNothing);
    });

    testWidgets('restricted user sees only permitted billing tabs', (
      tester,
    ) async {
      const cashier = AuthUser(
        id: 'cashier-1',
        username: 'cashier',
        fullName: 'Cashier',
        role: 'Cashier',
        isOwner: false,
        permissions: ['jobcards.view', 'invoices.view'],
      );

      await tester.pumpWidget(createTestApp(user: cashier));
      await tester.pumpAndSettle();

      expect(find.text('Job Cards'), findsOneWidget);
      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('Customers'), findsNothing);
      expect(find.text('Catalogue / Services'), findsNothing);
      expect(find.byType(BottomNavigationBar), findsNothing);
    });

    testWidgets('owner sees all billing tabs and no tabs from other suites', (
      tester,
    ) async {
      await tester.pumpWidget(createTestApp(user: ownerUser));
      await tester.pumpAndSettle();

      expect(find.text('Job Cards'), findsOneWidget);
      expect(find.text('Customers'), findsOneWidget);
      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('Catalogue / Services'), findsOneWidget);
      expect(find.text('Staff'), findsNothing);
      expect(find.text('Reports'), findsNothing);
      expect(find.text('Settings'), findsNothing);
    });

    testWidgets(
      'non-billing routes do not display Billing Suite or bottom nav',
      (tester) async {
        await tester.pumpWidget(
          createTestApp(user: ownerUser, initialLocation: AppRoutes.staff),
        );
        await tester.pumpAndSettle();

        expect(find.text('Staff Suite'), findsOneWidget);
        expect(find.text('Billing Suite'), findsNothing);
        expect(find.byType(BottomNavigationBar), findsNothing);
      },
    );
  });
}
