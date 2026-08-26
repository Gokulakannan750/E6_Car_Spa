import 'package:flutter/material.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/constants/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final StatusType type;
  final bool isCompact;

  const StatusBadge({
    super.key,
    required this.label,
    required this.type,
    this.isCompact = false,
  });

  factory StatusBadge.fromLabel(String label, {bool isCompact = false}) {
    final lower = label.toLowerCase();
    StatusType type;
    if (lower.contains('progress')) {
      type = StatusType.inProgress;
    } else if (lower.contains('ready') || lower.contains('completed') || lower.contains('delivered')) {
      type = StatusType.completed;
    } else if (lower.contains('paid')) {
      type = StatusType.paid;
    } else if (lower.contains('cancel')) {
      type = StatusType.cancelled;
    } else if (lower.contains('quality') || lower.contains('pending')) {
      type = StatusType.pending;
    } else if (lower.contains('invoice')) {
      type = StatusType.confirmed;
    } else {
      type = StatusType.draft;
    }
    return StatusBadge(label: label, type: type, isCompact: isCompact);
  }

  Color get _bgColor {
    switch (type) {
      case StatusType.pending:
        return AppColors.qualityCheckBg;
      case StatusType.inProgress:
        return AppColors.inProgressBg;
      case StatusType.completed:
        return AppColors.readyBg;
      case StatusType.cancelled:
        return AppColors.cancelledBg;
      case StatusType.draft:
        return AppColors.draftBg;
      case StatusType.paid:
        return AppColors.readyBg;
      case StatusType.overdue:
        return AppColors.cancelledBg;
      case StatusType.confirmed:
        return AppColors.invoicedBg;
      case StatusType.locked:
        return AppColors.draftBg;
    }
  }

  Color get _borderColor {
    switch (type) {
      case StatusType.pending:
        return AppColors.qualityCheckBorder;
      case StatusType.inProgress:
        return AppColors.inProgressBorder;
      case StatusType.completed:
        return AppColors.readyBorder;
      case StatusType.cancelled:
        return AppColors.cancelledBorder;
      case StatusType.draft:
        return AppColors.draftBorder;
      case StatusType.paid:
        return AppColors.readyBorder;
      case StatusType.overdue:
        return AppColors.cancelledBorder;
      case StatusType.confirmed:
        return AppColors.invoicedBorder;
      case StatusType.locked:
        return AppColors.draftBorder;
    }
  }

  Color get _textColor {
    switch (type) {
      case StatusType.pending:
        return AppColors.qualityCheckText;
      case StatusType.inProgress:
        return AppColors.inProgressText;
      case StatusType.completed:
        return AppColors.readyText;
      case StatusType.cancelled:
        return AppColors.cancelledText;
      case StatusType.draft:
        return AppColors.draftText;
      case StatusType.paid:
        return AppColors.readyText;
      case StatusType.overdue:
        return AppColors.cancelledText;
      case StatusType.confirmed:
        return AppColors.invoicedText;
      case StatusType.locked:
        return AppColors.draftText;
    }
  }

  IconData get _icon {
    switch (type) {
      case StatusType.pending:
        return Icons.hourglass_top_outlined;
      case StatusType.inProgress:
        return Icons.autorenew_rounded;
      case StatusType.completed:
        return Icons.check_circle_outline_rounded;
      case StatusType.cancelled:
        return Icons.cancel_outlined;
      case StatusType.draft:
        return Icons.edit_note_rounded;
      case StatusType.paid:
        return Icons.payments_outlined;
      case StatusType.overdue:
        return Icons.warning_amber_outlined;
      case StatusType.confirmed:
        return Icons.verified_outlined;
      case StatusType.locked:
        return Icons.lock_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: isCompact
          ? const EdgeInsets.symmetric(horizontal: 8, vertical: 3)
          : const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _bgColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: _borderColor, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_icon, size: isCompact ? 12 : 14, color: _textColor),
          const SizedBox(width: 5),
          Text(
            label,
            style: (isCompact ? AppTextStyles.labelSmall : AppTextStyles.labelMedium).copyWith(
              color: _textColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

enum StatusType {
  pending,
  inProgress,
  completed,
  cancelled,
  draft,
  paid,
  overdue,
  confirmed,
  locked,
}
