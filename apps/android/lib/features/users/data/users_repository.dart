import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/create_user_request.dart';
import '../models/permission_model.dart';
import '../models/update_user_request.dart';
import '../models/user_model.dart';
import 'users_api.dart';

final usersApiProvider = Provider<UsersApi>((ref) {
  final dio = ref.watch(dioProvider);
  return UsersApi(dio);
});

final usersRepositoryProvider = Provider<UsersRepository>((ref) {
  final api = ref.watch(usersApiProvider);
  return UsersRepository(api);
});

class UsersRepository {
  final UsersApi _api;

  UsersRepository(this._api);

  Future<List<UserModel>> getUsers() async {
    try {
      return await _api.getUsers();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<PermissionGroupModel>> getAvailablePermissions() async {
    try {
      return await _api.getAvailablePermissions();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<UserModel> getUserById(String id) async {
    try {
      return await _api.getUserById(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<UserModel> createUser(CreateUserRequest request) async {
    try {
      return await _api.createUser(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<UserModel> updateUser(
    String id,
    UpdateUserRequest request,
  ) async {
    try {
      return await _api.updateUser(id, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<UserModel> toggleUserStatus(String id) async {
    try {
      return await _api.toggleUserStatus(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
