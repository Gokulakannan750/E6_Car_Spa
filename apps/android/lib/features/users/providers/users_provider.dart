import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/users_repository.dart';
import '../models/create_user_request.dart';
import '../models/update_user_request.dart';
import 'users_state.dart';

final usersNotifierProvider =
    StateNotifierProvider.autoDispose<UsersNotifier, UsersState>((ref) {
  final repository = ref.watch(usersRepositoryProvider);
  return UsersNotifier(repository)..loadUsers();
});

class UsersNotifier extends StateNotifier<UsersState> {
  final UsersRepository _repository;

  UsersNotifier(this._repository) : super(const UsersInitial());

  Future<void> loadUsers({bool showLoading = true}) async {
    final currentState = state;
    if (showLoading || currentState is! UsersLoaded) {
      state = const UsersLoading();
    }

    try {
      final results = await Future.wait([
        _repository.getUsers(),
        _repository.getAvailablePermissions(),
      ]);

      final users = results[0] as List<dynamic>;
      final permissions = results[1] as List<dynamic>;

      final previousSearch =
          currentState is UsersLoaded ? currentState.searchQuery : '';
      final previousFilter =
          currentState is UsersLoaded ? currentState.statusFilter : UserStatusFilter.all;

      state = UsersLoaded(
        users: users.cast(),
        permissionGroups: permissions.cast(),
        searchQuery: previousSearch,
        statusFilter: previousFilter,
      );
    } catch (e) {
      final message =
          e is ApiException ? e.message : 'Failed to load users and permissions.';
      state = UsersError(message);
    }
  }

  void setSearchQuery(String query) {
    final currentState = state;
    if (currentState is UsersLoaded) {
      state = currentState.copyWith(searchQuery: query);
    }
  }

  void setStatusFilter(UserStatusFilter filter) {
    final currentState = state;
    if (currentState is UsersLoaded) {
      state = currentState.copyWith(statusFilter: filter);
    }
  }

  void clearMessages() {
    final currentState = state;
    if (currentState is UsersLoaded) {
      state = currentState.copyWith(clearSuccess: true, clearError: true);
    }
  }

  Future<bool> createUser(CreateUserRequest request) async {
    final currentState = state;
    if (currentState is! UsersLoaded) return false;

    state = currentState.copyWith(
      isMutating: true,
      clearSuccess: true,
      clearError: true,
    );

    try {
      await _repository.createUser(request);
      // Reload authoritative list
      await loadUsers(showLoading: false);
      if (state is UsersLoaded) {
        state = (state as UsersLoaded).copyWith(
          isMutating: false,
          mutationSuccessMessage:
              'User account for "${request.fullName}" created successfully.',
        );
      }
      return true;
    } catch (e) {
      final message =
          e is ApiException ? e.message : 'Failed to create user account.';
      state = currentState.copyWith(
        isMutating: false,
        mutationErrorMessage: message,
      );
      return false;
    }
  }

  Future<bool> updateUser(String id, UpdateUserRequest request) async {
    final currentState = state;
    if (currentState is! UsersLoaded) return false;

    state = currentState.copyWith(
      isMutating: true,
      clearSuccess: true,
      clearError: true,
    );

    try {
      await _repository.updateUser(id, request);
      await loadUsers(showLoading: false);
      if (state is UsersLoaded) {
        state = (state as UsersLoaded).copyWith(
          isMutating: false,
          mutationSuccessMessage:
              'User "${request.fullName}" updated successfully.',
        );
      }
      return true;
    } catch (e) {
      final message =
          e is ApiException ? e.message : 'Failed to update user account.';
      state = currentState.copyWith(
        isMutating: false,
        mutationErrorMessage: message,
      );
      return false;
    }
  }

  Future<bool> toggleUserStatus(String id) async {
    final currentState = state;
    if (currentState is! UsersLoaded) return false;

    state = currentState.copyWith(
      isMutating: true,
      clearSuccess: true,
      clearError: true,
    );

    try {
      final updated = await _repository.toggleUserStatus(id);
      await loadUsers(showLoading: false);
      if (state is UsersLoaded) {
        final statusStr = updated.isActive ? 'activated' : 'deactivated';
        state = (state as UsersLoaded).copyWith(
          isMutating: false,
          mutationSuccessMessage:
              'User "${updated.fullName}" was $statusStr.',
        );
      }
      return true;
    } catch (e) {
      final message =
          e is ApiException ? e.message : 'Failed to change user status.';
      state = currentState.copyWith(
        isMutating: false,
        mutationErrorMessage: message,
      );
      return false;
    }
  }
}
