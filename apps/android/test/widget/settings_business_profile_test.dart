import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/settings/data/settings_api.dart';
import 'package:e6_car_spa/features/settings/data/settings_repository.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/models/update_business_profile_request.dart';
import 'package:e6_car_spa/features/settings/presentation/pages/settings_screen.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:e6_car_spa/shared/widgets/app_error_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class MockSettingsRepository extends SettingsRepository {
  MockSettingsRepository() : super(SettingsApi(Dio()));

  BusinessProfileModel? profileToReturn;
  bool shouldThrow = false;
  String? updateError;
  int updateCalls = 0;
  int getCalls = 0;

  @override
  Future<BusinessProfileModel?> getCachedBusinessProfile() async => null;

  @override
  Future<BusinessProfileModel> getBusinessProfile() async {
    getCalls++;
    if (shouldThrow) {
      throw const ApiException(message: 'Failed to load business profile. Server unreachable.');
    }
    return profileToReturn!;
  }

  @override
  Future<BusinessProfileModel> updateBusinessProfile(UpdateBusinessProfileRequest request) async {
    updateCalls++;
    if (updateError != null) {
      throw ApiException(message: updateError!);
    }
    final updated = BusinessProfileModel(
      id: profileToReturn?.id ?? 'profile-1',
      businessName: request.businessName,
      addressLine1: request.addressLine1,
      addressLine2: request.addressLine2,
      city: request.city,
      state: request.state,
      postalCode: request.postalCode,
      phone: request.phone,
      email: request.email,
      gstin: request.gstin,
      invoicePrefix: request.invoicePrefix ?? profileToReturn?.invoicePrefix ?? 'INV',
      termsAndConditions: request.termsAndConditions,
      logoPath: profileToReturn?.logoPath,
    );
    profileToReturn = updated;
    return updated;
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
  const managerUser = AuthUser(
    id: 'user-admin',
    fullName: 'Owner Admin',
    username: 'admin',
    role: 'Owner',
    isOwner: true,
    permissions: ['settings.view', 'settings.business'],
  );

  const initialProfile = BusinessProfileModel(
    id: 'e6-profile-1',
    businessName: 'E6 Car Spa',
    addressLine1: '36, Geetha Nagar Main Road',
    addressLine2: 'Behind Sakthi Mahal',
    city: 'Erode',
    state: 'Tamil Nadu',
    postalCode: '638011',
    phone: '9578749449',
    email: 'e6carspaerd@gmail.com',
    gstin: '33AAAAA0000A1Z5',
    invoicePrefix: 'INV',
    termsAndConditions: 'Payment due within 7 days.',
  );

  group('Business Profile Validations', () {
    testWidgets('Validates 10-digit Indian phone number', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockSettingsRepository()..profileToReturn = initialProfile;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            settingsRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find phone number field (index 1: 0 is Name, 1 is Phone, 2 is Email)
      final phoneInput = find.byType(TextFormField).at(1);
      expect(phoneInput, findsOneWidget);

      // Clear phone number -> should show required
      await tester.enterText(phoneInput, '');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Save Settings'));
      await tester.pumpAndSettle();

      expect(find.text('Phone number is required'), findsOneWidget);

      // Enter invalid phone (less than 10 digits)
      await tester.enterText(phoneInput, '95787');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Save Settings'));
      await tester.pumpAndSettle();

      expect(find.text('Phone number must be exactly 10 digits'), findsOneWidget);
    });

    testWidgets('Validates GSTIN format with 15-character Indian GST regex', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockSettingsRepository()..profileToReturn = initialProfile;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            settingsRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find GSTIN field with '33AAAAA0000A1Z5'
      final gstinFinder = find.widgetWithText(TextFormField, '33AAAAA0000A1Z5');
      expect(gstinFinder, findsOneWidget);

      // Enter invalid GSTIN
      await tester.enterText(gstinFinder, 'INVALID_GSTIN_123');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Save Settings'));
      await tester.pumpAndSettle();

      expect(find.text('Invalid GSTIN format (e.g. 33AAAAA0000A1Z5)'), findsOneWidget);
    });

    testWidgets('Validates invoice prefix max 10 characters', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockSettingsRepository()..profileToReturn = initialProfile;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            settingsRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find prefix field with 'INV'
      final prefixFinder = find.widgetWithText(TextFormField, 'INV');
      expect(prefixFinder, findsOneWidget);

      // Enter prefix > 10 chars
      await tester.enterText(prefixFinder, 'TOOLONGPREFIX123');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Save Settings'));
      await tester.pumpAndSettle();

      expect(find.text('Prefix cannot exceed 10 characters'), findsOneWidget);
    });
  });

  group('Business Profile Save & Preservation', () {
    testWidgets('Preserves form input and displays error banner when update fails', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockSettingsRepository()
        ..profileToReturn = initialProfile
        ..updateError = 'API 400: GSTIN registration state mismatch for Tamil Nadu';

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            settingsRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Modify business name
      final nameFinder = find.widgetWithText(TextFormField, 'E6 Car Spa');
      await tester.enterText(nameFinder, 'E6 Elite Detailing Spa');
      await tester.pumpAndSettle();

      // Tap Save
      await tester.tap(find.widgetWithText(AppButton, 'Save Settings'));
      await tester.pumpAndSettle();

      // Error banner rendered
      expect(find.text('API 400: GSTIN registration state mismatch for Tamil Nadu'), findsOneWidget);
      // User input preserved
      expect(find.text('E6 Elite Detailing Spa'), findsOneWidget);
      expect(mockRepo.updateCalls, 1);
    });

    testWidgets('Successful save updates profile and shows success feedback', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockSettingsRepository()..profileToReturn = initialProfile;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            settingsRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Modify business name
      final nameFinder = find.widgetWithText(TextFormField, 'E6 Car Spa');
      await tester.enterText(nameFinder, 'E6 Auto Spa Private Limited');
      await tester.pumpAndSettle();

      // Tap Save
      await tester.tap(find.widgetWithText(AppButton, 'Save Settings'));
      await tester.pumpAndSettle();

      expect(mockRepo.updateCalls, 1);
      expect(find.text('Business profile and invoice settings saved successfully.'), findsWidgets);
      expect(find.text('E6 Auto Spa Private Limited'), findsOneWidget);
    });

    testWidgets('Displays error state when getBusinessProfile throws and allows retry', (tester) async {
      final mockRepo = MockSettingsRepository()..shouldThrow = true;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            settingsRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(AppErrorState), findsOneWidget);
      expect(find.text('Failed to load business profile. Server unreachable.'), findsOneWidget);

      // Fix repository and tap retry
      mockRepo.shouldThrow = false;
      mockRepo.profileToReturn = initialProfile;

      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();

      expect(find.byType(AppErrorState), findsNothing);
      expect(find.text('Business Details'), findsOneWidget);
      expect(find.text('E6 Car Spa'), findsWidgets);
    });
  });
}
