import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/users/models/user_model.dart';
import 'package:e6_car_spa/features/users/models/permission_model.dart';
import 'package:e6_car_spa/features/users/models/create_user_request.dart';
import 'package:e6_car_spa/features/users/models/update_user_request.dart';
import 'package:e6_car_spa/features/users/presentation/pages/users_screen.dart';
import 'package:e6_car_spa/features/users/presentation/widgets/user_card.dart';
import 'package:e6_car_spa/features/users/providers/users_provider.dart';
import 'package:e6_car_spa/features/users/providers/users_state.dart';

class TestAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  TestAuthNotifier(super.initialState);

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
}

class TestUsersNotifier extends StateNotifier<UsersState>
    implements UsersNotifier {
  TestUsersNotifier(super.initialState);

  @override
  Future<void> loadUsers({bool showLoading = true}) async {}

  @override
  void setSearchQuery(String query) {
    if (state is UsersLoaded) {
      state = (state as UsersLoaded).copyWith(searchQuery: query);
    }
  }

  @override
  void setStatusFilter(UserStatusFilter filter) {
    if (state is UsersLoaded) {
      state = (state as UsersLoaded).copyWith(statusFilter: filter);
    }
  }

  @override
  void clearMessages() {}

  @override
  Future<bool> createUser(CreateUserRequest request) async => true;

  @override
  Future<bool> updateUser(String id, UpdateUserRequest request) async => true;

  @override
  Future<bool> toggleUserStatus(String id) async => true;
}

void main() {
  const ownerAuth = AuthUser(
    id: 'owner-id',
    fullName: 'Owner User',
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

  const viewOnlyAuth = AuthUser(
    id: 'staff-id',
    fullName: 'Staff User',
    username: 'staff',
    role: 'Staff',
    isOwner: false,
    permissions: ['users.view'],
  );

  const unauthorizedAuth = AuthUser(
    id: 'unauth-id',
    fullName: 'Limited User',
    username: 'limited',
    role: 'Guest',
    isOwner: false,
    permissions: [],
  );

  final sampleUsers = [
    UserModel(
      id: 'owner-id',
      fullName: 'Owner User',
      username: 'admin',
      role: 'Owner',
      isActive: true,
      createdAt: DateTime.now(),
    ),
    UserModel(
      id: 'mgr-1',
      fullName: 'Ramesh Manager',
      username: 'ramesh',
      email: 'ramesh@e6carspa.com',
      role: 'Manager',
      isActive: true,
      createdAt: DateTime.now(),
      permissions: const ['customers.view', 'jobcards.view'],
    ),
    UserModel(
      id: 'stf-1',
      fullName: 'Priya Staff',
      username: 'priya',
      email: 'priya@e6carspa.com',
      role: 'Staff',
      isActive: false,
      createdAt: DateTime.now(),
      permissions: const ['jobcards.view'],
    ),
  ];

  final samplePermissions = [
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

  Widget createTestWidget({
    required AuthUser user,
    UsersState usersState = const UsersInitial(),
  }) {
    return ProviderScope(
      overrides: [
        authNotifierProvider.overrideWith(
          (ref) => TestAuthNotifier(Authenticated(user)),
        ),
        usersNotifierProvider.overrideWith(
          (ref) => TestUsersNotifier(usersState),
        ),
      ],
      child: const MaterialApp(
        home: UsersScreen(),
      ),
    );
  }

  group('UsersScreen Widget Tests', () {
    testWidgets('Renders Access Restricted when user lacks users.view',
        (tester) async {
      await tester.pumpWidget(createTestWidget(user: unauthorizedAuth));
      await tester.pumpAndSettle();

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(
        find.textContaining('You do not have permission to view or manage user accounts'),
        findsOneWidget,
      );
    });

    testWidgets('Renders loading state', (tester) async {
      await tester.pumpWidget(
        createTestWidget(
          user: ownerAuth,
          usersState: const UsersLoading(),
        ),
      );
      await tester.pump();

      expect(find.text('Loading users and permissions...'), findsOneWidget);
    });

    testWidgets('Renders error state with retry button', (tester) async {
      await tester.pumpWidget(
        createTestWidget(
          user: ownerAuth,
          usersState: const UsersError('Network timeout'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Failed to Load Users'), findsOneWidget);
      expect(find.text('Network timeout'), findsOneWidget);
    });

    testWidgets('Renders KPI metrics, user cards, and Add User FAB for Owner',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final loadedState = UsersLoaded(
        users: sampleUsers,
        permissionGroups: samplePermissions,
      );

      await tester.pumpWidget(
        createTestWidget(
          user: ownerAuth,
          usersState: loadedState,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Total Users'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('Active'), findsWidgets);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('Inactive'), findsWidgets);
      expect(find.text('1'), findsOneWidget);
      expect(find.text('Active (2)'), findsOneWidget);
      expect(find.text('Inactive (1)'), findsOneWidget);

      expect(find.byType(UserCard), findsNWidgets(3));
      expect(find.text('Ramesh Manager'), findsOneWidget);
      expect(find.text('Priya Staff'), findsOneWidget);

      expect(find.text('Add User'), findsOneWidget);
    });

    testWidgets('Hides Add User FAB for view-only user', (tester) async {
      final loadedState = UsersLoaded(
        users: sampleUsers,
        permissionGroups: samplePermissions,
      );

      await tester.pumpWidget(
        createTestWidget(
          user: viewOnlyAuth,
          usersState: loadedState,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Add User'), findsNothing);
    });

    testWidgets('Search query filters users dynamically', (tester) async {
      final loadedState = UsersLoaded(
        users: sampleUsers,
        permissionGroups: samplePermissions,
        searchQuery: 'priya',
      );

      await tester.pumpWidget(
        createTestWidget(
          user: ownerAuth,
          usersState: loadedState,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(UserCard), findsOneWidget);
      expect(find.text('Priya Staff'), findsOneWidget);
      expect(find.text('Ramesh Manager'), findsNothing);
    });
  });
}
