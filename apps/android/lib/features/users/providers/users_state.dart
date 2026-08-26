import 'package:flutter/foundation.dart';
import '../models/permission_model.dart';
import '../models/user_model.dart';

enum UserStatusFilter { all, active, inactive }

@immutable
abstract class UsersState {
  const UsersState();
}

class UsersInitial extends UsersState {
  const UsersInitial();
}

class UsersLoading extends UsersState {
  const UsersLoading();
}

class UsersLoaded extends UsersState {
  final List<UserModel> users;
  final List<PermissionGroupModel> permissionGroups;
  final String searchQuery;
  final UserStatusFilter statusFilter;
  final bool isMutating;
  final String? mutationSuccessMessage;
  final String? mutationErrorMessage;

  const UsersLoaded({
    required this.users,
    required this.permissionGroups,
    this.searchQuery = '',
    this.statusFilter = UserStatusFilter.all,
    this.isMutating = false,
    this.mutationSuccessMessage,
    this.mutationErrorMessage,
  });

  int get totalCount => users.length;
  int get activeCount => users.where((u) => u.isActive).length;
  int get inactiveCount => users.where((u) => !u.isActive).length;

  List<UserModel> get filteredUsers {
    return users.where((u) {
      // 1. Status Filter
      if (statusFilter == UserStatusFilter.active && !u.isActive) return false;
      if (statusFilter == UserStatusFilter.inactive && u.isActive) return false;

      // 2. Search Filter
      final q = searchQuery.trim().toLowerCase();
      if (q.isEmpty) return true;

      return u.fullName.toLowerCase().contains(q) ||
          u.username.toLowerCase().contains(q) ||
          u.role.toLowerCase().contains(q) ||
          (u.email != null && u.email!.toLowerCase().contains(q));
    }).toList();
  }

  UsersLoaded copyWith({
    List<UserModel>? users,
    List<PermissionGroupModel>? permissionGroups,
    String? searchQuery,
    UserStatusFilter? statusFilter,
    bool? isMutating,
    String? mutationSuccessMessage,
    String? mutationErrorMessage,
    bool clearSuccess = false,
    bool clearError = false,
  }) {
    return UsersLoaded(
      users: users ?? this.users,
      permissionGroups: permissionGroups ?? this.permissionGroups,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      isMutating: isMutating ?? this.isMutating,
      mutationSuccessMessage:
          clearSuccess ? null : (mutationSuccessMessage ?? this.mutationSuccessMessage),
      mutationErrorMessage:
          clearError ? null : (mutationErrorMessage ?? this.mutationErrorMessage),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UsersLoaded &&
          runtimeType == other.runtimeType &&
          listEquals(users, other.users) &&
          listEquals(permissionGroups, other.permissionGroups) &&
          searchQuery == other.searchQuery &&
          statusFilter == other.statusFilter &&
          isMutating == other.isMutating &&
          mutationSuccessMessage == other.mutationSuccessMessage &&
          mutationErrorMessage == other.mutationErrorMessage;

  @override
  int get hashCode =>
      users.length.hashCode ^
      permissionGroups.length.hashCode ^
      searchQuery.hashCode ^
      statusFilter.hashCode ^
      isMutating.hashCode ^
      (mutationSuccessMessage?.hashCode ?? 0) ^
      (mutationErrorMessage?.hashCode ?? 0);
}

class UsersError extends UsersState {
  final String message;

  const UsersError(this.message);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UsersError &&
          runtimeType == other.runtimeType &&
          message == other.message;

  @override
  int get hashCode => message.hashCode;
}
