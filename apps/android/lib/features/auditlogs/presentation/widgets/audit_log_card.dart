import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../models/audit_log_model.dart';

class AuditLogCard extends StatelessWidget {
  final AuditLogModel log;
  final VoidCallback onTap;

  const AuditLogCard({
    super.key,
    required this.log,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final localTime = log.timestampUtc.toLocal();
    final dateStr = DateFormat('dd MMM yyyy').format(localTime);
    final timeStr = DateFormat('hh:mm a').format(localTime);

    final actionBadge = _getActionBadgeStyle(log.action);
    final isSuccess = log.isSuccess;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Timestamp & Outcome Badge
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.schedule_rounded,
                          size: 14,
                          color: AppColors.textTertiary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '$dateStr • $timeStr',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: isSuccess
                            ? AppColors.successLight
                            : AppColors.errorLight,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSuccess
                              ? AppColors.readyBorder
                              : AppColors.cancelledBorder,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isSuccess
                                ? Icons.check_circle_rounded
                                : Icons.cancel_rounded,
                            size: 12,
                            color: isSuccess
                                ? AppColors.success
                                : AppColors.error,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            log.outcome,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isSuccess
                                  ? AppColors.success
                                  : AppColors.error,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // Actor & Role
                Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Center(
                        child: Text(
                          (log.userName != null && log.userName!.isNotEmpty)
                              ? log.userName![0].toUpperCase()
                              : 'S',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            log.userName ?? 'Anonymous / System',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (log.userRole != null && log.userRole!.isNotEmpty)
                      _buildRoleBadge(log.userRole!),
                  ],
                ),

                const SizedBox(height: 10),

                // Module & Action Badges
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        log.module.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: actionBadge.bgColor,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: actionBadge.borderColor),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: actionBadge.dotColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            log.action,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: actionBadge.textColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // Entity Reference if present
                if (log.entityReference != null &&
                    log.entityReference!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.link_rounded,
                          size: 13,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            log.entityReference!,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (log.entityType != null &&
                            log.entityType!.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Text(
                            '(${log.entityType})',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textTertiary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 8),

                // Description
                Text(
                  log.description,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

                const SizedBox(height: 8),
                const Divider(height: 1, color: AppColors.borderLight),
                const SizedBox(height: 6),

                // Bottom Details prompt
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: const [
                    Text(
                      'View full details',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                    SizedBox(width: 2),
                    Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 10,
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleBadge(String role) {
    Color bg;
    Color text;
    Color border;

    switch (role.toLowerCase()) {
      case 'owner':
        bg = const Color(0xFFFAF5FF);
        text = const Color(0xFF6B21A8);
        border = const Color(0xFFE9D5FF);
        break;
      case 'manager':
        bg = AppColors.inProgressBg;
        text = AppColors.inProgressText;
        border = AppColors.inProgressBorder;
        break;
      default:
        bg = AppColors.surfaceAlt;
        text = AppColors.textSecondary;
        border = AppColors.border;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: border),
      ),
      child: Text(
        role,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: text,
        ),
      ),
    );
  }

  _ActionBadgeStyle _getActionBadgeStyle(String action) {
    final act = action.toUpperCase();

    if (act.contains('SUCCESS') ||
        act.contains('CREATED') ||
        act == 'CREATE' ||
        act.contains('CONFIRMED')) {
      return const _ActionBadgeStyle(
        bgColor: Color(0xFFECFDF5),
        textColor: Color(0xFF047857),
        borderColor: Color(0xFFA7F3D0),
        dotColor: Color(0xFF10B981),
      );
    }

    if (act.contains('FAILED') ||
        act.contains('DELETE') ||
        act.contains('VOID') ||
        act.contains('DEACTIVATED') ||
        act.contains('OBSOLETED') ||
        act == 'CANCEL') {
      return const _ActionBadgeStyle(
        bgColor: Color(0xFFFEF2F2),
        textColor: Color(0xFFB91C1C),
        borderColor: Color(0xFFFECACA),
        dotColor: Color(0xFFEF4444),
      );
    }

    if (act.contains('UNLOCKED') ||
        act.contains('GENERATE') ||
        act.contains('SETTLED') ||
        act.contains('PAYMENT')) {
      return const _ActionBadgeStyle(
        bgColor: Color(0xFFFAF5FF),
        textColor: Color(0xFF6B21A8),
        borderColor: Color(0xFFE9D5FF),
        dotColor: Color(0xFFA855F7),
      );
    }

    return const _ActionBadgeStyle(
      bgColor: Color(0xFFFFFBEB),
      textColor: Color(0xFFB45309),
      borderColor: Color(0xFFFDE68A),
      dotColor: Color(0xFFF59E0B),
    );
  }
}

class _ActionBadgeStyle {
  final Color bgColor;
  final Color textColor;
  final Color borderColor;
  final Color dotColor;

  const _ActionBadgeStyle({
    required this.bgColor,
    required this.textColor,
    required this.borderColor,
    required this.dotColor,
  });
}
