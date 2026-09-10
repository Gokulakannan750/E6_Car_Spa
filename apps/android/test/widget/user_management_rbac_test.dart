import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/users/data/users_api.dart';
import 'package:e6_car_spa/features/users/data/users_repository.dart';
import 'package:e6_car_spa/features/users/models/create_user_request.dart';
import 'package:e6_car_spa/features/users/models/permission_model.dart';
import 'package:e6_car_spa/features/users/models/update_user_request.dart';
import 'package:e6_car_spa/features/users/models/user_model.dart';
import 'package:e6_car_spa/features/users/presentation/pages/users_screen.dart';
import 'package:e6_car_spa/features/users/presentation/widgets/permission_selector.dart';
import 'package:e6_car_spa/features/users/presentation/widgets/user_card.dart';
import 'package:e6_car_spa/features/users/presentation/widgets/user_form_sheet.dart';
import 'package:e6_car_spa/features/users/providers/users_provider.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class MockUsersRepo extends UsersRepository {
  MockUsersRepo() : super(UsersApi(Dio()));

  List<UserModel> users = [];
  List<PermissionGroupModel> permissions = [];
  String? createError;
  int createCalls = 0;
  int updateCalls = 0;
  int toggleCalls = 0;

  @override
  Future<List<UserModel>> getUsers() async => users;

  @override
  Future<List<PermissionGroupModel>> getAvailablePermissions() async => permissions;

  @override
  Future<UserModel> createUser(CreateUserRequest request) async {
    createCalls++;
    if (createError != null) {
      throw ApiException(message: createError!);
    }
    final created = UserModel(
      id: 'created-id',
      fullName: request.fullName,
      username: request.username,
      email: request.email,
      role: request.role,
      isActive: true,
      createdAt: DateTime(2026, 9, 9),
      permissions: request.permissionCodes,
    );
    users.add(created);
    return created;
  }

  @override
  Future<UserModel> updateUser(String id, UpdateUserRequest request) async {
    updateCalls++;
    final idx = users.indexWhere((u) => u.id == id);
    if (idx != -1) {
      final updated = UserModel(
        id: id,
        fullName: request.fullName,
        username: users[idx].username,
        email: request.email,
        role: request.role ?? users[idx].role,
        isActive: users[idx].isActive,
        createdAt: users[idx].createdAt,
        permissions: request.permissionCodes ?? users[idx].permissions,
      );
      users[idx] = updated;
      return updated;
    }
    throw const ApiException(message: 'User not found');
  }

  @override
  Future<UserModel> toggleUserStatus(String id) async {
    toggleCalls++;
    final idx = users.indexWhere((u) => u.id == id);
    if (idx != -1) {
      final updated = UserModel(
        id: id,
        fullName: users[idx].fullName,
        username: users[idx].username,
        email: users[idx].email,
        role: users[idx].role,
        isActive: !users[idx].isActive,
        createdAt: users[idx].createdAt,
        permissions: users[idx].permissions,
      );
      users[idx] = updated;
      return updated;
    }
    throw const ApiException(message: 'User not found');
  }
}

class FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  FakeAuthNotifier(AuthUser user) : super(Authenticated(user));

  @override
  Future<bool> login(String username, String password) async => true;
  @override
  Future<void> logout() async {
    state = const Unauthenticated();
  }
  @override
  Future<void> restoreSession() async {}
  @override
  void clearError() {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const ownerUser = AuthUser(
    id: 'owner-id',
    fullName: 'Owner Admin',
    username: 'admin',
    role: 'Owner',
    isOwner: true,
    permissions: [
      'users.view',
      'users.create',
      'users.edit',
      'users.deactivate',
    ],
  );

  final sampleOwner = UserModel(
    id: 'owner-id',
    fullName: 'Owner Admin',
    username: 'admin',
    role: 'Owner',
    isActive: true,
    createdAt: DateTime(2026, 1, 1),
  );

  final sampleStaff = UserModel(
    id: 'staff-1',
    fullName: 'Ravi Kumar',
    username: 'ravik',
    email: 'ravi@e6carspa.com',
    role: 'Staff',
    isActive: true,
    createdAt: DateTime(2026, 2, 1),
    permissions: const ['customers.view'],
  );

  final sampleInactiveStaff = UserModel(
    id: 'staff-2',
    fullName: 'Priya Sharma',
    username: 'priyas',
    email: 'priya@e6carspa.com',
    role: 'Staff',
    isActive: false,
    createdAt: DateTime(2026, 2, 1),
    permissions: const [],
  );

  const samplePermissionGroups = [
    PermissionGroupModel(
      module: 'Customers',
      permissions: [
        PermissionModel(
          id: 'p1',
          code: 'customers.view',
          name: 'View Customers',
          module: 'Customers',
        ),
        PermissionModel(
          id: 'p2',
          code: 'customers.create',
          name: 'Create Customers',
          module: 'Customers',
        ),
      ],
    ),
    PermissionGroupModel(
      module: 'Showroom',
      permissions: [
        PermissionModel(
          id: 'p3',
          code: 'showroom.view',
          name: 'View Showroom',
          module: 'Showroom',
        ),
      ],
    ),
  ];

  group('UserCard RBAC & Protection Controls', () {
    testWidgets('Owner card renders full access badge and omits deactivation button', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: UserCard(
              user: sampleOwner,
              isSelf: false,
              canEdit: true,
              canDeactivate: true,
              onEdit: () {},
              onToggleStatus: () {},
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Owner Admin'), findsOneWidget);
      expect(find.text('Full Access (All Modules)'), findsOneWidget);
      // Edit button is present
      expect(find.byTooltip('Edit User'), findsOneWidget);
      // Deactivate button is NEVER rendered for Owner
      expect(find.byTooltip('Deactivate User'), findsNothing);
      expect(find.byTooltip('Activate User'), findsNothing);
    });

    testWidgets('Self user card omits deactivation button even if has canDeactivate', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: UserCard(
              user: sampleStaff,
              isSelf: true,
              canEdit: true,
              canDeactivate: true,
              onEdit: () {},
              onToggleStatus: () {},
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Ravi Kumar'), findsOneWidget);
      expect(find.byTooltip('Edit User'), findsOneWidget);
      // Deactivate button is omitted for self
      expect(find.byTooltip('Deactivate User'), findsNothing);
    });

    testWidgets('Non-owner non-self active user card shows deactivation button', (tester) async {
      bool toggleCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: UserCard(
              user: sampleStaff,
              isSelf: false,
              canEdit: true,
              canDeactivate: true,
              onEdit: () {},
              onToggleStatus: () {
                toggleCalled = true;
              },
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Ravi Kumar'), findsOneWidget);
      final deactBtn = find.byTooltip('Deactivate User');
      expect(deactBtn, findsOneWidget);

      await tester.tap(deactBtn);
      await tester.pumpAndSettle();

      expect(toggleCalled, isTrue);
    });

    testWidgets('Inactive user card shows activate button with green styling', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: UserCard(
              user: sampleInactiveStaff,
              isSelf: false,
              canEdit: true,
              canDeactivate: true,
              onEdit: () {},
              onToggleStatus: () {},
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Priya Sharma'), findsOneWidget);
      expect(find.byTooltip('Activate User'), findsOneWidget);
    });
  });

  group('UserFormSheet Validations & RBAC', () {
    testWidgets('Validates required fields in create mode (name, username, password)', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockUsersRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            usersRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: UserFormSheet(
                permissionGroups: samplePermissionGroups,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap 'Create User' button without filling required fields
      final createBtn = find.widgetWithText(AppButton, 'Create User');
      expect(createBtn, findsOneWidget);
      await tester.tap(createBtn);
      await tester.pumpAndSettle();

      expect(find.text('Full name is required'), findsOneWidget);
      expect(find.text('Username is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });

    testWidgets('Validates username spaces, password length, and password mismatch', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockUsersRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            usersRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: UserFormSheet(
                permissionGroups: samplePermissionGroups,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter full name
      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'Anand Kumar'); // Full name
      await tester.enterText(textFields.at(1), 'anand kumar'); // Username with spaces
      await tester.enterText(textFields.at(3), 'short'); // Password < 8 chars
      await tester.enterText(textFields.at(4), 'different'); // Confirm password
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Create User'));
      await tester.pumpAndSettle();

      expect(find.text('Username cannot contain spaces'), findsOneWidget);
      expect(find.text('Password must be at least 8 characters'), findsOneWidget);
      expect(find.text('Passwords do not match'), findsOneWidget);
    });

    testWidgets('Protects Owner account when editing: hides role, permissions and displays OWNER ACCESS banner', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockUsersRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            usersRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: UserFormSheet(
                user: sampleOwner,
                permissionGroups: samplePermissionGroups,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Edit Owner Account'), findsOneWidget);
      expect(find.text('OWNER ACCESS'), findsOneWidget);
      expect(find.textContaining('Full access to all current and future modules'), findsOneWidget);

      // Role selector and Permission selector are completely hidden for Owner
      expect(find.text('ROLE *'), findsNothing);
      expect(find.text('ASSIGNED MODULE PERMISSIONS'), findsNothing);
      expect(find.byType(PermissionSelector), findsNothing);
    });

    testWidgets('Preserves form input and displays error when createUser API fails', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockUsersRepo()
        ..createError = 'Username "arun" is already taken. Please choose another.';

      final usersNotifier = UsersNotifier(mockRepo);
      await usersNotifier.loadUsers();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            usersRepositoryProvider.overrideWithValue(mockRepo),
            usersNotifierProvider.overrideWith((ref) => usersNotifier),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: UserFormSheet(
                permissionGroups: samplePermissionGroups,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'Arun Prakash');
      await tester.enterText(textFields.at(1), 'arun');
      await tester.enterText(textFields.at(2), 'arun@e6carspa.com');
      await tester.enterText(textFields.at(3), 'SecurePass123!');
      await tester.enterText(textFields.at(4), 'SecurePass123!');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Create User'));
      await tester.pumpAndSettle();

      // Error message rendered in error container
      expect(find.text('Username "arun" is already taken. Please choose another.'), findsOneWidget);
      // Inputs preserved
      expect(find.text('Arun Prakash'), findsOneWidget);
      expect(find.text('arun'), findsOneWidget);
      expect(find.text('arun@e6carspa.com'), findsOneWidget);
    });
  });

  group('PermissionSelector Granular Interactions', () {
    testWidgets('Toggles permissions and handles Select All and Clear All', (tester) async {
      List<String> selected = ['customers.view'];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return PermissionSelector(
                  groups: samplePermissionGroups,
                  selected: selected,
                  onChange: (newPerms) {
                    setState(() {
                      selected = newPerms;
                    });
                  },
                );
              },
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Module header
      expect(find.text('CUSTOMERS'), findsOneWidget);
      expect(find.text('1 / 2'), findsOneWidget);

      // Select All button under Customers
      final selectAllBtn = find.widgetWithText(TextButton, 'Select All');
      expect(selectAllBtn, findsOneWidget);
      await tester.tap(selectAllBtn);
      await tester.pumpAndSettle();

      expect(selected.contains('customers.view'), isTrue);
      expect(selected.contains('customers.create'), isTrue);
      expect(find.text('2 / 2'), findsOneWidget);

      // Clear All button
      final clearAllBtn = find.widgetWithText(TextButton, 'Clear All');
      expect(clearAllBtn, findsOneWidget);
      await tester.tap(clearAllBtn);
      await tester.pumpAndSettle();

      expect(selected.contains('customers.view'), isFalse);
      expect(selected.contains('customers.create'), isFalse);
      expect(find.text('0 / 2'), findsOneWidget);
    });
  });

  group('UsersScreen Status Filter Tabs', () {
    testWidgets('Filter chips switch between All, Active, and Inactive users', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockUsersRepo()
        ..users = [sampleOwner, sampleStaff, sampleInactiveStaff]
        ..permissions = samplePermissionGroups;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            usersRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(ownerUser)),
          ],
          child: const MaterialApp(
            home: UsersScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Initial state: All (3) users rendered
      expect(find.text('All (3)'), findsOneWidget);
      expect(find.text('Active (2)'), findsOneWidget);
      expect(find.text('Inactive (1)'), findsOneWidget);
      expect(find.text('Owner Admin'), findsOneWidget);
      expect(find.text('Ravi Kumar'), findsOneWidget);
      expect(find.text('Priya Sharma'), findsOneWidget);

      // Filter by Active
      await tester.tap(find.text('Active (2)'));
      await tester.pumpAndSettle();

      expect(find.text('Showing 2 users'), findsOneWidget);
      expect(find.text('Owner Admin'), findsOneWidget);
      expect(find.text('Ravi Kumar'), findsOneWidget);
      expect(find.text('Priya Sharma'), findsNothing);

      // Filter by Inactive
      await tester.tap(find.text('Inactive (1)'));
      await tester.pumpAndSettle();

      expect(find.text('Showing 1 user'), findsOneWidget);
      expect(find.text('Priya Sharma'), findsOneWidget);
      expect(find.text('Ravi Kumar'), findsNothing);
      expect(find.text('Owner Admin'), findsNothing);
    });
  });
}
