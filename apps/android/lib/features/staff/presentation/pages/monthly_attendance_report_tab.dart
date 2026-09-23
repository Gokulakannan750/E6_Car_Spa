import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../models/staff_attendance_models.dart';
import '../../providers/staff_attendance_providers.dart';
import '../../providers/staff_provider.dart';

class MonthlyAttendanceReportTab extends ConsumerWidget {
  const MonthlyAttendanceReportTab({super.key});

  static const _months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  void _shiftMonth(WidgetRef ref, int delta) {
    final current = ref.read(selectedMonthlyYearMonthProvider);
    int newYear = current.year;
    int newMonth = current.month + delta;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    ref.read(selectedMonthlyYearMonthProvider.notifier).state = (year: newYear, month: newMonth);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final yearMonth = ref.watch(selectedMonthlyYearMonthProvider);
    final selectedStaffId = ref.watch(selectedMonthlyStaffFilterProvider);
    final reportAsync = ref.watch(monthlyAttendanceReportProvider);
    final staffList = ref.watch(staffProvider).staffList;

    final monthName = _months[yearMonth.month - 1];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // Month Selector & Staff Filter Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white,
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left_rounded),
                      tooltip: 'Previous Month',
                      onPressed: () => _shiftMonth(ref, -1),
                    ),
                    Row(
                      children: [
                        const Icon(Icons.calendar_month_rounded, size: 18, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Text(
                          '$monthName ${yearMonth.year}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right_rounded),
                      tooltip: 'Next Month',
                      onPressed: () => _shiftMonth(ref, 1),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String?>(
                  initialValue: selectedStaffId,
                  decoration: const InputDecoration(
                    labelText: 'Filter by Staff Member',
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: null,
                      child: Text('All Active Staff Members', style: TextStyle(fontSize: 12)),
                    ),
                    ...staffList.map(
                      (s) => DropdownMenuItem(
                        value: s.id,
                        child: Text('${s.name} (${s.role ?? 'Staff'})', style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                  ],
                  onChanged: (val) {
                    ref.read(selectedMonthlyStaffFilterProvider.notifier).state = val;
                  },
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // Report Content
          Expanded(
            child: reportAsync.when(
              loading: () => const AppLoadingState(message: 'Compiling monthly attendance report...'),
              error: (err, stack) => AppErrorState(
                message: 'Failed to load monthly report: $err',
                onRetry: () => ref.invalidate(monthlyAttendanceReportProvider),
              ),
              data: (report) {
                final summary = report.summary;

                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async {
                    ref.invalidate(monthlyAttendanceReportProvider);
                  },
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // 4 KPI Summary Cards
                      Row(
                        children: [
                          Expanded(
                            child: _buildKpiCard(
                              title: 'Staff Members',
                              value: '${report.staffCount}',
                              subtitle: '${report.totalCalendarDays} calendar days',
                              icon: Icons.people_alt_outlined,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildKpiCard(
                              title: 'Present Records',
                              value: '${summary.present}',
                              subtitle: 'Full day attendances',
                              icon: Icons.check_circle_outline_rounded,
                              color: AppColors.success,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _buildKpiCard(
                              title: 'Half Day Records',
                              value: '${summary.halfDay}',
                              subtitle: 'Partial shifts',
                              icon: Icons.access_time_rounded,
                              color: AppColors.warningDark,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildKpiCard(
                              title: 'Leave Records',
                              value: '${summary.leave}',
                              subtitle: 'Approved leaves',
                              icon: Icons.event_busy_rounded,
                              color: AppColors.error,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),

                      // Staff Monthly Breakdown List
                      Text(
                        'Monthly Attendance Breakdown (${report.staffAttendance.length})',
                        style: AppTextStyles.labelLarge.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 10),

                      if (report.staffAttendance.isEmpty)
                        const AppEmptyState(
                          title: 'No Monthly Attendance Found',
                          message: 'No attendance records match the selected month and filter.',
                          icon: Icons.calendar_today_rounded,
                        )
                      else
                        ...report.staffAttendance.map((item) => _MonthlyStaffCard(item: item)),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _MonthlyStaffCard extends StatefulWidget {
  final MonthlyStaffAttendanceItem item;

  const _MonthlyStaffCard({required this.item});

  @override
  State<_MonthlyStaffCard> createState() => _MonthlyStaffCardState();
}

class _MonthlyStaffCardState extends State<_MonthlyStaffCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.accentPill,
                  child: Text(
                    item.name.isNotEmpty ? item.name.substring(0, 1).toUpperCase() : 'S',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.name, style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w700)),
                      Text(
                        '${item.role ?? 'Staff'} • ${item.phoneNumber}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(_expanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded),
                  tooltip: _expanded ? 'Hide Day Matrix' : 'Show Day-by-Day Log',
                  onPressed: () {
                    setState(() {
                      _expanded = !_expanded;
                    });
                  },
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Summary counters
            Row(
              children: [
                _buildMetricBadge('Present', '${item.presentDays}', AppColors.success, AppColors.successLight),
                const SizedBox(width: 6),
                _buildMetricBadge('Half Day', '${item.halfDays}', AppColors.warningDark, AppColors.warningLight),
                const SizedBox(width: 6),
                _buildMetricBadge('Leave', '${item.leaveDays}', AppColors.error, AppColors.errorLight),
                const SizedBox(width: 6),
                _buildMetricBadge('Unmarked', '${item.unmarkedDays}', AppColors.textSecondary, AppColors.surface),
              ],
            ),

            if (_expanded) ...[
              const Divider(height: 20, color: AppColors.border),
              const Text('Calendar Day Log:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: item.dailyRecords.map((d) {
                  Color bg;
                  Color fg;
                  if (d.status == 'Present') {
                    bg = AppColors.successLight;
                    fg = AppColors.success;
                  } else if (d.status == 'HalfDay') {
                    bg = AppColors.warningLight;
                    fg = AppColors.warningDark;
                  } else if (d.status == 'Leave') {
                    bg = AppColors.errorLight;
                    fg = AppColors.error;
                  } else {
                    bg = AppColors.surface;
                    fg = AppColors.textSecondary;
                  }

                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: fg.withAlpha(80)),
                    ),
                    child: Text(
                      '${d.day} (${d.dayOfWeek.substring(0, 1)}): ${d.status}',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: fg),
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMetricBadge(String label, String count, Color color, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: color.withAlpha(50)),
        ),
        child: Column(
          children: [
            Text(count, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: color)),
            Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }
}
