import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../../staff/models/staff_model.dart';
import '../../../staff/presentation/widgets/add_edit_staff_bottom_sheet.dart';
import '../../../staff/presentation/widgets/staff_card.dart';
import '../../../staff/providers/staff_provider.dart';
import '../../models/staff_advance_model.dart';
import '../../providers/staff_advances_provider.dart';
import '../widgets/advance_card.dart';
import '../widgets/advance_kpi_card.dart';
import '../widgets/create_advance_bottom_sheet.dart';
import '../widgets/obsolete_advance_bottom_sheet.dart';
import '../widgets/settle_advance_dialog.dart';
import '../widgets/staff_advance_history_sheet.dart';

class StaffAdvancesScreen extends ConsumerStatefulWidget {
  const StaffAdvancesScreen({super.key});

  @override
  ConsumerState<StaffAdvancesScreen> createState() => _StaffAdvancesScreenState();
}

class _StaffAdvancesScreenState extends ConsumerState<StaffAdvancesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final TextEditingController _advancesSearchController = TextEditingController();
  final TextEditingController _staffSearchController = TextEditingController();

  static const List<Map<String, String>> _statusFilters = [
    {'label': 'Active', 'value': 'active'},
    {'label': 'Outstanding', 'value': 'outstanding'},
    {'label': 'Settled', 'value': 'settled'},
    {'label': 'Obsolete', 'value': 'obsolete'},
    {'label': 'All', 'value': 'all'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _advancesSearchController.dispose();
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

  void _showCreateAdvanceSheet(List<Staff> activeStaff, {String? initialStaffId}) {
    final messenger = ScaffoldMessenger.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return CreateAdvanceBottomSheet(
          activeStaff: activeStaff,
          initialStaffId: initialStaffId,
          onSubmit: (request) async {
            final error = await ref.read(staffAdvancesProvider.notifier).createAdvance(request);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff advance disbursed successfully!'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            return error;
          },
        );
      },
    );
  }

  void _showSettleDialog(StaffAdvance advance) {
    final messenger = ScaffoldMessenger.of(context);
    showDialog(
      context: context,
      builder: (context) {
        return SettleAdvanceDialog(
          advance: advance,
          onSettle: (advanceId) async {
            final error = await ref.read(staffAdvancesProvider.notifier).settleAdvance(advanceId);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff advance settled successfully!'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            return error;
          },
        );
      },
    );
  }

  void _showObsoleteSheet(StaffAdvance advance) {
    final messenger = ScaffoldMessenger.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return ObsoleteAdvanceBottomSheet(
          advance: advance,
          onObsolete: (advanceId, reason) async {
            final error = await ref.read(staffAdvancesProvider.notifier).obsoleteAdvance(advanceId, reason);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff advance marked obsolete.'),
                  backgroundColor: AppColors.error,
                ),
              );
            }
            return error;
          },
        );
      },
    );
  }

  void _showHistorySheet(String staffId, String staffName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StaffAdvanceHistorySheet(
          staffId: staffId,
          staffName: staffName,
        );
      },
    );
  }

  void _showAddEditStaffSheet([Staff? staff]) {
    final messenger = ScaffoldMessenger.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return AddEditStaffBottomSheet(
          staff: staff,
          onCreate: (request) async {
            final error = await ref.read(staffProvider.notifier).createStaff(request);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff member added successfully!'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            return error;
          },
          onUpdate: (staffId, request) async {
            final error = await ref.read(staffProvider.notifier).updateStaff(staffId, request);
            if (error == null) {
              messenger.showSnackBar(
                const SnackBar(
                  content: Text('Staff member updated successfully!'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            return error;
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final advancesState = ref.watch(staffAdvancesProvider);
    final staffState = ref.watch(staffProvider);

    final canCreateAdvance = _hasPermission('staff_advances.create');
    final canSettleAdvance = _hasPermission('staff_advances.settle');
    final canObsoleteAdvance = _hasPermission('staff_advances.obsolete');
    final canCreateStaff = _hasPermission('staff.create');
    final canEditStaff = _hasPermission('staff.edit');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Staff Advances'),
        backgroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelStyle: AppTextStyles.labelLarge.copyWith(fontWeight: FontWeight.w700),
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
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textPrimary),
            tooltip: 'Refresh',
            onPressed: () {
              ref.read(staffAdvancesProvider.notifier).loadAdvances(refresh: true);
              ref.read(staffProvider.notifier).loadStaff(refresh: true);
            },
          ),
          const AppLogoutAction(),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // ── TAB 1: ADVANCES ───────────────────────────────────────────────
          _buildAdvancesTab(
            advancesState: advancesState,
            activeStaff: staffState.activeStaff,
            canSettle: canSettleAdvance,
            canObsolete: canObsoleteAdvance,
          ),

          // ── TAB 2: STAFF DIRECTORY ────────────────────────────────────────
          _buildStaffTab(
            staffState: staffState,
            canEdit: canEditStaff,
          ),
        ],
      ),
      floatingActionButton: AnimatedBuilder(
        animation: _tabController,
        builder: (context, _) {
          if (_tabController.index == 0 && canCreateAdvance) {
            return FloatingActionButton.extended(
              onPressed: () => _showCreateAdvanceSheet(staffState.activeStaff),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text(
                'New Advance',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
            );
          } else if (_tabController.index == 1 && canCreateStaff) {
            return FloatingActionButton.extended(
              onPressed: () => _showAddEditStaffSheet(),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.person_add_outlined, color: Colors.white),
              label: const Text(
                'Add Staff',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildAdvancesTab({
    required StaffAdvancesState advancesState,
    required List<Staff> activeStaff,
    required bool canSettle,
    required bool canObsolete,
  }) {
    if (advancesState.isLoading && advancesState.advances.isEmpty) {
      return const AppLoadingState(message: 'Loading staff advances...');
    }

    if (advancesState.errorMessage != null && advancesState.advances.isEmpty) {
      return AppErrorState(
        message: advancesState.errorMessage!,
        onRetry: () => ref.read(staffAdvancesProvider.notifier).loadAdvances(refresh: true),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(staffAdvancesProvider.notifier).loadAdvances(refresh: true);
        await ref.read(staffProvider.notifier).loadStaff(refresh: true);
      },
      child: CustomScrollView(
        slivers: [
          // KPI Section
          SliverToBoxAdapter(
            child: AdvanceKpiSection(
              outstandingAmount: advancesState.summary.outstandingAmount,
              settledAmount: advancesState.summary.settledAmount,
              activeCount: advancesState.summary.totalActiveCount,
            ),
          ),

          // Search Field
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: AppSearchField(
                controller: _advancesSearchController,
                hint: 'Search by staff name, reason, notes...',
                onChanged: (query) {
                  ref.read(staffAdvancesProvider.notifier).setSearch(query);
                },
                onClear: () {
                  _advancesSearchController.clear();
                  ref.read(staffAdvancesProvider.notifier).setSearch('');
                },
              ),
            ),
          ),

          // Staff Filter Dropdown
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Row(
                children: [
                  const Icon(Icons.filter_list_rounded, size: 18, color: AppColors.textSecondary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String?>(
                        value: advancesState.selectedStaffId,
                        isExpanded: true,
                        hint: Text(
                          'All Staff Members',
                          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                        ),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('All Staff Members'),
                          ),
                          ...activeStaff.map((staff) {
                            return DropdownMenuItem<String?>(
                              value: staff.id,
                              child: Text(
                                staff.name + (staff.role != null && staff.role!.isNotEmpty ? ' (${staff.role})' : ''),
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }),
                        ],
                        onChanged: (val) {
                          ref.read(staffAdvancesProvider.notifier).setStaffFilter(val);
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Status Filter Chips
          SliverToBoxAdapter(
            child: SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                itemCount: _statusFilters.length,
                separatorBuilder: (context, index) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final filter = _statusFilters[index];
                  final isSelected = advancesState.selectedStatus == filter['value'];
                  return ChoiceChip(
                    label: Text(filter['label']!),
                    selected: isSelected,
                    selectedColor: AppColors.primary.withAlpha(30),
                    backgroundColor: Colors.white,
                    labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? AppColors.primary : AppColors.textPrimary,
                    ),
                    side: BorderSide(
                      color: isSelected ? AppColors.primary : AppColors.border,
                    ),
                    onSelected: (_) {
                      ref.read(staffAdvancesProvider.notifier).setStatusFilter(filter['value']!);
                    },
                  );
                },
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 8)),

          // Advances List
          if (advancesState.advances.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: AppEmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'No staff advances found',
                message: 'Tap "+ New Advance" below to disburse a staff advance.',
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final advance = advancesState.advances[index];
                  return AdvanceCard(
                    advance: advance,
                    canSettle: canSettle,
                    canObsolete: canObsolete,
                    onSettle: () => _showSettleDialog(advance),
                    onObsolete: () => _showObsoleteSheet(advance),
                    onHistory: () => _showHistorySheet(advance.staffId, advance.staffName),
                  );
                },
                childCount: advancesState.advances.length,
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
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
        onRetry: () => ref.read(staffProvider.notifier).loadStaff(refresh: true),
      );
    }

    final staffList = staffState.filteredStaff;
    final totalStaff = staffState.staffList.length;
    final activeStaffCount = staffState.activeStaff.length;
    final withAdvancesCount = staffState.staffList.where((s) => s.totalAdvances > 0).length;
    final canCreateAdvance = _hasPermission('staff_advances.create');

    return RefreshIndicator(
      onRefresh: () => ref.read(staffProvider.notifier).loadStaff(refresh: true),
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
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                children: [
                  _buildStaffStatusChip(
                    label: 'All ($totalStaff)',
                    selected: staffState.statusFilter == StaffStatusFilter.all,
                    onSelected: () => ref.read(staffProvider.notifier).setStatusFilter(StaffStatusFilter.all),
                  ),
                  const SizedBox(width: 8),
                  _buildStaffStatusChip(
                    label: 'Active ($activeStaffCount)',
                    selected: staffState.statusFilter == StaffStatusFilter.active,
                    onSelected: () => ref.read(staffProvider.notifier).setStatusFilter(StaffStatusFilter.active),
                  ),
                  const SizedBox(width: 8),
                  _buildStaffStatusChip(
                    label: 'Inactive (${totalStaff - activeStaffCount})',
                    selected: staffState.statusFilter == StaffStatusFilter.inactive,
                    onSelected: () => ref.read(staffProvider.notifier).setStatusFilter(StaffStatusFilter.inactive),
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
                message: 'Tap "+ Add Staff" below to add a staff member to the directory.',
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final staff = staffList[index];
                  return StaffCard(
                    staff: staff,
                    canEdit: canEdit,
                    canCreateAdvance: canCreateAdvance,
                    onAddAdvance: () => _showCreateAdvanceSheet(
                      staffState.activeStaff,
                      initialStaffId: staff.id,
                    ),
                    onEdit: () => _showAddEditStaffSheet(staff),
                    onHistory: () => _showHistorySheet(staff.id, staff.name),
                  );
                },
                childCount: staffList.length,
              ),
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
      side: BorderSide(
        color: selected ? AppColors.primary : AppColors.border,
      ),
      onSelected: (_) => onSelected(),
    );
  }
}

