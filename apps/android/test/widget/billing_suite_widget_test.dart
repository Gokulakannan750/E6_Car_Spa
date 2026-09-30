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
  const testOwnerUser = AuthUser(
    id: 'owner-1',
    username: 'owner',
    fullName: 'Owner User',
    role: 'Owner',
    isOwner: true,
    permissions: [
      'customers.view',
      'jobcards.view',
      'invoices.view',
      'catalogue.view',
      'staff.view',
    ],
  );

  const restrictedBillingUser = AuthUser(
    id: 'cashier-1',
    username: 'cashier',
    fullName: 'Cashier User',
    role: 'Cashier',
    isOwner: false,
    permissions: ['jobcards.view', 'invoices.view'],
  );

  const noBillingUser = AuthUser(
    id: 'staff-only',
    username: 'mechanic',
    fullName: 'Mechanic User',
    role: 'Staff',
    isOwner: false,
    permissions: ['staff.view'],
  );

  final mockTabs = [
    const BillingTabDefinition(
      label: 'Customers',
      icon: Icons.people_outline_rounded,
      permission: 'customers.view',
      widget: Scaffold(
        key: Key('mock_customers_screen'),
        body: Text('CustomersScreen Body Content'),
      ),
    ),
    const BillingTabDefinition(
      label: 'Job Cards',
      icon: Icons.assignment_outlined,
      permission: 'jobcards.view',
      widget: Scaffold(
        key: Key('mock_job_cards_screen'),
        body: Text('JobCardsScreen Body Content'),
      ),
    ),
    const BillingTabDefinition(
      label: 'Invoices',
      icon: Icons.receipt_long_outlined,
      permission: 'invoices.view',
      widget: Scaffold(
        key: Key('mock_invoices_screen'),
        body: Text('InvoicesScreen Body Content'),
      ),
    ),
    const BillingTabDefinition(
      label: 'Catalogue / Services',
      icon: Icons.inventory_2_outlined,
      permission: 'catalogue.view',
      widget: Scaffold(
        key: Key('mock_catalogue_screen'),
        body: Text('CatalogueScreen Body Content'),
      ),
    ),
  ];

  Widget createTestWidget({
    required AuthUser user,
    String initialLocation = AppRoutes.billing,
    int initialTabIndex = 0,
    List<BillingTabDefinition>? tabs,
  }) {
    final effectiveTabs = tabs ?? mockTabs;
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
                  const Scaffold(body: Text('Suite Launcher Dashboard')),
            ),
            GoRoute(
              path: AppRoutes.billing,
              builder: (context, state) => BillingScreen(
                initialTabIndex: initialTabIndex,
                tabs: effectiveTabs,
              ),
              routes: [
                GoRoute(
                  path: 'customers',
                  builder: (context, state) =>
                      BillingScreen(initialTabIndex: 0, tabs: effectiveTabs),
                ),
                GoRoute(
                  path: 'job-cards',
                  builder: (context, state) =>
                      BillingScreen(initialTabIndex: 1, tabs: effectiveTabs),
                ),
                GoRoute(
                  path: 'invoices',
                  builder: (context, state) =>
                      BillingScreen(initialTabIndex: 2, tabs: effectiveTabs),
                ),
                GoRoute(
                  path: 'catalogue',
                  builder: (context, state) =>
                      BillingScreen(initialTabIndex: 3, tabs: effectiveTabs),
                ),
                GoRoute(
                  path: 'services',
                  builder: (context, state) =>
                      BillingScreen(initialTabIndex: 3, tabs: effectiveTabs),
                ),
              ],
            ),
            GoRoute(
              path: AppRoutes.customers,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 0, tabs: effectiveTabs),
            ),
            GoRoute(
              path: AppRoutes.jobCards,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 1, tabs: effectiveTabs),
            ),
            GoRoute(
              path: AppRoutes.quotationsInvoices,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 2, tabs: effectiveTabs),
            ),
            GoRoute(
              path: AppRoutes.catalogue,
              builder: (context, state) =>
                  BillingScreen(initialTabIndex: 3, tabs: effectiveTabs),
            ),
            GoRoute(
              path: AppRoutes.staff,
              builder: (context, state) => const Scaffold(
                appBar: PreferredSize(
                  preferredSize: Size.fromHeight(kToolbarHeight),
                  child: Text('Staff Suite'),
                ),
                body: Text('Staff Suite Destination'),
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

  group('Billing Suite Level-2 Navigation & UI Parity (Section 12 Tests)', () {
    // 1. Billing Suite opens successfully
    testWidgets('1. Billing Suite opens successfully', (tester) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      expect(find.byType(BillingScreen), findsOneWidget);
    });

    // 2. Header displays: Billing Suite
    testWidgets('2. Header displays: Billing Suite', (tester) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      expect(find.text('Billing Suite'), findsOneWidget);
      expect(find.byTooltip('Sign Out'), findsOneWidget);
      expect(
        find.byKey(const Key('billing_suite_back_button')),
        findsOneWidget,
      );
    });

    // 3. Four Billing tabs exist: Customers, Job Cards, Invoices, Catalogue / Services
    testWidgets('3. Four Billing tabs exist with correct labels and order', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      expect(find.text('Customers'), findsOneWidget);
      expect(find.text('Job Cards'), findsOneWidget);
      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('Catalogue / Services'), findsOneWidget);
      expect(find.byType(Tab), findsNWidgets(4));
    });

    // 4. Payments is NOT present as a Billing tab
    testWidgets('4. Payments is NOT present as a Billing tab', (tester) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      expect(find.text('Payments'), findsNothing);
    });

    // 5. Vehicles is NOT present as a Billing tab
    testWidgets('5. Vehicles is NOT present as a Billing tab', (tester) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      expect(find.text('Vehicles'), findsNothing);
    });

    // 6. Customers tab opens CustomersScreen (and is default selected)
    testWidgets('6. Customers tab opens CustomersScreen as default selection', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      // By default initialTabIndex is 0 (Customers)
      expect(find.byKey(const Key('mock_customers_screen')), findsOneWidget);
      expect(find.text('CustomersScreen Body Content'), findsOneWidget);

      await tester.tap(find.text('Customers'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('mock_customers_screen')), findsOneWidget);
    });

    // 7. Job Cards tab opens JobCardsScreen
    testWidgets('7. Job Cards tab opens JobCardsScreen when selected', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Job Cards'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('mock_job_cards_screen')), findsOneWidget);
      expect(find.text('JobCardsScreen Body Content'), findsOneWidget);
    });

    // 8. Invoices tab opens InvoicesScreen
    testWidgets('8. Invoices tab opens InvoicesScreen', (tester) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Invoices'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('mock_invoices_screen')), findsOneWidget);
      expect(find.text('InvoicesScreen Body Content'), findsOneWidget);
    });

    // 9. Catalogue tab opens CatalogueScreen
    testWidgets('9. Catalogue tab opens CatalogueScreen', (tester) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Catalogue / Services'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('mock_catalogue_screen')), findsOneWidget);
      expect(find.text('CatalogueScreen Body Content'), findsOneWidget);
    });

    // 10. Permission filtering works
    testWidgets('10. Permission filtering works for restricted user', (
      tester,
    ) async {
      await tester.pumpWidget(createTestWidget(user: restrictedBillingUser));
      await tester.pumpAndSettle();

      expect(find.text('Job Cards'), findsOneWidget);
      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('Customers'), findsNothing);
      expect(find.text('Catalogue / Services'), findsNothing);
      expect(find.byType(Tab), findsNWidgets(2));
    });

    // 11. Owner can access all four modules
    testWidgets('11. Owner can access all four modules', (tester) async {
      await tester.pumpWidget(createTestWidget(user: testOwnerUser));
      await tester.pumpAndSettle();

      expect(find.text('Customers'), findsOneWidget);
      expect(find.text('Job Cards'), findsOneWidget);
      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('Catalogue / Services'), findsOneWidget);
    });

    // 12. A restricted user only sees modules for which they have permission
    testWidgets(
      '12. A user with no billing permissions sees Access Restricted screen',
      (tester) async {
        await tester.pumpWidget(createTestWidget(user: noBillingUser));
        await tester.pumpAndSettle();

        expect(find.text('Access Restricted'), findsOneWidget);
        expect(
          find.text('You do not have permission to access Billing Suite.'),
          findsOneWidget,
        );
        expect(find.text('Return to Suite Launcher'), findsOneWidget);
        expect(find.byType(Tab), findsNothing);

        // Can return to suite launcher
        await tester.tap(find.text('Return to Suite Launcher'));
        await tester.pumpAndSettle();
        expect(find.text('Suite Launcher Dashboard'), findsOneWidget);
      },
    );

    // 13. Back navigation returns from Billing Suite to Level-1 Suite Launcher
    testWidgets(
      '13. Back navigation returns from Billing Suite to Level-1 Suite Launcher',
      (tester) async {
        await tester.pumpWidget(createTestWidget(user: testOwnerUser));
        await tester.pumpAndSettle();

        await tester.tap(find.byKey(const Key('billing_suite_back_button')));
        await tester.pumpAndSettle();

        expect(find.text('Suite Launcher Dashboard'), findsOneWidget);
        expect(find.byType(BillingScreen), findsNothing);
      },
    );

    // 14. Existing Staff Suite navigation remains unaffected
    testWidgets('14. Existing Staff Suite navigation remains unaffected', (
      tester,
    ) async {
      await tester.pumpWidget(
        createTestWidget(user: testOwnerUser, initialLocation: AppRoutes.staff),
      );
      await tester.pumpAndSettle();

      expect(find.text('Staff Suite'), findsOneWidget);
      expect(find.text('Staff Suite Destination'), findsOneWidget);
      expect(find.byType(BillingScreen), findsNothing);
    });

    // 15. Existing global application navigation remains unaffected
    testWidgets(
      '15. Existing global application navigation remains unaffected',
      (tester) async {
        await tester.pumpWidget(
          createTestWidget(
            user: testOwnerUser,
            initialLocation: AppRoutes.dashboard,
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Suite Launcher Dashboard'), findsOneWidget);
        expect(find.byType(BottomNavigationBar), findsNothing);
      },
    );

    // 16. Switching sequentially between all four tabs works correctly
    testWidgets(
      '16. Starts on Customers and switches sequentially between all four tabs',
      (tester) async {
        await tester.pumpWidget(createTestWidget(user: testOwnerUser));
        await tester.pumpAndSettle();

        // Starts on Customers (index 0)
        expect(find.byKey(const Key('mock_customers_screen')), findsOneWidget);

        // Switch to Job Cards (index 1)
        await tester.tap(find.text('Job Cards'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('mock_job_cards_screen')), findsOneWidget);

        // Switch to Invoices (index 2)
        await tester.tap(find.text('Invoices'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('mock_invoices_screen')), findsOneWidget);

        // Switch to Catalogue / Services (index 3)
        await tester.tap(find.text('Catalogue / Services'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('mock_catalogue_screen')), findsOneWidget);

        // Switch back to Customers (index 0)
        await tester.tap(find.text('Customers'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('mock_customers_screen')), findsOneWidget);
      },
    );

    // 17. Deep link /billing/customers opens Customers (index 0)
    testWidgets('17. Deep link /billing/customers opens Customers', (
      tester,
    ) async {
      await tester.pumpWidget(
        createTestWidget(
          user: testOwnerUser,
          initialLocation: AppRoutes.billingCustomers,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('mock_customers_screen')), findsOneWidget);
    });

    // 18. Deep link /billing/job-cards opens Job Cards (index 1)
    testWidgets('18. Deep link /billing/job-cards opens Job Cards', (
      tester,
    ) async {
      await tester.pumpWidget(
        createTestWidget(
          user: testOwnerUser,
          initialLocation: AppRoutes.billingJobCards,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('mock_job_cards_screen')), findsOneWidget);
    });

    // 19. Deep link /billing/invoices opens Invoices (index 2)
    testWidgets('19. Deep link /billing/invoices opens Invoices', (
      tester,
    ) async {
      await tester.pumpWidget(
        createTestWidget(
          user: testOwnerUser,
          initialLocation: AppRoutes.billingInvoices,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('mock_invoices_screen')), findsOneWidget);
    });

    // 20. Deep link /billing/services opens Catalogue / Services (index 3)
    testWidgets('20. Deep link /billing/services opens Catalogue / Services', (
      tester,
    ) async {
      await tester.pumpWidget(
        createTestWidget(
          user: testOwnerUser,
          initialLocation: AppRoutes.billingServices,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('mock_catalogue_screen')), findsOneWidget);
    });
  });
}
