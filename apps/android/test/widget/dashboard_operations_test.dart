import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/dashboard/presentation/pages/dashboard_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  _FakeAuthNotifier()
      : super(
          const Authenticated(
            AuthUser(
              id: 'user-1',
              username: 'owner',
              fullName: 'E6 Owner',
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

Widget _buildTestApp({
  required List<Override> overrides,
  GoRouter? customRouter,
}) {
  final router = customRouter ??
      GoRouter(
        initialLocation: AppRoutes.dashboard,
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: AppRoutes.jobCards,
            builder: (context, state) => const Scaffold(body: Text('Billing / Job Cards Destination')),
          ),
          GoRoute(
            path: AppRoutes.staff,
            builder: (context, state) => const Scaffold(body: Text('Staff Destination')),
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
      authNotifierProvider.overrideWith((ref) => _FakeAuthNotifier()),
      ...overrides,
    ],
    child: MaterialApp.router(
      routerConfig: router,
    ),
  );
}

void main() {
  group('Level 1 Suite Launcher Operations & Navigation', () {
    testWidgets('Tapping E6 Billing navigates to AppRoutes.jobCards', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            currentUserProvider.overrideWithValue(
              const AuthUser(
                id: 'owner-1',
                username: 'owner',
                fullName: 'E6 Owner',
                role: 'Owner',
                isOwner: true,
              ),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('launcher_app_E6 Billing')));
      await tester.pumpAndSettle();

      expect(find.text('Billing / Job Cards Destination'), findsOneWidget);
    });

    testWidgets('Tapping E6 Staff navigates to AppRoutes.staff', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            currentUserProvider.overrideWithValue(
              const AuthUser(
                id: 'owner-1',
                username: 'owner',
                fullName: 'E6 Owner',
                role: 'Owner',
                isOwner: true,
              ),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('launcher_app_E6 Staff')));
      await tester.pumpAndSettle();

      expect(find.text('Staff Destination'), findsOneWidget);
    });

    testWidgets('Tapping E6 Showroom navigates to AppRoutes.showroom', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            currentUserProvider.overrideWithValue(
              const AuthUser(
                id: 'owner-1',
                username: 'owner',
                fullName: 'E6 Owner',
                role: 'Owner',
                isOwner: true,
              ),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      final finder = find.byKey(const Key('launcher_app_E6 Showroom'));
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      await tester.tap(finder);
      await tester.pumpAndSettle();

      expect(find.text('Showroom Destination'), findsOneWidget);
    });

    testWidgets('Tapping E6 Reports navigates to AppRoutes.reports', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            currentUserProvider.overrideWithValue(
              const AuthUser(
                id: 'owner-1',
                username: 'owner',
                fullName: 'E6 Owner',
                role: 'Owner',
                isOwner: true,
              ),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      final finder = find.byKey(const Key('launcher_app_E6 Reports'));
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      await tester.tap(finder);
      await tester.pumpAndSettle();

      expect(find.text('Reports Destination'), findsOneWidget);
    });

    testWidgets('Tapping Settings navigates to AppRoutes.settings', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            currentUserProvider.overrideWithValue(
              const AuthUser(
                id: 'owner-1',
                username: 'owner',
                fullName: 'E6 Owner',
                role: 'Owner',
                isOwner: true,
              ),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      final finder = find.byKey(const Key('launcher_app_Settings'));
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      await tester.tap(finder);
      await tester.pumpAndSettle();

      expect(find.text('Settings Destination'), findsOneWidget);
    });

    testWidgets('Renders empty state when user has no application permissions', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            currentUserProvider.overrideWithValue(
              const AuthUser(
                id: 'guest-1',
                username: 'guest',
                fullName: 'Guest User',
                role: 'Guest',
                isOwner: false,
                permissions: [],
              ),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No applications are assigned to your profile.'), findsOneWidget);
    });
  });
}
