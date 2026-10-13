import 'package:e6_car_spa/core/utils/auto_refresh_mixin.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _RefreshProbe extends ConsumerStatefulWidget {
  const _RefreshProbe({super.key});

  @override
  ConsumerState<_RefreshProbe> createState() => _RefreshProbeState();
}

class _RefreshProbeState extends ConsumerState<_RefreshProbe>
    with WidgetsBindingObserver, AutoRefreshMixin<_RefreshProbe> {
  int refreshes = 0;

  @override
  void onAutoRefresh() => refreshes++;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

void main() {
  testWidgets('preference changes cannot restart polling in the background', (
    tester,
  ) async {
    final key = GlobalKey<_RefreshProbeState>();
    await tester.pumpWidget(ProviderScope(child: _RefreshProbe(key: key)));
    final state = key.currentState!;
    state.didChangeAppLifecycleState(AppLifecycleState.paused);
    state.syncRefreshTimerWithPreferences(15);
    await tester.pump(const Duration(seconds: 30));
    expect(state.refreshes, 0);

    state.didChangeAppLifecycleState(AppLifecycleState.resumed);
    await tester.pump();
    expect(state.refreshes, 1);
    await tester.pump(const Duration(seconds: 15));
    expect(state.refreshes, 2);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('manual refresh mode stays off after resuming', (tester) async {
    final key = GlobalKey<_RefreshProbeState>();
    await tester.pumpWidget(ProviderScope(child: _RefreshProbe(key: key)));
    final state = key.currentState!;
    state.didChangeAppLifecycleState(AppLifecycleState.hidden);
    state.syncRefreshTimerWithPreferences(0);
    state.didChangeAppLifecycleState(AppLifecycleState.resumed);
    await tester.pump();
    expect(state.refreshes, 1);
    await tester.pump(const Duration(minutes: 1));
    expect(state.refreshes, 1);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
