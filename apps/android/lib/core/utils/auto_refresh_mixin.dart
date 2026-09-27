import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mixin for [ConsumerState] widgets that enables automatic data synchronization:
/// 1. Auto-sync on screen resume / app foregrounding.
/// 2. Periodic background refresh respecting SystemPreferences [refreshInterval] (0 = Off, 15s, 30s, 60s).
/// 3. Pauses polling when the app is backgrounded to preserve battery/network.
mixin AutoRefreshMixin<T extends ConsumerStatefulWidget> on ConsumerState<T>, WidgetsBindingObserver {
  Timer? _refreshTimer;
  int _lastConfiguredSeconds = -1;

  /// Override to customize the default interval if needed (default: 12 seconds).
  Duration get defaultAutoRefreshInterval => const Duration(seconds: 12);

  /// Callback executed on periodic interval and when the app resumes.
  void onAutoRefresh();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startTimer();
  }

  void _startTimer([Duration? interval]) {
    _refreshTimer?.cancel();
    final effectiveInterval = interval ?? defaultAutoRefreshInterval;
    if (effectiveInterval.inSeconds <= 0) {
      _refreshTimer = null;
      return;
    }
    _refreshTimer = Timer.periodic(effectiveInterval, (_) {
      if (mounted) {
        onAutoRefresh();
      }
    });
  }

  void _stopTimer() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  /// Synchronizes the auto-refresh timer with the configured system preferences interval (in seconds).
  /// 0 = Manual / Off (timer stopped).
  /// 15, 30, 60 = Periodic refresh timer.
  void syncRefreshTimerWithPreferences(int refreshIntervalSeconds) {
    if (refreshIntervalSeconds != _lastConfiguredSeconds) {
      _lastConfiguredSeconds = refreshIntervalSeconds;
      if (refreshIntervalSeconds <= 0) {
        _stopTimer();
      } else {
        _startTimer(Duration(seconds: refreshIntervalSeconds));
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (mounted) {
        onAutoRefresh();
      }
      if (_lastConfiguredSeconds > 0) {
        _startTimer(Duration(seconds: _lastConfiguredSeconds));
      } else if (_lastConfiguredSeconds == -1) {
        _startTimer();
      }
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

