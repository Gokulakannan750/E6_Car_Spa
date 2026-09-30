import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../../staff/providers/staff_provider.dart';
import '../../providers/staff_advances_provider.dart';
import 'advance_card.dart';
import 'advance_kpi_card.dart';
import 'staff_advances_dialogs.dart';

/// Reusable content widget for Staff Advances list, search, filter chips, and KPIs.
/// Can be embedded in [StaffScreen]'s TabBarView or [StaffAdvancesScreen].
class StaffAdvancesContent extends ConsumerStatefulWidget {
  const StaffAdvancesContent({super.key});

  @override
  ConsumerState<StaffAdvancesContent> createState() =>
      _StaffAdvancesContentState();
}

class _StaffAdvancesContentState extends ConsumerState<StaffAdvancesContent>
    with AutomaticKeepAliveClientMixin {
  late final TextEditingController _advancesSearchController;

  static const List<Map<String, String>> _statusFilters = [
    {'label': 'Active', 'value': 'active'},
    {'label': 'Outstanding', 'value': 'outstanding'},
    {'label': 'Settled', 'value': 'settled'},
    {'label': 'Obsolete', 'value': 'obsolete'},
    {'label': 'All', 'value': 'all'},
  ];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _advancesSearchController = TextEditingController(
      text: ref.read(staffAdvancesProvider).searchQuery,
    );
  }

  @override
  void dispose() {
    _advancesSearchController.dispose();
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
    super.build(context);
    final advancesState = ref.watch(staffAdvancesProvider);
    final staffState = ref.watch(staffProvider);

    final canSettleAdvance = _hasPermission('staff_advances.settle');
    final canObsoleteAdvance = _hasPermission('staff_advances.obsolete');

    if (advancesState.isLoading && advancesState.advances.isEmpty) {
      return const AppLoadingState(message: 'Loading staff advances...');
    }

    if (advancesState.errorMessage != null && advancesState.advances.isEmpty) {
      return AppErrorState(
        message: advancesState.errorMessage!,
        onRetry: () => ref
            .read(staffAdvancesProvider.notifier)
            .loadAdvances(refresh: true),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        await ref
            .read(staffAdvancesProvider.notifier)
            .loadAdvances(refresh: true);
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
                  const Icon(
                    Icons.filter_list_rounded,
                    size: 18,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String?>(
                        value: advancesState.selectedStaffId,
                        isExpanded: true,
                        hint: Text(
                          'All Staff Members',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('All Staff Members'),
                          ),
                          ...staffState.activeStaff.map((staff) {
                            return DropdownMenuItem<String?>(
                              value: staff.id,
                              child: Text(
                                staff.name +
                                    (staff.role != null &&
                                            staff.role!.isNotEmpty
                                        ? ' (${staff.role})'
                                        : ''),
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }),
                        ],
                        onChanged: (val) {
                          ref
                              .read(staffAdvancesProvider.notifier)
                              .setStaffFilter(val);
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
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 4,
                ),
                itemCount: _statusFilters.length,
                separatorBuilder: (context, index) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final filter = _statusFilters[index];
                  final isSelected =
                      advancesState.selectedStatus == filter['value'];
                  return ChoiceChip(
                    label: Text(filter['label']!),
                    selected: isSelected,
                    selectedColor: AppColors.primary.withAlpha(30),
                    backgroundColor: Colors.white,
                    labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: isSelected
                          ? AppColors.primary
                          : AppColors.textPrimary,
                    ),
                    side: BorderSide(
                      color: isSelected ? AppColors.primary : AppColors.border,
                    ),
                    onSelected: (_) {
                      ref
                          .read(staffAdvancesProvider.notifier)
                          .setStatusFilter(filter['value']!);
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
                message:
                    'Tap "+ New Advance" below to disburse a staff advance.',
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate((context, index) {
                final advance = advancesState.advances[index];
                return AdvanceCard(
                  advance: advance,
                  canSettle: canSettleAdvance,
                  canObsolete: canObsoleteAdvance,
                  onSettle: () => StaffAdvancesDialogs.showSettleDialog(
                    context,
                    ref,
                    advance,
                  ),
                  onObsolete: () => StaffAdvancesDialogs.showObsoleteSheet(
                    context,
                    ref,
                    advance,
                  ),
                  onHistory: () => StaffAdvancesDialogs.showHistorySheet(
                    context,
                    advance.staffId,
                    advance.staffName,
                  ),
                );
              }, childCount: advancesState.advances.length),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }
}
