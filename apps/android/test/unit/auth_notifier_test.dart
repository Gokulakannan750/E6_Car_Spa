import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/core/network/auth_session_events.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/models/login_request.dart';
import 'package:e6_car_spa/features/auth/models/login_response.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:dio/dio.dart';

class MockAuthApi extends AuthApi {
  LoginResponse? loginResponse;
  AuthUser? currentUser;
  ApiException? error;

  MockAuthApi() : super(Dio());

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

  const testUser = AuthUser(
    id: '123',
    fullName: 'Owner Admin',
    username: 'owner',
    role: 'Owner',
    isOwner: true,
  );

  setUp(() {
    api = MockAuthApi();
    storage = MockStorage();
    repository = AuthRepository(api, storage);
  });

  group('AuthNotifier Unit Tests', () {
    test('startup initializes and sets Unauthenticated when no stored session exists', () async {
      storage.token = null;
      notifier = AuthNotifier(repository);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<Unauthenticated>());
    });

    test('startup restores session and sets Authenticated when token is valid', () async {
      storage.token = 'saved_token_123';
      api.currentUser = testUser;
      notifier = AuthNotifier(repository);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<Authenticated>());
      final auth = notifier.state as Authenticated;
      expect(auth.user.username, 'owner');
    });

    test('login success sets Authenticated state', () async {
      storage.token = null;
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.loginResponse = const LoginResponse(token: 'token_1', user: testUser);

      final success = await notifier.login('owner', 'ValidPassword123!');

      expect(success, true);
      expect(notifier.state, isA<Authenticated>());
      final authState = notifier.state as Authenticated;
      expect(authState.user.fullName, 'Owner Admin');
    });

    test('login failure sets AuthFailure state with error message', () async {
      storage.token = null;
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      api.error = const UnauthorizedException(message: 'Invalid username or password.');

      final success = await notifier.login('baduser', 'badpass');

      expect(success, false);
      expect(notifier.state, isA<AuthFailure>());
      final failureState = notifier.state as AuthFailure;
      expect(failureState.message, 'Invalid username or password.');
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

    test('logout resets state to Unauthenticated', () async {
      storage.token = 'valid_token';
      api.currentUser = testUser;
      notifier = AuthNotifier(repository);
      await Future<void>.delayed(const Duration(milliseconds: 10));

      await notifier.logout();

      expect(notifier.state, isA<Unauthenticated>());
      expect(storage.token, isNull);
    });
  });
}
