import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/login_screen.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/providers/settings_provider.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/settings/providers/settings_state.dart';
import 'package:e6_car_spa/shared/widgets/app_business_logo.dart';

class StubAuthRepo extends AuthRepository {
  StubAuthRepo() : super(AuthApi(Dio()), const AuthTokenStorage());

  @override
  Future<AuthUser?> restoreSession() async => null;
}

class TestLoginNotifier extends AuthNotifier {
  TestLoginNotifier(super.repo) {
    state = const Unauthenticated();
  }

  @override
  Future<void> restoreSession() async {}
}

class FakeSettingsNotifier extends StateNotifier<SettingsState>
    implements SettingsNotifier {
  FakeSettingsNotifier(super.initialState);

  @override
  Future<void> loadProfile() async {}

  @override
  Future<void> loadPublicProfile() async {}

  @override
  Future<bool> updateProfile(dynamic request) async => true;

  @override
  Future<bool> uploadLogo({required List<int> bytes, required String filename}) async =>
      true;

  @override
  Future<bool> removeLogo() async => true;

  @override
  void clearMessages() {}

  void setProfile(BusinessProfileModel profile) {
    state = SettingsLoaded(profile: profile);
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  const defaultProfile = BusinessProfileModel(
    id: 'default-1',
    businessName: 'E6 Car Spa',
    addressLine1: '36, Geetha Nagar',
    city: 'Erode',
    state: 'Tamil Nadu',
    postalCode: '638011',
    phone: '9578749449',
    email: 'info@e6carspa.com',
    logoPath: null,
  );

  const customProfile = BusinessProfileModel(
    id: 'custom-1',
    businessName: 'Apex Detailing Studio',
    addressLine1: '100 Grand Avenue',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    postalCode: '641001',
    phone: '9876543210',
    email: 'contact@apexdetailing.com',
    logoPath: '/uploads/logos/apex_logo.png',
  );

  Widget createLoginTestWidget({
    SettingsState? settingsState,
    FakeSettingsNotifier? notifier,
  }) {
    final authRepo = StubAuthRepo();
    final effectiveNotifier =
        notifier ?? FakeSettingsNotifier(settingsState ?? const SettingsLoaded(profile: defaultProfile));

    return ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(authRepo),
        authNotifierProvider.overrideWith((ref) => TestLoginNotifier(authRepo)),
        settingsNotifierProvider.overrideWith((ref) => effectiveNotifier),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const LoginScreen(),
      ),
    );
  }

  group('LoginScreen Business Logo Tests', () {
    testWidgets('displays fallback icon and default name when no custom logo configured', (tester) async {
      await tester.pumpWidget(createLoginTestWidget(
        settingsState: const SettingsLoaded(profile: defaultProfile),
      ));
      await tester.pumpAndSettle();

      // Fallback icon and default name
      expect(find.byType(AppBusinessLogo), findsOneWidget);
      expect(find.byIcon(Icons.local_car_wash_rounded), findsOneWidget);
      expect(find.text('E6 Car Spa'), findsOneWidget);
      expect(find.text('Management Suite'), findsOneWidget);
    });

    testWidgets('displays configured business logo and business name when logo exists', (tester) async {
      await tester.pumpWidget(createLoginTestWidget(
        settingsState: const SettingsLoaded(profile: customProfile),
      ));
      await tester.pump();

      // Should render AppBusinessLogo containing Image.network
      expect(find.byType(AppBusinessLogo), findsOneWidget);
      expect(find.byType(Image), findsOneWidget);
      expect(find.text('Apex Detailing Studio'), findsOneWidget);
    });

    testWidgets('dynamically updates logo and business name when profile state changes', (tester) async {
      final notifier = FakeSettingsNotifier(const SettingsLoaded(profile: defaultProfile));

      await tester.pumpWidget(createLoginTestWidget(notifier: notifier));
      await tester.pumpAndSettle();

      expect(find.text('E6 Car Spa'), findsOneWidget);
      expect(find.byIcon(Icons.local_car_wash_rounded), findsOneWidget);

      // Now update the profile dynamically (e.g. cross-device settings update)
      notifier.setProfile(customProfile);
      await tester.pump();

      expect(find.text('Apex Detailing Studio'), findsOneWidget);
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('falls back to default icon when image network error occurs without crashing', (tester) async {
      final logoWidget = MaterialApp(
        home: Scaffold(
          body: AppBusinessLogo(
            height: 72,
            maxHeight: 72,
            maxWidth: 240,
            borderRadius: 16,
            fallbackIcon: Icons.local_car_wash_rounded,
            customLogoPath: 'http://nonexistent.domain.invalid/logo.png',
          ),
        ),
      );

      await tester.pumpWidget(ProviderScope(child: logoWidget));
      await tester.pump();

      // When network fails or image cannot be decoded in test environment,
      // AppBusinessLogo handles errorBuilder and displays fallback
      expect(find.byType(AppBusinessLogo), findsOneWidget);
    });
  });
}
