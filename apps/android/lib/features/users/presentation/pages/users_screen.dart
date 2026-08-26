import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_confirm_dialog.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../models/user_model.dart';
import '../../providers/users_provider.dart';
import '../../providers/users_state.dart';
import '../widgets/user_card.dart';
import '../widgets/user_form_sheet.dart';

class UsersScreen extends ConsumerStatefulWidget {
  const UsersScreen({super.key});

  @override
  ConsumerState<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends ConsumerState<UsersScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _handleToggleStatus(
    UserModel user,
    String currentUserId,
  ) async {
    if (user.isOwner) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Owner account cannot be deactivated.'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (user.id == currentUserId) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You cannot deactivate your own account.'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final action = user.isActive ? 'deactivate' : 'activate';
    final confirmed = await AppConfirmDialog.show(
      context: context,
      title: '${user.isActive ? 'Deactivate' : 'Activate'} User',
      message:
          'Are you sure you want to $action ${user.fullName} (@${user.username})?',
      confirmLabel: user.isActive ? 'Deactivate' : 'Activate',
      isDestructive: user.isActive,
    );

    if (confirmed == true && mounted) {
      final success = await ref
          .read(usersNotifierProvider.notifier)
          .toggleUserStatus(user.id);

      if (success && mounted) {
        final state = ref.read(usersNotifierProvider);
        if (state is UsersLoaded && state.mutationSuccessMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.mutationSuccessMessage!),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }

  void _handleOpenCreate(UsersLoaded state) async {
    final result = await UserFormSheet.show(
      context,
      permissionGroups: state.permissionGroups,
    );

    if (result == true && mounted) {
      final updatedState = ref.read(usersNotifierProvider);
      if (updatedState is UsersLoaded &&
          updatedState.mutationSuccessMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(updatedState.mutationSuccessMessage!),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _handleOpenEdit(UserModel user, UsersLoaded state) async {
    final result = await UserFormSheet.show(
      context,
      user: user,
      permissionGroups: state.permissionGroups,
    );

    if (result == true && mounted) {
      final updatedState = ref.read(usersNotifierProvider);
      if (updatedState is UsersLoaded &&
          updatedState.mutationSuccessMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(updatedState.mutationSuccessMessage!),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState is Authenticated ? authState.user : null;

    final canView = currentUser?.hasPermission('users.view') ?? false;
    final canCreate = currentUser?.hasPermission('users.create') ?? false;
    final canEdit = currentUser?.hasPermission('users.edit') ?? false;
    final canDeactivate =
        currentUser?.hasPermission('users.deactivate') ?? false;

    if (!canView) {
      return const AppScreenScaffold(
        title: 'Users & Permissions',
        actions: [AppLogoutAction()],
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: AppEmptyState(
              icon: Icons.lock_outline_rounded,
              title: 'Access Restricted',
              message:
                  'You do not have permission to view or manage user accounts.\nContact your administrator if you require access.',
            ),
          ),
        ),
      );
    }

    final usersState = ref.watch(usersNotifierProvider);

    return AppScreenScaffold(
      title: 'Users & Permissions',
      actions: const [AppLogoutAction()],
      floatingActionButton: canCreate && usersState is UsersLoaded
          ? FloatingActionButton.extended(
              onPressed: () => _handleOpenCreate(usersState),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.person_add_rounded, color: Colors.white),
              label: const Text(
                'Add User',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            )
          : null,
      body: Builder(
        builder: (context) {
          if (usersState is UsersLoading) {
            return const AppLoadingState(
              message: 'Loading users and permissions...',
            );
          }

          if (usersState is UsersError) {
            return AppErrorState(
              title: 'Failed to Load Users',
              message: usersState.message,
              onRetry: () =>
                  ref.read(usersNotifierProvider.notifier).loadUsers(),
            );
          }

          if (usersState is UsersLoaded) {
            return _buildLoadedContent(
              context: context,
              state: usersState,
              currentUserId: currentUser?.id ?? '',
              canCreate: canCreate,
              canEdit: canEdit,
              canDeactivate: canDeactivate,
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildLoadedContent({
    required BuildContext context,
    required UsersLoaded state,
    required String currentUserId,
    required bool canCreate,
    required bool canEdit,
    required bool canDeactivate,
  }) {
    final filteredUsers = state.filteredUsers;

    return RefreshIndicator(
      onRefresh: () => ref
          .read(usersNotifierProvider.notifier)
          .loadUsers(showLoading: false),
      color: AppColors.primary,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // KPI Metric Strip
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricCard(
                          title: 'Total Users',
                          value: '${state.totalCount}',
                          icon: Icons.people_alt_outlined,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildMetricCard(
                          title: 'Active',
                          value: '${state.activeCount}',
                          icon: Icons.check_circle_outline_rounded,
                          color: const Color(0xFF059669),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildMetricCard(
                          title: 'Inactive',
                          value: '${state.inactiveCount}',
                          icon: Icons.cancel_outlined,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Search Bar
                  AppSearchField(
                    controller: _searchController,
                    hint: 'Search users by name, username, or role...',
                    onChanged: (val) => ref
                        .read(usersNotifierProvider.notifier)
                        .setSearchQuery(val),
                    onClear: () {
                      _searchController.clear();
                      ref
                          .read(usersNotifierProvider.notifier)
                          .setSearchQuery('');
                    },
                  ),
                  const SizedBox(height: 12),

                  // Status Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip(
                          label: 'All (${state.totalCount})',
                          isSelected:
                              state.statusFilter == UserStatusFilter.all,
                          onSelected: () => ref
                              .read(usersNotifierProvider.notifier)
                              .setStatusFilter(UserStatusFilter.all),
                        ),
                        const SizedBox(width: 8),
                        _buildFilterChip(
                          label: 'Active (${state.activeCount})',
                          isSelected:
                              state.statusFilter == UserStatusFilter.active,
                          onSelected: () => ref
                              .read(usersNotifierProvider.notifier)
                              .setStatusFilter(UserStatusFilter.active),
                        ),
                        const SizedBox(width: 8),
                        _buildFilterChip(
                          label: 'Inactive (${state.inactiveCount})',
                          isSelected:
                              state.statusFilter == UserStatusFilter.inactive,
                          onSelected: () => ref
                              .read(usersNotifierProvider.notifier)
                              .setStatusFilter(UserStatusFilter.inactive),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Results count
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Showing ${filteredUsers.length} user${filteredUsers.length == 1 ? '' : 's'}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // User Cards List
          if (filteredUsers.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: AppEmptyState(
                    icon: Icons.people_outline_rounded,
                    title: 'No users found',
                    message: state.searchQuery.isNotEmpty
                        ? 'No users match "${state.searchQuery}". Try modifying your search or filter.'
                        : 'No user accounts found. Click "+ Add User" to create one.',
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final user = filteredUsers[index];
                    final isSelf = user.id == currentUserId;

                    return UserCard(
                      user: user,
                      isSelf: isSelf,
                      canEdit: canEdit,
                      canDeactivate: canDeactivate,
                      onEdit: () => _handleOpenEdit(user, state),
                      onToggleStatus: () =>
                          _handleToggleStatus(user, currentUserId),
                    );
                  },
                  childCount: filteredUsers.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isSelected,
    required VoidCallback onSelected,
  }) {
    return InkWell(
      onTap: onSelected,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
