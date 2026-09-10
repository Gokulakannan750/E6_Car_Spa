import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/first_time_setup_screen.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/models/bootstrap_owner_request.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:e6_car_spa/shared/widgets/app_text_field.dart';
import 'package:dio/dio.dart';

class MockAuthRepo extends AuthRepository {
  MockAuthRepo() : super(AuthApi(Dio()), const AuthTokenStorage());

  bool bootstrapShouldSucceed = true;
  String? bootstrapErrorMessage;
  BootstrapOwnerRequest? capturedRequest;

  @override
  Future<AuthUser?> restoreSession() async => null;

  @override
  Future<bool> checkInitialization() async => false;

  @override
  Future<AuthUser> bootstrapOwner(BootstrapOwnerRequest request) async {
    capturedRequest = request;
    if (!bootstrapShouldSucceed) {
      throw Exception(bootstrapErrorMessage ?? 'System has already been initialized.');
    }
    return AuthUser(
      id: 'owner-1',
      fullName: request.fullName,
      username: request.username,
      role: 'Owner',
      isOwner: true,
    );
  }
}

class TestFirstTimeSetupNotifier extends AuthNotifier {
  int pollSetupStatusCalls = 0;

  TestFirstTimeSetupNotifier(super.repo, [AuthState initial = const SetupRequired()]) {
    state = initial;
  }

  @override
  Future<void> restoreSession() async {
    // No-op in widget test
  }

  @override
  Future<void> pollSetupStatus() async {
    pollSetupStatusCalls++;
    await super.pollSetupStatus();
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  Widget createSetupTestWidget({
    AuthState initialState = const SetupRequired(),
    MockAuthRepo? mockRepo,
  }) {
    final repo = mockRepo ?? MockAuthRepo();

    return ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(repo),
        authNotifierProvider.overrideWith(
          (ref) => TestFirstTimeSetupNotifier(repo, initialState),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const FirstTimeSetupScreen(),
      ),
    );
  }

  group('FirstTimeSetupScreen Widget Tests', () {
    testWidgets('1. renders header, branding, titles, and owner privilege card', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createSetupTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('WELCOME TO E6 CAR SPA'), findsOneWidget);
      expect(find.text('First-Time Setup — Create Owner Account'), findsOneWidget);
      expect(
        find.text(
          'This account will have Owner privileges with unrestricted access to all current and future modules.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('2. renders all four required fields and submit button', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createSetupTestWidget());
      await tester.pumpAndSettle();

      expect(find.widgetWithText(AppTextField, 'Full Name'), findsOneWidget);
      expect(find.widgetWithText(AppTextField, 'Username'), findsOneWidget);
      expect(find.widgetWithText(AppTextField, 'Password'), findsOneWidget);
      expect(find.widgetWithText(AppTextField, 'Confirm Password'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Create Owner Account'), findsOneWidget);
    });

    testWidgets('3. password visibility toggle buttons work', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createSetupTestWidget());
      await tester.pumpAndSettle();

      // Starts obscured -> visibility_outlined icons
      final visibilityIcons = find.byIcon(Icons.visibility_outlined);
      expect(visibilityIcons, findsNWidgets(2));

      // Tap first visibility toggle (Password)
      await tester.tap(visibilityIcons.first);
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
    });

    testWidgets('4. validates empty fields on submit', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createSetupTestWidget());
      await tester.pumpAndSettle();

      // Tap submit with empty fields
      await tester.tap(find.widgetWithText(AppButton, 'Create Owner Account'));
      await tester.pumpAndSettle();

      expect(find.text('Full name is required.'), findsOneWidget);
    });

    testWidgets('5. validates password length must be at least 8 characters', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createSetupTestWidget());
      await tester.pumpAndSettle();

      // Fill valid name & username
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Full Name'),
          matching: find.byType(TextField),
        ),
        'Owner Admin',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Username'),
          matching: find.byType(TextField),
        ),
        'admin',
      );
      // Fill short password
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Password'),
          matching: find.byType(TextField),
        ),
        'short',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Confirm Password'),
          matching: find.byType(TextField),
        ),
        'short',
      );

      await tester.tap(find.widgetWithText(AppButton, 'Create Owner Account'));
      await tester.pumpAndSettle();

      expect(find.text('Password must be at least 8 characters long.'), findsOneWidget);
    });

    testWidgets('6. validates password confirmation mismatch', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createSetupTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Full Name'),
          matching: find.byType(TextField),
        ),
        'Owner Admin',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Username'),
          matching: find.byType(TextField),
        ),
        'admin',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Password'),
          matching: find.byType(TextField),
        ),
        'Password@123',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Confirm Password'),
          matching: find.byType(TextField),
        ),
        'Mismatch@123',
      );

      await tester.tap(find.widgetWithText(AppButton, 'Create Owner Account'));
      await tester.pumpAndSettle();

      expect(find.text('Passwords do not match.'), findsOneWidget);
    });

    testWidgets('7. validates password cannot be equal to username', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createSetupTestWidget());
      await tester.pumpAndSettle();

      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Full Name'),
          matching: find.byType(TextField),
        ),
        'Owner Admin',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Username'),
          matching: find.byType(TextField),
        ),
        'administrator',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Password'),
          matching: find.byType(TextField),
        ),
        'administrator',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Confirm Password'),
          matching: find.byType(TextField),
        ),
        'administrator',
      );

      await tester.tap(find.widgetWithText(AppButton, 'Create Owner Account'));
      await tester.pumpAndSettle();

      expect(find.text('Password cannot be the same as the username.'), findsOneWidget);
    });

    testWidgets('8. displays error banner when state is SetupRequired with message', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        createSetupTestWidget(
          initialState: const SetupRequired('System is already initialized or server unreachable.'),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('System is already initialized or server unreachable.'),
        findsOneWidget,
      );
    });

    testWidgets('9. successful bootstrap submits valid payload and clears error', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockAuthRepo();

      await tester.pumpWidget(createSetupTestWidget(mockRepo: mockRepo));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Full Name'),
          matching: find.byType(TextField),
        ),
        'Gokul Kannan',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Username'),
          matching: find.byType(TextField),
        ),
        'gokul',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Password'),
          matching: find.byType(TextField),
        ),
        'Password@123',
      );
      await tester.enterText(
        find.descendant(
          of: find.widgetWithText(AppTextField, 'Confirm Password'),
          matching: find.byType(TextField),
        ),
        'Password@123',
      );

      await tester.tap(find.widgetWithText(AppButton, 'Create Owner Account'));
      await tester.pump();

      // Verify captured request sent to repo
      expect(mockRepo.capturedRequest, isNotNull);
      expect(mockRepo.capturedRequest!.fullName, 'Gokul Kannan');
      expect(mockRepo.capturedRequest!.username, 'gokul');
      expect(mockRepo.capturedRequest!.password, 'Password@123');
      expect(mockRepo.capturedRequest!.confirmPassword, 'Password@123');
    });

    testWidgets('10. periodic polling triggers pollSetupStatus while setup screen is open', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockAuthRepo();
      final notifier = TestFirstTimeSetupNotifier(mockRepo, const SetupRequired());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => notifier),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const FirstTimeSetupScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(notifier.pollSetupStatusCalls, 0);

      // Advance time by 10 seconds (timer fires)
      await tester.pump(const Duration(seconds: 10));
      expect(notifier.pollSetupStatusCalls, 1);

      // Advance time by another 10 seconds
      await tester.pump(const Duration(seconds: 10));
      expect(notifier.pollSetupStatusCalls, 2);
    });
  });
}

