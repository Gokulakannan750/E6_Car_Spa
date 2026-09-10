import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/shared/widgets/app_logout_action.dart';
import 'package:dio/dio.dart';

class _FakeAuthRepo extends AuthRepository {
  _FakeAuthRepo() : super(AuthApi(Dio()), AuthTokenStorage());
}

class _MockAuthNotifier extends AuthNotifier {
  bool logoutCalled = false;

  _MockAuthNotifier() : super(_FakeAuthRepo());

  @override
  Future<void> logout() async {
    logoutCalled = true;
    state = const Unauthenticated();
  }
}

void main() {
  group('AppLogoutAction Confirmation & Teardown Widget Tests', () {
    const testUser = AuthUser(
      id: 'u-1',
      fullName: 'Suresh Raina',
      username: 'manager_suresh',
      role: 'Manager',
      isOwner: false,
      permissions: ['jobcards.view'],
    );

    testWidgets('renders sign out icon button in bar', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(testUser),
          ],
          child: MaterialApp(
            home: Scaffold(
              appBar: AppBar(
                actions: const [AppLogoutAction()],
              ),
            ),
          ),
        ),
      );

      expect(find.byType(AppLogoutAction), findsOneWidget);
      expect(find.byTooltip('Sign Out'), findsOneWidget);
      expect(find.byIcon(Icons.logout_rounded), findsOneWidget);
    });

    testWidgets('tapping Sign Out displays confirmation dialog with username', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(testUser),
          ],
          child: MaterialApp(
            home: Scaffold(
              appBar: AppBar(
                actions: const [AppLogoutAction()],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byTooltip('Sign Out'));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.text('Are you sure you want to sign out from account "manager_suresh"?'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Sign Out'), findsOneWidget);
    });

    testWidgets('tapping Sign Out with null user displays fallback message', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(null),
          ],
          child: MaterialApp(
            home: Scaffold(
              appBar: AppBar(
                actions: const [AppLogoutAction()],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byTooltip('Sign Out'));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.text('Are you sure you want to sign out of E6 Car Spa?'), findsOneWidget);
    });

    testWidgets('tapping Cancel dismisses dialog without calling logout', (tester) async {
      final mockNotifier = _MockAuthNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(testUser),
            authNotifierProvider.overrideWith((ref) => mockNotifier),
          ],
          child: MaterialApp(
            home: Scaffold(
              appBar: AppBar(
                actions: const [AppLogoutAction()],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byTooltip('Sign Out'));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);

      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsNothing);
      expect(mockNotifier.logoutCalled, isFalse);
    });

    testWidgets('tapping Sign Out in dialog invokes authNotifier.logout and dismisses dialog', (tester) async {
      final mockNotifier = _MockAuthNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(testUser),
            authNotifierProvider.overrideWith((ref) => mockNotifier),
          ],
          child: MaterialApp(
            home: Scaffold(
              appBar: AppBar(
                actions: const [AppLogoutAction()],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byTooltip('Sign Out'));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(ElevatedButton, 'Sign Out'));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsNothing);
      expect(mockNotifier.logoutCalled, isTrue);
    });
  });
}
