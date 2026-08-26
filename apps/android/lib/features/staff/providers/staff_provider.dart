import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/staff_repository.dart';
import '../models/staff_model.dart';
import '../models/staff_request_models.dart';

enum StaffStatusFilter { all, active, inactive }

@immutable
class StaffState {
  final bool isLoading;
  final bool isSubmitting;
  final List<Staff> staffList;
  final String searchQuery;
  final StaffStatusFilter statusFilter;
  final String? errorMessage;

  const StaffState({
    this.isLoading = false,
    this.isSubmitting = false,
    this.staffList = const [],
    this.searchQuery = '',
    this.statusFilter = StaffStatusFilter.all,
    this.errorMessage,
  });

  List<Staff> get filteredStaff {
    var list = staffList;
    if (statusFilter == StaffStatusFilter.active) {
      list = list.where((s) => s.isActive).toList();
    } else if (statusFilter == StaffStatusFilter.inactive) {
      list = list.where((s) => !s.isActive).toList();
    }

    if (searchQuery.trim().isEmpty) return list;
    final query = searchQuery.trim().toLowerCase();
    return list.where((s) {
      return s.name.toLowerCase().contains(query) ||
          s.phoneNumber.toLowerCase().contains(query) ||
          (s.role?.toLowerCase().contains(query) ?? false) ||
          (s.email?.toLowerCase().contains(query) ?? false);
    }).toList();
  }

  List<Staff> get activeStaff {
    return staffList.where((s) => s.isActive).toList();
  }

  StaffState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    List<Staff>? staffList,
    String? searchQuery,
    StaffStatusFilter? statusFilter,
    String? errorMessage,
    bool clearError = false,
  }) {
    return StaffState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      staffList: staffList ?? this.staffList,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class StaffNotifier extends StateNotifier<StaffState> {
  final StaffRepository _repository;

  StaffNotifier(this._repository) : super(const StaffState()) {
    loadStaff();
  }

  Future<void> loadStaff({bool refresh = false}) async {
    if (state.isLoading && !refresh) return;

    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final list = await _repository.getStaff();
      state = state.copyWith(
        isLoading: false,
        staffList: list,
        clearError: true,
      );
    } catch (e) {
      final message = e is ApiException ? e.message : e.toString();
      state = state.copyWith(
        isLoading: false,
        errorMessage: message,
      );
    }
  }

  void setSearch(String query) {
    state = state.copyWith(searchQuery: query);
  }

  void setStatusFilter(StaffStatusFilter filter) {
    state = state.copyWith(statusFilter: filter);
  }

  Future<String?> createStaff(CreateStaffRequest request) async {
    if (state.isSubmitting) return 'Operation in progress';

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _repository.createStaff(request);
      state = state.copyWith(isSubmitting: false);
      await loadStaff(refresh: true);
      return null;
    } catch (e) {
      final message = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return message;
    }
  }

  Future<String?> updateStaff(String id, UpdateStaffRequest request) async {
    if (state.isSubmitting) return 'Operation in progress';

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _repository.updateStaff(id, request);
      state = state.copyWith(isSubmitting: false);
      await loadStaff(refresh: true);
      return null;
    } catch (e) {
      final message = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return message;
    }
  }

  Future<String?> deleteStaff(String id) async {
    if (state.isSubmitting) return 'Operation in progress';

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _repository.deleteStaff(id);
      state = state.copyWith(isSubmitting: false);
      await loadStaff(refresh: true);
      return null;
    } catch (e) {
      final message = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return message;
    }
  }
}

final staffProvider = StateNotifierProvider<StaffNotifier, StaffState>((ref) {
  final repository = ref.watch(staffRepositoryProvider);
  return StaffNotifier(repository);
});
