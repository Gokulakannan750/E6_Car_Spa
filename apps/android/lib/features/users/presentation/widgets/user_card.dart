import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../models/user_model.dart';
import 'user_role_badge.dart';

class UserCard extends StatelessWidget {
  final UserModel user;
  final bool isSelf;
  final bool canEdit;
  final bool canDeactivate;
  final VoidCallback? onEdit;
  final VoidCallback? onToggleStatus;

  const UserCard({
    super.key,
    required this.user,
    required this.isSelf,
    required this.canEdit,
    required this.canDeactivate,
    this.onEdit,
    this.onToggleStatus,
  });

  String _getInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return 'U';
    if (parts.length == 1) {
      return parts[0].isNotEmpty ? parts[0].substring(0, 1).toUpperCase() : 'U';
    }
    return '${parts[0].substring(0, 1)}${parts[1].substring(0, 1)}'
        .toUpperCase();
  }

  Color _getAvatarBg(String role) {
    switch (role.toLowerCase()) {
      case 'owner':
        return const Color(0xFFF3E8FF);
      case 'manager':
        return const Color(0xFFDBEAFE);
      case 'staff':
      default:
        return const Color(0xFFF1F5F9);
    }
  }

  Color _getAvatarText(String role) {
    switch (role.toLowerCase()) {
      case 'owner':
        return const Color(0xFF6B21A8);
      case 'manager':
        return const Color(0xFF1E40AF);
      case 'staff':
      default:
        return const Color(0xFF475569);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = user.isOwner;
    final formattedLastLogin = user.lastLoginAt != null
        ? DateFormat('d MMM yyyy, h:mm a').format(user.lastLoginAt!.toLocal())
        : 'Never';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: user.isActive ? AppColors.border : const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top row: Avatar + Name/Username + Role/Status Badges
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar
                CircleAvatar(
                  radius: 22,
                  backgroundColor: _getAvatarBg(user.role),
                  child: Text(
                    _getInitials(user.fullName),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: _getAvatarText(user.role),
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Name & Username
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              user.fullName,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isSelf) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withAlpha(20),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'You',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '@${user.username}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),

                // Role & Status Badges
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    UserRoleBadge(role: user.role),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: user.isActive
                            ? const Color(0xFFECFDF5)
                            : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: user.isActive
                              ? const Color(0xFFA7F3D0)
                              : const Color(0xFFCBD5E1),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            user.isActive
                                ? Icons.check_circle_rounded
                                : Icons.cancel_rounded,
                            size: 11,
                            color: user.isActive
                                ? const Color(0xFF059669)
                                : const Color(0xFF64748B),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            user.isActive ? 'Active' : 'Inactive',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: user.isActive
                                  ? const Color(0xFF047857)
                                  : const Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),

            if (user.email != null && user.email!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.email_outlined,
                      size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      user.email!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],

            const Divider(height: 20, color: AppColors.border),

            // Bottom section: Permissions summary + Last login + Action buttons
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Permissions
                      if (isOwner)
                        const Row(
                          children: [
                            Icon(Icons.all_inclusive_rounded,
                                size: 14, color: Color(0xFF7C3AED)),
                            SizedBox(width: 4),
                            Text(
                              'Full Access (All Modules)',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF7C3AED),
                              ),
                            ),
                          ],
                        )
                      else
                        Row(
                          children: [
                            const Icon(Icons.lock_open_rounded,
                                size: 14, color: AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Text(
                              '${user.permissions.length} permissions granted',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      const SizedBox(height: 4),
                      // Last Login
                      Row(
                        children: [
                          const Icon(Icons.access_time_rounded,
                              size: 13, color: AppColors.textTertiary),
                          const SizedBox(width: 4),
                          Text(
                            'Last login: $formattedLastLogin',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textTertiary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Action Buttons
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (canEdit)
                      IconButton(
                        onPressed: onEdit,
                        icon: const Icon(Icons.edit_outlined, size: 19),
                        color: AppColors.primary,
                        tooltip: 'Edit User',
                        padding: const EdgeInsets.all(8),
                        constraints: const BoxConstraints(),
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.accentPill,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    if (canDeactivate && !isOwner && !isSelf) ...[
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: onToggleStatus,
                        icon: Icon(
                          Icons.power_settings_new_rounded,
                          size: 19,
                          color: user.isActive
                              ? const Color(0xFFDC2626)
                              : const Color(0xFF059669),
                        ),
                        tooltip: user.isActive ? 'Deactivate User' : 'Activate User',
                        padding: const EdgeInsets.all(8),
                        constraints: const BoxConstraints(),
                        style: IconButton.styleFrom(
                          backgroundColor: user.isActive
                              ? const Color(0xFFFEF2F2)
                              : const Color(0xFFECFDF5),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ],
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
