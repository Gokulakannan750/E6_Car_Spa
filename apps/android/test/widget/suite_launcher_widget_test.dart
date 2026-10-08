import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/billing/presentation/pages/billing_screen.dart';
import 'package:e6_car_spa/features/dashboard/presentation/pages/dashboard_screen.dart';
import 'package:e6_car_spa/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  Widget createTestWidget({required AuthUser user, GoRouter? router}) {
    final defaultRouter = GoRouter(
      initialLocation: AppRoutes.dashboard,
      routes: [
        ShellRoute(
          builder: (context, state, child) =>
              AppShell(currentLocation: state.matchedLocation, child: child),
          routes: [
            GoRoute(
              path: AppRoutes.dashboard,
              builder: (context, state) => const DashboardScreen(),
            ),
            GoRoute(
              path: AppRoutes.billing,
              builder: (context, state) => const BillingScreen(
                initialTabIndex: 0,
                tabs: [
                  BillingTabDefinition(
                    label: 'Customers',
                    icon: Icons.people_outline_rounded,
                    permission: 'customers.view',
                    widget: Scaffold(body: Text('Customers Destination')),
                  ),
                  BillingTabDefinition(
                    label: 'Job Cards',
                    icon: Icons.assignment_outlined,
                    permission: 'jobcards.view',
                    widget: Scaffold(body: Text('Job Cards Destination')),
                  ),
                  BillingTabDefinition(
                    label: 'Invoices',
                    icon: Icons.receipt_long_outlined,
                    permission: 'invoices.view',
                    widget: Scaffold(body: Text('Invoices Destination')),
                  ),
                  BillingTabDefinition(
                    label: 'Catalogue / Services',
                    icon: Icons.inventory_2_outlined,
                    permission: 'catalogue.view',
                    widget: Scaffold(body: Text('Catalogue Destination')),
                  ),
                ],
              ),
            ),
            GoRoute(
              path: AppRoutes.staff,
              builder: (context, state) => const Scaffold(
                appBar: PreferredSize(
                  preferredSize: Size.fromHeight(kToolbarHeight),
                  child: Text('Staff Suite'),
                ),
                body: Text('Staff Screen Destination'),
              ),
            ),
            GoRoute(
              path: AppRoutes.jobCards,
              builder: (context, state) =>
                  const Scaffold(body: Text('Job Cards Destination')),
            ),
            GoRoute(
              path: AppRoutes.customers,
              builder: (context, state) =>
                  const Scaffold(body: Text('Customers Destination')),
            ),
            GoRoute(
              path: AppRoutes.quotationsInvoices,
              builder: (context, state) =>
                  const Scaffold(body: Text('Invoices Destination')),
            ),
            GoRoute(
              path: AppRoutes.catalogue,
              builder: (context, state) =>
                  const Scaffold(body: Text('Catalogue Destination')),
            ),
            GoRoute(
              path: AppRoutes.showroom,
              builder: (context, state) =>
                  const Scaffold(body: Text('Showroom Destination')),
            ),
            GoRoute(
              path: AppRoutes.reports,
              builder: (context, state) =>
                  const Scaffold(body: Text('Reports Destination')),
            ),
            GoRoute(
              path: AppRoutes.settings,
              builder: (context, state) =>
                  const Scaffold(body: Text('Settings Destination')),
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
      child: MaterialApp.router(routerConfig: router ?? defaultRouter),
    );
  }

  group('Level 1 Suite Launcher Tests', () {
    testWidgets(
      'Displays exactly the 5 applications with exact titles and descriptions for Owner',
      (tester) async {
        const ownerUser = AuthUser(
          id: 'owner-1',
          username: 'owner',
          fullName: 'E6 Owner',
          email: 'owner@e6carspa.com',
          role: 'Owner',
          isOwner: true,
          permissions: [],
        );

        await tester.pumpWidget(createTestWidget(user: ownerUser));
        await tester.pumpAndSettle();

        // 1. Verify Header branding and greeting
        expect(find.text('Car Spa Management'), findsWidgets);
        expect(find.text('Good Morning, E6 Owner'), findsOneWidget);
        expect(
          find.text('Choose an application to manage your business'),
          findsOneWidget,
        );

        // 2. Verify Promotional Vehicle Hero Banner
        expect(find.text('CAR SPA MANAGEMENT'), findsOneWidget);
        expect(find.textContaining('CLEAN CARS'), findsOneWidget);
        expect(find.textContaining('HAPPY PEOPLE'), findsOneWidget);
        expect(find.textContaining('DRIVE BETTER'), findsOneWidget);

        // 3. Verify Applications Section Header
        expect(find.text('Applications'), findsOneWidget);
        expect(find.text('Choose a workspace to continue'), findsOneWidget);

        // 4. Verify exactly the 5 application titles
        expect(find.text('Billing'), findsOneWidget);
        expect(find.text('Staff'), findsOneWidget);
        expect(find.text('Showroom'), findsOneWidget);
        expect(find.text('Reports'), findsOneWidget);
        expect(find.text('Settings'), findsOneWidget);

        // 5. Verify exact descriptions
        expect(
          find.text('Customers, job cards, invoices and payments'),
          findsOneWidget,
        );
        expect(
          find.text('Staff, attendance and salary management'),
          findsOneWidget,
        );
        expect(
          find.text('Showrooms, staff work and showroom billing'),
          findsOneWidget,
        );
        expect(
          find.text('Business, billing, staff and showroom reports'),
          findsOneWidget,
        );
        expect(
          find.text('Business configuration and system settings'),
          findsOneWidget,
        );

        // 6. Verify old Level 1 feature tiles are NOT displayed as independent launcher cards
        expect(find.byKey(const Key('launcher_app_Job Cards')), findsNothing);
        expect(find.byKey(const Key('launcher_app_Customers')), findsNothing);
        expect(
          find.byKey(const Key('launcher_app_Billing & Invoices')),
          findsNothing,
        );
        expect(find.byKey(const Key('launcher_app_Catalogue')), findsNothing);
        expect(find.byKey(const Key('launcher_app_Staff Suite')), findsNothing);

        // 7. Verify NO bottom navigation bar is present
        expect(find.byType(BottomNavigationBar), findsNothing);
      },
    );

    testWidgets('Tapping E6 Staff reaches the existing Staff Suite route', (
      tester,
    ) async {
      const ownerUser = AuthUser(
        id: 'owner-1',
        username: 'owner',
        fullName: 'E6 Owner',
        role: 'Owner',
        isOwner: true,
      );

      await tester.pumpWidget(createTestWidget(user: ownerUser));
      await tester.pumpAndSettle();

      // Tap on E6 Staff card
      await tester.tap(find.byKey(const Key('launcher_tile_Staff')));
      await tester.pumpAndSettle();

      expect(find.text('Staff Screen Destination'), findsOneWidget);
    });

    testWidgets('Tapping E6 Billing opens the Billing Suite top tabs', (
      tester,
    ) async {
      const ownerUser = AuthUser(
        id: 'owner-1',
        username: 'owner',
        fullName: 'E6 Owner',
        role: 'Owner',
        isOwner: true,
      );

      await tester.pumpWidget(createTestWidget(user: ownerUser));
      await tester.pumpAndSettle();

      // Tap on E6 Billing card
      await tester.tap(find.byKey(const Key('launcher_tile_Billing')));
      await tester.pumpAndSettle();

      expect(find.text('Billing Suite'), findsOneWidget);
      expect(find.text('Job Cards'), findsOneWidget);
      expect(find.text('Customers'), findsOneWidget);
      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('Catalogue / Services'), findsOneWidget);
      expect(find.byType(BottomNavigationBar), findsNothing);
    });

    testWidgets(
      'Restricted Staff member only sees permitted applications (RBAC)',
      (tester) async {
        const restrictedUser = AuthUser(
          id: 'staff-1',
          username: 'detailer',
          fullName: 'Detailer Arun',
          email: 'arun@e6carspa.com',
          role: 'Detailer',
          isOwner: false,
          permissions: ['jobcards.view'],
        );

        await tester.pumpWidget(createTestWidget(user: restrictedUser));
        await tester.pumpAndSettle();

        expect(find.text('Applications'), findsOneWidget);
        expect(find.text('Billing'), findsOneWidget);

        // Restricted applications should NOT be rendered
        expect(find.text('Staff'), findsNothing);
        expect(find.text('Showroom'), findsNothing);
        expect(find.text('Reports'), findsNothing);
        expect(find.text('Settings'), findsNothing);
      },
    );

    testWidgets('Accountant sees E6 Billing, E6 Staff, and E6 Reports only', (
      tester,
    ) async {
      const accountantUser = AuthUser(
        id: 'staff-2',
        username: 'accountant',
        fullName: 'Accountant Priya',
        email: 'priya@e6carspa.com',
        role: 'Accountant',
        isOwner: false,
        permissions: ['staff.view', 'invoices.view', 'reports.view'],
      );

      await tester.pumpWidget(createTestWidget(user: accountantUser));
      await tester.pumpAndSettle();

      expect(find.text('Applications'), findsOneWidget);
      expect(find.text('Billing'), findsOneWidget);
      expect(find.text('Staff'), findsOneWidget);
      expect(find.text('Reports'), findsOneWidget);

      expect(find.text('Settings'), findsNothing);
      expect(find.text('Showroom'), findsNothing);
    });
  });
}

class FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  FakeAuthNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
