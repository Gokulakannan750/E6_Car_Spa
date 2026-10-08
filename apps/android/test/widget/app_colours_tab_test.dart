import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/theme/brand_palette.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/presentation/widgets/app_colours_tab.dart';
import 'package:e6_car_spa/features/settings/providers/settings_provider.dart';
import 'package:e6_car_spa/features/settings/providers/settings_state.dart';

class _TestAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  _TestAuthNotifier(super.initialState);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeSettingsNotifier extends StateNotifier<SettingsState>
    implements SettingsNotifier {
  _FakeSettingsNotifier(super.initialState);

  Map<String, String?>? saved;

  @override
  Future<bool> updateAppearance({
    String? appColor,
    String? sidebarColor,
    String? brandColor,
  }) async {
    saved = {
      'app': appColor,
      'sidebar': sidebarColor,
      'document': brandColor,
    };
    return true;
  }

  @override
  Future<void> loadProfile() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const owner = AuthUser(
    id: 'o-1',
    fullName: 'Owner',
    username: 'owner',
    role: 'Owner',
    isOwner: true,
    permissions: ['settings.view', 'settings.business'],
  );
  const viewer = AuthUser(
    id: 'v-1',
    fullName: 'Viewer',
    username: 'viewer',
    role: 'Staff',
    isOwner: false,
    permissions: ['settings.view'],
  );

  const profile = BusinessProfileModel(
    id: 'p-1',
    businessName: 'Sunrise Detailing',
    addressLine1: '12 Park Road',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
    phone: '9123456789',
    email: 'hello@sunrise.example',
    appColor: '#0F766E',
    sidebarColor: null,
    brandColor: '#A11A1A',
  );

  late _FakeSettingsNotifier notifier;

  Widget build(AuthUser user) {
    notifier = _FakeSettingsNotifier(const SettingsLoaded(profile: profile));
    return ProviderScope(
      overrides: [
        authNotifierProvider.overrideWith(
          (ref) => _TestAuthNotifier(Authenticated(user)),
        ),
        settingsNotifierProvider.overrideWith((ref) => notifier),
      ],
      child: const MaterialApp(home: Scaffold(body: AppColoursTab())),
    );
  }

  Color swatch(WidgetTester tester, String key) {
    final box =
        tester.widget<Container>(find.byKey(Key(key))).decoration
            as BoxDecoration;
    return box.color!;
  }

  setUp(() => BrandPalette.apply());

  // A tall screen, so the whole list (colour card and preview) is built at once.
  void useTallScreen(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 3200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('shows the saved colours and a live preview', (tester) async {
    useTallScreen(tester);
    await tester.pumpWidget(build(owner));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextField, '#0F766E'), findsOneWidget);
    expect(find.widgetWithText(TextField, '#A11A1A'), findsOneWidget);
    expect(find.byKey(const Key('colour_preview')), findsOneWidget);
    expect(find.text('SUNRISE DETAILING'), findsOneWidget);
  });

  testWidgets('picking colours repaints the preview before saving', (
    tester,
  ) async {
    useTallScreen(tester);
    await tester.pumpWidget(build(owner));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('app_colour_field')),
      '#7C3AED',
    );
    await tester.enterText(
      find.byKey(const Key('sidebar_colour_field')),
      '#BE185D',
    );
    await tester.pump();

    expect(swatch(tester, 'app_colour_swatch'), const Color(0xFF7C3AED));
    expect(swatch(tester, 'sidebar_colour_swatch'), const Color(0xFFBE185D));

    final button = tester.widget<Container>(
      find.byKey(const Key('preview_button')),
    );
    expect((button.decoration as BoxDecoration).color, const Color(0xFF7C3AED));
    final signIn = tester.widget<Container>(
      find.byKey(const Key('preview_signin')),
    );
    expect((signIn.decoration as BoxDecoration).color, const Color(0xFFBE185D));
  });

  testWidgets('saves all three colours, sending an empty value to clear one', (
    tester,
  ) async {
    useTallScreen(tester);
    await tester.pumpWidget(build(owner));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('sidebar_colour_field')),
      '#112233',
    );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const Key('save_colours_button')));
    await tester.tap(find.byKey(const Key('save_colours_button')));
    await tester.pumpAndSettle();

    expect(notifier.saved, {
      'app': '#0F766E',
      'sidebar': '#112233',
      'document': '#A11A1A',
    });
  });

  testWidgets('rejects a malformed colour code', (tester) async {
    useTallScreen(tester);
    await tester.pumpWidget(build(owner));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('app_colour_field')), '#12');
    await tester.pump();

    expect(find.text('Use a code like #1E293B'), findsOneWidget);
    final save = tester.widget<ElevatedButton>(
      find.descendant(
        of: find.byKey(const Key('save_colours_button')),
        matching: find.byType(ElevatedButton),
      ),
    );
    expect(save.onPressed, isNull);
  });

  testWidgets('is read-only without the settings.business permission', (
    tester,
  ) async {
    useTallScreen(tester);
    await tester.pumpWidget(build(viewer));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('save_colours_button')), findsNothing);
    expect(find.textContaining('Only an owner or administrator'), findsOneWidget);
  });
}
