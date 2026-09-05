import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mixin for [ConsumerState] widgets that enables automatic data synchronization:
/// 1. Auto-sync on screen resume / app foregrounding.
/// 2. Periodic background refresh (default 12s) while the screen is mounted and app is active.
/// 3. Pauses polling when the app is backgrounded to preserve battery/network.
mixin AutoRefreshMixin<T extends ConsumerStatefulWidget> on ConsumerState<T>, WidgetsBindingObserver {
  Timer? _refreshTimer;

  /// Override to customize the interval if needed (default: 12 seconds).
  Duration get autoRefreshInterval => const Duration(seconds: 12);

  /// Callback executed on periodic interval and when the app resumes.
  void onAutoRefresh();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startTimer();
  }

  void _startTimer() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(autoRefreshInterval, (_) {
      if (mounted) {
        onAutoRefresh();
      }
    });
  }

  void _stopTimer() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (mounted) {
        onAutoRefresh();
      }
      _startTimer();
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _stopTimer();
    }
  }

  @override
  void dispose() {
    _stopTimer();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
