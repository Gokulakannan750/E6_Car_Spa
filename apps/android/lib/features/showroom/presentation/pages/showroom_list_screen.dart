import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../models/showroom_model.dart';
import '../../providers/showroom_provider.dart';
import '../widgets/showroom_card.dart';
import '../widgets/showroom_form_sheet.dart';
import 'showroom_detail_screen.dart';

class ShowroomListScreen extends ConsumerStatefulWidget {
  const ShowroomListScreen({super.key});

  @override
  ConsumerState<ShowroomListScreen> createState() => _ShowroomListScreenState();
}

class _ShowroomListScreenState extends ConsumerState<ShowroomListScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _hasPermission(String permission) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return false;
    if (user.isOwner) return true;
    return user.hasPermission(permission);
  }

  void _openCreateShowroomSheet() {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => ShowroomFormSheet(
        onCreate: (request) async {
          await ref.read(showroomsProvider.notifier).createShowroom(request);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Showroom created successfully!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
        },
      ),
    );
  }

  void _openEditShowroomSheet(Showroom showroom) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => ShowroomFormSheet(
        showroom: showroom,
        onUpdate: (id, request) async {
          await ref.read(showroomsProvider.notifier).updateShowroom(id, request);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Showroom updated successfully!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
        },
      ),
    );
  }

  Future<void> _handleToggleActive(Showroom showroom) async {
    final action = showroom.isActive ? 'deactivate' : 'activate';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${showroom.isActive ? 'Deactivate' : 'Activate'} Showroom'),
        content: Text('Are you sure you want to $action "${showroom.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: showroom.isActive ? AppColors.warning : AppColors.success,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(showroom.isActive ? 'Deactivate' : 'Activate'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ref.read(showroomsProvider.notifier).toggleShowroomActive(showroom.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Showroom $action status updated!'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to $action showroom: $e'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  void _openShowroomDetail(Showroom showroom) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => ShowroomDetailScreen(showroom: showroom),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(showroomsProvider);
    final canManage = _hasPermission('showroom.manage');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'Showrooms',
          style: AppTextStyles.headingMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        actions: [
          IconButton(
            onPressed: () => ref.read(showroomsProvider.notifier).loadShowrooms(),
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textPrimary),
            tooltip: 'Refresh',
          ),
          const AppLogoutAction(),
        ],
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: _openCreateShowroomSheet,
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add_business_outlined, color: Colors.white),
              label: const Text(
                'Add Showroom',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.read(showroomsProvider.notifier).loadShowrooms(),
        child: Column(
          children: [
            // KPI Summary Cards Banner
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  _buildKpiCard(
                    title: 'Total Showrooms',
                    value: '${state.totalShowroomsCount}',
                    icon: Icons.storefront_outlined,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  _buildKpiCard(
                    title: 'Active Hubs',
                    value: '${state.activeShowroomsCount}',
                    icon: Icons.check_circle_outline,
                    color: AppColors.success,
                  ),
                  const SizedBox(width: 8),
                  _buildKpiCard(
                    title: "Today's Staff",
                    value: '${state.totalStaffTodayCount}',
                    icon: Icons.people_alt_outlined,
                    color: AppColors.info,
                  ),
                ],
              ),
            ),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: AppTextField(
                controller: _searchController,
                hintText: 'Search showrooms by name, address, phone...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          ref.read(showroomsProvider.notifier).setSearchTerm('');
                        },
                      )
                    : null,
                onChanged: (val) {
                  ref.read(showroomsProvider.notifier).setSearchTerm(val);
                },
              ),
            ),

            // Status Filter Chips
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                children: [
                  _buildFilterChip('All', 'all', state.statusFilter),
                  const SizedBox(width: 8),
                  _buildFilterChip('Active', 'active', state.statusFilter),
                  const SizedBox(width: 8),
                  _buildFilterChip('Inactive', 'inactive', state.statusFilter),
                ],
              ),
            ),
            const SizedBox(height: 6),

            // Main List View
            Expanded(
              child: state.isLoading && state.showrooms.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : state.errorMessage != null && state.showrooms.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                                const SizedBox(height: 12),
                                Text(
                                  state.errorMessage!,
                                  textAlign: TextAlign.center,
                                  style: AppTextStyles.bodyMedium.copyWith(color: AppColors.error),
                                ),
                                const SizedBox(height: 16),
                                OutlinedButton.icon(
                                  onPressed: () => ref.read(showroomsProvider.notifier).loadShowrooms(),
                                  icon: const Icon(Icons.refresh),
                                  label: const Text('Try Again'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : state.filteredShowrooms.isEmpty
                          ? ListView(
                              children: [
                                const SizedBox(height: 48),
                                AppEmptyState(
                                  title: state.searchTerm.isNotEmpty
                                      ? 'No matching showrooms'
                                      : 'No showrooms found',
                                  message: state.searchTerm.isNotEmpty
                                      ? 'Try adjusting your search or filter criteria.'
                                      : 'Get started by creating your first customer showroom.',
                                  icon: Icons.storefront_outlined,
                                  actionLabel: canManage && state.searchTerm.isEmpty
                                      ? 'Add Showroom'
                                      : null,
                                  onAction: canManage && state.searchTerm.isEmpty
                                      ? _openCreateShowroomSheet
                                      : null,
                                ),
                              ],
                            )
                          : ListView.builder(
                              physics: const AlwaysScrollableScrollPhysics(),
                              itemCount: state.filteredShowrooms.length,
                              padding: const EdgeInsets.only(bottom: 88, top: 4),
                              itemBuilder: (context, index) {
                                final showroom = state.filteredShowrooms[index];
                                return ShowroomCard(
                                  showroom: showroom,
                                  canManage: canManage,
                                  onTap: () => _openShowroomDetail(showroom),
                                  onEdit: () => _openEditShowroomSheet(showroom),
                                  onToggleActive: () => _handleToggleActive(showroom),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(4),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(icon, size: 14, color: color),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: AppTextStyles.headingSmall.copyWith(
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, String selectedValue) {
    final isSelected = selectedValue == value;
    return InkWell(
      onTap: () => ref.read(showroomsProvider.notifier).setStatusFilter(value),
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: AppTextStyles.bodySmall.copyWith(
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
