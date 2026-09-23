import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../models/staff_salary_models.dart';
import 'enter_salary_bottom_sheet.dart';
import 'settle_salary_bottom_sheet.dart';
import 'settlement_history_bottom_sheet.dart';

class SalaryStaffCard extends ConsumerWidget {
  final StaffSalaryItem item;
  final VoidCallback? onEnterSalary;
  final VoidCallback? onSettleSalary;
  final VoidCallback? onSettlementHistory;

  const SalaryStaffCard({
    super.key,
    required this.item,
    this.onEnterSalary,
    this.onSettleSalary,
    this.onSettlementHistory,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;
    final canManageSalary = user?.isOwner == true || (user?.permissions.contains('staff_salary.manage') ?? false) || (user?.permissions.contains('staff.manage') ?? false);
    final canSettleSalary = user?.isOwner == true || (user?.permissions.contains('staff_salary.settle') ?? false) || (user?.permissions.contains('staff.manage') ?? false);

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
      statusLabel = 'Salary Not Entered';
    }

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSettled
              ? AppColors.success.withAlpha(80)
              : isReady
                  ? AppColors.primary.withAlpha(80)
                  : AppColors.border,
        ),
      ),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Staff Info & Status
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.accentPill,
                  child: Text(
                    item.staffName.isNotEmpty ? item.staffName.substring(0, 1).toUpperCase() : 'S',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.staffName,
                        style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        '${item.staffRole ?? 'Staff'} • ${item.staffPhoneNumber}',
                        style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                StatusBadge(
                  label: statusLabel,
                  type: statusType,
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Financial Metrics Grid
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Entered Salary', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                        const SizedBox(height: 2),
                        Text(
                          item.enteredSalary != null ? '₹${item.enteredSalary!.toStringAsFixed(0)}' : '—',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 28, color: AppColors.border),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Applicable Advance', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                        const SizedBox(height: 2),
                        Text(
                          '₹${item.outstandingAdvance.toStringAsFixed(0)}',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.warningDark),
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 28, color: AppColors.border),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Net Final Payout', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                        const SizedBox(height: 2),
                        Text(
                          item.finalSalary != null ? '₹${item.finalSalary!.toStringAsFixed(0)}' : '—',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: item.finalSalary != null ? AppColors.success : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Action Buttons
            Row(
              children: [
                if (!isSettled && canManageSalary) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        side: const BorderSide(color: AppColors.primary),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.edit_outlined, size: 15, color: AppColors.primary),
                      label: Text(
                        item.enteredSalary != null ? 'Edit Salary' : 'Enter Salary',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
                      ),
                      onPressed: onEnterSalary ?? () => EnterSalaryBottomSheet.show(context, item),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                if (!isSettled && isReady && canSettleSalary) ...[
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.success,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.check_circle_outline_rounded, size: 15),
                      label: const Text('Settle', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      onPressed: onSettleSalary ?? () => SettleSalaryBottomSheet.show(context, item),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                IconButton(
                  icon: const Icon(Icons.history_rounded, size: 20, color: AppColors.textSecondary),
                  tooltip: 'Settlement History',
                  onPressed: onSettlementHistory ?? () => SettlementHistoryBottomSheet.show(context, item.staffId, item.staffName),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
