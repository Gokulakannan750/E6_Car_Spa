import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/dashboard/presentation/pages/dashboard_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('DashboardScreen displays Level 1 Suite Launcher with header, hero banner, and applications', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          currentUserProvider.overrideWithValue(
            const AuthUser(
              id: 'user-admin',
              username: 'admin',
              fullName: 'Admin User',
              role: 'Owner',
              permissions: ['*'],
              isOwner: true,
            ),
          ),
          authNotifierProvider.overrideWith((ref) => _FakeAuthNotifier()),
        ],
        child: const MaterialApp(
          home: DashboardScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify Title & Greeting
    expect(find.text('E6 Car Spa'), findsWidgets);
    expect(find.text('Good Morning, Admin User'), findsOneWidget);
    expect(find.text('Choose an application to manage your business'), findsOneWidget);

    // Verify Promotional Vehicle Hero Banner
    expect(find.text('CLEAN CARS'), findsOneWidget);
    expect(find.text('HAPPY PEOPLE'), findsOneWidget);
    expect(find.text('DRIVE BETTER'), findsOneWidget);

    // Verify Applications Section Header
    expect(find.text('Applications'), findsOneWidget);
    expect(find.text('Choose a workspace to continue'), findsOneWidget);

    // Verify the 5 Applications are displayed
    expect(find.text('E6 Billing'), findsOneWidget);
    expect(find.text('E6 Staff'), findsOneWidget);
    expect(find.text('E6 Showroom'), findsOneWidget);
    expect(find.text('E6 Reports'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);

    // Verify descriptions
    expect(find.text('Customers, job cards, invoices and payments'), findsOneWidget);
    expect(find.text('Staff, attendance and salary management'), findsOneWidget);
    expect(find.text('Showrooms, staff work and showroom billing'), findsOneWidget);
    expect(find.text('Business, billing, staff and showroom reports'), findsOneWidget);
    expect(find.text('Business configuration and system settings'), findsOneWidget);

    // Sub-feature tiles should NOT be rendered
    expect(find.byKey(const Key('launcher_app_Job Cards')), findsNothing);
    expect(find.byKey(const Key('launcher_app_Customers')), findsNothing);
    expect(find.byKey(const Key('launcher_app_Billing & Invoices')), findsNothing);
    expect(find.byKey(const Key('launcher_app_Catalogue')), findsNothing);
    expect(find.byKey(const Key('launcher_app_Staff Suite')), findsNothing);
  });
}

class _FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  _FakeAuthNotifier()
      : super(
          const Authenticated(
            AuthUser(
              id: 'user-admin',
              username: 'admin',
              fullName: 'Admin User',
              role: 'Owner',
              permissions: ['*'],
              isOwner: true,
            ),
          ),
        );

  @override
  void clearError() {}

  @override
  Future<void> restoreSession() async {}

  @override
  Future<bool> login(String username, String password) async => true;

  @override
  Future<void> logout() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
