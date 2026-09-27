import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../models/showroom_operations_model.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/daily_staff_provider.dart';
import '../../providers/showroom_operations_provider.dart';
import 'close_work_session_modal_sheet.dart';
import 'edit_vehicle_work_modal_sheet.dart';
import 'log_vehicle_work_modal_sheet.dart';
import 'vehicle_work_card.dart';

class ShowroomOperationsTab extends ConsumerWidget {
  final String showroomId;
  final String showroomName;
  final DateTime selectedDate;
  final bool canLogWork;
  final VoidCallback? onOpenLogWorkSheet;

  const ShowroomOperationsTab({
    super.key,
    required this.showroomId,
    required this.showroomName,
    required this.selectedDate,
    this.canLogWork = true,
    this.onOpenLogWorkSheet,
  });

  void _openLogWorkSheet(BuildContext context, WidgetRef ref) {
    if (onOpenLogWorkSheet != null) {
      onOpenLogWorkSheet!();
      return;
    }

    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => LogVehicleWorkModalSheet(
        showroomId: showroomId,
        showroomName: showroomName,
        selectedDate: selectedDate,
      ),
    );
  }

  void _openEditWorkSheet(
    BuildContext context,
    WidgetRef ref,
    ShowroomVehicleWork work,
  ) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => EditVehicleWorkModalSheet(
        work: work,
        showroomId: showroomId,
        showroomName: showroomName,
      ),
    );
  }

  void _openCloseSessionSheet(
    BuildContext context,
    WidgetRef ref,
    DailyStaffAssignment assignment,
  ) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => CloseWorkSessionModalSheet(
        showroomId: showroomId,
        showroomName: showroomName,
        assignment: assignment,
      ),
    );
  }

  Future<void> _handleDeleteWork(
    BuildContext context,
    WidgetRef ref,
    ShowroomVehicleWork work,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(
          'Delete Vehicle Work?',
          style: AppTextStyles.headingSmall.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        content: Text(
          'Are you sure you want to delete this ${work.vehicleTypeName} work entry for ${work.staffName}?',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      try {
        await ref
            .read(showroomOperationsProvider(showroomId).notifier)
            .deleteVehicleWork(work.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Vehicle work record deleted successfully.'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete work record: $e'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final opsState = ref.watch(showroomOperationsProvider(showroomId));
    final dailyState = ref.watch(dailyStaffProvider(showroomId));
    final opsNotifier =
        ref.read(showroomOperationsProvider(showroomId).notifier);

    final dateHeading = DateFormat('dd MMM yyyy').format(opsState.selectedDate);
    final filteredWorks = opsState.filteredVehicleWorks;
    final hasActiveFilter = opsState.selectedStaffId != null ||
        opsState.selectedVehicleTypeId != null;

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([
          opsNotifier.loadOperationsData(),
          ref.read(dailyStaffProvider(showroomId).notifier).loadDailyStaff(),
        ]);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          const SliverToBoxAdapter(child: SizedBox(height: 8)),

          // 1. Operations KPI Banner (3 Cards)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  _buildMetricCard(
                    title: 'Vehicles Handled',
                    value: '${opsState.totalVehiclesHandled}',
                    icon: Icons.directions_car_filled_outlined,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  _buildMetricCard(
                    title: 'Services Done',
                    value: '${opsState.totalServicesPerformed}',
                    icon: Icons.build_circle_outlined,
                    color: AppColors.info,
                  ),
                  const SizedBox(width: 6),
                  _buildMetricCard(
                    title: 'Active Sessions',
                    value: '${opsState.totalActiveStaffSessions}',
                    icon: Icons.people_outline_rounded,
                    color: const Color(0xFFE65100),
                  ),
                ],
              ),
            ),
          ),

          // 2. Breakdowns (Vehicle Types & Services)
          if (opsState.hasData) ...[
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
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
                    // Vehicle Types Breakdown
                    if (opsState.vehicleTypeBreakdown.isNotEmpty) ...[
                      Row(
                        children: [
                          const Icon(
                            Icons.pie_chart_outline_rounded,
                            size: 14,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'Vehicle Type Breakdown',
                            style: AppTextStyles.bodySmall.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: opsState.vehicleTypeBreakdown.map((item) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withAlpha(15),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: AppColors.primary.withAlpha(35),
                              ),
                            ),
                            child: Text(
                              '${item.vehicleTypeName}: ${item.totalVehicles}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 10),
                    ],

                    // Services / Work Type Breakdown
                    if (opsState.workTypeBreakdown.isNotEmpty) ...[
                      Row(
                        children: [
                          const Icon(
                            Icons.checklist_rounded,
                            size: 14,
                            color: AppColors.info,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'Service Breakdown',
                            style: AppTextStyles.bodySmall.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: opsState.workTypeBreakdown.map((item) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceAlt,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: AppColors.border,
                              ),
                            ),
                            child: Text(
                              '${item.workTypeName}: ${item.totalPerformed}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],

          // 3. Active Staff Sessions Clock-Out Banner (if any staff on duty is still clocked in)
          if (dailyState.staffAssignments.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: _buildActiveSessionsSection(
                context: context,
                ref: ref,
                dailyState: dailyState,
              ),
            ),
          ],

          // 4. Filter Bar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: _buildFilterBar(
                context: context,
                ref: ref,
                opsState: opsState,
                dailyState: dailyState,
                opsNotifier: opsNotifier,
              ),
            ),
          ),

          // 5. Section Heading: "Recorded Vehicle Work"
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            'Daily Vehicle Work',
                            style: AppTextStyles.headingSmall.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withAlpha(25),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${filteredWorks.length}',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    dateHeading,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 6. Vehicle Works List / Empty / Error / Loading States
          if (opsState.isLoading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: CircularProgressIndicator(),
                ),
              ),
            )
          else if (opsState.errorMessage != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: AppColors.error),
                      const SizedBox(height: 12),
                      Text(
                        opsState.errorMessage!,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.bodyMedium
                            .copyWith(color: AppColors.error),
                      ),
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: () => opsNotifier.loadOperationsData(),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Try Again'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else if (filteredWorks.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: AppEmptyState(
                  title: hasActiveFilter
                      ? 'No matching records found'
                      : 'No vehicle work recorded for $dateHeading',
                  message: hasActiveFilter
                      ? 'No vehicle work matches your selected filters. Try clearing filters.'
                      : 'Tap "+ Log Vehicle Work" below to record services performed by staff on duty.',
                  icon: hasActiveFilter
                      ? Icons.filter_alt_off_outlined
                      : Icons.directions_car_outlined,
                  actionLabel: hasActiveFilter
                      ? 'Clear Filters'
                      : (canLogWork ? 'Log Vehicle Work' : null),
                  onAction: hasActiveFilter
                      ? () => opsNotifier.clearFilters()
                      : (canLogWork
                          ? () => _openLogWorkSheet(context, ref)
                          : null),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.only(bottom: 88, top: 2),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (itemContext, index) {
                    final work = filteredWorks[index];
                    return VehicleWorkCard(
                      key: Key('vehicle_work_card_${work.id}'),
                      work: work,
                      canEdit: canLogWork,
                      canDelete: canLogWork,
                      onEdit: () => _openEditWorkSheet(context, ref, work),
                      onDelete: () => _handleDeleteWork(context, ref, work),
                    );
                  },
                  childCount: filteredWorks.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(3),
              blurRadius: 3,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: color.withAlpha(20),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(icon, size: 14, color: color),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    title,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterBar({
    required BuildContext context,
    required WidgetRef ref,
    required ShowroomOperationsState opsState,
    required DailyStaffState dailyState,
    required ShowroomOperationsNotifier opsNotifier,
  }) {
    final staffList = dailyState.staffAssignments;
    final vehicleTypes = opsState.vehicleTypes;

    final selectedStaff = staffList
        .where((s) => s.staffId == opsState.selectedStaffId)
        .firstOrNull;
    final selectedVehicleType = vehicleTypes
        .where((v) => v.id == opsState.selectedVehicleTypeId)
        .firstOrNull;

    final hasActiveFilter = opsState.selectedStaffId != null ||
        opsState.selectedVehicleTypeId != null;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          // Staff Filter Chip
          PopupMenuButton<String?>(
            key: const Key('staff_filter_popup'),
            initialValue: opsState.selectedStaffId,
            tooltip: 'Filter by Staff Member',
            onSelected: (val) {
              opsNotifier.setStaffFilter(val);
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem<String?>(
                value: null,
                child: Text('All Staff Members'),
              ),
              ...staffList.map(
                (s) => PopupMenuItem<String?>(
                  value: s.staffId,
                  child: Text(s.staffName),
                ),
              ),
            ],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: opsState.selectedStaffId != null
                    ? AppColors.primary.withAlpha(20)
                    : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: opsState.selectedStaffId != null
                      ? AppColors.primary
                      : AppColors.border,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.person_outline_rounded,
                    size: 14,
                    color: opsState.selectedStaffId != null
                        ? AppColors.primary
                        : AppColors.textSecondary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    selectedStaff != null
                        ? selectedStaff.staffName
                        : 'Staff: All',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: opsState.selectedStaffId != null
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: opsState.selectedStaffId != null
                          ? AppColors.primary
                          : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(
                    Icons.arrow_drop_down,
                    size: 16,
                    color: opsState.selectedStaffId != null
                        ? AppColors.primary
                        : AppColors.textSecondary,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Vehicle Type Filter Chip
          PopupMenuButton<String?>(
            key: const Key('vehicle_type_filter_popup'),
            initialValue: opsState.selectedVehicleTypeId,
            tooltip: 'Filter by Vehicle Type',
            onSelected: (val) {
              opsNotifier.setVehicleTypeFilter(val);
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem<String?>(
                value: null,
                child: Text('All Vehicle Types'),
              ),
              ...vehicleTypes.map(
                (v) => PopupMenuItem<String?>(
                  value: v.id,
                  child: Text(v.name),
                ),
              ),
            ],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: opsState.selectedVehicleTypeId != null
                    ? AppColors.primary.withAlpha(20)
                    : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: opsState.selectedVehicleTypeId != null
                      ? AppColors.primary
                      : AppColors.border,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.directions_car_filled_outlined,
                    size: 14,
                    color: opsState.selectedVehicleTypeId != null
                        ? AppColors.primary
                        : AppColors.textSecondary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    selectedVehicleType != null
                        ? selectedVehicleType.name
                        : 'Vehicle: All',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: opsState.selectedVehicleTypeId != null
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: opsState.selectedVehicleTypeId != null
                          ? AppColors.primary
                          : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(
                    Icons.arrow_drop_down,
                    size: 16,
                    color: opsState.selectedVehicleTypeId != null
                        ? AppColors.primary
                        : AppColors.textSecondary,
                  ),
                ],
              ),
            ),
          ),

          if (hasActiveFilter) ...[
            const SizedBox(width: 8),
            InkWell(
              onTap: () => opsNotifier.clearFilters(),
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.close_rounded, size: 13, color: AppColors.textSecondary),
                    SizedBox(width: 3),
                    Text(
                      'Clear',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActiveSessionsSection({
    required BuildContext context,
    required WidgetRef ref,
    required DailyStaffState dailyState,
  }) {
    final activeSessions = dailyState.staffAssignments;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
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
              Row(
                children: [
                  const Icon(
                    Icons.badge_outlined,
                    size: 15,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Staff on Duty (${activeSessions.length})',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Text(
                'Shift Sessions',
                style: AppTextStyles.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 10.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: activeSessions.map((session) {
              return Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircleAvatar(
                      radius: 9,
                      backgroundColor: AppColors.primary.withAlpha(25),
                      child: Text(
                        session.initials,
                        style: const TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      session.staffName,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(width: 6),
                    InkWell(
                      key: Key('clock_out_btn_${session.id}'),
                      onTap: () => _openCloseSessionSheet(context, ref, session),
                      borderRadius: BorderRadius.circular(4),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red.withAlpha(20),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.logout_rounded,
                                size: 10, color: AppColors.error),
                            SizedBox(width: 2),
                            Text(
                              'Clock Out',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.error,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
