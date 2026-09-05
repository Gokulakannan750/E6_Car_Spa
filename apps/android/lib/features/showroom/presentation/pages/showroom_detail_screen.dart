import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../models/showroom_model.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/daily_staff_provider.dart';
import '../../providers/showroom_provider.dart';
import '../widgets/assign_staff_modal_sheet.dart';
import '../widgets/daily_staff_assignment_card.dart';
import '../widgets/showroom_date_selector.dart';
import '../widgets/showroom_form_sheet.dart';

class ShowroomDetailScreen extends ConsumerStatefulWidget {
  final Showroom showroom;

  const ShowroomDetailScreen({
    super.key,
    required this.showroom,
  });

  @override
  ConsumerState<ShowroomDetailScreen> createState() => _ShowroomDetailScreenState();
}

class _ShowroomDetailScreenState extends ConsumerState<ShowroomDetailScreen> {
  late Showroom _currentShowroom;

  @override
  void initState() {
    super.initState();
    _currentShowroom = widget.showroom;
  }

  bool _hasPermission(String permission) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return false;
    if (user.isOwner) return true;
    return user.hasPermission(permission);
  }

  void _openAssignStaffSheet(DailyStaffState dailyState) {
    final assignedStaffIds =
        dailyState.staffAssignments.map((a) => a.staffId).toSet();

    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => AssignStaffModalSheet(
        showroomName: _currentShowroom.name,
        selectedDate: dailyState.selectedDate,
        alreadyAssignedStaffIds: assignedStaffIds,
        onAssign: (staffIds, initialVehicles) async {
          await ref
              .read(dailyStaffProvider(_currentShowroom.id).notifier)
              .assignMultipleStaff(
                staffIds: staffIds,
                vehiclesAttended: initialVehicles,
              );
          if (mounted) {
            final count = staffIds.length;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  count > 1
                      ? '$count staff members assigned successfully!'
                      : 'Staff member assigned successfully!',
                ),
                backgroundColor: AppColors.success,
              ),
            );
          }
        },
      ),
    );
  }

  Future<void> _handleUpdateVehicles(
    DailyStaffAssignment assignment,
    int newVehicles,
  ) async {
    try {
      await ref
          .read(dailyStaffProvider(_currentShowroom.id).notifier)
          .updateVehicles(
            assignmentId: assignment.id,
            vehiclesAttended: newVehicles,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Vehicles attended updated successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update vehicles attended: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _openEditShowroomSheet() {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => ShowroomFormSheet(
        showroom: _currentShowroom,
        onUpdate: (id, request) async {
          final updated = await ref
              .read(showroomsProvider.notifier)
              .updateShowroom(id, request);
          if (updated != null && mounted) {
            setState(() {
              _currentShowroom = updated;
            });
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

  Future<void> _handleRemoveAssignment(DailyStaffAssignment assignment) async {
    try {
      await ref
          .read(dailyStaffProvider(_currentShowroom.id).notifier)
          .removeAssignment(assignment.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Staff assignment removed successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove assignment: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _confirmSubmitAttendance() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(
          'Confirm Attendance?',
          style: AppTextStyles.headingSmall.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        content: const Text(
          'Once attendance is confirmed, staff assignments and vehicle counts for this day cannot be edited.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          FilledButton(
            key: const Key('confirm_dialog_confirm_button'),
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm Attendance'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(dailyStaffProvider(_currentShowroom.id).notifier)
            .confirmAttendance();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Attendance confirmed successfully!'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to confirm attendance: $e'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  Future<void> _confirmUnlockAttendance() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(
          'Unlock Attendance for Correction?',
          style: AppTextStyles.headingSmall.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        content: const Text(
          'Unlocking will reopen attendance and vehicle counts for editing. You will need to confirm attendance again when finished.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          FilledButton(
            key: const Key('unlock_dialog_confirm_button'),
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Unlock Attendance'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(dailyStaffProvider(_currentShowroom.id).notifier)
            .unlockAttendance();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Attendance unlocked for correction.'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to unlock attendance: $e'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dailyState = ref.watch(dailyStaffProvider(_currentShowroom.id));
    final canAssignStaff = _hasPermission('showroom.assign_staff');
    final canConfirmAttendance = _hasPermission('showroom.confirm_attendance');
    final canManage = _hasPermission('showroom.manage');
    final user = ref.watch(currentUserProvider);
    final isOwner = user?.isOwner ?? false;
    final isLocked = dailyState.isAttendanceConfirmed;

    final dateHeading = DateFormat('dd MMM yyyy').format(dailyState.selectedDate);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          _currentShowroom.name,
          style: AppTextStyles.headingMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
          overflow: TextOverflow.ellipsis,
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        actions: [
          IconButton(
            onPressed: () => ref
                .read(dailyStaffProvider(_currentShowroom.id).notifier)
                .loadDailyStaff(),
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textPrimary),
            tooltip: 'Refresh Roster',
          ),
          const AppLogoutAction(),
        ],
      ),
      floatingActionButton: (canAssignStaff && !isLocked)
          ? FloatingActionButton.extended(
              onPressed: () => _openAssignStaffSheet(dailyState),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.person_add_alt_1_outlined, color: Colors.white),
              label: const Text(
                'Assign Staff',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref
            .read(dailyStaffProvider(_currentShowroom.id).notifier)
            .loadDailyStaff(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // 1. Showroom Master Header Card
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                padding: const EdgeInsets.all(14),
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
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: _currentShowroom.isActive
                              ? AppColors.primary.withAlpha(25)
                              : AppColors.surfaceAlt,
                          child: Text(
                            _currentShowroom.initials,
                            style: AppTextStyles.headingSmall.copyWith(
                              color: _currentShowroom.isActive
                                  ? AppColors.primary
                                  : AppColors.textSecondary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _currentShowroom.name,
                                style: AppTextStyles.headingSmall.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    size: 13,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      _currentShowroom.address,
                                      style: AppTextStyles.bodySmall.copyWith(
                                        color: AppColors.textSecondary,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        StatusBadge(
                          label: _currentShowroom.isActive ? 'Active' : 'Inactive',
                          type: _currentShowroom.isActive
                              ? StatusType.completed
                              : StatusType.cancelled,
                          isCompact: true,
                        ),
                        if (canManage) ...[
                          const SizedBox(width: 4),
                          IconButton(
                            onPressed: _openEditShowroomSheet,
                            icon: const Icon(Icons.edit_outlined, size: 16),
                            color: AppColors.textSecondary,
                            tooltip: 'Edit Showroom',
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ],
                    ),
                    if (_currentShowroom.phone != null &&
                        _currentShowroom.phone!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(
                            Icons.phone_outlined,
                            size: 13,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _currentShowroom.phone!,
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w500,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // 2. Interactive Date Selector
            SliverToBoxAdapter(
              child: ShowroomDateSelector(
                selectedDate: dailyState.selectedDate,
                onDateSelected: (newDate) {
                  ref
                      .read(dailyStaffProvider(_currentShowroom.id).notifier)
                      .setDate(newDate);
                },
              ),
            ),

            // 3. Daily Summary Metrics Banner
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
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
                      title: 'Vehicles Attended',
                      value: '${dailyState.totalVehiclesAttended}',
                      icon: Icons.directions_car_outlined,
                      color: AppColors.info,
                    ),
                  ],
                ),
              ),
            ),

            // 4. Attendance Confirmation Status Banner
            SliverToBoxAdapter(
              child: _buildAttendanceBanner(
                dailyState: dailyState,
                canConfirm: canConfirmAttendance,
                isOwner: isOwner,
              ),
            ),

            // 5. Section Heading: "Staff on Duty"
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
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
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

            // 6. Daily Staff Assignments List / States
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
                        const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                        const SizedBox(height: 12),
                        Text(
                          dailyState.errorMessage!,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.error),
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          onPressed: () => ref
                              .read(dailyStaffProvider(_currentShowroom.id).notifier)
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
                    actionLabel: (canAssignStaff && !isLocked) ? 'Assign Staff' : null,
                    onAction: (canAssignStaff && !isLocked)
                        ? () => _openAssignStaffSheet(dailyState)
                        : null,
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(bottom: 88, top: 2),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (itemContext, index) {
                      final assignment = dailyState.staffAssignments[index];
                      return DailyStaffAssignmentCard(
                        assignment: assignment,
                        canManage: canAssignStaff,
                        isLocked: isLocked,
                        onRemove: () => _handleRemoveAssignment(assignment),
                        onEditVehicles: (newVehicles) =>
                            _handleUpdateVehicles(assignment, newVehicles),
                      );
                    },
                    childCount: dailyState.staffAssignments.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttendanceBanner({
    required DailyStaffState dailyState,
    required bool canConfirm,
    required bool isOwner,
  }) {
    final isConfirmed = dailyState.isAttendanceConfirmed;

    if (isConfirmed) {
      final confirmedByName = dailyState.attendanceConfirmedByName ?? 'Authorized User';
      final confirmedAtStr = dailyState.attendanceConfirmedAt != null
          ? DateFormat('dd MMM yyyy, hh:mm a').format(dailyState.attendanceConfirmedAt!.toLocal())
          : null;

      return Container(
        margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.readyBg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.readyBorder),
        ),
        child: Row(
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
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.readyBorder.withAlpha(60),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.lock_outline, size: 10, color: AppColors.readyText),
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
            if (isOwner) ...[
              const SizedBox(width: 8),
              OutlinedButton.icon(
                key: const Key('unlock_attendance_button'),
                onPressed: dailyState.isUnlocking ? null : () => _confirmUnlockAttendance(),
                icon: dailyState.isUnlocking
                    ? const SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.lock_open_outlined, size: 14),
                label: const Text('Correct', style: TextStyle(fontSize: 11)),
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  side: const BorderSide(color: AppColors.readyBorder),
                  foregroundColor: AppColors.readyText,
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
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
                      'Attendance and vehicle counts can still be edited.',
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
                onPressed: dailyState.isConfirming ? null : () => _confirmSubmitAttendance(),
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
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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
