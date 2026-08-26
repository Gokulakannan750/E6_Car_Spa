import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/core/navigation/app_router.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/login_screen.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/shared/widgets/app_shell.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:dio/dio.dart';

class StubAuthRepo extends AuthRepository {
  StubAuthRepo() : super(AuthApi(Dio()), const AuthTokenStorage());

  @override
  Future<AuthUser?> restoreSession() async => null;
}

class TestAuthNotifier extends AuthNotifier {
  TestAuthNotifier(super.repo, [AuthState initial = const Unauthenticated()]) {
    state = initial;
  }

  @override
  Future<void> restoreSession() async {
    // No-op in router test to preserve test state
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  const testUser = AuthUser(
    id: 'user-1',
    fullName: 'Owner Admin',
    username: 'owner',
    role: 'Owner',
    isOwner: true,
  );

  group('AuthRouter Redirection Tests', () {
    testWidgets('unauthenticated user stays on /login and cannot see protected dashboard', (tester) async {
      final notifier = TestAuthNotifier(StubAuthRepo(), const Unauthenticated());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => notifier),
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

      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Sign In'), findsOneWidget);
      expect(find.byType(AppShell), findsNothing);
    });

    testWidgets('authenticated user is redirected to /dashboard away from /login', (tester) async {
      final notifier = TestAuthNotifier(
        StubAuthRepo(),
        const Authenticated(testUser),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => notifier),
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

      // Use bounded pump instead of pumpAndSettle because DashboardScreen
      // triggers async provider loading that never completes in test environment
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(AppShell), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
    });
  });
}
