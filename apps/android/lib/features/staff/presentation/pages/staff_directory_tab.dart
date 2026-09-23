import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../providers/staff_provider.dart';
import '../widgets/add_edit_staff_bottom_sheet.dart';
import '../widgets/staff_card.dart';
import '../widgets/staff_details_bottom_sheet.dart';

class StaffDirectoryTab extends ConsumerWidget {
  const StaffDirectoryTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staffState = ref.watch(staffProvider);
    final authState = ref.watch(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;
    final canCreateStaff = user?.isOwner == true || (user?.permissions.contains('staff.create') ?? false);

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: canCreateStaff
          ? FloatingActionButton.extended(
              key: const Key('add_staff_fab'),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Text('Add Staff', style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: () {
                showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => AddEditStaffBottomSheet(
                    onCreate: (req) => ref.read(staffProvider.notifier).createStaff(req),
                  ),
                );
              },
            )
          : null,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => ref.read(staffProvider.notifier).loadStaff(refresh: true),
        child: Column(
          children: [
            // Search and Status Filters
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              color: Colors.white,
              child: Column(
                children: [
                  AppSearchField(
                    placeholder: 'Search staff by name, phone, role...',
                    onChanged: (val) => ref.read(staffProvider.notifier).setSearch(val),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildFilterChip(
                        ref: ref,
                        label: 'All (${staffState.staffList.length})',
                        filter: StaffStatusFilter.all,
                        currentFilter: staffState.statusFilter,
                      ),
                      const SizedBox(width: 8),
                      _buildFilterChip(
                        ref: ref,
                        label: 'Active (${staffState.activeStaff.length})',
                        filter: StaffStatusFilter.active,
                        currentFilter: staffState.statusFilter,
                      ),
                      const SizedBox(width: 8),
                      _buildFilterChip(
                        ref: ref,
                        label: 'Inactive (${staffState.staffList.length - staffState.activeStaff.length})',
                        filter: StaffStatusFilter.inactive,
                        currentFilter: staffState.statusFilter,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.border),

            // Content List
            Expanded(
              child: staffState.isLoading && staffState.staffList.isEmpty
                  ? const AppLoadingState(message: 'Loading staff directory...')
                  : staffState.errorMessage != null && staffState.staffList.isEmpty
                      ? AppErrorState(
                          message: staffState.errorMessage!,
                          onRetry: () => ref.read(staffProvider.notifier).loadStaff(refresh: true),
                        )
                      : staffState.filteredStaff.isEmpty
                          ? const AppEmptyState(
                              title: 'No Staff Members Found',
                              message: 'Try adjusting your search query or filter settings.',
                              icon: Icons.people_outline_rounded,
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                              itemCount: staffState.filteredStaff.length,
                              itemBuilder: (context, index) {
                                final staff = staffState.filteredStaff[index];
                                return StaffCard(
                                  staff: staff,
                                  onTap: () {
                                    showModalBottomSheet<void>(
                                      context: context,
                                      isScrollControlled: true,
                                      backgroundColor: Colors.transparent,
                                      builder: (_) => StaffDetailsBottomSheet(staff: staff),
                                    );
                                  },
                                  onEdit: () {
                                    showModalBottomSheet<void>(
                                      context: context,
                                      isScrollControlled: true,
                                      backgroundColor: Colors.transparent,
                                      builder: (_) => AddEditStaffBottomSheet(
                                        staff: staff,
                                        onUpdate: (id, req) => ref.read(staffProvider.notifier).updateStaff(id, req),
                                      ),
                                    );
                                  },
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip({
    required WidgetRef ref,
    required String label,
    required StaffStatusFilter filter,
    required StaffStatusFilter currentFilter,
  }) {
    final isSelected = filter == currentFilter;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? Colors.white : AppColors.textSecondary,
        ),
      ),
      selected: isSelected,
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.surface,
      side: BorderSide(color: isSelected ? AppColors.primary : AppColors.border),
      onSelected: (_) => ref.read(staffProvider.notifier).setStatusFilter(filter),
    );
  }
}
