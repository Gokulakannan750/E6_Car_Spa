import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../models/showroom_staff_assignment_model.dart';

class DailyStaffAssignmentCard extends StatelessWidget {
  final DailyStaffAssignment assignment;
  final VoidCallback? onRemove;
  final VoidCallback? onEdit;
  final VoidCallback? onSwap;
  final VoidCallback? onViewSwap;
  final bool canManage;
  final bool isLocked;

  const DailyStaffAssignmentCard({
    super.key,
    required this.assignment,
    this.onRemove,
    this.onEdit,
    this.onSwap,
    this.onViewSwap,
    this.canManage = true,
    this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    final isTransfer = assignment.isTemporaryTransfer;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isTransfer
              ? Colors.purple.withAlpha(50)
              : AppColors.border,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(4),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: Avatar, Name, Role/ID, Action Buttons & Locked Badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: isTransfer
                      ? Colors.purple.withAlpha(25)
                      : AppColors.primary.withAlpha(25),
                  child: Text(
                    assignment.initials,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: isTransfer ? Colors.purple : AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              assignment.staffName,
                              style: AppTextStyles.bodyMedium.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (assignment.staffMasterId.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceAlt,
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(
                                  color: AppColors.border.withAlpha(80),
                                ),
                              ),
                              child: Text(
                                '#${assignment.staffMasterId}',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 6,
                        runSpacing: 2,
                        children: [
                          if (assignment.staffRole != null &&
                              assignment.staffRole!.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 1.5,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceAlt,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                assignment.staffRole!,
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.textSecondary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          if (assignment.staffPhone.isNotEmpty)
                            Text(
                              assignment.staffPhone,
                              style: AppTextStyles.bodySmall.copyWith(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                                fontFamily: 'monospace',
                              ),
                            ),
                        ],
                      ),
                      if (assignment.isSwapped) ...[
                        const SizedBox(height: 4),
                        InkWell(
                          onTap: onViewSwap,
                          borderRadius: BorderRadius.circular(4),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.purple.withAlpha(25),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: Colors.purple.withAlpha(80)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.swap_horiz, size: 12, color: Colors.purple),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    'Swapped with ${assignment.swappedWithStaffName ?? "Staff"} (#${assignment.swapId})',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.purple.shade900,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // Action buttons or Locked badge at top right
                if (canManage && !isLocked) ...[
                  const SizedBox(width: 4),
                  if (assignment.isSwapped && onViewSwap != null)
                    IconButton(
                      onPressed: onViewSwap,
                      icon: const Icon(Icons.info_outline, size: 18),
                      color: Colors.purple,
                      tooltip: 'View Swap Traceability',
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    ),
                  if (onSwap != null)
                    IconButton(
                      onPressed: onSwap,
                      icon: const Icon(Icons.swap_horiz, size: 18),
                      color: Colors.purple.shade700,
                      tooltip: 'Swap Staff',
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    ),
                  if (onEdit != null)
                    IconButton(
                      onPressed: onEdit,
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      color: AppColors.primary,
                      tooltip: 'Edit Session',
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    ),
                  if (onRemove != null)
                    IconButton(
                      onPressed: () => _confirmRemoval(context),
                      icon: const Icon(Icons.delete_outline, size: 18),
                      color: AppColors.error,
                      tooltip: 'Remove Session',
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    ),
                ] else if (isLocked) ...[
                  const SizedBox(width: 4),
                  if (assignment.isSwapped && onViewSwap != null)
                    IconButton(
                      onPressed: onViewSwap,
                      icon: const Icon(Icons.info_outline, size: 18),
                      color: Colors.purple,
                      tooltip: 'View Swap Traceability',
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_outline, size: 12, color: AppColors.textSecondary),
                        SizedBox(width: 3),
                        Text(
                          'Locked',
                          style: TextStyle(fontSize: 10, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),

            // Divider line
            Divider(height: 1, color: AppColors.border.withAlpha(80)),
            const SizedBox(height: 8),

            // Row 2: Working Time, Working Hours & Assignment Type Pills (full width Wrap)
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 4,
              children: [
                // Time range
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.access_time_rounded,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      assignment.displayTimeRange,
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
                // Working hours pill
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(20),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: AppColors.primary.withAlpha(50),
                    ),
                  ),
                  child: Text(
                    assignment.displayHours,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
                // Assignment Type Tag
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: assignment.isSwapped
                        ? Colors.purple.withAlpha(25)
                        : isTransfer
                            ? Colors.purple.withAlpha(20)
                            : AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: assignment.isSwapped
                          ? Colors.purple.withAlpha(80)
                          : isTransfer
                              ? Colors.purple.withAlpha(60)
                              : AppColors.border,
                    ),
                  ),
                  child: Text(
                    assignment.isSwapped
                        ? 'Swapped'
                        : isTransfer
                            ? 'Temporary Transfer'
                            : 'Regular',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: (assignment.isSwapped || isTransfer)
                          ? Colors.purple.shade700
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),

            // Row 3: Home Showroom & Transfer / Swap Details
            if (assignment.isSwapped) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(
                    Icons.history_edu_outlined,
                    size: 13,
                    color: Colors.purple.shade600,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Orig: ${assignment.originalShowroomName ?? "Other Showroom"} → Now: ${assignment.showroomName}',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.purple.shade700,
                    ),
                  ),
                ],
              ),
            ] else if (isTransfer || (assignment.homeShowroomName != null && assignment.homeShowroomName!.isNotEmpty)) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(
                    Icons.home_work_outlined,
                    size: 13,
                    color: isTransfer ? Colors.purple.shade600 : AppColors.textSecondary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Home: ${assignment.displayHomeShowroom}',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontSize: 11,
                      fontWeight: isTransfer ? FontWeight.w600 : FontWeight.normal,
                      color: isTransfer ? Colors.purple.shade700 : AppColors.textSecondary,
                    ),
                  ),
                  if (assignment.transferReason != null &&
                      assignment.transferReason!.trim().isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '• ${assignment.transferReason!}',
                        style: AppTextStyles.bodySmall.copyWith(
                          fontSize: 11,
                          fontStyle: FontStyle.italic,
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _confirmRemoval(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Staff Assignment'),
        content: Text(
          'Remove ${assignment.staffName} (${assignment.displayTimeRange}) from this showroom on this date?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed == true && onRemove != null) {
      onRemove!();
    }
  }
}
