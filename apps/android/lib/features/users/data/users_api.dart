import 'package:dio/dio.dart';
import '../models/create_user_request.dart';
import '../models/permission_model.dart';
import '../models/update_user_request.dart';
import '../models/user_model.dart';

class UsersApi {
  final Dio _dio;

  UsersApi(this._dio);

  /// Retrieves all users in the system
  Future<List<UserModel>> getUsers() async {
    final response = await _dio.get('/users');
    final data = response.data as List<dynamic>;
    return data
        .map((e) => UserModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Retrieves all available permissions grouped by module
  Future<List<PermissionGroupModel>> getAvailablePermissions() async {
    final response = await _dio.get('/users/permissions');
    final data = response.data as List<dynamic>;
    return data
        .map((e) =>
            PermissionGroupModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Retrieves a single user by ID
  Future<UserModel> getUserById(String id) async {
    final response = await _dio.get('/users/$id');
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Creates a new user account (Manager or Staff)
  Future<UserModel> createUser(CreateUserRequest request) async {
    final response = await _dio.post(
      '/users',
      data: request.toJson(),
    );
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Updates an existing user account
  Future<UserModel> updateUser(
    String id,
    UpdateUserRequest request,
  ) async {
    final response = await _dio.put(
      '/users/$id',
      data: request.toJson(),
    );
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Toggles the active/inactive status of a user
  Future<UserModel> toggleUserStatus(String id) async {
    final response = await _dio.patch('/users/$id/toggle-status');
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }
}
