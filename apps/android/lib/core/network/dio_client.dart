import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_constants.dart';
import '../../core/utils/app_environment.dart';
import '../../features/auth/data/auth_token_storage.dart';
import 'auth_session_events.dart';

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(authTokenStorageProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: AppEnvironment.apiBaseUrl,
      connectTimeout: const Duration(milliseconds: AppConstants.connectTimeoutMs),
      receiveTimeout: const Duration(milliseconds: AppConstants.receiveTimeoutMs),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    ),
  );

  // Authentication & Session Interceptor
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.getToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        final path = error.requestOptions.path;
        final uri = Uri.tryParse(path);
        String normalizedPath = (uri?.path ?? path).toLowerCase();
        if (!normalizedPath.startsWith('/')) {
          normalizedPath = '/$normalizedPath';
        }
        if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
          normalizedPath = normalizedPath.substring(0, normalizedPath.length - 1);
        }
        final canonicalPath = normalizedPath.startsWith('/api/')
            ? normalizedPath.substring(4)
            : normalizedPath;

        const unauthenticatedEndpoints = <String>{
          '/auth/login',
          '/auth/bootstrap',
          '/auth/status',
          '/public/business-profile',
        };

        final isUnauthenticated = unauthenticatedEndpoints.contains(canonicalPath);

        if (error.response?.statusCode == 401 && !isUnauthenticated) {
          await storage.clearSession();
          AuthSessionEvents.notifyUnauthorized();
        }
        return handler.next(error);
      },
    ),
  );

  // Sanitized Development Logger (Redacts passwords and sensitive auth headers)
  if (AppEnvironment.isDevelopment) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          // Log only method and endpoint without sensitive headers
          return handler.next(options);
        },
        onResponse: (response, handler) {
          return handler.next(response);
        },
        onError: (error, handler) {
          return handler.next(error);
        },
      ),
    );
  }

  return dio;
});
