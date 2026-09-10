import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/auth_status_response.dart';
import '../models/auth_user.dart';
import '../models/bootstrap_owner_request.dart';
import '../models/login_request.dart';
import '../models/login_response.dart';

final authApiProvider = Provider<AuthApi>((ref) {
  final dio = ref.watch(dioProvider);
  return AuthApi(dio);
});

class AuthApi {
  final Dio _dio;

  const AuthApi(this._dio);

  /// Checks whether backend is initialized with an Owner against GET /api/auth/status
  Future<AuthStatusResponse> getAuthStatus() async {
    try {
      final response = await _dio.get('/auth/status');
      if (response.data is Map<String, dynamic>) {
        return AuthStatusResponse.fromJson(response.data as Map<String, dynamic>);
      }
      throw const ApiException(message: 'Invalid response format from auth status API.');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Bootstraps initial Owner account against POST /api/auth/bootstrap
  Future<AuthUser> bootstrapOwner(BootstrapOwnerRequest request) async {
    try {
      final response = await _dio.post(
        '/auth/bootstrap',
        data: request.toJson(),
      );

      if (response.data is Map<String, dynamic>) {
        return AuthUser.fromJson(response.data as Map<String, dynamic>);
      }
      throw const ApiException(message: 'Invalid response format from bootstrap API.');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Performs user login against POST /api/auth/login
  Future<LoginResponse> login(LoginRequest request) async {
    try {
      final response = await _dio.post(
        '/auth/login',
        data: request.toJson(),
      );

      if (response.data is Map<String, dynamic>) {
        return LoginResponse.fromJson(response.data as Map<String, dynamic>);
      }
      throw const ApiException(message: 'Invalid response format from login API.');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Retrieves current authenticated user profile against GET /api/auth/me
  Future<AuthUser> getCurrentUser({String? customToken}) async {
    try {
      final options = customToken != null
          ? Options(headers: {'Authorization': 'Bearer $customToken'})
          : null;

      final response = await _dio.get(
        '/auth/me',
        options: options,
      );

      if (response.data is Map<String, dynamic>) {
        return AuthUser.fromJson(response.data as Map<String, dynamic>);
      }
      throw const ApiException(message: 'Invalid response format from user profile API.');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
