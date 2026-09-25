import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/providers/settings_provider.dart';
import 'package:e6_car_spa/features/settings/providers/settings_state.dart';
import 'package:e6_car_spa/features/settings/presentation/pages/settings_screen.dart';
import 'package:e6_car_spa/features/settings/presentation/pages/company_settings_screen.dart';
import 'package:e6_car_spa/features/settings/presentation/pages/system_preferences_screen.dart';
import 'package:e6_car_spa/features/users/models/permission_model.dart';
import 'package:e6_car_spa/features/users/models/user_model.dart';
import 'package:e6_car_spa/features/users/presentation/pages/users_screen.dart';
import 'package:e6_car_spa/features/users/providers/users_provider.dart';
import 'package:e6_car_spa/features/users/providers/users_state.dart';

class FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  FakeAuthNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeSettingsNotifier extends StateNotifier<SettingsState>
    implements SettingsNotifier {
  FakeSettingsNotifier(super.state);

  @override
  Future<void> loadProfile() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeUsersNotifier extends StateNotifier<UsersState>
    implements UsersNotifier {
  FakeUsersNotifier(super.state);

  @override
  Future<void> loadUsers({bool showLoading = true}) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const ownerUser = AuthUser(
    id: 'owner-1',
    username: 'owner',
    fullName: 'E6 Owner',
    email: 'owner@e6carspa.com',
    role: 'Owner',
    isOwner: true,
    permissions: [],
  );

  const settingsOnlyUser = AuthUser(
    id: 'settings-user',
    username: 'settings_user',
    fullName: 'Settings User',
    email: 'settings@e6carspa.com',
    role: 'Staff',
    isOwner: false,
    permissions: ['settings.view'],
  );

  const usersOnlyUser = AuthUser(
    id: 'users-user',
    username: 'users_user',
    fullName: 'Users User',
    email: 'users@e6carspa.com',
    role: 'Staff',
    isOwner: false,
    permissions: ['users.view'],
  );

  const unauthorizedUser = AuthUser(
    id: 'unauth-user',
    username: 'unauth_user',
    fullName: 'Unauth User',
    email: 'unauth@e6carspa.com',
    role: 'Staff',
    isOwner: false,
    permissions: [],
  );

  const sampleProfile = BusinessProfileModel(
    id: 'test-profile-1',
    businessName: 'E6 Car Spa',
    addressLine1: '36, Geetha Nagar',
    city: 'Erode',
    state: 'Tamil Nadu',
    postalCode: '638011',
    phone: '9578749449',
    email: 'e6carspaerd@gmail.com',
    gstin: '33AAAAA0000A1Z5',
    invoicePrefix: 'INV',
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
  ];

  GoRouter createTestRouter({String initialLocation = AppRoutes.settings}) {
    return GoRouter(
      initialLocation: initialLocation,
      routes: [
        GoRoute(
          path: AppRoutes.dashboard,
          builder: (context, state) => const Scaffold(
            body: Text('Level-1 Suite Launcher Dashboard'),
          ),
        ),
        GoRoute(
          path: AppRoutes.settings,
          builder: (context, state) => const SettingsScreen(),
          routes: [
            GoRoute(
              path: 'company',
              builder: (context, state) => const CompanySettingsScreen(),
            ),
            GoRoute(
              path: 'users',
              builder: (context, state) => const UsersScreen(),
            ),
            GoRoute(
              path: 'preferences',
              builder: (context, state) => const SystemPreferencesScreen(),
            ),
          ],
        ),
      ],
    );
  }

  Widget createTestApp({
    required AuthUser user,
    GoRouter? router,
  }) {
    return ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(user),
        authNotifierProvider.overrideWith(
          (ref) => FakeAuthNotifier(Authenticated(user)),
        ),
        settingsNotifierProvider.overrideWith(
          (ref) => FakeSettingsNotifier(const SettingsLoaded(profile: sampleProfile)),
        ),
        usersNotifierProvider.overrideWith(
          (ref) => FakeUsersNotifier(UsersLoaded(
            users: sampleUsers,
            permissionGroups: const [
              PermissionGroupModel(
                module: 'Settings',
                permissions: [
                  PermissionModel(
                    id: 'p1',
                    code: 'settings.view',
                    name: 'View Settings',
                    module: 'Settings',
                  ),
                ],
              ),
            ],
          )),
        ),
      ],
      child: MaterialApp.router(
        routerConfig: router ?? createTestRouter(),
      ),
    );
  }

  group('Settings Level-2 Workspace Tests', () {
    testWidgets('1-7: Workspace opens, displays headers, cards, and NO WhatsApp',
        (tester) async {
      await tester.pumpWidget(createTestApp(user: ownerUser));
      await tester.pumpAndSettle();

      // 1. Settings workspace opens
      expect(find.byType(SettingsScreen), findsOneWidget);

      // 2. Header contains "E6 Settings"
      expect(find.text('E6 Settings'), findsOneWidget);

      // 3. Header contains "Level-2 Workspace"
      expect(find.text('Level-2 Workspace'), findsOneWidget);

      // 4. Company Settings card exists
      expect(find.text('Company Settings'), findsOneWidget);
      expect(find.text('Business profile & invoices'), findsOneWidget);

      // 5. Users & Access card exists when authorized
      expect(find.text('Users & Access'), findsOneWidget);
      expect(find.text('Users, roles & permissions'), findsOneWidget);

      // 6. System Preferences card exists
      expect(find.text('System Preferences'), findsOneWidget);
      expect(find.text('Display & application settings'), findsOneWidget);

      // 7. WhatsApp Settings does NOT exist
      expect(find.textContaining('WhatsApp'), findsNothing);
      expect(find.textContaining('whatsapp'), findsNothing);

      // Verify no bottom navigation bar
      expect(find.byType(BottomNavigationBar), findsNothing);
    });

    testWidgets('8. Company Settings navigation works and back returns to Settings',
        (tester) async {
      final router = createTestRouter();
      await tester.pumpWidget(createTestApp(user: ownerUser, router: router));
      await tester.pumpAndSettle();

      // Tap Company Settings card
      await tester.tap(find.byKey(const Key('settings_tile_Company Settings')));
      await tester.pumpAndSettle();

      // Company Settings opens
      expect(find.byType(CompanySettingsScreen), findsOneWidget);
      expect(find.text('Business Profile & Invoices'), findsOneWidget);

      // 11. Child back returns to Settings workspace
      await tester.tap(find.byKey(const Key('company_settings_back_button')));
      await tester.pumpAndSettle();

      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.text('E6 Settings'), findsOneWidget);
    });

    testWidgets('9. Users & Access navigation works and child back returns to Settings',
        (tester) async {
      final router = createTestRouter();
      await tester.pumpWidget(createTestApp(user: ownerUser, router: router));
      await tester.pumpAndSettle();

      // Tap Users & Access card
      await tester.tap(find.byKey(const Key('settings_tile_Users & Access')));
      await tester.pumpAndSettle();

      // UsersScreen opens
      expect(find.byType(UsersScreen), findsOneWidget);
      expect(find.text('Users & Permissions'), findsOneWidget);

      // Tapping back button in UsersScreen returns to Settings
      final backButton = find.byKey(const Key('users_back_button'));
      await tester.tap(backButton);
      await tester.pumpAndSettle();

      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.text('E6 Settings'), findsOneWidget);
    });

    testWidgets('10. System Preferences navigation works and child back returns to Settings',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final router = createTestRouter();
      await tester.pumpWidget(createTestApp(user: ownerUser, router: router));
      await tester.pumpAndSettle();

      // Tap System Preferences card
      await tester.tap(find.byKey(const Key('settings_tile_System Preferences')));
      await tester.pumpAndSettle();

      // System Preferences opens
      expect(find.byType(SystemPreferencesScreen), findsOneWidget);
      expect(find.text('Display & Application Settings'), findsOneWidget);
      expect(find.text('Date & Time'), findsOneWidget);
      expect(find.text('Currency & Formatting'), findsOneWidget);
      expect(find.text('Document Printing'), findsOneWidget);
      expect(find.text('Application Behavior'), findsOneWidget);
      expect(find.text('System Diagnostics'), findsOneWidget);

      // Child back returns to Settings workspace
      await tester.tap(find.byKey(const Key('system_preferences_back_button')));
      await tester.pumpAndSettle();

      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.text('E6 Settings'), findsOneWidget);
    });

    testWidgets('12. Settings workspace back returns to /dashboard',
        (tester) async {
      final router = createTestRouter();
      await tester.pumpWidget(createTestApp(user: ownerUser, router: router));
      await tester.pumpAndSettle();

      // Tap settings back button
      await tester.tap(find.byKey(const Key('settings_back_button')));
      await tester.pumpAndSettle();

      expect(find.text('Level-1 Suite Launcher Dashboard'), findsOneWidget);
    });

    testWidgets('13. Android system back from Settings returns to /dashboard',
        (tester) async {
      final router = createTestRouter();
      await tester.pumpWidget(createTestApp(user: ownerUser, router: router));
      await tester.pumpAndSettle();

      // Trigger Android system back
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      expect(find.text('Level-1 Suite Launcher Dashboard'), findsOneWidget);
    });

    testWidgets('14a. User with settings.view only sees Company Settings and System Preferences',
        (tester) async {
      final router = createTestRouter();
      await tester.pumpWidget(createTestApp(user: settingsOnlyUser, router: router));
      await tester.pumpAndSettle();

      expect(find.text('Company Settings'), findsOneWidget);
      expect(find.text('System Preferences'), findsOneWidget);
      expect(find.text('Users & Access'), findsNothing);
    });

    testWidgets('14b. User with users.view only sees Users & Access',
        (tester) async {
      final router = createTestRouter();
      await tester.pumpWidget(createTestApp(user: usersOnlyUser, router: router));
      await tester.pumpAndSettle();

      expect(find.text('Users & Access'), findsOneWidget);
      expect(find.text('Company Settings'), findsNothing);
      expect(find.text('System Preferences'), findsNothing);
    });

    testWidgets('14c. Unauthorized user sees Access Restricted empty state',
        (tester) async {
      final router = createTestRouter();
      await tester.pumpWidget(createTestApp(user: unauthorizedUser, router: router));
      await tester.pumpAndSettle();

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(find.text('Company Settings'), findsNothing);
      expect(find.text('Users & Access'), findsNothing);
      expect(find.text('System Preferences'), findsNothing);
    });
  });
}
