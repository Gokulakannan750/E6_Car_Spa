import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/users/models/user_model.dart';
import 'package:e6_car_spa/features/users/models/permission_model.dart';
import 'package:e6_car_spa/features/users/models/create_user_request.dart';
import 'package:e6_car_spa/features/users/models/update_user_request.dart';

void main() {
  group('UserModel Tests', () {
    test('fromJson and toJson round-trip preserves all fields', () {
      final json = {
        'id': '11111111-2222-3333-4444-555555555555',
        'fullName': 'Ramesh Kumar',
        'username': 'ramesh',
        'email': 'ramesh@e6carspa.com',
        'role': 'Manager',
        'isActive': true,
        'lastLoginAt': '2026-08-26T10:00:00.000Z',
        'createdAt': '2026-08-24T08:00:00.000Z',
        'permissions': ['customers.view', 'jobcards.create'],
      };

      final model = UserModel.fromJson(json);

      expect(model.id, '11111111-2222-3333-4444-555555555555');
      expect(model.fullName, 'Ramesh Kumar');
      expect(model.username, 'ramesh');
      expect(model.email, 'ramesh@e6carspa.com');
      expect(model.role, 'Manager');
      expect(model.isActive, true);
      expect(model.isManager, true);
      expect(model.isOwner, false);
      expect(model.isStaff, false);
      expect(model.permissions, ['customers.view', 'jobcards.create']);
      expect(model.hasPermission('customers.view'), true);
      expect(model.hasPermission('reports.view'), false);

      final exportedJson = model.toJson();
      expect(exportedJson['id'], '11111111-2222-3333-4444-555555555555');
      expect(exportedJson['username'], 'ramesh');
      expect(exportedJson['permissions'], ['customers.view', 'jobcards.create']);
    });

    test('Owner automatically has full access for all permission codes', () {
      final owner = UserModel(
        id: 'owner-id',
        fullName: 'Owner User',
        username: 'admin',
        role: 'Owner',
        isActive: true,
        createdAt: DateTime.now(),
        permissions: const [],
      );

      expect(owner.isOwner, true);
      expect(owner.hasPermission('customers.view'), true);
      expect(owner.hasPermission('anything.anytime'), true);
    });

    test('copyWith updates specific fields immutably', () {
      final initial = UserModel(
        id: 'user-1',
        fullName: 'Initial Name',
        username: 'user1',
        role: 'Staff',
        isActive: true,
        createdAt: DateTime.now(),
      );

      final updated = initial.copyWith(
        fullName: 'Updated Name',
        isActive: false,
        permissions: ['invoices.view'],
      );

      expect(updated.fullName, 'Updated Name');
      expect(updated.isActive, false);
      expect(updated.permissions, ['invoices.view']);
      expect(initial.fullName, 'Initial Name');
    });
  });

  group('PermissionModel Tests', () {
    test('PermissionModel and PermissionGroupModel deserialization', () {
      final groupJson = {
        'module': 'Customers',
        'permissions': [
          {
            'id': 'p1',
            'code': 'customers.view',
            'name': 'View Customers',
            'module': 'Customers',
            'description': 'Allows viewing customers',
          },
          {
            'id': 'p2',
            'code': 'customers.create',
            'name': 'Create Customers',
            'module': 'Customers',
            'description': 'Allows adding new customers',
          }
        ]
      };

      final group = PermissionGroupModel.fromJson(groupJson);

      expect(group.module, 'Customers');
      expect(group.permissions.length, 2);
      expect(group.permissions[0].code, 'customers.view');
      expect(group.permissions[1].name, 'Create Customers');

      final exported = group.toJson();
      expect(exported['module'], 'Customers');
      expect((exported['permissions'] as List).length, 2);
    });
  });

  group('Request DTO Tests', () {
    test('CreateUserRequest normalizes username and trims whitespace', () {
      const request = CreateUserRequest(
        fullName: '  Priya Sharma  ',
        username: '  PriyaS  ',
        email: '  PRIYA@EXAMPLE.COM  ',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'Staff',
        permissionCodes: ['jobcards.view'],
      );

      final json = request.toJson();

      expect(json['fullName'], 'Priya Sharma');
      expect(json['username'], 'priyas');
      expect(json['email'], 'priya@example.com');
      expect(json['role'], 'Staff');
      expect(json['permissionCodes'], ['jobcards.view']);
    });

    test('UpdateUserRequest omits null password when not changing password', () {
      const request = UpdateUserRequest(
        fullName: 'Priya Sharma Updated',
        role: 'Manager',
        permissionCodes: ['jobcards.view', 'jobcards.create'],
      );

      final json = request.toJson();

      expect(json['fullName'], 'Priya Sharma Updated');
      expect(json['role'], 'Manager');
      expect(json.containsKey('password'), false);
      expect(json.containsKey('confirmPassword'), false);
    });
  });
}
