import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../../staff/providers/staff_provider.dart';
import '../../../staffadvances/presentation/widgets/staff_advances_content.dart';
import '../../../staffadvances/presentation/widgets/staff_advances_dialogs.dart';

/// Staff Advances tab view embedded in [StaffScreen]'s TabBarView.
class StaffAdvancesTab extends ConsumerStatefulWidget {
  const StaffAdvancesTab({super.key});

  @override
  ConsumerState<StaffAdvancesTab> createState() => _StaffAdvancesTabState();
}

class _StaffAdvancesTabState extends ConsumerState<StaffAdvancesTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final authState = ref.watch(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;

    final canViewAdvances =
        user?.isOwner == true ||
        (user?.permissions.contains('staff_advances.view') ?? false);

    if (!canViewAdvances) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, size: 56, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                'Access Restricted',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'You do not have permission to view Staff Advances (staff_advances.view).',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final canCreateAdvance =
        user?.isOwner == true ||
        (user?.permissions.contains('staff_advances.create') ?? false);
    final staffState = ref.watch(staffProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: canCreateAdvance
          ? FloatingActionButton.extended(
              key: const Key('add_advance_fab'),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text(
                'New Advance',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
              onPressed: () => StaffAdvancesDialogs.showCreateAdvanceSheet(
                context,
                ref,
                staffState.activeStaff,
              ),
            )
          : null,
      body: const StaffAdvancesContent(),
    );
  }
}
