import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../models/staff_model.dart';

/// Mobile-adapted Table/List row presentation for Staff Directory matching Desktop layout.
class StaffCard extends StatelessWidget {
  final Staff staff;
  final VoidCallback? onEdit;
  final VoidCallback? onHistory;
  final VoidCallback? onAddAdvance;
  final bool canEdit;
  final bool canCreateAdvance;

  const StaffCard({
    super.key,
    required this.staff,
    this.onEdit,
    this.onHistory,
    this.onAddAdvance,
    this.canEdit = true,
    this.canCreateAdvance = true,
  });

  String _formatCurrency(double amount) {
    final parts = amount.toStringAsFixed(2).split('.');
    final integerPart = parts[0];
    final decimalPart = parts[1];

    final reg = RegExp(r'(\d+?)(?=(\d\d)+(\d)(?!\d))');
    final formattedInt = integerPart.replaceAllMapped(reg, (Match m) => '${m[1]},');
    return '₹$formattedInt.$decimalPart';
  }

  @override
  Widget build(BuildContext context) {
    final hasOutstanding = staff.totalAdvances > 0 && staff.totalAdvanceAmount > 0;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: staff.isActive ? AppColors.border : AppColors.border.withAlpha(120),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(4),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Table Row 1: Staff Member Header & Status
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar Box
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: staff.isActive
                        ? AppColors.primary.withAlpha(20)
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: staff.isActive
                          ? AppColors.primary.withAlpha(50)
                          : AppColors.border,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    staff.initials,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: staff.isActive ? AppColors.primary : AppColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                // Name & Role
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        staff.name,
                        style: AppTextStyles.bodyMedium.copyWith(
                          fontWeight: FontWeight.w700,
                          color: staff.isActive ? AppColors.textPrimary : AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          staff.role?.isNotEmpty == true ? staff.role! : 'Staff Member',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Status Pill
                StatusBadge(
                  label: staff.isActive ? 'Active' : 'Inactive',
                  type: staff.isActive ? StatusType.completed : StatusType.cancelled,
                  isCompact: true,
                ),
              ],
            ),
          ),

          // Table Row 2: Contact Details (Phone & Email / Address)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(Icons.phone_outlined, size: 13, color: AppColors.textSecondary),
                      const SizedBox(width: 6),
                      Text(
                        staff.phoneNumber,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (staff.email != null && staff.email!.isNotEmpty) ...[
                        const SizedBox(width: 10),
                        const Text('·', style: TextStyle(color: AppColors.textSecondary)),
                        const SizedBox(width: 10),
                        const Icon(Icons.email_outlined, size: 13, color: AppColors.textSecondary),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            staff.email!,
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (staff.address != null && staff.address!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 13, color: AppColors.textSecondary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            staff.address!,
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Table Row 3: Outstanding Advance Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: hasOutstanding
                    ? const Color(0xFFFFFBEB)
                    : Colors.white,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: hasOutstanding
                      ? const Color(0xFFFDE68A)
                      : AppColors.border,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.account_balance_wallet_outlined,
                        size: 13,
                        color: hasOutstanding ? const Color(0xFFB45309) : AppColors.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Total Advances: ${staff.totalAdvances}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: hasOutstanding ? const Color(0xFF92400E) : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    _formatCurrency(staff.totalAdvanceAmount),
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: hasOutstanding ? const Color(0xFFB45309) : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 8),
          const Divider(height: 1, color: AppColors.border),

          // Table Row 4: Action Toolbar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton.icon(
                  onPressed: onHistory,
                  icon: const Icon(Icons.history_rounded, size: 14),
                  label: const Text('Advance History', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600)),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (canCreateAdvance && staff.isActive && onAddAdvance != null) ...[
                      OutlinedButton.icon(
                        onPressed: onAddAdvance,
                        icon: const Icon(Icons.add_rounded, size: 13),
                        label: const Text('+ Advance', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary, width: 1),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          visualDensity: VisualDensity.compact,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                      ),
                      const SizedBox(width: 4),
                    ],
                    if (canEdit)
                      IconButton(
                        onPressed: onEdit,
                        icon: const Icon(Icons.edit_outlined, size: 15, color: AppColors.primary),
                        tooltip: 'Edit Staff Member',
                        padding: const EdgeInsets.all(6),
                        constraints: const BoxConstraints(),
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
