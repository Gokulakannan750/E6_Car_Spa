import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/staff_advances_repository.dart';
import '../models/staff_advance_model.dart';
import '../models/staff_advance_request_models.dart';

@immutable
class StaffAdvancesState {
  final bool isLoading;
  final bool isSubmitting;
  final List<StaffAdvance> advances;
  final StaffAdvanceSummary summary;
  final int totalCount;
  final int page;
  final int pageSize;
  final String selectedStatus; // 'all', 'active', 'outstanding', 'settled', 'obsolete'
  final String? selectedStaffId;
  final String searchQuery;
  final String? errorMessage;

  const StaffAdvancesState({
    this.isLoading = false,
    this.isSubmitting = false,
    this.advances = const [],
    this.summary = const StaffAdvanceSummary(),
    this.totalCount = 0,
    this.page = 1,
    this.pageSize = 20,
    this.selectedStatus = 'active',
    this.selectedStaffId,
    this.searchQuery = '',
    this.errorMessage,
  });

  StaffAdvancesState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    List<StaffAdvance>? advances,
    StaffAdvanceSummary? summary,
    int? totalCount,
    int? page,
    int? pageSize,
    String? selectedStatus,
    String? selectedStaffId,
    bool clearStaffId = false,
    String? searchQuery,
    String? errorMessage,
    bool clearError = false,
  }) {
    return StaffAdvancesState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      advances: advances ?? this.advances,
      summary: summary ?? this.summary,
      totalCount: totalCount ?? this.totalCount,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      selectedStatus: selectedStatus ?? this.selectedStatus,
      selectedStaffId: clearStaffId ? null : (selectedStaffId ?? this.selectedStaffId),
      searchQuery: searchQuery ?? this.searchQuery,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class StaffAdvancesNotifier extends StateNotifier<StaffAdvancesState> {
  final StaffAdvancesRepository _repository;

  StaffAdvancesNotifier(this._repository) : super(const StaffAdvancesState()) {
    loadAdvances();
  }

  Future<void> loadAdvances({bool refresh = false}) async {
    if (state.isLoading && !refresh) return;

    state = state.copyWith(
      isLoading: true,
      clearError: true,
      page: refresh ? 1 : state.page,
    );

    try {
      final response = await _repository.getStaffAdvances(
        page: state.page,
        pageSize: state.pageSize,
        staffId: state.selectedStaffId,
        status: state.selectedStatus,
        search: state.searchQuery.isEmpty ? null : state.searchQuery,
      );

      state = state.copyWith(
        isLoading: false,
        advances: response.items,
        summary: response.summary,
        totalCount: response.totalCount,
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

  void setStatusFilter(String status) {
    if (state.selectedStatus == status) return;
    state = state.copyWith(selectedStatus: status, page: 1);
    loadAdvances(refresh: true);
  }

  void setStaffFilter(String? staffId) {
    if (state.selectedStaffId == staffId) return;
    state = state.copyWith(
      selectedStaffId: staffId,
      clearStaffId: staffId == null || staffId.isEmpty,
      page: 1,
    );
    loadAdvances(refresh: true);
  }

  void setSearch(String query) {
    if (state.searchQuery == query) return;
    state = state.copyWith(searchQuery: query, page: 1);
    loadAdvances(refresh: true);
  }

  Future<String?> createAdvance(CreateStaffAdvanceRequest request) async {
    if (state.isSubmitting) return 'Operation in progress';

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _repository.createStaffAdvance(request);
      state = state.copyWith(isSubmitting: false);
      await loadAdvances(refresh: true);
      return null;
    } catch (e) {
      final message = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return message;
    }
  }

  Future<String?> settleAdvance(String id) async {
    if (state.isSubmitting) return 'Operation in progress';

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _repository.settleStaffAdvance(id);
      state = state.copyWith(isSubmitting: false);
      await loadAdvances(refresh: true);
      return null;
    } catch (e) {
      final message = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return message;
    }
  }

  Future<String?> obsoleteAdvance(String id, String reason) async {
    if (state.isSubmitting) return 'Operation in progress';

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _repository.obsoleteStaffAdvance(id, ObsoleteStaffAdvanceRequest(reason: reason));
      state = state.copyWith(isSubmitting: false);
      await loadAdvances(refresh: true);
      return null;
    } catch (e) {
      final message = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: message);
      return message;
    }
  }
}

final staffAdvancesProvider =
    StateNotifierProvider<StaffAdvancesNotifier, StaffAdvancesState>((ref) {
  final repository = ref.watch(staffAdvancesRepositoryProvider);
  return StaffAdvancesNotifier(repository);
});
