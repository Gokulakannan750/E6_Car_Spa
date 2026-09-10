import 'package:dio/dio.dart';
import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/core/navigation/app_router.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/login_screen.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:e6_car_spa/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class StubAuthRepo extends AuthRepository {
  StubAuthRepo() : super(AuthApi(Dio()), const AuthTokenStorage());

  @override
  Future<AuthUser?> restoreSession() async => null;
}

class TestNavigationAuthNotifier extends AuthNotifier {
  TestNavigationAuthNotifier(super.repo, [AuthState initial = const Unauthenticated()]) {
    state = initial;
  }

  @override
  Future<void> restoreSession() async {}

  void expireSession() {
    state = const Unauthenticated();
  }

  void authenticateUser(AuthUser user) {
    state = Authenticated(user);
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  const authorizedUser = AuthUser(
    id: 'user-auth-1',
    fullName: 'Owner Admin',
    username: 'admin',
    role: 'Owner',
    isOwner: true,
    permissions: [
      'showroom.view',
      'settings.view',
      'settings.business',
      'staff_advances.view',
      'catalogue.view',
      'reports.view',
      'users.view',
    ],
  );

  group('Navigation Deep-Link Route Guards', () {
    testWidgets('Unauthenticated deep-link to /showroom redirects to /login', (tester) async {
      final authNotifier = TestNavigationAuthNotifier(StubAuthRepo(), const Unauthenticated());
      late GoRouter testRouter;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => authNotifier),
          ],
          child: Consumer(
            builder: (context, ref, _) {
              final router = ref.watch(routerProvider);
              testRouter = router;
              return MaterialApp.router(
                theme: AppTheme.light,
                routerConfig: router,
              );
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Attempt deep-link navigation to /showroom while unauthenticated
      testRouter.go(AppRoutes.showroom);
      await tester.pumpAndSettle();

      // Must remain redirected to LoginScreen
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(AppShell), findsNothing);
    });

    testWidgets('Unauthenticated deep-link to /settings redirects to /login', (tester) async {
      final authNotifier = TestNavigationAuthNotifier(StubAuthRepo(), const Unauthenticated());
      late GoRouter testRouter;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => authNotifier),
          ],
          child: Consumer(
            builder: (context, ref, _) {
              final router = ref.watch(routerProvider);
              testRouter = router;
              return MaterialApp.router(
                theme: AppTheme.light,
                routerConfig: router,
              );
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      testRouter.go(AppRoutes.settings);
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(AppShell), findsNothing);
    });

    testWidgets('Unauthenticated deep-link to /staff-advances redirects to /login', (tester) async {
      final authNotifier = TestNavigationAuthNotifier(StubAuthRepo(), const Unauthenticated());
      late GoRouter testRouter;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => authNotifier),
          ],
          child: Consumer(
            builder: (context, ref, _) {
              final router = ref.watch(routerProvider);
              testRouter = router;
              return MaterialApp.router(
                theme: AppTheme.light,
                routerConfig: router,
              );
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      testRouter.go(AppRoutes.staffAdvances);
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(AppShell), findsNothing);
    });

    testWidgets('Unauthenticated deep-link to /catalogue redirects to /login', (tester) async {
      final authNotifier = TestNavigationAuthNotifier(StubAuthRepo(), const Unauthenticated());
      late GoRouter testRouter;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => authNotifier),
          ],
          child: Consumer(
            builder: (context, ref, _) {
              final router = ref.watch(routerProvider);
              testRouter = router;
              return MaterialApp.router(
                theme: AppTheme.light,
                routerConfig: router,
              );
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      testRouter.go(AppRoutes.catalogue);
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(AppShell), findsNothing);
    });
  });

  group('Session Expiration & UI Teardown Safety', () {
    testWidgets('Session expiration tears down protected AppShell and redirects to /login', (tester) async {
      final authNotifier = TestNavigationAuthNotifier(
        StubAuthRepo(),
        const Authenticated(authorizedUser),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => authNotifier),
          ],
          child: Consumer(
            builder: (context, ref, _) {
              final router = ref.watch(routerProvider);
              return MaterialApp.router(
                theme: AppTheme.light,
                routerConfig: router,
              );
            },
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Authenticated session is in AppShell
      expect(find.byType(AppShell), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);

      // Trigger session expiration (e.g. 401 response or token expiry)
      authNotifier.expireSession();
      await tester.pumpAndSettle();

      // Protected UI is completely torn down, user is back on login
      expect(find.byType(AppShell), findsNothing);
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Sign In'), findsOneWidget);
    });
  });

  group('Concurrency & Double-Tap Safety Guards', () {
    testWidgets('AppButton disabled during isLoading prevents duplicate tap callbacks', (tester) async {
      int tapCount = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return AppButton(
                  label: 'Submit Action',
                  isLoading: tapCount > 0,
                  onPressed: () {
                    tapCount++;
                    setState(() {});
                  },
                );
              },
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // First tap executes callback
      await tester.tap(find.text('Submit Action'));
      await tester.pump();

      expect(tapCount, 1);
      // Button enters loading state
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Rapid consecutive tap while in loading state
      await tester.tap(find.byType(AppButton), warnIfMissed: false);
      await tester.pump();

      // tapCount must remain 1 (no duplicate submission)
      expect(tapCount, 1);
    });
  });
}
