import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/daily_staff_provider.dart';
import 'daily_staff_assignment_card.dart';

class ShowroomAttendanceTab extends ConsumerWidget {
  final String showroomId;
  final bool canAssignStaff;
  final bool canConfirmAttendance;
  final bool isOwner;
  final VoidCallback onOpenAssignStaffSheet;
  final void Function(DailyStaffAssignment assignment)
  onOpenEditStaffSessionSheet;
  final void Function(DailyStaffAssignment assignment) onRemoveAssignment;
  final void Function(DailyStaffAssignment? assignment)? onOpenSwapStaffSheet;
  final void Function(String swapId)? onOpenSwapDetailsSheet;
  final VoidCallback? onOpenSwapHistorySheet;
  final VoidCallback onConfirmSubmitAttendance;
  final VoidCallback onConfirmUnlockAttendance;

  const ShowroomAttendanceTab({
    super.key,
    required this.showroomId,
    required this.canAssignStaff,
    required this.canConfirmAttendance,
    required this.isOwner,
    required this.onOpenAssignStaffSheet,
    required this.onOpenEditStaffSessionSheet,
    required this.onRemoveAssignment,
    this.onOpenSwapStaffSheet,
    this.onOpenSwapDetailsSheet,
    this.onOpenSwapHistorySheet,
    required this.onConfirmSubmitAttendance,
    required this.onConfirmUnlockAttendance,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dailyState = ref.watch(dailyStaffProvider(showroomId));
    final isLocked = dailyState.isAttendanceConfirmed;
    final dateHeading = DateFormat(
      'dd MMM yyyy',
    ).format(dailyState.selectedDate);

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(dailyStaffProvider(showroomId).notifier).loadDailyStaff(),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          const SliverToBoxAdapter(child: SizedBox(height: 8)),

          // 1. Daily Summary Metrics Banner (Staff on Duty & Scheduled Hours)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  _buildMetricCard(
                    title: 'Staff on Duty',
                    value: '${dailyState.totalStaffCount}',
                    icon: Icons.people_alt_outlined,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  _buildMetricCard(
                    title: 'Scheduled Hours',
                    value:
                        '${dailyState.totalScheduledHours.toStringAsFixed(1)}h',
                    icon: Icons.access_time_rounded,
                    color: AppColors.info,
                  ),
                ],
              ),
            ),
          ),

          // 2. Attendance Confirmation Status Banner
          SliverToBoxAdapter(
            child: _buildAttendanceBanner(
              context: context,
              dailyState: dailyState,
              canConfirm: canConfirmAttendance,
              isOwner: isOwner,
            ),
          ),

          // 3. Section Heading: "Staff on Duty" & Actions
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Flexible(
                              child: Text(
                                'Staff on Duty',
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
                                '${dailyState.totalStaffCount}',
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
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (onOpenSwapHistorySheet != null)
                            IconButton(
                              key: const Key('swap_history_button'),
                              onPressed: onOpenSwapHistorySheet,
                              icon: const Icon(
                                Icons.history,
                                size: 20,
                                color: Colors.purple,
                              ),
                              tooltip: 'Swap History',
                              visualDensity: VisualDensity.compact,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(
                                minWidth: 32,
                                minHeight: 32,
                              ),
                            ),
                          if (canAssignStaff &&
                              !isLocked &&
                              onOpenSwapStaffSheet != null)
                            IconButton(
                              key: const Key('swap_staff_button'),
                              onPressed: () => onOpenSwapStaffSheet!(null),
                              icon: const Icon(
                                Icons.swap_horiz,
                                size: 20,
                                color: Colors.purple,
                              ),
                              tooltip: 'Swap Staff',
                              visualDensity: VisualDensity.compact,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(
                                minWidth: 32,
                                minHeight: 32,
                              ),
                            ),
                          const SizedBox(width: 4),
                          Text(
                            dateHeading,
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // 4. Daily Staff Assignments List / States
          if (dailyState.isLoading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: CircularProgressIndicator(),
                ),
              ),
            )
          else if (dailyState.errorMessage != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 48,
                        color: AppColors.error,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        dailyState.errorMessage!,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: AppColors.error,
                        ),
                      ),
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: () => ref
                            .read(dailyStaffProvider(showroomId).notifier)
                            .loadDailyStaff(),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Try Again'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else if (dailyState.staffAssignments.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: AppEmptyState(
                  title: 'No staff assigned for $dateHeading',
                  message: isLocked
                      ? 'Attendance is confirmed and locked for this date.'
                      : 'Tap "+ Assign Staff" below to schedule staff members to this showroom for this date.',
                  icon: Icons.people_outline,
                  actionLabel: (canAssignStaff && !isLocked)
                      ? 'Assign Staff'
                      : null,
                  onAction: (canAssignStaff && !isLocked)
                      ? onOpenAssignStaffSheet
                      : null,
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.only(bottom: 88, top: 2),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate((itemContext, index) {
                  final assignment = dailyState.staffAssignments[index];
                  return DailyStaffAssignmentCard(
                    assignment: assignment,
                    canManage: canAssignStaff,
                    isLocked: isLocked,
                    onEdit: (canAssignStaff && !isLocked)
                        ? () => onOpenEditStaffSessionSheet(assignment)
                        : null,
                    onRemove: (canAssignStaff && !isLocked)
                        ? () => onRemoveAssignment(assignment)
                        : null,
                    onSwap:
                        (canAssignStaff &&
                            !isLocked &&
                            onOpenSwapStaffSheet != null)
                        ? () => onOpenSwapStaffSheet!(assignment)
                        : null,
                    onViewSwap:
                        (assignment.swapId != null &&
                            onOpenSwapDetailsSheet != null)
                        ? () => onOpenSwapDetailsSheet!(assignment.swapId!)
                        : null,
                  );
                }, childCount: dailyState.staffAssignments.length),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAttendanceBanner({
    required BuildContext context,
    required DailyStaffState dailyState,
    required bool canConfirm,
    required bool isOwner,
  }) {
    final isConfirmed = dailyState.isAttendanceConfirmed;

    if (isConfirmed) {
      final confirmedByName =
          dailyState.attendanceConfirmedByName ?? 'Authorized User';
      final confirmedAtStr = dailyState.attendanceConfirmedAt != null
          ? DateFormat(
              'dd MMM yyyy, hh:mm a',
            ).format(dailyState.attendanceConfirmedAt!.toLocal())
          : null;

      return Container(
        margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.readyBg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.readyBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.readyBorder.withAlpha(60),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.check_circle_rounded,
                    size: 20,
                    color: AppColors.readyText,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            'Attendance Confirmed',
                            style: AppTextStyles.bodyMedium.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.readyText,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.readyBorder.withAlpha(60),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.lock_outline,
                                  size: 10,
                                  color: AppColors.readyText,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  'Locked',
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: AppColors.readyText,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        confirmedAtStr != null
                            ? 'Confirmed by $confirmedByName • $confirmedAtStr'
                            : 'Confirmed by $confirmedByName',
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.readyText,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (isOwner) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton.icon(
                  key: const Key('unlock_attendance_button'),
                  onPressed: dailyState.isUnlocking
                      ? null
                      : onConfirmUnlockAttendance,
                  icon: dailyState.isUnlocking
                      ? const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.lock_open_outlined, size: 14),
                  label: const Text(
                    'Correct',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                  style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    side: const BorderSide(color: AppColors.readyBorder),
                    foregroundColor: AppColors.readyText,
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

    // Unconfirmed state
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.qualityCheckBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.qualityCheckBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.qualityCheckBorder.withAlpha(60),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.schedule_rounded,
                  size: 20,
                  color: AppColors.qualityCheckText,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          'Attendance Not Confirmed',
                          style: AppTextStyles.bodyMedium.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.qualityCheckText,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.qualityCheckBorder.withAlpha(60),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'Open for edits',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.qualityCheckText,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Attendance and work sessions can still be edited.',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.warningDark,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (canConfirm) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                key: const Key('confirm_attendance_button'),
                onPressed: dailyState.isConfirming
                    ? null
                    : onConfirmSubmitAttendance,
                icon: dailyState.isConfirming
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check_circle_outline_rounded, size: 14),
                label: const Text(
                  'Confirm Attendance',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                ),
              ),
            ),
          ],
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withAlpha(20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
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
          ],
        ),
      ),
    );
  }
}
