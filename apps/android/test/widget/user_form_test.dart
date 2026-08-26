import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/users/models/user_model.dart';
import 'package:e6_car_spa/features/users/models/permission_model.dart';
import 'package:e6_car_spa/features/users/models/create_user_request.dart';
import 'package:e6_car_spa/features/users/models/update_user_request.dart';
import 'package:e6_car_spa/features/users/presentation/widgets/user_form_sheet.dart';
import 'package:e6_car_spa/features/users/presentation/widgets/permission_selector.dart';
import 'package:e6_car_spa/features/users/providers/users_provider.dart';
import 'package:e6_car_spa/features/users/providers/users_state.dart';

class TestUsersNotifier extends StateNotifier<UsersState>
    implements UsersNotifier {
  TestUsersNotifier(super.initialState);

  CreateUserRequest? lastCreateRequest;
  UpdateUserRequest? lastUpdateRequest;

  @override
  Future<void> loadUsers({bool showLoading = true}) async {}

  @override
  void setSearchQuery(String query) {}

  @override
  void setStatusFilter(UserStatusFilter filter) {}

  @override
  void clearMessages() {}

  @override
  Future<bool> createUser(CreateUserRequest request) async {
    lastCreateRequest = request;
    return true;
  }

  @override
  Future<bool> updateUser(String id, UpdateUserRequest request) async {
    lastUpdateRequest = request;
    return true;
  }

  @override
  Future<bool> toggleUserStatus(String id) async => true;
}

void main() {
  final samplePermissions = [
    const PermissionGroupModel(
      module: 'Customers',
      permissions: [
        PermissionModel(
          id: 'p1',
          code: 'customers.view',
          name: 'View Customers',
          module: 'Customers',
          description: 'Allows viewing customer list',
        ),
        PermissionModel(
          id: 'p2',
          code: 'customers.create',
          name: 'Create Customers',
          module: 'Customers',
          description: 'Allows creating new customer',
        ),
      ],
    ),
  ];

  Widget createTestWidget({
    UserModel? user,
    required TestUsersNotifier notifier,
  }) {
    return ProviderScope(
      overrides: [
        usersNotifierProvider.overrideWith((ref) => notifier),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: UserFormSheet(
            user: user,
            permissionGroups: samplePermissions,
          ),
        ),
      ),
    );
  }

  group('UserFormSheet Widget Tests', () {
    testWidgets('Renders Create User form correctly', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final notifier = TestUsersNotifier(const UsersLoaded(
        users: [],
        permissionGroups: [],
      ));

      await tester.pumpWidget(createTestWidget(notifier: notifier));
      await tester.pumpAndSettle();

      expect(find.text('Add New User'), findsOneWidget);
      expect(find.text('Full Name *'), findsOneWidget);
      expect(find.text('Username *'), findsOneWidget);
      expect(find.text('Password *'), findsOneWidget);
      expect(find.text('Confirm Password *'), findsOneWidget);
      expect(find.text('ROLE *'), findsOneWidget);
      expect(find.byType(PermissionSelector), findsOneWidget);
      expect(find.text('Create User'), findsOneWidget);
    });

    testWidgets('Validates required fields on create', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final notifier = TestUsersNotifier(const UsersLoaded(
        users: [],
        permissionGroups: [],
      ));

      await tester.pumpWidget(createTestWidget(notifier: notifier));
      await tester.pumpAndSettle();

      // Tap Create User without entering details
      await tester.ensureVisible(find.text('Create User'));
      await tester.tap(find.text('Create User'));
      await tester.pumpAndSettle();

      expect(find.text('Full name is required'), findsOneWidget);
      expect(find.text('Username is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });

    testWidgets('Renders Edit User form with immutable username and optional password',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final userToEdit = UserModel(
        id: 'user-1',
        fullName: 'Ramesh Kumar',
        username: 'ramesh',
        email: 'ramesh@e6carspa.com',
        role: 'Manager',
        isActive: true,
        createdAt: DateTime.now(),
        permissions: const ['customers.view'],
      );

      final notifier = TestUsersNotifier(const UsersLoaded(
        users: [],
        permissionGroups: [],
      ));

      await tester.pumpWidget(createTestWidget(
        user: userToEdit,
        notifier: notifier,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Edit User: Ramesh Kumar'), findsOneWidget);
      expect(find.text('Username (Immutable)'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('ramesh'), findsOneWidget);
      expect(find.text('New Password'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
    });

    testWidgets('Renders Owner Access banner when editing Owner', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final ownerUser = UserModel(
        id: 'owner-id',
        fullName: 'Owner User',
        username: 'admin',
        role: 'Owner',
        isActive: true,
        createdAt: DateTime.now(),
      );

      final notifier = TestUsersNotifier(const UsersLoaded(
        users: [],
        permissionGroups: [],
      ));

      await tester.pumpWidget(createTestWidget(
        user: ownerUser,
        notifier: notifier,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Edit Owner Account'), findsOneWidget);
      expect(find.text('OWNER ACCESS'), findsOneWidget);
      expect(find.text('ROLE *'), findsNothing);
      expect(find.byType(PermissionSelector), findsNothing);
    });
  });
}
