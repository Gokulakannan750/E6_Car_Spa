import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/models/login_request.dart';
import 'package:e6_car_spa/features/auth/models/login_response.dart';
import 'package:dio/dio.dart';

class FakeAuthApi extends AuthApi {
  LoginResponse? mockLoginResponse;
  AuthUser? mockCurrentUser;
  ApiException? errorToThrow;

  FakeAuthApi() : super(Dio());

  @override
  Future<LoginResponse> login(LoginRequest request) async {
    if (errorToThrow != null) throw errorToThrow!;
    if (mockLoginResponse != null) return mockLoginResponse!;
    throw const ApiException(message: 'No response configured');
  }

  @override
  Future<AuthUser> getCurrentUser({String? customToken}) async {
    if (errorToThrow != null) throw errorToThrow!;
    if (mockCurrentUser != null) return mockCurrentUser!;
    throw const ApiException(message: 'No user configured');
  }
}

class FakeAuthTokenStorage extends AuthTokenStorage {
  String? storedToken;
  AuthUser? storedUser;

  @override
  Future<void> saveToken(String token) async {
    storedToken = token;
  }

  @override
  Future<String?> getToken() async => storedToken;

  @override
  Future<bool> hasToken() async => storedToken != null && storedToken!.isNotEmpty;

  @override
  Future<void> saveUser(AuthUser user) async {
    storedUser = user;
  }

  @override
  Future<AuthUser?> getCachedUser() async => storedUser;

  @override
  Future<void> clearSession() async {
    storedToken = null;
    storedUser = null;
  }
}

void main() {
  late FakeAuthApi fakeApi;
  late FakeAuthTokenStorage fakeStorage;
  late AuthRepository repository;

  const testUser = AuthUser(
    id: 'user-123',
    fullName: 'Test User',
    username: 'testuser',
    email: 'test@example.com',
    role: 'Staff',
    isOwner: false,
    permissions: ['JobCards.View'],
  );

  setUp(() {
    fakeApi = FakeAuthApi();
    fakeStorage = FakeAuthTokenStorage();
    repository = AuthRepository(fakeApi, fakeStorage);
  });

  group('AuthRepository Unit Tests', () {
    test('login saves token and user to storage upon success', () async {
      fakeApi.mockLoginResponse = const LoginResponse(
        token: 'token_abc_123',
        user: testUser,
      );

      final user = await repository.login('testuser', 'Password123!');

      expect(user.username, 'testuser');
      expect(fakeStorage.storedToken, 'token_abc_123');
      expect(fakeStorage.storedUser?.id, 'user-123');
    });

    test('login propagates ApiException without saving session when failed', () async {
      fakeApi.errorToThrow = const UnauthorizedException(
        message: 'Invalid username or password.',
      );

      expect(
        () => repository.login('wronguser', 'wrongpass'),
        throwsA(isA<UnauthorizedException>()),
      );
      expect(fakeStorage.storedToken, isNull);
    });

    test('restoreSession returns validated user when token exists and GET /me succeeds', () async {
      fakeStorage.storedToken = 'valid_token_xyz';
      fakeApi.mockCurrentUser = testUser;

      final user = await repository.restoreSession();

      expect(user, isNotNull);
      expect(user?.username, 'testuser');
      expect(fakeStorage.storedUser?.id, 'user-123');
    });

    test('restoreSession clears session and returns null when token is 401 Unauthorized', () async {
      fakeStorage.storedToken = 'expired_token';
      fakeApi.errorToThrow = const UnauthorizedException(
        message: 'User not found or inactive.',
      );

      final user = await repository.restoreSession();

      expect(user, isNull);
      expect(fakeStorage.storedToken, isNull);
      expect(fakeStorage.storedUser, isNull);
    });

    test('restoreSession returns null without calling API when no token is stored', () async {
      fakeStorage.storedToken = null;

      final user = await repository.restoreSession();

      expect(user, isNull);
    });

    test('logout clears stored credentials', () async {
      fakeStorage.storedToken = 'active_token';
      fakeStorage.storedUser = testUser;

      await repository.logout();

      expect(fakeStorage.storedToken, isNull);
      expect(fakeStorage.storedUser, isNull);
    });
  });
}
