import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/navigation/app_router.dart';
import 'features/auth/providers/auth_provider.dart';
import 'core/theme/brand_palette.dart';
import 'features/settings/data/settings_repository.dart';
import 'features/settings/providers/settings_provider.dart';
import 'features/settings/providers/system_preferences_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SettingsRepository.applyCachedBrandColours();
  runApp(const ProviderScope(child: E6CarSpaApp()));
}

class E6CarSpaApp extends ConsumerStatefulWidget {
  const E6CarSpaApp({super.key});

  @override
  ConsumerState<E6CarSpaApp> createState() => _E6CarSpaAppState();
}

class _E6CarSpaAppState extends ConsumerState<E6CarSpaApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(() {
      if (mounted) {
        ref.read(systemPreferencesNotifierProvider.notifier).loadPreferences();
        // Fetch the company's current colours (public endpoint, safe before sign-in).
        ref.read(settingsNotifierProvider.notifier).loadPublicProfile();
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref
          .read(authNotifierProvider.notifier)
          .revalidateAuthState(onResume: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    // The company's colours drive the whole theme. When they change, the app is rebuilt under a new key so every
    // screen picks the new colours up.
    final profile = ref.watch(businessProfileProvider);
    BrandPalette.apply(
      appHex: profile?.appColor,
      sidebarHex: profile?.sidebarColor,
    );

    return MaterialApp.router(
      key: ValueKey('${profile?.appColor}|${profile?.sidebarColor}'),
      title: 'Car Spa Management',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: router,
    );
  }
}
