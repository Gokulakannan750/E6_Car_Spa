import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/presentation/pages/settings_screen.dart';
import 'package:e6_car_spa/features/settings/presentation/widgets/business_logo_card.dart';
import 'package:e6_car_spa/features/settings/presentation/widgets/business_info_card.dart';
import 'package:e6_car_spa/features/settings/presentation/widgets/address_info_card.dart';
import 'package:e6_car_spa/features/settings/presentation/widgets/invoice_config_card.dart';
import 'package:e6_car_spa/features/settings/providers/settings_provider.dart';
import 'package:e6_car_spa/features/settings/providers/settings_state.dart';
import 'package:e6_car_spa/features/settings/data/settings_repository.dart';
import 'package:e6_car_spa/features/settings/data/settings_api.dart';
import 'package:dio/dio.dart';

class FakeSettingsRepository extends SettingsRepository {
  FakeSettingsRepository() : super(SettingsApi(Dio()));

  BusinessProfileModel profile = const BusinessProfileModel(
    id: 'test-id',
    businessName: 'E6 Car Spa',
    addressLine1: '36, Geetha Nagar Main Road',
    addressLine2: 'Behind Sakthi Mahal',
    city: 'Erode',
    state: 'Tamil Nadu',
    postalCode: '638011',
    phone: '+91 9578749449',
    email: 'e6carspaerd@gmail.com',
    gstin: '33AAAAA0000A1Z5',
    invoicePrefix: 'INV',
  );

  @override
  Future<BusinessProfileModel> getBusinessProfile() async {
    return profile;
  }
}

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

void main() {
  const managerUser = AuthUser(
    id: 'mgr-1',
    fullName: 'Owner User',
    username: 'admin',
    role: 'Owner',
    isOwner: true,
    permissions: ['settings.view', 'settings.business'],
  );

  const staffUser = AuthUser(
    id: 'stf-1',
    fullName: 'Staff User',
    username: 'staff',
    role: 'Staff',
    isOwner: false,
    permissions: ['settings.view'],
  );

  const unauthorizedUser = AuthUser(
    id: 'unauth-1',
    fullName: 'Limited User',
    username: 'limited',
    role: 'Guest',
    isOwner: false,
    permissions: [],
  );

  Widget createTestWidget({
    required AuthUser user,
    SettingsState settingsState = const SettingsInitial(),
  }) {
    return ProviderScope(
      overrides: [
        authNotifierProvider.overrideWith(
          (ref) => TestAuthNotifier(Authenticated(user)),
        ),
        settingsNotifierProvider.overrideWith(
          (ref) => StateControllerNotifier(settingsState),
        ),
      ],
      child: const MaterialApp(
        home: SettingsScreen(),
      ),
    );
  }

  group('SettingsScreen Widget Tests', () {
    testWidgets('Renders restricted access message when user lacks settings.view',
        (tester) async {
      await tester.pumpWidget(createTestWidget(user: unauthorizedUser));
      await tester.pumpAndSettle();

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(
        find.textContaining('You do not have permission to view Business Settings'),
        findsOneWidget,
      );
    });

    testWidgets('Renders loading state when settings are loading',
        (tester) async {
      await tester.pumpWidget(
        createTestWidget(
          user: managerUser,
          settingsState: const SettingsLoading(),
        ),
      );
      await tester.pump();

      expect(find.text('Loading business profile...'), findsOneWidget);
    });

    testWidgets('Renders form cards with populated values for Manager/Owner',
        (tester) async {
      const profile = BusinessProfileModel(
        id: '123',
        businessName: 'E6 Car Spa',
        addressLine1: '36, Geetha Nagar',
        city: 'Erode',
        state: 'Tamil Nadu',
        postalCode: '638011',
        phone: '+91 9578749449',
        email: 'e6carspaerd@gmail.com',
        gstin: '33AAAAA0000A1Z5',
      );

      await tester.pumpWidget(
        createTestWidget(
          user: managerUser,
          settingsState: const SettingsLoaded(profile: profile),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(BusinessLogoCard), findsOneWidget);
      expect(find.byType(BusinessInfoCard), findsOneWidget);
      expect(find.byType(AddressInfoCard), findsOneWidget);
      expect(find.byType(InvoiceConfigCard), findsOneWidget);

      expect(find.text('Save Settings'), findsOneWidget);
      expect(find.text('E6 Car Spa'), findsWidgets);
      expect(find.text('+91 9578749449'), findsOneWidget);
    });

    testWidgets('Shows View-Only banner and hides Save button for view-only staff',
        (tester) async {
      const profile = BusinessProfileModel(
        id: '123',
        businessName: 'E6 Car Spa',
        addressLine1: '36, Geetha Nagar',
        city: 'Erode',
        state: 'Tamil Nadu',
        postalCode: '638011',
        phone: '+91 9578749449',
        email: 'e6carspaerd@gmail.com',
      );

      await tester.pumpWidget(
        createTestWidget(
          user: staffUser,
          settingsState: const SettingsLoaded(profile: profile),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('View-Only Mode'), findsOneWidget);
      expect(find.text('Save Settings'), findsNothing);
    });

    testWidgets('Displays success banner when successMessage is present',
        (tester) async {
      const profile = BusinessProfileModel(
        id: '123',
        businessName: 'E6 Car Spa',
        addressLine1: '36, Geetha Nagar',
        city: 'Erode',
        state: 'Tamil Nadu',
        postalCode: '638011',
        phone: '+91 9578749449',
        email: 'e6carspaerd@gmail.com',
      );

      await tester.pumpWidget(
        createTestWidget(
          user: managerUser,
          settingsState: const SettingsLoaded(
            profile: profile,
            successMessage: 'Settings updated successfully!',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Settings updated successfully!'), findsOneWidget);
    });
  });
}

class StateControllerNotifier extends StateNotifier<SettingsState>
    implements SettingsNotifier {
  StateControllerNotifier(super.initialState);

  @override
  Future<void> loadProfile() async {}

  @override
  Future<bool> updateProfile(dynamic request) async => true;

  @override
  Future<bool> uploadLogo({required List<int> bytes, required String filename}) async =>
      true;

  @override
  Future<bool> removeLogo() async => true;

  @override
  void clearMessages() {}
}
