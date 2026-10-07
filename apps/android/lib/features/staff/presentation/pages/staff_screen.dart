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

class _StaffTabConfig {
  final int canonicalIndex;
  final String label;
  final IconData icon;
  final String permission;
  final Widget content;

  const _StaffTabConfig({
    required this.canonicalIndex,
    required this.label,
    required this.icon,
    required this.permission,
    required this.content,
  });
}

const List<_StaffTabConfig> _allStaffTabs = [
  _StaffTabConfig(
    canonicalIndex: 0,
    label: 'Directory',
    icon: Icons.people_outline,
    permission: 'staff.view',
    content: StaffDirectoryTab(),
  ),
  _StaffTabConfig(
    canonicalIndex: 1,
    label: 'Attendance',
    icon: Icons.fact_check_outlined,
    permission: 'staff_attendance.view',
    content: StaffAttendanceTab(),
  ),
  _StaffTabConfig(
    canonicalIndex: 2,
    label: 'Staff Advances',
    icon: Icons.account_balance_wallet_outlined,
    permission: 'staff_advances.view',
    content: StaffAdvancesTab(),
  ),
  _StaffTabConfig(
    canonicalIndex: 3,
    label: 'Salary',
    icon: Icons.payments_outlined,
    permission: 'staff_salary.view',
    content: StaffSalaryTab(),
  ),
];

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
  TabController? _tabController;

  @override
  void onAutoRefresh() {
    final authState = ref.read(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;
    final isOwner = user?.isOwner == true;

    final canViewStaff =
        isOwner || user?.permissions.contains('staff.view') == true;
    if (canViewStaff) {
      ref.read(staffProvider.notifier).loadStaff(refresh: true, silent: true);
    }

    final canViewAttendance =
        isOwner || user?.permissions.contains('staff_attendance.view') == true;
    if (canViewAttendance) {
      final date = ref.read(selectedAttendanceDateProvider);
      ref.invalidate(dailyAttendanceProvider(date));
      ref.invalidate(monthlyAttendanceReportProvider);
    }

    final canViewAdvances =
        isOwner || user?.permissions.contains('staff_advances.view') == true;
    if (canViewAdvances) {
      ref.read(staffAdvancesProvider.notifier).loadAdvances(silent: true);
    }
  }

  List<_StaffTabConfig> _getAuthorizedTabs() {
    final authState = ref.read(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;
    final isOwner = user?.isOwner == true;
    return _allStaffTabs.where((t) {
      if (isOwner) return true;
      return user?.permissions.contains(t.permission) == true;
    }).toList();
  }

  int _resolveInitialIndex(
    List<_StaffTabConfig> authorizedTabs,
    int targetCanonicalIndex,
  ) {
    if (authorizedTabs.isEmpty) return 0;
    final idx = authorizedTabs.indexWhere(
      (t) => t.canonicalIndex == targetCanonicalIndex,
    );
    return idx >= 0 ? idx : 0;
  }

  @override
  void initState() {
    super.initState();
    final authorized = _getAuthorizedTabs();
    if (authorized.isNotEmpty) {
      final safeIndex = _resolveInitialIndex(authorized, widget.initialTabIndex);
      _tabController = TabController(
        length: authorized.length,
        initialIndex: safeIndex,
        vsync: this,
      );
    }
  }

  @override
  void didUpdateWidget(covariant StaffScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTabIndex != widget.initialTabIndex &&
        _tabController != null) {
      final authorized = _getAuthorizedTabs();
      final safeIndex = _resolveInitialIndex(authorized, widget.initialTabIndex);
      if (safeIndex >= 0 && safeIndex < _tabController!.length) {
        _tabController!.animateTo(safeIndex);
      }
    }
  }

  @override
  void dispose() {
    _tabController?.dispose();
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
    final isOwner = user?.isOwner == true;

    final authorizedTabs = _allStaffTabs.where((t) {
      if (isOwner) return true;
      return user?.permissions.contains(t.permission) == true;
    }).toList();

    if (authorizedTabs.isEmpty) {
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
                    'You do not have permission to access Staff Management (staff.view, staff_attendance.view, staff_advances.view, staff_salary.view).',
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

    if (_tabController == null ||
        _tabController!.length != authorizedTabs.length) {
      final safeIndex = _resolveInitialIndex(authorizedTabs, widget.initialTabIndex);
      _tabController?.dispose();
      _tabController = TabController(
        length: authorizedTabs.length,
        initialIndex: safeIndex,
        vsync: this,
      );
    }

    final canViewAttendance =
        isOwner || user?.permissions.contains('staff_attendance.view') == true;

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
            if (canViewAttendance)
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
            tabs: authorizedTabs
                .map(
                  (t) => Tab(
                    icon: Icon(t.icon, size: 20),
                    text: t.label,
                  ),
                )
                .toList(),
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: authorizedTabs.map((t) => t.content).toList(),
        ),
      ),
    );
  }
}
