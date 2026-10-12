import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/dio_client.dart';
import '../auth/providers/auth_provider.dart';
import '../auth/providers/auth_state.dart';
import 'plan_features.dart';

/// Loads GET /api/subscription/status. Null under `flutter test`, so widget
/// tests never call a server unless they provide their own loader.
final subscriptionStatusLoaderProvider =
    Provider<Future<SubscriptionStatus> Function()?>((ref) {
      if (Platform.environment.containsKey('FLUTTER_TEST')) return null;
      final dio = ref.watch(dioProvider);
      return () async {
        final response = await dio.get('/subscription/status');
        return SubscriptionStatus.fromJson(
          response.data as Map<String, dynamic>,
        );
      };
    });

/// The signed-in company's subscription. Loaded after sign-in and whenever the
/// session is checked again (e.g. the app comes back to the foreground);
/// cleared on sign-out. It also updates [PlanFeatures], which permission checks
/// use to hide modules outside the company's plan.
final subscriptionStatusProvider =
    StateNotifierProvider<SubscriptionNotifier, SubscriptionStatus?>((ref) {
      final notifier = SubscriptionNotifier(
        ref.watch(subscriptionStatusLoaderProvider),
      );
      ref.listen<AuthState>(authNotifierProvider, (previous, next) {
        if (next is Authenticated) {
          notifier.load();
        } else if (next is! Authenticating) {
          notifier.clear();
        }
      }, fireImmediately: true);
      return notifier;
    });

class SubscriptionNotifier extends StateNotifier<SubscriptionStatus?> {
  SubscriptionNotifier(this._load) : super(null);

  final Future<SubscriptionStatus> Function()? _load;

  Future<void> load() async {
    final loader = _load;
    if (loader == null) return;
    try {
      final status = await loader();
      if (!mounted) return;
      PlanFeatures.update(status);
      state = status;
    } on DioException {
      // Keep what we had; the server still enforces the plan.
    } catch (_) {
      // Never block the app on this.
    }
  }

  void clear() {
    PlanFeatures.update(null);
    if (mounted) state = null;
  }
}
