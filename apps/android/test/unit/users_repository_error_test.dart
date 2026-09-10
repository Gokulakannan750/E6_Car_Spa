import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/users/data/users_api.dart';
import 'package:e6_car_spa/features/users/data/users_repository.dart';
import 'package:e6_car_spa/features/users/models/create_user_request.dart';
import 'package:e6_car_spa/features/users/models/permission_model.dart';
import 'package:e6_car_spa/features/users/models/update_user_request.dart';
import 'package:e6_car_spa/features/users/models/user_model.dart';
import 'package:flutter_test/flutter_test.dart';

class MockErrorUsersApi extends UsersApi {
  MockErrorUsersApi() : super(Dio());

  DioException? exceptionToThrow;

  @override
  Future<List<UserModel>> getUsers() async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    return [];
  }

  @override
  Future<List<PermissionGroupModel>> getAvailablePermissions() async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    return [];
  }

  @override
  Future<UserModel> getUserById(String id) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<UserModel> createUser(CreateUserRequest request) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<UserModel> updateUser(String id, UpdateUserRequest request) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<UserModel> toggleUserStatus(String id) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }
}

void main() {
  late MockErrorUsersApi mockApi;
  late UsersRepository repository;

  setUp(() {
    mockApi = MockErrorUsersApi();
    repository = UsersRepository(mockApi);
  });

  group('UsersRepository Additional Error Boundary Tests', () {
    test('getUsers maps 401 Unauthorized to UnauthorizedException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/users'),
        response: Response(
          requestOptions: RequestOptions(path: '/users'),
          statusCode: 401,
          data: {'error': 'Unauthorized: Token expired.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getUsers(),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('createUser maps 400 Bad Request to ValidationException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/users'),
        response: Response(
          requestOptions: RequestOptions(path: '/users'),
          statusCode: 400,
          data: {'error': 'Password must contain at least 8 characters and one symbol.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createUser(
          const CreateUserRequest(
            fullName: 'Test User',
            username: 'testuser',
            password: '123',
            confirmPassword: '123',
            role: 'Staff',
          ),
        ),
        throwsA(isA<ValidationException>().having(
          (e) => e.message,
          'message',
          contains('Password must contain at least 8 characters'),
        )),
      );
    });

    test('getUserById maps 404 Not Found to NotFoundException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/users/user-404'),
        response: Response(
          requestOptions: RequestOptions(path: '/users/user-404'),
          statusCode: 404,
          data: {'error': 'User user-404 not found.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getUserById('user-404'),
        throwsA(isA<NotFoundException>()),
      );
    });

    test('toggleUserStatus maps 500 Server Error to ServerException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/users/user-1/toggle-status'),
        response: Response(
          requestOptions: RequestOptions(path: '/users/user-1/toggle-status'),
          statusCode: 500,
          data: {'error': 'Database failure occurred while updating user status.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.toggleUserStatus('user-1'),
        throwsA(isA<ServerException>()),
      );
    });

    test('getAvailablePermissions maps connection timeout to NetworkException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/users/permissions'),
        type: DioExceptionType.connectionTimeout,
      );

      expect(
        () => repository.getAvailablePermissions(),
        throwsA(isA<NetworkException>().having(
          (e) => e.message,
          'message',
          contains('Connection timeout'),
        )),
      );
    });

    test('updateUser maps connection error to NetworkException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/users/user-1'),
        type: DioExceptionType.connectionError,
      );

      expect(
        () => repository.updateUser('user-1', const UpdateUserRequest(fullName: 'Updated')),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
