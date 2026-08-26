import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../models/staff_advance_model.dart';
import '../../providers/staff_advance_history_provider.dart';

class StaffAdvanceHistorySheet extends ConsumerWidget {
  final String staffId;
  final String staffName;

  const StaffAdvanceHistorySheet({
    super.key,
    required this.staffId,
    required this.staffName,
  });

  String _formatCurrency(double amount) {
    final parts = amount.toStringAsFixed(2).split('.');
    final integerPart = parts[0];
    final decimalPart = parts[1];

    final reg = RegExp(r'(\d+?)(?=(\d\d)+(\d)(?!\d))');
    final formattedInt = integerPart.replaceAllMapped(reg, (Match m) => '${m[1]},');
    return '₹$formattedInt.$decimalPart';
  }

  String _formatDate(DateTime date) {
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  StatusType _statusType(StaffAdvanceStatus status) {
    switch (status) {
      case StaffAdvanceStatus.outstanding:
        return StatusType.pending;
      case StaffAdvanceStatus.settled:
        return StatusType.completed;
      case StaffAdvanceStatus.obsolete:
        return StatusType.cancelled;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(staffAdvanceHistoryProvider(staffId));

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          AppModalHeader(
            title: 'Advance History',
            subtitle: staffName,
            icon: Icons.history_rounded,
            iconBgColor: AppColors.inProgressBg,
            iconColor: AppColors.primary,
            showDragHandle: true,
          ),
          const SizedBox(height: 14),

          Expanded(
            child: historyAsync.when(
              loading: () => const AppLoadingState(message: 'Loading advance history...'),
              error: (err, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline, size: 36, color: AppColors.error),
                      const SizedBox(height: 10),
                      Text(
                        'Could not load advance history.',
                        style: AppTextStyles.bodyMedium.copyWith(color: AppColors.error),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        err.toString(),
                        style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
              data: (history) {
                return Column(
                  children: [
                    // Summary cards
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _StatItem(
                            label: 'Lifetime',
                            value: _formatCurrency(history.totalAdvancesAmount),
                            color: AppColors.textPrimary,
                          ),
                          Container(width: 1, height: 28, color: AppColors.border),
                          _StatItem(
                            label: 'Outstanding',
                            value: _formatCurrency(history.outstandingAmount),
                            color: AppColors.warning,
                          ),
                          Container(width: 1, height: 28, color: AppColors.border),
                          _StatItem(
                            label: 'Settled',
                            value: _formatCurrency(history.settledAmount),
                            color: AppColors.success,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Timeline / list
                    Expanded(
                      child: history.advances.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.receipt_long_outlined, size: 36, color: AppColors.textSecondary),
                                  const SizedBox(height: 8),
                                  Text(
                                    'No advances found for this staff member.',
                                    style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            )
                          : ListView.separated(
                              itemCount: history.advances.length,
                              separatorBuilder: (context, index) => const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final adv = history.advances[index];
                                return Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            _formatCurrency(adv.amount),
                                            style: AppTextStyles.headingSmall.copyWith(
                                              fontFamily: 'monospace',
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          StatusBadge(
                                            label: adv.status.label,
                                            type: _statusType(adv.status),
                                            isCompact: true,
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Row(
                                        children: [
                                          const Icon(Icons.calendar_today_outlined, size: 12, color: AppColors.textSecondary),
                                          const SizedBox(width: 4),
                                          Text(
                                            _formatDate(adv.advanceDate),
                                            style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                                          ),
                                          const SizedBox(width: 10),
                                          const Icon(Icons.label_outline, size: 12, color: AppColors.textSecondary),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              adv.reason,
                                              style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (adv.isSettled && adv.settledAt != null)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 4),
                                          child: Text(
                                            'Settled on ${_formatDate(adv.settledAt!)}',
                                            style: AppTextStyles.labelSmall.copyWith(color: AppColors.success),
                                          ),
                                        ),
                                      if (adv.isObsolete && adv.obsoleteReason != null)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 4),
                                          child: Text(
                                            'Obsoleted: ${adv.obsoleteReason}',
                                            style: AppTextStyles.labelSmall.copyWith(color: AppColors.error),
                                          ),
                                        ),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: AppTextStyles.labelSmall.copyWith(color: AppColors.textSecondary, fontSize: 11),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: AppTextStyles.bodyMedium.copyWith(
            fontWeight: FontWeight.w700,
            fontFamily: 'monospace',
            color: color,
          ),
        ),
      ],
    );
  }
}
