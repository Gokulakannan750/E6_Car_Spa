import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/showroom_staff_assignment_model.dart';

class DailyStaffAssignmentCard extends StatelessWidget {
  final DailyStaffAssignment assignment;
  final VoidCallback? onRemove;
  final Future<void> Function(int newVehiclesAttended)? onEditVehicles;
  final bool canManage;
  final bool isLocked;

  const DailyStaffAssignmentCard({
    super.key,
    required this.assignment,
    this.onRemove,
    this.onEditVehicles,
    this.canManage = true,
    this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
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
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.primary.withAlpha(25),
              child: Text(
                assignment.initials,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 12),

            // Staff Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    assignment.staffName,
                    style: AppTextStyles.bodyMedium.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 6,
                    runSpacing: 2,
                    children: [
                      if (assignment.staffRole != null && assignment.staffRole!.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
                ],
              ),
            ),

            // Vehicles Attended Count Badge (Tappable to Edit when not locked)
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: canManage && !isLocked && onEditVehicles != null
                  ? () => _openEditVehiclesDialog(context)
                  : null,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isLocked ? AppColors.surfaceAlt : AppColors.accentPill,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isLocked
                        ? AppColors.border
                        : AppColors.primary.withAlpha(50),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isLocked ? Icons.lock_outline : Icons.directions_car_outlined,
                      size: 13,
                      color: isLocked ? AppColors.textSecondary : AppColors.primary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${assignment.vehiclesAttended}',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w700,
                        color: isLocked ? AppColors.textSecondary : AppColors.primary,
                        fontSize: 12,
                      ),
                    ),
                    if (canManage && !isLocked && onEditVehicles != null) ...[
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.edit_outlined,
                        size: 12,
                        color: AppColors.primary,
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // Delete / Remove Action (only when not locked)
            if (canManage && !isLocked && onRemove != null) ...[
              const SizedBox(width: 6),
              IconButton(
                onPressed: () => _confirmRemoval(context),
                icon: const Icon(Icons.delete_outline, size: 18),
                color: AppColors.error,
                tooltip: 'Remove from Daily Roster',
                visualDensity: VisualDensity.compact,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _openEditVehiclesDialog(BuildContext context) async {
    final controller = TextEditingController(text: '${assignment.vehiclesAttended}');
    String? errorText;

    await showDialog<void>(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          return AlertDialog(
            backgroundColor: Colors.white,
            title: Text(
              'Edit Vehicles Attended',
              style: AppTextStyles.headingSmall.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Staff: ${assignment.staffName}',
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 14),
                AppTextField(
                  key: const Key('edit_vehicles_attended_input'),
                  controller: controller,
                  label: 'Vehicles Attended',
                  hintText: '0',
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  prefixIcon: const Icon(Icons.directions_car_outlined, size: 20),
                  onChanged: (_) {
                    if (errorText != null) {
                      setDialogState(() => errorText = null);
                    }
                  },
                ),
                if (errorText != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    errorText!,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.error,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogCtx).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
                onPressed: () async {
                  final raw = controller.text.trim();
                  final val = int.tryParse(raw);
                  if (val == null || val < 0) {
                    setDialogState(() {
                      errorText = 'Enter a valid non-negative integer.';
                    });
                    return;
                  }
                  Navigator.of(dialogCtx).pop();
                  if (onEditVehicles != null) {
                    await onEditVehicles!(val);
                  }
                },
                child: const Text('Save'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _confirmRemoval(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Staff Assignment'),
        content: Text(
          'Remove ${assignment.staffName} from this showroom on this date?',
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
