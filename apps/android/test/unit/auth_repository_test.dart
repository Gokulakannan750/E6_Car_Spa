import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_status_response.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/models/bootstrap_owner_request.dart';
import 'package:e6_car_spa/features/auth/models/login_request.dart';
import 'package:e6_car_spa/features/auth/models/login_response.dart';
import 'package:dio/dio.dart';

class FakeAuthApi extends AuthApi {
  LoginResponse? mockLoginResponse;
  AuthUser? mockCurrentUser;
  AuthStatusResponse? mockAuthStatus;
  AuthUser? mockBootstrapUser;
  ApiException? errorToThrow;
  BootstrapOwnerRequest? lastBootstrapRequest;

  FakeAuthApi() : super(Dio());

  @override
  Future<AuthStatusResponse> getAuthStatus() async {
    if (errorToThrow != null) throw errorToThrow!;
    if (mockAuthStatus != null) return mockAuthStatus!;
    return const AuthStatusResponse(initialized: true);
  }

  @override
  Future<AuthUser> bootstrapOwner(BootstrapOwnerRequest request) async {
    lastBootstrapRequest = request;
    if (errorToThrow != null) throw errorToThrow!;
    if (mockBootstrapUser != null) return mockBootstrapUser!;
    return const AuthUser(
      id: 'owner-id',
      fullName: 'Owner Admin',
      username: 'owner',
      role: 'Owner',
      isOwner: true,
    );
  }

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
    test('checkInitialization returns false when database is uninitialized', () async {
      fakeApi.mockAuthStatus = const AuthStatusResponse(initialized: false);

      final isInitialized = await repository.checkInitialization();

      expect(isInitialized, false);
    });

    test('checkInitialization returns true when database is initialized', () async {
      fakeApi.mockAuthStatus = const AuthStatusResponse(initialized: true);

      final isInitialized = await repository.checkInitialization();

      expect(isInitialized, true);
    });

    test('checkInitialization propagates ApiException on network or server failure', () async {
      fakeApi.errorToThrow = const ApiException(message: 'Backend server unreachable');

      expect(
        () => repository.checkInitialization(),
        throwsA(isA<ApiException>()),
      );
    });

    test('bootstrapOwner sends expected request payload and returns created user', () async {
      const request = BootstrapOwnerRequest(
        fullName: 'E6 Founder',
        username: 'founder',
        password: 'Password@123',
        confirmPassword: 'Password@123',
      );
      fakeApi.mockBootstrapUser = const AuthUser(
        id: 'owner-created-id',
        fullName: 'E6 Founder',
        username: 'founder',
        role: 'Owner',
        isOwner: true,
      );

      final created = await repository.bootstrapOwner(request);

      expect(created.id, 'owner-created-id');
      expect(created.isOwner, true);
      expect(fakeApi.lastBootstrapRequest?.username, 'founder');
      expect(fakeApi.lastBootstrapRequest?.fullName, 'E6 Founder');
    });

    test('bootstrapOwner propagates ConflictException when already initialized', () async {
      fakeApi.errorToThrow = const ConflictException(message: 'Application is already initialized with an Owner.');

      expect(
        () => repository.bootstrapOwner(
          const BootstrapOwnerRequest(
            fullName: 'E6 Founder',
            username: 'founder',
            password: 'Password@123',
            confirmPassword: 'Password@123',
          ),
        ),
        throwsA(isA<ConflictException>()),
      );
    });

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
