import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/auto_refresh_mixin.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../../settings/providers/system_preferences_provider.dart';
import '../../../staff/presentation/widgets/staff_card.dart';
import '../../../staff/providers/staff_provider.dart';
import '../../providers/staff_advances_provider.dart';
import '../widgets/staff_advances_content.dart';
import '../widgets/staff_advances_dialogs.dart';

class StaffAdvancesScreen extends ConsumerStatefulWidget {
  const StaffAdvancesScreen({super.key});

  @override
  ConsumerState<StaffAdvancesScreen> createState() =>
      _StaffAdvancesScreenState();
}

class _StaffAdvancesScreenState extends ConsumerState<StaffAdvancesScreen>
    with
        SingleTickerProviderStateMixin,
        WidgetsBindingObserver,
        AutoRefreshMixin<StaffAdvancesScreen> {
  late final TabController _tabController;
  final TextEditingController _staffSearchController = TextEditingController();

  @override
  void onAutoRefresh() {
    if (_hasPermission('staff_advances.view')) {
      ref.read(staffAdvancesProvider.notifier).loadAdvances(silent: true);
    }
    if (_hasPermission('staff.view')) {
      ref.read(staffProvider.notifier).loadStaff(refresh: true, silent: true);
    }
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _staffSearchController.dispose();
    super.dispose();
  }

  bool _hasPermission(String permission) {
    final authState = ref.read(authNotifierProvider);
    if (authState is Authenticated) {
      if (authState.user.isOwner) return true;
      return authState.user.permissions.contains(permission);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final preferences = ref.watch(systemPreferencesProvider);
    syncRefreshTimerWithPreferences(preferences.refreshInterval);
    final staffState = ref.watch(staffProvider);

    final canCreateAdvance = _hasPermission('staff_advances.create');
    final canCreateStaff = _hasPermission('staff.create');
    final canEditStaff = _hasPermission('staff.edit');

    final scaffold = Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          key: const Key('staff_advances_back_button'),
          icon: const Icon(Icons.arrow_back_rounded),
          tooltip: 'Back',
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.staff);
            }
          },
        ),
        title: Text('Staff Advances', style: AppTextStyles.appBarTitle),
        backgroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelStyle: AppTextStyles.labelLarge.copyWith(
            fontWeight: FontWeight.w700,
          ),
          tabs: const [
            Tab(
              icon: Icon(Icons.account_balance_wallet_outlined, size: 20),
              text: 'Advances',
            ),
            Tab(
              icon: Icon(Icons.people_outline_rounded, size: 20),
              text: 'Staff Directory',
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(
              Icons.refresh_rounded,
              color: AppColors.textPrimary,
            ),
            tooltip: 'Refresh',
            onPressed: () {
              if (_hasPermission('staff_advances.view')) {
                ref
                    .read(staffAdvancesProvider.notifier)
                    .loadAdvances(refresh: true);
              }
              if (_hasPermission('staff.view')) {
                ref.read(staffProvider.notifier).loadStaff(refresh: true);
              }
            },
          ),
          const AppLogoutAction(),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // ── TAB 1: ADVANCES ───────────────────────────────────────────────
          const StaffAdvancesContent(),

          // ── TAB 2: STAFF DIRECTORY ────────────────────────────────────────
          _buildStaffTab(staffState: staffState, canEdit: canEditStaff),
        ],
      ),
      floatingActionButton: AnimatedBuilder(
        animation: _tabController,
        builder: (context, _) {
          if (_tabController.index == 0 && canCreateAdvance) {
            return FloatingActionButton.extended(
              onPressed: () => StaffAdvancesDialogs.showCreateAdvanceSheet(
                context,
                ref,
                staffState.activeStaff,
              ),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text(
                'New Advance',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            );
          } else if (_tabController.index == 1 && canCreateStaff) {
            return FloatingActionButton.extended(
              onPressed: () =>
                  StaffAdvancesDialogs.showAddEditStaffSheet(context, ref),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.person_add_outlined, color: Colors.white),
              label: const Text(
                'Add Staff',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (context.canPop()) {
          context.pop();
        } else {
          context.go(AppRoutes.staff);
        }
      },
      child: scaffold,
    );
  }

  Widget _buildStaffTab({
    required StaffState staffState,
    required bool canEdit,
  }) {
    if (staffState.isLoading && staffState.staffList.isEmpty) {
      return const AppLoadingState(message: 'Loading staff directory...');
    }

    if (staffState.errorMessage != null && staffState.staffList.isEmpty) {
      return AppErrorState(
        message: staffState.errorMessage!,
        onRetry: () =>
            ref.read(staffProvider.notifier).loadStaff(refresh: true),
      );
    }

    final staffList = staffState.filteredStaff;
    final totalStaff = staffState.staffList.length;
    final activeStaffCount = staffState.activeStaff.length;
    final withAdvancesCount = staffState.staffList
        .where((s) => s.totalAdvances > 0)
        .length;
    final canCreateAdvance = _hasPermission('staff_advances.create');

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(staffProvider.notifier).loadStaff(refresh: true),
      child: CustomScrollView(
        slivers: [
          // Staff KPI Summary Cards (Desktop Parity)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: _buildStaffKpiCard(
                      label: 'Total Staff',
                      value: '$totalStaff',
                      icon: Icons.people_alt_outlined,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildStaffKpiCard(
                      label: 'Active Staff',
                      value: '$activeStaffCount',
                      icon: Icons.check_circle_outline_rounded,
                      color: AppColors.success,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildStaffKpiCard(
                      label: 'With Advances',
                      value: '$withAdvancesCount',
                      icon: Icons.account_balance_wallet_outlined,
                      color: AppColors.warningDark,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Search Field
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: AppSearchField(
                controller: _staffSearchController,
                hint: 'Search staff by name, phone, role, email...',
                onChanged: (query) {
                  ref.read(staffProvider.notifier).setSearch(query);
                },
                onClear: () {
                  _staffSearchController.clear();
                  ref.read(staffProvider.notifier).setSearch('');
                },
              ),
            ),
          ),

          // Status Filter Chips (All, Active, Inactive)
          SliverToBoxAdapter(
            child: SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 4,
                ),
                children: [
                  _buildStaffStatusChip(
                    label: 'All ($totalStaff)',
                    selected: staffState.statusFilter == StaffStatusFilter.all,
                    onSelected: () => ref
                        .read(staffProvider.notifier)
                        .setStatusFilter(StaffStatusFilter.all),
                  ),
                  const SizedBox(width: 8),
                  _buildStaffStatusChip(
                    label: 'Active ($activeStaffCount)',
                    selected:
                        staffState.statusFilter == StaffStatusFilter.active,
                    onSelected: () => ref
                        .read(staffProvider.notifier)
                        .setStatusFilter(StaffStatusFilter.active),
                  ),
                  const SizedBox(width: 8),
                  _buildStaffStatusChip(
                    label: 'Inactive (${totalStaff - activeStaffCount})',
                    selected:
                        staffState.statusFilter == StaffStatusFilter.inactive,
                    onSelected: () => ref
                        .read(staffProvider.notifier)
                        .setStatusFilter(StaffStatusFilter.inactive),
                  ),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 6)),

          // Staff List
          if (staffList.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: AppEmptyState(
                icon: Icons.people_outline_rounded,
                title: 'No staff members found',
                message:
                    'Tap "+ Add Staff" below to add a staff member to the directory.',
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate((context, index) {
                final staff = staffList[index];
                return StaffCard(
                  staff: staff,
                  canEdit: canEdit,
                  canCreateAdvance: canCreateAdvance,
                  onAddAdvance: () =>
                      StaffAdvancesDialogs.showCreateAdvanceSheet(
                        context,
                        ref,
                        staffState.activeStaff,
                        initialStaffId: staff.id,
                      ),
                  onEdit: () => StaffAdvancesDialogs.showAddEditStaffSheet(
                    context,
                    ref,
                    staff,
                  ),
                  onHistory: () => StaffAdvancesDialogs.showHistorySheet(
                    context,
                    staff.id,
                    staff.name,
                  ),
                );
              }, childCount: staffList.length),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }

  Widget _buildStaffKpiCard({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              Icon(icon, size: 14, color: color),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              fontFamily: 'monospace',
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStaffStatusChip({
    required String label,
    required bool selected,
    required VoidCallback onSelected,
  }) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      selectedColor: AppColors.primary.withAlpha(30),
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
        color: selected ? AppColors.primary : AppColors.textPrimary,
      ),
      side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
      onSelected: (_) => onSelected(),
    );
  }
}
