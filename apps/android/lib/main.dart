import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/navigation/app_router.dart';
import 'features/settings/providers/system_preferences_provider.dart';

void main() {
  runApp(const ProviderScope(child: E6CarSpaApp()));
}

class E6CarSpaApp extends ConsumerStatefulWidget {
  const E6CarSpaApp({super.key});

  @override
  ConsumerState<E6CarSpaApp> createState() => _E6CarSpaAppState();
}

class _E6CarSpaAppState extends ConsumerState<E6CarSpaApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted) {
        ref.read(systemPreferencesNotifierProvider.notifier).loadPreferences();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'E6 Car Spa',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: router,
    );
  }
}
