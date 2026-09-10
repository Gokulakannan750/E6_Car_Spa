import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/network/auth_session_events.dart';
import 'package:e6_car_spa/core/network/dio_client.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';

class _FakeAuthStorage extends AuthTokenStorage {
  String? storedToken;
  int clearSessionCallCount = 0;

  @override
  Future<String?> getToken() async => storedToken;

  @override
  Future<void> saveToken(String token) async => storedToken = token;

  @override
  Future<void> clearSession() async {
    storedToken = null;
    clearSessionCallCount++;
  }

  @override
  Future<AuthUser?> getCachedUser() async => null;

  @override
  Future<void> saveUser(AuthUser user) async {}
}

void main() {
  group('DioClient Interceptor & Session Lifecycle Tests', () {
    late _FakeAuthStorage fakeStorage;
    late ProviderContainer container;
    late Dio dio;

    setUp(() {
      fakeStorage = _FakeAuthStorage();
      container = ProviderContainer(
        overrides: [
          authTokenStorageProvider.overrideWithValue(fakeStorage),
        ],
      );
      dio = container.read(dioProvider);
    });

    tearDown(() {
      container.dispose();
    });

    test('onRequest attaches Authorization Bearer header when token is present', () async {
      fakeStorage.storedToken = 'valid-jwt-token-12345';

      final interceptor = dio.interceptors.firstWhere((i) => i is InterceptorsWrapper) as InterceptorsWrapper;
      final options = RequestOptions(path: '/api/jobcards');

      final completer = Completer<RequestOptions>();
      interceptor.onRequest(
        options,
        _InterceptHandler(
          onNext: (opt) => completer.complete(opt),
        ),
      );

      final result = await completer.future;
      expect(result.headers['Authorization'], 'Bearer valid-jwt-token-12345');
    });

    test('onRequest omits Authorization header when token is null or empty', () async {
      fakeStorage.storedToken = null;

      final interceptor = dio.interceptors.firstWhere((i) => i is InterceptorsWrapper) as InterceptorsWrapper;
      final options = RequestOptions(path: '/api/public/health');

      final completer = Completer<RequestOptions>();
      interceptor.onRequest(
        options,
        _InterceptHandler(
          onNext: (opt) => completer.complete(opt),
        ),
      );

      final result = await completer.future;
      expect(result.headers.containsKey('Authorization'), isFalse);
    });

    test('onError on HTTP 401 clears session and broadcasts notifyUnauthorized', () async {
      fakeStorage.storedToken = 'expired-token';

      bool unauthorizedNotified = false;
      final sub = AuthSessionEvents.onUnauthorized.listen((_) {
        unauthorizedNotified = true;
      });

      final interceptor = dio.interceptors.firstWhere((i) => i is InterceptorsWrapper) as InterceptorsWrapper;
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/api/profile'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/profile'),
          statusCode: 401,
          statusMessage: 'Unauthorized',
        ),
        type: DioExceptionType.badResponse,
      );

      final errorCompleter = Completer<DioException>();
      interceptor.onError(
        dioError,
        _ErrorInterceptHandler(
          onNext: (err) => errorCompleter.complete(err),
        ),
      );

      final err = await errorCompleter.future;
      expect(err.response?.statusCode, 401);

      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(fakeStorage.clearSessionCallCount, 1);
      expect(fakeStorage.storedToken, isNull);
      expect(unauthorizedNotified, isTrue);

      await sub.cancel();
    });

    test('onError on HTTP 401 for /auth/login does NOT clear session and does NOT broadcast notifyUnauthorized', () async {
      fakeStorage.storedToken = 'pre-existing-token';

      bool unauthorizedNotified = false;
      final sub = AuthSessionEvents.onUnauthorized.listen((_) {
        unauthorizedNotified = true;
      });

      final interceptor = dio.interceptors.firstWhere((i) => i is InterceptorsWrapper) as InterceptorsWrapper;
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/auth/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 401,
          statusMessage: 'Unauthorized',
        ),
        type: DioExceptionType.badResponse,
      );

      final errorCompleter = Completer<DioException>();
      interceptor.onError(
        dioError,
        _ErrorInterceptHandler(
          onNext: (err) => errorCompleter.complete(err),
        ),
      );

      final err = await errorCompleter.future;
      expect(err.response?.statusCode, 401);

      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(fakeStorage.clearSessionCallCount, 0);
      expect(fakeStorage.storedToken, 'pre-existing-token');
      expect(unauthorizedNotified, isFalse);

      await sub.cancel();
    });

    test('onError on HTTP 401 for /api/auth/login does NOT clear session and does NOT broadcast notifyUnauthorized', () async {
      fakeStorage.storedToken = 'pre-existing-token';

      bool unauthorizedNotified = false;
      final sub = AuthSessionEvents.onUnauthorized.listen((_) {
        unauthorizedNotified = true;
      });

      final interceptor = dio.interceptors.firstWhere((i) => i is InterceptorsWrapper) as InterceptorsWrapper;
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/api/auth/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/auth/login'),
          statusCode: 401,
          statusMessage: 'Unauthorized',
        ),
        type: DioExceptionType.badResponse,
      );

      final errorCompleter = Completer<DioException>();
      interceptor.onError(
        dioError,
        _ErrorInterceptHandler(
          onNext: (err) => errorCompleter.complete(err),
        ),
      );

      final err = await errorCompleter.future;
      expect(err.response?.statusCode, 401);

      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(fakeStorage.clearSessionCallCount, 0);
      expect(fakeStorage.storedToken, 'pre-existing-token');
      expect(unauthorizedNotified, isFalse);

      await sub.cancel();
    });

    test('onError on HTTP 500 passes error through without clearing session or broadcasting 401', () async {
      fakeStorage.storedToken = 'valid-token';

      bool unauthorizedNotified = false;
      final sub = AuthSessionEvents.onUnauthorized.listen((_) {
        unauthorizedNotified = true;
      });

      final interceptor = dio.interceptors.firstWhere((i) => i is InterceptorsWrapper) as InterceptorsWrapper;
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/api/orders'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/orders'),
          statusCode: 500,
          statusMessage: 'Internal Server Error',
        ),
        type: DioExceptionType.badResponse,
      );

      final errorCompleter = Completer<DioException>();
      interceptor.onError(
        dioError,
        _ErrorInterceptHandler(
          onNext: (err) => errorCompleter.complete(err),
        ),
      );

      final err = await errorCompleter.future;
      expect(err.response?.statusCode, 500);

      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(fakeStorage.clearSessionCallCount, 0);
      expect(fakeStorage.storedToken, 'valid-token');
      expect(unauthorizedNotified, isFalse);

      await sub.cancel();
    });

    test('onError on HTTP 403 Forbidden does not clear session', () async {
      fakeStorage.storedToken = 'valid-token-staff';

      final interceptor = dio.interceptors.firstWhere((i) => i is InterceptorsWrapper) as InterceptorsWrapper;
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/api/settings'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/settings'),
          statusCode: 403,
          statusMessage: 'Forbidden',
        ),
        type: DioExceptionType.badResponse,
      );

      final errorCompleter = Completer<DioException>();
      interceptor.onError(
        dioError,
        _ErrorInterceptHandler(
          onNext: (err) => errorCompleter.complete(err),
        ),
      );

      final err = await errorCompleter.future;
      expect(err.response?.statusCode, 403);

      expect(fakeStorage.clearSessionCallCount, 0);
      expect(fakeStorage.storedToken, 'valid-token-staff');
    });
  });
}

class _InterceptHandler extends RequestInterceptorHandler {
  final void Function(RequestOptions) onNext;
  _InterceptHandler({required this.onNext});

  @override
  void next(RequestOptions requestOptions) => onNext(requestOptions);
}

class _ErrorInterceptHandler extends ErrorInterceptorHandler {
  final void Function(DioException) onNext;
  _ErrorInterceptHandler({required this.onNext});

  @override
  void next(DioException err) => onNext(err);
}
