import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../models/staff_salary_models.dart';
import 'settle_salary_bottom_sheet.dart';

class SalaryDetailsBottomSheet extends StatelessWidget {
  final StaffSalaryItem item;
  final bool canSettle;

  const SalaryDetailsBottomSheet({
    super.key,
    required this.item,
    this.canSettle = false,
  });

  static Future<void> show(
    BuildContext context,
    StaffSalaryItem item, {
    bool canSettle = false,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) =>
          SalaryDetailsBottomSheet(item: item, canSettle: canSettle),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return '—';
    try {
      final dt = DateTime.parse(dateStr);
      return DateFormat('dd MMM yyyy').format(dt);
    } catch (_) {
      return dateStr;
    }
  }

  String _formatDateTime(DateTime? dt) {
    if (dt == null) return '—';
    return DateFormat('dd MMM yyyy, hh:mm a').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );

    final isSettled = item.isSettled;
    final isReady = item.isReady;

    StatusType statusType;
    String statusLabel;

    if (isSettled) {
      statusType = StatusType.paid;
      statusLabel = 'Settled';
    } else if (isReady) {
      statusType = StatusType.confirmed;
      statusLabel = 'Ready for Settlement';
    } else {
      statusType = StatusType.draft;
      statusLabel = 'Not Entered';
    }

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
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
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isSettled
                          ? 'Salary Settlement Receipt'
                          : 'Salary Details',
                      style: AppTextStyles.headingMedium.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Complete payroll and advance breakdown for this period.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(
                    Icons.close_rounded,
                    color: AppColors.textSecondary,
                  ),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(height: 20, color: AppColors.border),

            // Staff Info Card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: AppColors.accentPill,
                    child: Text(
                      item.staffName.isNotEmpty
                          ? item.staffName.substring(0, 1).toUpperCase()
                          : 'S',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.staffName,
                          style: AppTextStyles.bodyMedium.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${item.staffRole ?? 'Staff Member'} · ${item.staffPhoneNumber}',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  StatusBadge(label: statusLabel, type: statusType),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Financial Snapshot Breakdown Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  // Salary Period Row
                  _buildRow(
                    'Salary Period',
                    '${_formatDate(item.periodFrom)} — ${_formatDate(item.periodTo)}',
                    isBold: true,
                  ),
                  const Divider(height: 20, color: AppColors.border),

                  // Gross Entered Salary
                  _buildRow(
                    'Entered Salary',
                    item.enteredSalary != null
                        ? currencyFormat.format(item.enteredSalary)
                        : '—',
                    isBold: item.enteredSalary != null,
                  ),
                  const SizedBox(height: 8),

                  // Outstanding Advance Before Settlement
                  _buildRow(
                    isSettled
                        ? 'Outstanding Advance (Before Settlement)'
                        : 'Current Outstanding Advance',
                    currencyFormat.format(item.outstandingAdvance),
                    color: item.outstandingAdvance > 0
                        ? AppColors.warningDark
                        : AppColors.textSecondary,
                  ),
                  const SizedBox(height: 8),

                  // Advance Recovery Deduction
                  _buildRow(
                    'Advance Recovery',
                    item.advanceDeduction != null
                        ? '- ${currencyFormat.format(item.advanceDeduction)}'
                        : '—',
                    color:
                        (item.advanceDeduction != null &&
                            item.advanceDeduction! > 0)
                        ? AppColors.error
                        : AppColors.textSecondary,
                    isBold:
                        item.advanceDeduction != null &&
                        item.advanceDeduction! > 0,
                  ),
                  const Divider(height: 20, color: AppColors.border),

                  // Net Payable Salary
                  _buildRow(
                    'Salary Payable (Net Final Payout)',
                    item.finalSalary != null
                        ? currencyFormat.format(item.finalSalary)
                        : '—',
                    color: item.finalSalary != null
                        ? AppColors.success
                        : AppColors.textSecondary,
                    isBold: true,
                    fontSize: 15,
                  ),
                  const SizedBox(height: 8),

                  // Remaining Advance Balance
                  _buildRow(
                    'Remaining Advance Balance',
                    item.remainingAdvance != null
                        ? currencyFormat.format(item.remainingAdvance)
                        : '—',
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Historical Settlement Snapshot metadata
            if (isSettled) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.success.withAlpha(20),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.success.withAlpha(60)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.check_circle_outline_rounded,
                      size: 18,
                      color: AppColors.success,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Historical Settlement Snapshot',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppColors.success,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Settled on ${_formatDateTime(item.settledAt)}${item.settledByName != null ? ' by ${item.settledByName}' : ''}.',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Notes
            if (item.notes != null && item.notes!.trim().isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Notes / Remarks:',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.notes!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Actions
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Close'),
                  ),
                ),
                if (!isSettled && isReady && canSettle) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      label: 'Settle Salary',
                      icon: Icons.check_circle_outline_rounded,
                      onPressed: () {
                        Navigator.pop(context);
                        SettleSalaryBottomSheet.show(context, item);
                      },
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(
    String label,
    String value, {
    Color? color,
    bool isBold = false,
    double fontSize = 13,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: color ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
