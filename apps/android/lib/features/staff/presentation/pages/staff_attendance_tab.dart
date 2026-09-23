import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../providers/staff_attendance_providers.dart';
import '../widgets/attendance_staff_card.dart';

class StaffAttendanceTab extends ConsumerWidget {
  const StaffAttendanceTab({super.key});

  String _formatDisplayDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return '${days[dt.weekday - 1]}, ${dt.day} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return isoDate;
    }
  }

  void _shiftDate(WidgetRef ref, int days) {
    final currentDateStr = ref.read(selectedAttendanceDateProvider);
    try {
      final dt = DateTime.parse(currentDateStr);
      final newDt = dt.add(Duration(days: days));
      ref.read(selectedAttendanceDateProvider.notifier).state = newDt.toIso8601String().split('T')[0];
    } catch (_) {}
  }

  Future<void> _pickDate(BuildContext context, WidgetRef ref) async {
    final currentDateStr = ref.read(selectedAttendanceDateProvider);
    DateTime initial = DateTime.now();
    try {
      initial = DateTime.parse(currentDateStr);
    } catch (_) {}

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(primary: AppColors.primary),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      ref.read(selectedAttendanceDateProvider.notifier).state = picked.toIso8601String().split('T')[0];
    }
  }

  Future<void> _showConfirmDialog(BuildContext context, WidgetRef ref, String date) async {
    final notesController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Daily Attendance?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Confirming attendance will lock all records for this date and record an authoritative audit entry.',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: notesController,
              decoration: const InputDecoration(
                labelText: 'Confirmation Notes (Optional)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirm & Lock'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(attendanceActionProvider.notifier).confirmDailyAttendance(
        date: date,
        notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedAttendanceDateProvider);
    final attendanceAsync = ref.watch(dailyAttendanceProvider(selectedDate));
    final authState = ref.watch(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;

    final canManageAttendance = user?.isOwner == true || (user?.permissions.contains('staff_attendance.manage') ?? false) || (user?.permissions.contains('staff.manage') ?? false);
    final canConfirmAttendance = user?.isOwner == true || (user?.permissions.contains('staff_attendance.confirm') ?? false) || (user?.permissions.contains('staff.manage') ?? false);

    final isToday = selectedDate == DateTime.now().toIso8601String().split('T')[0];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // Date Selector Header Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white,
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left_rounded),
                  tooltip: 'Previous Day',
                  onPressed: () => _shiftDate(ref, -1),
                ),
                Expanded(
                  child: InkWell(
                    onTap: () => _pickDate(context, ref),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.primary),
                          const SizedBox(width: 8),
                          Text(
                            _formatDisplayDate(selectedDate),
                            style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.bold),
                          ),
                          if (isToday) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.accentPill,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'TODAY',
                                style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.primary),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right_rounded),
                  tooltip: 'Next Day',
                  onPressed: () => _shiftDate(ref, 1),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // Main Roster Body
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(dailyAttendanceProvider(selectedDate));
                await ref.read(dailyAttendanceProvider(selectedDate).future);
              },
              child: attendanceAsync.when(
                loading: () => const AppLoadingState(message: 'Loading daily attendance roster...'),
                error: (err, _) => AppErrorState(
                  message: 'Failed to load attendance roster: $err',
                  onRetry: () => ref.invalidate(dailyAttendanceProvider(selectedDate)),
                ),
                data: (data) {
                  final isConfirmed = data.isConfirmed;
                  final summary = data.summary;

                  return ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Confirmation Status Banner
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: isConfirmed ? AppColors.successLight : AppColors.warningLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isConfirmed ? AppColors.success.withAlpha(80) : AppColors.warningDark.withAlpha(80),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isConfirmed ? Icons.lock_rounded : Icons.lock_open_rounded,
                              size: 18,
                              color: isConfirmed ? AppColors.success : AppColors.warningDark,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isConfirmed ? 'Attendance Confirmed & Locked' : 'Pending Confirmation',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                      color: isConfirmed ? AppColors.success : AppColors.warningDark,
                                    ),
                                  ),
                                  if (isConfirmed && data.attendanceConfirmedByName != null)
                                    Text(
                                      'Confirmed by ${data.attendanceConfirmedByName}',
                                      style: TextStyle(fontSize: 10, color: AppColors.success.withAlpha(200)),
                                    ),
                                ],
                              ),
                            ),
                            if (!isConfirmed && canConfirmAttendance)
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                icon: const Icon(Icons.check_rounded, size: 14),
                                label: const Text('Confirm Day', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                onPressed: () => _showConfirmDialog(context, ref, selectedDate),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // KPI Summary Counter Pills
                      Row(
                        children: [
                          _buildSummaryCard('Present', '${summary.presentCount}', AppColors.success, AppColors.successLight),
                          const SizedBox(width: 8),
                          _buildSummaryCard('Half Day', '${summary.halfDayCount}', AppColors.warningDark, AppColors.warningLight),
                          const SizedBox(width: 8),
                          _buildSummaryCard('Leave', '${summary.leaveCount}', AppColors.error, AppColors.errorLight),
                          const SizedBox(width: 8),
                          _buildSummaryCard('Unmarked', '${summary.unmarkedCount}', AppColors.textSecondary, AppColors.surface),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Staff Attendance Cards List
                      if (data.staffMembers.isEmpty)
                        const AppEmptyState(
                          title: 'No Staff Found',
                          message: 'There are no active staff members in the roster for this date.',
                          icon: Icons.people_outline_rounded,
                        )
                      else ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Staff Roster (${data.staffMembers.length})',
                              style: AppTextStyles.labelLarge.copyWith(fontWeight: FontWeight.w700),
                            ),
                            if (isConfirmed)
                              const Text(
                                '🔒 Locked for editing',
                                style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontStyle: FontStyle.italic),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        ...data.staffMembers.map(
                          (item) => AttendanceStaffCard(
                            item: item,
                            isConfirmed: isConfirmed,
                            canManage: canManageAttendance,
                          ),
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(String label, String count, Color color, Color bgColor) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withAlpha(50)),
        ),
        child: Column(
          children: [
            Text(count, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }
}
