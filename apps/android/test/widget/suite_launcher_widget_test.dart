import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/dashboard/presentation/pages/dashboard_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  Widget createTestWidget({required AuthUser user, GoRouter? router}) {
    final defaultRouter = GoRouter(
      initialLocation: AppRoutes.dashboard,
      routes: [
        GoRoute(
          path: AppRoutes.dashboard,
          builder: (context, state) => const DashboardScreen(),
        ),
        GoRoute(
          path: AppRoutes.staff,
          builder: (context, state) => const Scaffold(body: Text('Staff Screen Destination')),
        ),
        GoRoute(
          path: AppRoutes.jobCards,
          builder: (context, state) => const Scaffold(body: Text('Job Cards Destination')),
        ),
        GoRoute(
          path: AppRoutes.showroom,
          builder: (context, state) => const Scaffold(body: Text('Showroom Destination')),
        ),
        GoRoute(
          path: AppRoutes.reports,
          builder: (context, state) => const Scaffold(body: Text('Reports Destination')),
        ),
        GoRoute(
          path: AppRoutes.settings,
          builder: (context, state) => const Scaffold(body: Text('Settings Destination')),
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
      child: MaterialApp.router(
        routerConfig: router ?? defaultRouter,
      ),
    );
  }

  group('Level 1 Suite Launcher Tests', () {
    testWidgets('Displays exactly the 5 applications with exact titles and descriptions for Owner', (tester) async {
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
      expect(find.text('E6 Car Spa'), findsWidgets);
      expect(find.text('Good Morning, E6 Owner'), findsOneWidget);
      expect(find.text('Choose an application to manage your business'), findsOneWidget);

      // 2. Verify Promotional Vehicle Hero Banner
      expect(find.text('E6 CAR SPA'), findsOneWidget);
      expect(find.textContaining('CLEAN CARS'), findsOneWidget);
      expect(find.textContaining('HAPPY PEOPLE'), findsOneWidget);
      expect(find.textContaining('DRIVE BETTER'), findsOneWidget);

      // 3. Verify Applications Section Header
      expect(find.text('Applications'), findsOneWidget);
      expect(find.text('Choose a workspace to continue'), findsOneWidget);

      // 4. Verify exactly the 5 application titles
      expect(find.text('E6 Billing'), findsOneWidget);
      expect(find.text('E6 Staff'), findsOneWidget);
      expect(find.text('E6 Showroom'), findsOneWidget);
      expect(find.text('E6 Reports'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);

      // 5. Verify exact descriptions
      expect(find.text('Customers, job cards, invoices and payments'), findsOneWidget);
      expect(find.text('Staff, attendance and salary management'), findsOneWidget);
      expect(find.text('Showrooms, staff work and showroom billing'), findsOneWidget);
      expect(find.text('Business, billing, staff and showroom reports'), findsOneWidget);
      expect(find.text('Business configuration and system settings'), findsOneWidget);

      // 6. Verify old Level 1 feature tiles are NOT displayed as independent launcher cards
      expect(find.byKey(const Key('launcher_app_Job Cards')), findsNothing);
      expect(find.byKey(const Key('launcher_app_Customers')), findsNothing);
      expect(find.byKey(const Key('launcher_app_Billing & Invoices')), findsNothing);
      expect(find.byKey(const Key('launcher_app_Catalogue')), findsNothing);
      expect(find.byKey(const Key('launcher_app_Staff Suite')), findsNothing);

      // 7. Verify NO bottom navigation bar is present
      expect(find.byType(BottomNavigationBar), findsNothing);
    });

    testWidgets('Tapping E6 Staff reaches the existing Staff Suite route', (tester) async {
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
      await tester.tap(find.byKey(const Key('launcher_tile_E6 Staff')));
      await tester.pumpAndSettle();

      expect(find.text('Staff Screen Destination'), findsOneWidget);
    });

    testWidgets('Tapping E6 Billing reaches the job cards / billing route', (tester) async {
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
      await tester.tap(find.byKey(const Key('launcher_tile_E6 Billing')));
      await tester.pumpAndSettle();

      expect(find.text('Job Cards Destination'), findsOneWidget);
    });

    testWidgets('Restricted Staff member only sees permitted applications (RBAC)', (tester) async {
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
      expect(find.text('E6 Billing'), findsOneWidget);

      // Restricted applications should NOT be rendered
      expect(find.text('E6 Staff'), findsNothing);
      expect(find.text('E6 Showroom'), findsNothing);
      expect(find.text('E6 Reports'), findsNothing);
      expect(find.text('Settings'), findsNothing);
    });

    testWidgets('Accountant sees E6 Billing, E6 Staff, and E6 Reports only', (tester) async {
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
      expect(find.text('E6 Billing'), findsOneWidget);
      expect(find.text('E6 Staff'), findsOneWidget);
      expect(find.text('E6 Reports'), findsOneWidget);

      expect(find.text('Settings'), findsNothing);
      expect(find.text('E6 Showroom'), findsNothing);
    });
  });
}

class FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  FakeAuthNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
