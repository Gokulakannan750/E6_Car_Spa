import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../features/auth/providers/auth_provider.dart';

class AppLogoutAction extends ConsumerWidget {
  const AppLogoutAction({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: IconButton(
        icon: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: AppColors.accentPill,
            borderRadius: BorderRadius.circular(17),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
          ),
          child: const Center(
            child: Icon(Icons.logout_rounded, size: 18, color: AppColors.primary),
          ),
        ),
        tooltip: 'Sign Out',
        onPressed: () => _confirmLogout(context, ref, user?.username),
      ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref, String? username) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: AppColors.error),
            SizedBox(width: 8),
            Text('Sign Out', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary)),
          ],
        ),
        content: Text(
          username != null
              ? 'Are you sure you want to sign out from account "$username"?'
              : 'Are you sure you want to sign out of E6 Car Spa?',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        actions: [
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.textPrimary,
              side: const BorderSide(color: AppColors.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(authNotifierProvider.notifier).logout();
            },
            child: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
