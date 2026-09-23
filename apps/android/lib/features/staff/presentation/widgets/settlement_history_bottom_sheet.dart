import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../providers/staff_salary_providers.dart';

class SettlementHistoryBottomSheet extends ConsumerWidget {
  final String staffId;
  final String staffName;

  const SettlementHistoryBottomSheet({
    super.key,
    required this.staffId,
    required this.staffName,
  });

  static Future<void> show(BuildContext context, String staffId, String staffName) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SettlementHistoryBottomSheet(
        staffId: staffId,
        staffName: staffName,
      ),
    );
  }

  String _formatDate(DateTime? dt) {
    if (dt == null) return '';
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(salarySettlementHistoryProvider(staffId));

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        top: 20,
        left: 20,
        right: 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Settlement History',
                    style: AppTextStyles.headingMedium.copyWith(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    staffName,
                    style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const Divider(height: 20, color: AppColors.border),

          Expanded(
            child: historyAsync.when(
              loading: () => const AppLoadingState(message: 'Loading settlement records...'),
              error: (err, stack) => AppErrorState(
                message: 'Failed to load settlement history: $err',
                onRetry: () => ref.invalidate(salarySettlementHistoryProvider(staffId)),
              ),
              data: (historyList) {
                if (historyList.isEmpty) {
                  return const AppEmptyState(
                    title: 'No Settlements Recorded',
                    message: 'No salary settlements have been processed for this staff member yet.',
                    icon: Icons.history_rounded,
                  );
                }

                return ListView.separated(
                  itemCount: historyList.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = historyList[index];
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
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
                                '${item.periodFrom} → ${item.periodTo}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                              ),
                              const StatusBadge(
                                label: 'Settled',
                                type: StatusType.paid,
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Gross Salary', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                                  Text('₹${item.enteredSalary.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Advance Recovered', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                                  Text('- ₹${item.advanceDeduction.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppColors.error)),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  const Text('Final Payout', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                                  Text('₹${item.finalSalary.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.success)),
                                ],
                              ),
                            ],
                          ),
                          if (item.settledByName != null || item.settledAt != null) ...[
                            const Divider(height: 14, color: AppColors.border),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  item.settledByName != null ? 'Settled by: ${item.settledByName}' : '',
                                  style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                                ),
                                Text(
                                  _formatDate(item.settledAt),
                                  style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ],
                          if (item.notes != null && item.notes!.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Notes: ${item.notes}',
                              style: const TextStyle(fontSize: 10, fontStyle: FontStyle.italic, color: AppColors.textSecondary),
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
