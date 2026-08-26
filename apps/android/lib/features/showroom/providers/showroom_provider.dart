import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/showroom_repository.dart';
import '../models/showroom_model.dart';

@immutable
class ShowroomsState {
  final List<Showroom> showrooms;
  final bool isLoading;
  final bool isMutating;
  final String? errorMessage;
  final String searchTerm;
  final String statusFilter; // 'all', 'active', 'inactive'

  const ShowroomsState({
    this.showrooms = const [],
    this.isLoading = false,
    this.isMutating = false,
    this.errorMessage,
    this.searchTerm = '',
    this.statusFilter = 'all',
  });

  List<Showroom> get filteredShowrooms {
    var list = showrooms;
    if (statusFilter == 'active') {
      list = list.where((s) => s.isActive).toList();
    } else if (statusFilter == 'inactive') {
      list = list.where((s) => !s.isActive).toList();
    }

    if (searchTerm.trim().isNotEmpty) {
      final term = searchTerm.trim().toLowerCase();
      list = list.where((s) {
        return s.name.toLowerCase().contains(term) ||
            s.address.toLowerCase().contains(term) ||
            (s.phone != null && s.phone!.toLowerCase().contains(term));
      }).toList();
    }

    return list;
  }

  int get totalShowroomsCount => showrooms.length;
  int get activeShowroomsCount => showrooms.where((s) => s.isActive).length;
  int get totalStaffTodayCount =>
      showrooms.fold(0, (sum, s) => sum + s.activeStaffCountToday);
  int get totalVehiclesTodayCount =>
      showrooms.fold(0, (sum, s) => sum + s.totalVehiclesToday);

  ShowroomsState copyWith({
    List<Showroom>? showrooms,
    bool? isLoading,
    bool? isMutating,
    String? errorMessage,
    bool clearError = false,
    String? searchTerm,
    String? statusFilter,
  }) {
    return ShowroomsState(
      showrooms: showrooms ?? this.showrooms,
      isLoading: isLoading ?? this.isLoading,
      isMutating: isMutating ?? this.isMutating,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      searchTerm: searchTerm ?? this.searchTerm,
      statusFilter: statusFilter ?? this.statusFilter,
    );
  }
}

class ShowroomsNotifier extends StateNotifier<ShowroomsState> {
  final ShowroomRepository _repository;

  ShowroomsNotifier(this._repository) : super(const ShowroomsState()) {
    loadShowrooms();
  }

  Future<void> loadShowrooms() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final list = await _repository.getShowrooms();
      state = state.copyWith(
        showrooms: list,
        isLoading: false,
        clearError: true,
      );
    } on ApiException catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.message,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'An unexpected error occurred while loading showrooms.',
      );
    }
  }

  void setSearchTerm(String term) {
    state = state.copyWith(searchTerm: term);
  }

  void setStatusFilter(String filter) {
    state = state.copyWith(statusFilter: filter);
  }

  Future<Showroom?> createShowroom(CreateShowroomRequest request) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      final created = await _repository.createShowroom(request);
      state = state.copyWith(
        showrooms: [created, ...state.showrooms],
        isMutating: false,
        clearError: true,
      );
      return created;
    } on ApiException catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to create showroom.',
      );
      rethrow;
    }
  }

  Future<Showroom?> updateShowroom(String id, UpdateShowroomRequest request) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      final updated = await _repository.updateShowroom(id, request);
      state = state.copyWith(
        showrooms: state.showrooms.map((s) => s.id == id ? updated : s).toList(),
        isMutating: false,
        clearError: true,
      );
      return updated;
    } on ApiException catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to update showroom.',
      );
      rethrow;
    }
  }

  Future<void> toggleShowroomActive(String id) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      await _repository.toggleShowroomActive(id);
      state = state.copyWith(
        showrooms: state.showrooms.map((s) {
          if (s.id == id) {
            return s.copyWith(isActive: !s.isActive);
          }
          return s;
        }).toList(),
        isMutating: false,
        clearError: true,
      );
    } on ApiException catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to toggle active status.',
      );
      rethrow;
    }
  }

  Future<void> deleteShowroom(String id) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      await _repository.deleteShowroom(id);
      state = state.copyWith(
        showrooms: state.showrooms.where((s) => s.id != id).toList(),
        isMutating: false,
        clearError: true,
      );
    } on ApiException catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to delete showroom.',
      );
      rethrow;
    }
  }
}

final showroomsProvider =
    StateNotifierProvider<ShowroomsNotifier, ShowroomsState>((ref) {
  final repository = ref.watch(showroomRepositoryProvider);
  return ShowroomsNotifier(repository);
});
