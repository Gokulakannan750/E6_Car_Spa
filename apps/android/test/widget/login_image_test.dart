import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/login_screen.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/providers/settings_provider.dart';
import 'package:e6_car_spa/features/settings/providers/settings_state.dart';

class _StubAuthRepo extends AuthRepository {
  _StubAuthRepo() : super(AuthApi(Dio()), const AuthTokenStorage());

  @override
  Future<AuthUser?> restoreSession() async => null;
}

class _LoggedOut extends AuthNotifier {
  _LoggedOut(super.repo) {
    state = const Unauthenticated();
  }

  @override
  Future<void> restoreSession() async {}
}

class _FakeSettings extends StateNotifier<SettingsState>
    implements SettingsNotifier {
  _FakeSettings(super.initialState);

  @override
  Future<void> loadProfile() async {}

  @override
  Future<void> loadPublicProfile() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Widget login(BusinessProfileModel profile) {
    final repo = _StubAuthRepo();
    return ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(repo),
        authNotifierProvider.overrideWith((ref) => _LoggedOut(repo)),
        settingsNotifierProvider.overrideWith(
          (ref) => _FakeSettings(SettingsLoaded(profile: profile)),
        ),
      ],
      child: MaterialApp(theme: AppTheme.light, home: const LoginScreen()),
    );
  }

  const base = BusinessProfileModel(
    id: 'p-1',
    businessName: 'Sunrise Detailing',
    addressLine1: '12 Park Road',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
    phone: '9123456789',
    email: 'hello@sunrise.example',
  );

  testWidgets('shows a plain colour background when no picture is uploaded', (
    tester,
  ) async {
    await tester.pumpWidget(login(base));
    await tester.pump();

    expect(find.text('SUNRISE DETAILING', skipOffstage: false), findsNothing);
    expect(find.byKey(const Key('login_background_image')), findsNothing);
  });

  testWidgets('shows the company\'s own picture behind the sign-in form', (
    tester,
  ) async {
    await tester.pumpWidget(
      login(base.copyWith(loginImagePath: '/uploads/login/login_abc.png')),
    );
    await tester.pump();

    final image = tester.widget<Image>(
      find.byKey(const Key('login_background_image')),
    );
    final provider = image.image as NetworkImage;
    expect(provider.url, contains('/uploads/login/login_abc.png'));
    // The form is still there on top of it.
    expect(find.text('Sunrise Detailing'), findsWidgets);
  });
}
