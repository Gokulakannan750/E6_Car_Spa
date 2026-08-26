import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../models/staff_advance_model.dart';

class AdvanceCard extends StatelessWidget {
  final StaffAdvance advance;
  final VoidCallback? onSettle;
  final VoidCallback? onObsolete;
  final VoidCallback? onHistory;
  final bool canSettle;
  final bool canObsolete;

  const AdvanceCard({
    super.key,
    required this.advance,
    this.onSettle,
    this.onObsolete,
    this.onHistory,
    this.canSettle = true,
    this.canObsolete = true,
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

  StatusType get _statusType {
    switch (advance.status) {
      case StaffAdvanceStatus.outstanding:
        return StatusType.pending;
      case StaffAdvanceStatus.settled:
        return StatusType.completed;
      case StaffAdvanceStatus.obsolete:
        return StatusType.cancelled;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: advance.isOutstanding ? AppColors.warning.withAlpha(80) : AppColors.border,
          width: advance.isOutstanding ? 1.2 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(5),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: Staff Name & Status Badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        advance.staffName,
                        style: AppTextStyles.headingSmall.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (advance.staffRole != null && advance.staffRole!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            advance.staffRole!,
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                StatusBadge(
                  label: advance.status.label,
                  type: _statusType,
                  isCompact: true,
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Row 2: Amount & Date
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Amount',
                      style: AppTextStyles.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatCurrency(advance.amount),
                      style: AppTextStyles.headingMedium.copyWith(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w800,
                        color: advance.isOutstanding
                            ? AppColors.primary
                            : (advance.isSettled ? AppColors.success : AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Advance Date',
                      style: AppTextStyles.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_outlined, size: 12, color: AppColors.textSecondary),
                        const SizedBox(width: 4),
                        Text(
                          _formatDate(advance.advanceDate),
                          style: AppTextStyles.bodySmall.copyWith(
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Reason & Notes
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  const Icon(Icons.label_outline_rounded, size: 13, color: AppColors.textSecondary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      advance.reason + (advance.notes != null && advance.notes!.isNotEmpty ? ' — ${advance.notes}' : ''),
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.textPrimary,
                        fontSize: 12,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),

            // Settlement or Obsolete metadata
            if (advance.isSettled && advance.settledAt != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, size: 13, color: AppColors.success),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        'Settled on ${_formatDate(advance.settledAt!)}${advance.settledByName != null ? ' by ${advance.settledByName}' : ''}',
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.success,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            if (advance.isObsolete && advance.obsoleteReason != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, size: 13, color: AppColors.error),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        'Obsoleted: ${advance.obsoleteReason}',
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.error,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 10),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: 6),

            // Actions row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton.icon(
                  onPressed: onHistory,
                  icon: const Icon(Icons.history_rounded, size: 16),
                  label: const Text('History', style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
                if (advance.isOutstanding)
                  Row(
                    children: [
                      if (canObsolete)
                        TextButton(
                          onPressed: onObsolete,
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.error,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            visualDensity: VisualDensity.compact,
                          ),
                          child: const Text('Mark Obsolete', style: TextStyle(fontSize: 12)),
                        ),
                      if (canSettle)
                        ElevatedButton.icon(
                          onPressed: onSettle,
                          icon: const Icon(Icons.check, size: 14),
                          label: const Text('Settle', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            visualDensity: VisualDensity.compact,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(6),
                            ),
                          ),
                        ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
