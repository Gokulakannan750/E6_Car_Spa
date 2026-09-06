import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/login_screen.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';

void main() {
  group('Account Lockout Tests', () {
    test('ApiException.fromDio parses HTTP 423 with remainingLockoutSeconds', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/auth/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/auth/login'),
          statusCode: 423,
          data: {
            'error': 'Too many failed login attempts. Please try again later.',
            'locked': true,
            'remainingLockoutSeconds': 300,
            'retryAfter': 300,
          },
        ),
      );

      final exception = ApiException.fromDio(dioException);
      expect(exception, isA<AccountLockedException>());
      final lockedEx = exception as AccountLockedException;
      expect(lockedEx.message, 'Too many failed login attempts. Please try again later.');
      expect(lockedEx.remainingLockoutSeconds, 300);
      expect(lockedEx.statusCode, 423);
    });

    testWidgets('LoginScreen displays lockout message and disables login button when account is locked',
        (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => MockLockedAuthNotifier()),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );
      await tester.pump();

      // Verify lockout message is displayed
      expect(find.textContaining('Too many failed login attempts'), findsOneWidget);
      expect(find.textContaining('remaining'), findsOneWidget);

      // Verify button says "Account Locked" and has null onPressed (disabled)
      final buttonFinder = find.widgetWithText(ElevatedButton, 'Account Locked');
      expect(buttonFinder, findsOneWidget);
      final elevatedButton = tester.widget<ElevatedButton>(buttonFinder);
      expect(elevatedButton.onPressed, isNull);
    });
  });
}

class MockLockedAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  MockLockedAuthNotifier()
      : super(const AccountLocked(
          message: 'Too many failed login attempts. Please try again later.',
          remainingSeconds: 295,
        ));

  @override
  void clearError() {
    state = const Unauthenticated();
  }

  @override
  Future<bool> login(String username, String password) async => false;

  @override
  Future<void> logout() async {
    state = const Unauthenticated();
  }

  @override
  Future<void> restoreSession() async {}
}
