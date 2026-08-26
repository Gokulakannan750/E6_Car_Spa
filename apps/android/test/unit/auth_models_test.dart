import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/models/login_request.dart';
import 'package:e6_car_spa/features/auth/models/login_response.dart';

void main() {
  group('Auth Models Unit Tests', () {
    test('AuthUser correctly parses from backend JSON and serializes to JSON', () {
      final json = {
        'id': '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        'fullName': 'John Manager',
        'username': 'john_manager',
        'email': 'john@e6carspa.com',
        'role': 'Manager',
        'isOwner': false,
        'permissions': ['JobCards.Create', 'JobCards.View', 'Invoices.Create'],
      };

      final user = AuthUser.fromJson(json);

      expect(user.id, '3fa85f64-5717-4562-b3fc-2c963f66afa6');
      expect(user.fullName, 'John Manager');
      expect(user.username, 'john_manager');
      expect(user.email, 'john@e6carspa.com');
      expect(user.role, 'Manager');
      expect(user.isOwner, false);
      expect(user.permissions, ['JobCards.Create', 'JobCards.View', 'Invoices.Create']);
      expect(user.hasPermission('JobCards.Create'), true);
      expect(user.hasPermission('Reports.View'), false);

      final serialized = user.toJson();
      expect(serialized['id'], user.id);
      expect(serialized['username'], user.username);
      expect(serialized['permissions'], user.permissions);
    });

    test('AuthUser owner role grants all permissions', () {
      const owner = AuthUser(
        id: '11111111-2222-3333-4444-555555555555',
        fullName: 'Owner User',
        username: 'owner',
        role: 'Owner',
        isOwner: true,
        permissions: [],
      );

      expect(owner.hasPermission('Any.Action'), true);
      expect(owner.hasPermission('Reports.Export'), true);
    });

    test('LoginRequest serializes to expected JSON structure', () {
      const request = LoginRequest(
        username: 'test_user',
        password: 'Password123!',
      );

      final json = request.toJson();
      expect(json['username'], 'test_user');
      expect(json['password'], 'Password123!');
    });

    test('LoginResponse deserializes from backend contract', () {
      final json = {
        'token': 'mock_jwt_token_header.payload.signature',
        'user': {
          'id': '22222222-3333-4444-5555-666666666666',
          'fullName': 'Staff Member',
          'username': 'staff1',
          'email': null,
          'role': 'Staff',
          'isOwner': false,
          'permissions': ['JobCards.View'],
        },
      };

      final response = LoginResponse.fromJson(json);

      expect(response.token, 'mock_jwt_token_header.payload.signature');
      expect(response.user.username, 'staff1');
      expect(response.user.role, 'Staff');
      expect(response.user.isOwner, false);
    });
  });
}
