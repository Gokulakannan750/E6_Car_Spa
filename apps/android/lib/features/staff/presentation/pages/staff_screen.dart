import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/auto_refresh_mixin.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../../settings/providers/system_preferences_provider.dart';
import '../../../staffadvances/providers/staff_advances_provider.dart';
import '../../providers/staff_attendance_providers.dart';
import '../../providers/staff_provider.dart';
import 'staff_advances_tab.dart';
import 'staff_attendance_tab.dart';
import 'staff_directory_tab.dart';
import 'staff_salary_tab.dart';

class StaffScreen extends ConsumerStatefulWidget {
  final int initialTabIndex;

  const StaffScreen({super.key, this.initialTabIndex = 0});

  @override
  ConsumerState<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends ConsumerState<StaffScreen>
    with
        SingleTickerProviderStateMixin,
        WidgetsBindingObserver,
        AutoRefreshMixin<StaffScreen> {
  late final TabController _tabController;

  @override
  void onAutoRefresh() {
    final authState = ref.read(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;
    final canViewStaff =
        user?.isOwner == true ||
        user?.permissions.contains('staff.view') == true;
    if (canViewStaff) {
      ref.read(staffProvider.notifier).loadStaff(refresh: true, silent: true);
      final date = ref.read(selectedAttendanceDateProvider);
      ref.invalidate(dailyAttendanceProvider(date));
      ref.invalidate(monthlyAttendanceReportProvider);
    }

    final canViewAdvances =
        user?.isOwner == true ||
        user?.permissions.contains('staff_advances.view') == true;
    if (canViewAdvances) {
      ref.read(staffAdvancesProvider.notifier).loadAdvances(silent: true);
    }
  }

  static const List<Tab> _tabs = [
    Tab(icon: Icon(Icons.people_outline, size: 20), text: 'Directory'),
    Tab(icon: Icon(Icons.fact_check_outlined, size: 20), text: 'Attendance'),
    Tab(
      icon: Icon(Icons.account_balance_wallet_outlined, size: 20),
      text: 'Staff Advances',
    ),
    Tab(icon: Icon(Icons.payments_outlined, size: 20), text: 'Salary'),
  ];

  @override
  void initState() {
    super.initState();
    final safeIndex = widget.initialTabIndex.clamp(0, _tabs.length - 1);
    _tabController = TabController(
      length: _tabs.length,
      initialIndex: safeIndex,
      vsync: this,
    );
  }

  @override
  void didUpdateWidget(covariant StaffScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTabIndex != widget.initialTabIndex) {
      final safeIndex = widget.initialTabIndex.clamp(0, _tabs.length - 1);
      _tabController.animateTo(safeIndex);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _handleBackNavigation() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go(AppRoutes.dashboard);
    }
  }

  @override
  Widget build(BuildContext context) {
    final preferences = ref.watch(systemPreferencesProvider);
    syncRefreshTimerWithPreferences(preferences.refreshInterval);
    final authState = ref.watch(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;

    final canViewStaff =
        user?.isOwner == true ||
        user?.permissions.contains('staff.view') == true;

    if (!canViewStaff) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) return;
          _handleBackNavigation();
        },
        child: Scaffold(
          appBar: AppBar(
            leading: IconButton(
              key: const Key('staff_unauthorized_back_button'),
              icon: const Icon(Icons.arrow_back_rounded),
              tooltip: 'Back to Dashboard',
              onPressed: _handleBackNavigation,
            ),
            title: const Text('Staff Management'),
            actions: const [AppLogoutAction()],
          ),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.lock_outline,
                    size: 56,
                    color: AppColors.error,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Access Restricted',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'You do not have permission to access Staff Management (staff.view).',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () => context.go(AppRoutes.dashboard),
                    icon: const Icon(Icons.dashboard_outlined),
                    label: const Text('Return to Suite Launcher'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _handleBackNavigation();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            key: const Key('staff_suite_back_button'),
            icon: const Icon(Icons.arrow_back_rounded),
            tooltip: 'Back to Dashboard',
            onPressed: _handleBackNavigation,
          ),
          title: const Text('Staff Suite'),
          actions: [
            IconButton(
              key: const Key('staff_monthly_report_button'),
              icon: const Icon(Icons.assessment_outlined),
              tooltip: 'Monthly Attendance Report',
              onPressed: () => context.go(AppRoutes.staffMonthlyReport),
            ),
            const AppLogoutAction(),
          ],
          bottom: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: Theme.of(context).colorScheme.primary,
            labelColor: Theme.of(context).colorScheme.primary,
            unselectedLabelColor: Theme.of(
              context,
            ).colorScheme.onSurfaceVariant,
            tabs: _tabs,
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: const [
            StaffDirectoryTab(),
            StaffAttendanceTab(),
            StaffAdvancesTab(),
            StaffSalaryTab(),
          ],
        ),
      ),
    );
  }
}
