import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../providers/reports_provider.dart';

class ReportDateFilter extends ConsumerWidget {
  const ReportDateFilter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filterState = ref.watch(reportDateFilterProvider);
    final notifier = ref.read(reportDateFilterProvider.notifier);

    final presets = [
      (ReportDatePreset.sevenDays, '7D'),
      (ReportDatePreset.thirtyDays, '30D'),
      (ReportDatePreset.thisMonth, 'This Month'),
      (ReportDatePreset.lastMonth, 'Last Month'),
      (ReportDatePreset.ytd, 'YTD'),
      (ReportDatePreset.custom, 'Custom'),
    ];

    final dateFormat = DateFormat('dd MMM yyyy');
    final formattedRange = '${dateFormat.format(filterState.startDate)} – ${dateFormat.format(filterState.endDate)}';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusLG),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Range Label & Selected Dates
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    filterState.label,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Text(
                formattedRange,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Presets horizontal scroll
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: presets.map((item) {
                final isSelected = filterState.preset == item.$1;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: InkWell(
                    onTap: () {
                      if (item.$1 == ReportDatePreset.custom) {
                        _showCustomDateRangePicker(context, ref);
                      } else {
                        notifier.setPreset(item.$1);
                      }
                    },
                    borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primary : AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                        border: Border.all(
                          color: isSelected ? AppColors.primary : AppColors.border,
                        ),
                      ),
                      child: Text(
                        item.$2,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                          color: isSelected ? Colors.white : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  void _showCustomDateRangePicker(BuildContext context, WidgetRef ref) async {
    final filterState = ref.read(reportDateFilterProvider);
    final pickedRange = await showDateRangePicker(
      context: context,
      initialDateRange: DateTimeRange(
        start: filterState.startDate,
        end: filterState.endDate,
      ),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (pickedRange != null) {
      ref.read(reportDateFilterProvider.notifier).setCustomRange(
            pickedRange.start,
            pickedRange.end,
          );
    }
  }
}
