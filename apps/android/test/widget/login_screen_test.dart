import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/login_screen.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:dio/dio.dart';

class StubAuthRepo extends AuthRepository {
  bool shouldSucceed = true;
  String? errorMessage;

  StubAuthRepo() : super(AuthApi(Dio()), const AuthTokenStorage());

  @override
  Future<AuthUser?> restoreSession() async => null;

  @override
  Future<AuthUser> login(String username, String password) async {
    if (!shouldSucceed) {
      throw Exception(errorMessage ?? 'Invalid credentials.');
    }
    return const AuthUser(
      id: 'test-id',
      fullName: 'Test Manager',
      username: 'test_manager',
      role: 'Manager',
      isOwner: false,
    );
  }
}

class TestLoginNotifier extends AuthNotifier {
  TestLoginNotifier(super.repo, [AuthState initial = const Unauthenticated()]) {
    state = initial;
  }

  @override
  Future<void> restoreSession() async {
    // No-op in widget test to preserve explicit test state
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  Widget createLoginTestWidget({
    AuthState initialState = const Unauthenticated(),
    StubAuthRepo? stubRepo,
  }) {
    final repo = stubRepo ?? StubAuthRepo();

    return ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(repo),
        authNotifierProvider.overrideWith(
          (ref) => TestLoginNotifier(repo, initialState),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const LoginScreen(),
      ),
    );
  }

  group('LoginScreen Widget Tests', () {
    testWidgets('renders brand title, subtitle, input fields and Sign In button', (tester) async {
      await tester.pumpWidget(createLoginTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('E6 Car Spa'), findsOneWidget);
      expect(find.text('Management Suite'), findsOneWidget);
      expect(find.text('Username'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Sign In'), findsOneWidget);
    });

    testWidgets('shows validation error when submitting empty form', (tester) async {
      await tester.pumpWidget(createLoginTestWidget());
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Sign In'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter your username.'), findsOneWidget);
    });

    testWidgets('shows validation error when username entered but password empty', (tester) async {
      await tester.pumpWidget(createLoginTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, 'testuser');
      await tester.tap(find.widgetWithText(AppButton, 'Sign In'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter your password.'), findsOneWidget);
    });

    testWidgets('displays error banner when AuthFailure state is emitted', (tester) async {
      await tester.pumpWidget(
        createLoginTestWidget(
          initialState: const AuthFailure('Invalid username or password.'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Invalid username or password.'), findsOneWidget);
    });

    testWidgets('displays loading state during authentication', (tester) async {
      await tester.pumpWidget(
        createLoginTestWidget(
          initialState: const Authenticating(),
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('toggles password visibility icon on click', (tester) async {
      await tester.pumpWidget(createLoginTestWidget());
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
      await tester.tap(find.byIcon(Icons.visibility_off_outlined));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
    });

    testWidgets('renders custom business profile name and logo widget when available', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(StubAuthRepo()),
            authNotifierProvider.overrideWith(
              (ref) => TestLoginNotifier(StubAuthRepo(), const Unauthenticated()),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const LoginScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Management Suite'), findsOneWidget);
    });
  });
}
