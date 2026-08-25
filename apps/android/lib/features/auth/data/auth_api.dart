import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/auth_user.dart';
import '../models/login_request.dart';
import '../models/login_response.dart';

final authApiProvider = Provider<AuthApi>((ref) {
  final dio = ref.watch(dioProvider);
  return AuthApi(dio);
});

class AuthApi {
  final Dio _dio;

  const AuthApi(this._dio);

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
