import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/users/data/users_api.dart';
import 'package:e6_car_spa/features/users/data/users_repository.dart';
import 'package:e6_car_spa/features/users/models/create_user_request.dart';
import 'package:e6_car_spa/features/users/models/permission_model.dart';
import 'package:e6_car_spa/features/users/models/update_user_request.dart';
import 'package:e6_car_spa/features/users/models/user_model.dart';

class MockUsersApi extends UsersApi {
  MockUsersApi() : super(Dio());

  List<UserModel>? usersToReturn;
  List<PermissionGroupModel>? permissionsToReturn;
  UserModel? userToReturn;
  DioException? dioExceptionToThrow;

  @override
  Future<List<UserModel>> getUsers() async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return usersToReturn!;
  }

  @override
  Future<List<PermissionGroupModel>> getAvailablePermissions() async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return permissionsToReturn!;
  }

  @override
  Future<UserModel> getUserById(String id) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return userToReturn!;
  }

  @override
  Future<UserModel> createUser(CreateUserRequest request) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return userToReturn!;
  }

  @override
  Future<UserModel> updateUser(String id, UpdateUserRequest request) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return userToReturn!;
  }

  @override
  Future<UserModel> toggleUserStatus(String id) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return userToReturn!;
  }
}

void main() {
  late MockUsersApi mockApi;
  late UsersRepository repository;

  final sampleUser = UserModel(
    id: 'user-1',
    fullName: 'Ramesh Kumar',
    username: 'ramesh',
    email: 'ramesh@e6carspa.com',
    role: 'Manager',
    isActive: true,
    createdAt: DateTime.now(),
    permissions: const ['customers.view', 'jobcards.view'],
  );

  setUp(() {
    mockApi = MockUsersApi();
    repository = UsersRepository(mockApi);
  });

  group('UsersRepository Tests', () {
    test('getUsers returns list on success', () async {
      mockApi.usersToReturn = [sampleUser];

      final result = await repository.getUsers();

      expect(result.length, 1);
      expect(result.first.fullName, 'Ramesh Kumar');
      expect(result.first.username, 'ramesh');
    });

    test('getAvailablePermissions returns permission groups on success', () async {
      mockApi.permissionsToReturn = [
        const PermissionGroupModel(
          module: 'Customers',
          permissions: [
            PermissionModel(
              id: 'p1',
              code: 'customers.view',
              name: 'View Customers',
              module: 'Customers',
            ),
          ],
        ),
      ];

      final result = await repository.getAvailablePermissions();

      expect(result.length, 1);
      expect(result.first.module, 'Customers');
      expect(result.first.permissions.first.code, 'customers.view');
    });

    test('createUser returns created user on success', () async {
      mockApi.userToReturn = sampleUser;

      const request = CreateUserRequest(
        fullName: 'Ramesh Kumar',
        username: 'ramesh',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'Manager',
      );

      final result = await repository.createUser(request);

      expect(result.id, 'user-1');
      expect(result.fullName, 'Ramesh Kumar');
    });

    test('updateUser returns updated user on success', () async {
      final updatedUser = sampleUser.copyWith(fullName: 'Ramesh Kumar Updated');
      mockApi.userToReturn = updatedUser;

      const request = UpdateUserRequest(
        fullName: 'Ramesh Kumar Updated',
      );

      final result = await repository.updateUser('user-1', request);

      expect(result.fullName, 'Ramesh Kumar Updated');
    });

    test('toggleUserStatus returns toggled user on success', () async {
      final toggled = sampleUser.copyWith(isActive: false);
      mockApi.userToReturn = toggled;

      final result = await repository.toggleUserStatus('user-1');

      expect(result.isActive, false);
    });

    test('rethrows ApiException on 409 Conflict (Duplicate username)', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/users'),
        response: Response(
          requestOptions: RequestOptions(path: '/users'),
          statusCode: 409,
          data: {'error': "A user with username 'ramesh' already exists."},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createUser(const CreateUserRequest(
          fullName: 'Ramesh Kumar',
          username: 'ramesh',
          password: 'Password@123',
          confirmPassword: 'Password@123',
          role: 'Manager',
        )),
        throwsA(isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains("A user with username 'ramesh' already exists."),
        )),
      );
    });

    test('rethrows ApiException on 403 Forbidden', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/users'),
        response: Response(
          requestOptions: RequestOptions(path: '/users'),
          statusCode: 403,
          data: {'error': 'Forbidden access.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getUsers(),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
