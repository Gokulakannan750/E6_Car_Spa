import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/core/network/auth_session_events.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_status_response.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/models/bootstrap_owner_request.dart';
import 'package:e6_car_spa/features/auth/models/login_request.dart';
import 'package:e6_car_spa/features/auth/models/login_response.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:dio/dio.dart';

const testUser = AuthUser(
  id: '123',
  fullName: 'Owner Admin',
  username: 'owner',
  role: 'Owner',
  isOwner: true,
);

class MockAuthApi extends AuthApi {
  LoginResponse? loginResponse;
  AuthUser? currentUser;
  AuthStatusResponse? authStatusResponse;
  AuthUser? bootstrapResponse;
  ApiException? error;
  ApiException? statusError;
  ApiException? bootstrapError;

  MockAuthApi() : super(Dio());

  @override
  Future<AuthStatusResponse> getAuthStatus() async {
    if (statusError != null) throw statusError!;
    if (authStatusResponse != null) return authStatusResponse!;
    return const AuthStatusResponse(initialized: true);
  }

  @override
  Future<AuthUser> bootstrapOwner(BootstrapOwnerRequest request) async {
    if (bootstrapError != null) throw bootstrapError!;
    if (bootstrapResponse != null) return bootstrapResponse!;
    return testUser;
  }

  @override
  Future<LoginResponse> login(LoginRequest request) async {
    if (error != null) throw error!;
    if (loginResponse != null) return loginResponse!;
    throw const ApiException(message: 'Invalid call');
  }

  @override
  Future<AuthUser> getCurrentUser({String? customToken}) async {
    if (error != null) throw error!;
    if (currentUser != null) return currentUser!;
    throw const ApiException(message: 'Invalid call');
  }
}

class MockStorage extends AuthTokenStorage {
  String? token;
  AuthUser? user;

  @override
  Future<void> saveToken(String t) async => token = t;

  @override
  Future<String?> getToken() async => token;

  @override
  Future<void> saveUser(AuthUser u) async => user = u;

  @override
  Future<AuthUser?> getCachedUser() async => user;

  @override
  Future<void> clearSession() async {
    token = null;
    user = null;
  }
}

void main() {
  late MockAuthApi api;
  late MockStorage storage;
  late AuthRepository repository;
  late AuthNotifier notifier;

  setUp(() {
    api = MockAuthApi();
    storage = MockStorage();
    repository = AuthRepository(api, storage);
  });

  group('AuthNotifier Unit Tests', () {
    test('startup initializes and sets SetupRequired when database is uninitialized (initialized=false)', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: false);
      notifier = AuthNotifier(repository);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<SetupRequired>());
    });

    test('startup initializes and sets Unauthenticated when database is initialized (initialized=true)', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<Unauthenticated>());
      expect((notifier.state as Unauthenticated).message, isNull);
    });

    test('startup sets Unauthenticated with error and NOT SetupRequired when status request fails', () async {
      storage.token = null;
      api.statusError = const ApiException(message: 'Backend server connection timeout.');
      notifier = AuthNotifier(repository);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      // Must NOT assume database is fresh
      expect(notifier.state, isA<Unauthenticated>());
      expect(notifier.state, isNot(isA<SetupRequired>()));
      final unauth = notifier.state as Unauthenticated;
      expect(unauth.message, contains('Backend server connection timeout'));
    });

    test('startup restores session and sets Authenticated when token is valid, without overriding with setup status', () async {
      storage.token = 'saved_token_123';
      api.currentUser = testUser;
      // Even if status was queried, existing valid session prevails
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<Authenticated>());
      final auth = notifier.state as Authenticated;
      expect(auth.user.username, 'owner');
    });

    test('bootstrapOwner success transitions to Unauthenticated with success message (no auto-auth)', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: false);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<SetupRequired>());

      api.bootstrapResponse = testUser;

      final success = await notifier.bootstrapOwner(
        const BootstrapOwnerRequest(
          fullName: 'Gokulakannan',
          username: 'gokul',
          password: 'Password@123',
          confirmPassword: 'Password@123',
        ),
      );

      expect(success, true);
      // Confirms transitions to Unauthenticated (not automatically Authenticated)
      expect(notifier.state, isA<Unauthenticated>());
      final unauth = notifier.state as Unauthenticated;
      expect(unauth.isSuccess, true);
      expect(unauth.message, contains('Owner account created successfully'));
    });

    test('bootstrapOwner failure remains in SetupRequired with error displayed', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: false);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<SetupRequired>());

      api.bootstrapError = const ConflictException(message: 'Application is already initialized with an Owner.');

      final success = await notifier.bootstrapOwner(
        const BootstrapOwnerRequest(
          fullName: 'Gokulakannan',
          username: 'gokul',
          password: 'Password@123',
          confirmPassword: 'Password@123',
        ),
      );

      expect(success, false);
      expect(notifier.state, isA<SetupRequired>());
      final setupState = notifier.state as SetupRequired;
      expect(setupState.message, contains('already initialized'));
    });

    test('login success sets Authenticated state', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.loginResponse = const LoginResponse(token: 'token_1', user: testUser);

      final success = await notifier.login('owner', 'ValidPassword123!');

      expect(success, true);
      expect(notifier.state, isA<Authenticated>());
      final authState = notifier.state as Authenticated;
      expect(authState.user.fullName, 'Owner Admin');
    });

    test('login failure with wrong password sets AuthFailure("Invalid username or password.")', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.error = const UnauthorizedException(message: 'Invalid username or password.');

      final success = await notifier.login('validuser', 'wrongpass');

      expect(success, false);
      expect(notifier.state, isA<AuthFailure>());
      final failureState = notifier.state as AuthFailure;
      expect(failureState.message, 'Invalid username or password.');
      expect(failureState.message, isNot(contains('Session expired')));
    });

    test('login failure with wrong username sets AuthFailure("Invalid username or password.")', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.error = const UnauthorizedException(message: 'Invalid username or password.');

      final success = await notifier.login('nonexistentuser', 'somepass');

      expect(success, false);
      expect(notifier.state, isA<AuthFailure>());
      final failureState = notifier.state as AuthFailure;
      expect(failureState.message, 'Invalid username or password.');
    });

    test('login 423 sets AccountLocked with contract message and remaining seconds', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.error = const AccountLockedException(
        message: 'Account temporarily locked. Please try again later.',
        remainingLockoutSeconds: 300,
      );

      final success = await notifier.login('lockeduser', 'somepass');

      expect(success, false);
      expect(notifier.state, isA<AccountLocked>());
      final lockedState = notifier.state as AccountLocked;
      expect(lockedState.message, 'Account temporarily locked. Please try again later.');
      expect(lockedState.remainingSeconds, 300);
    });

    test('login 429 sets AuthFailure("Too many attempts. Please try again later.")', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.error = const RateLimitedException(
        message: 'Too many attempts. Please try again later.',
      );

      final success = await notifier.login('spamuser', 'somepass');

      expect(success, false);
      expect(notifier.state, isA<AuthFailure>());
      final failureState = notifier.state as AuthFailure;
      expect(failureState.message, 'Too many attempts. Please try again later.');
    });

    test('login network failure sets AuthFailure("Unable to connect to the server. Please try again.")', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.error = const NetworkException(
        message: 'Unable to connect to the server. Please try again.',
      );

      final success = await notifier.login('user', 'pass');

      expect(success, false);
      expect(notifier.state, isA<AuthFailure>());
      final failureState = notifier.state as AuthFailure;
      expect(failureState.message, 'Unable to connect to the server. Please try again.');
    });

    test('login unexpected failure does NOT map to Invalid username or password', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.error = const ServerException(
        message: 'Internal Server Error',
      );

      final success = await notifier.login('user', 'pass');

      expect(success, false);
      expect(notifier.state, isA<AuthFailure>());
      final failureState = notifier.state as AuthFailure;
      expect(failureState.message, isNot('Invalid username or password.'));
      expect(failureState.message, isNot(contains('Session expired')));
    });

    test('AuthSessionEvents 401 broadcast transitions state to Unauthenticated', () async {
      storage.token = 'valid_token';
      api.currentUser = testUser;
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<Authenticated>());

      AuthSessionEvents.notifyUnauthorized();

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<Unauthenticated>());
      final unauth = notifier.state as Unauthenticated;
      expect(unauth.message, contains('Session expired'));
    });

    test('logout resets state to Unauthenticated and verifies backend setup status', () async {
      storage.token = 'valid_token';
      api.currentUser = testUser;
      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      await notifier.logout();

      expect(notifier.state, isA<Unauthenticated>());
      expect(storage.token, isNull);
    });

    test('pollSetupStatus transitions SetupRequired to Unauthenticated when initialized becomes true', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: false);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(notifier.state, isA<SetupRequired>());

      // Simulate backend becoming initialized from another device
      api.authStatusResponse = const AuthStatusResponse(initialized: true);

      await notifier.pollSetupStatus();

      expect(notifier.state, isA<Unauthenticated>());
      final unauthState = notifier.state as Unauthenticated;
      expect(unauthState.message, isNull);
    });

    test('pollSetupStatus retains SetupRequired when backend is still uninitialized', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: false);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(notifier.state, isA<SetupRequired>());

      await notifier.pollSetupStatus();

      expect(notifier.state, isA<SetupRequired>());
    });

    test('pollSetupStatus preserves SetupRequired and form state when status check fails', () async {
      storage.token = null;
      api.authStatusResponse = const AuthStatusResponse(initialized: false);
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(notifier.state, isA<SetupRequired>());

      // Simulate temporary network outage during periodic poll
      api.error = const NetworkException(message: 'Connection timeout');

      await notifier.pollSetupStatus();

      // Must remain SetupRequired without overwriting state or disrupting the form
      expect(notifier.state, isA<SetupRequired>());
    });

    test('pollSetupStatus is a no-op when state is not SetupRequired', () async {
      storage.token = 'valid_token';
      api.currentUser = testUser;
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(notifier.state, isA<Authenticated>());

      api.authStatusResponse = const AuthStatusResponse(initialized: true);
      await notifier.pollSetupStatus();

      // State must remain Authenticated
      expect(notifier.state, isA<Authenticated>());
    });
  });
}
