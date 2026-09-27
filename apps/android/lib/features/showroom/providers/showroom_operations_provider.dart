import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/showroom_repository.dart';
import '../models/showroom_operations_model.dart';
import 'daily_staff_provider.dart';
import 'showroom_provider.dart';

@immutable
class ShowroomOperationsState {
  final String showroomId;
  final DateTime selectedDate;
  final List<ShowroomVehicleType> vehicleTypes;
  final List<ShowroomWorkType> workTypes;
  final List<ShowroomVehicleWork> vehicleWorks;
  final ShowroomOperationsSummary? summary;
  final String? selectedStaffId;
  final String? selectedVehicleTypeId;
  final bool isLoading;
  final bool isTypesLoading;
  final bool isSaving;
  final bool isDeleting;
  final bool isClosingSession;
  final String? errorMessage;

  const ShowroomOperationsState({
    required this.showroomId,
    required this.selectedDate,
    this.vehicleTypes = const [],
    this.workTypes = const [],
    this.vehicleWorks = const [],
    this.summary,
    this.selectedStaffId,
    this.selectedVehicleTypeId,
    this.isLoading = false,
    this.isTypesLoading = false,
    this.isSaving = false,
    this.isDeleting = false,
    this.isClosingSession = false,
    this.errorMessage,
  });

  List<ShowroomVehicleWork> get filteredVehicleWorks {
    return vehicleWorks.where((work) {
      if (selectedStaffId != null && selectedStaffId!.isNotEmpty) {
        if (work.staffId != selectedStaffId) return false;
      }
      if (selectedVehicleTypeId != null && selectedVehicleTypeId!.isNotEmpty) {
        if (work.vehicleTypeId != selectedVehicleTypeId) return false;
      }
      return true;
    }).toList();
  }

  int get totalVehiclesHandled => summary?.totalVehiclesHandled ?? 0;
  int get totalServicesPerformed => summary?.totalServicesPerformed ?? 0;
  int get totalActiveStaffSessions => summary?.totalActiveStaffSessions ?? 0;
  List<VehicleTypeWorkSummary> get vehicleTypeBreakdown =>
      summary?.vehicleTypeBreakdown ?? const [];
  List<WorkTypeWorkSummary> get workTypeBreakdown =>
      summary?.workTypeBreakdown ?? const [];
  List<StaffWorkSummary> get staffProductivityBreakdown =>
      summary?.staffProductivityBreakdown ?? const [];

  bool get hasData =>
      vehicleWorks.isNotEmpty ||
      (summary != null &&
          (summary!.totalVehiclesHandled > 0 ||
              summary!.totalServicesPerformed > 0 ||
              summary!.totalActiveStaffSessions > 0));

  ShowroomOperationsState copyWith({
    String? showroomId,
    DateTime? selectedDate,
    List<ShowroomVehicleType>? vehicleTypes,
    List<ShowroomWorkType>? workTypes,
    List<ShowroomVehicleWork>? vehicleWorks,
    ShowroomOperationsSummary? summary,
    String? selectedStaffId,
    String? selectedVehicleTypeId,
    bool? isLoading,
    bool? isTypesLoading,
    bool? isSaving,
    bool? isDeleting,
    bool? isClosingSession,
    String? errorMessage,
    bool clearError = false,
    bool clearStaffFilter = false,
    bool clearVehicleTypeFilter = false,
  }) {
    return ShowroomOperationsState(
      showroomId: showroomId ?? this.showroomId,
      selectedDate: selectedDate ?? this.selectedDate,
      vehicleTypes: vehicleTypes ?? this.vehicleTypes,
      workTypes: workTypes ?? this.workTypes,
      vehicleWorks: vehicleWorks ?? this.vehicleWorks,
      summary: summary ?? this.summary,
      selectedStaffId: clearStaffFilter ? null : (selectedStaffId ?? this.selectedStaffId),
      selectedVehicleTypeId: clearVehicleTypeFilter
          ? null
          : (selectedVehicleTypeId ?? this.selectedVehicleTypeId),
      isLoading: isLoading ?? this.isLoading,
      isTypesLoading: isTypesLoading ?? this.isTypesLoading,
      isSaving: isSaving ?? this.isSaving,
      isDeleting: isDeleting ?? this.isDeleting,
      isClosingSession: isClosingSession ?? this.isClosingSession,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class ShowroomOperationsNotifier extends StateNotifier<ShowroomOperationsState> {
  final ShowroomRepository _repository;
  final Ref _ref;

  ShowroomOperationsNotifier(this._repository, this._ref, String showroomId)
      : super(ShowroomOperationsState(
          showroomId: showroomId,
          selectedDate: DateTime.now(),
        )) {
    init();
  }

  Future<void> init() async {
    await loadCatalogs();
    await loadOperationsData();
  }

  Future<void> loadCatalogs() async {
    if (state.vehicleTypes.isNotEmpty && state.workTypes.isNotEmpty) return;
    state = state.copyWith(isTypesLoading: true, clearError: true);
    try {
      final vTypesFuture = _repository.getShowroomVehicleTypes(isActive: true);
      final wTypesFuture = _repository.getShowroomWorkTypes(isActive: true);
      final results = await Future.wait([vTypesFuture, wTypesFuture]);

      if (!mounted) return;
      state = state.copyWith(
        vehicleTypes: results[0] as List<ShowroomVehicleType>,
        workTypes: results[1] as List<ShowroomWorkType>,
        isTypesLoading: false,
        clearError: true,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isTypesLoading: false,
        errorMessage: 'Failed to load vehicle/service types catalog.',
      );
    }
  }

  Future<void> loadOperationsData({DateTime? date, bool silent = false}) async {
    final targetDate = date ?? state.selectedDate;
    if (!silent) {
      state = state.copyWith(
        selectedDate: targetDate,
        isLoading: true,
        clearError: true,
      );
    }

    try {
      final worksFuture = _repository.getShowroomVehicleWorks(
        state.showroomId,
        date: targetDate,
      );
      final summaryFuture = _repository.getShowroomOperationsSummary(
        state.showroomId,
        targetDate,
      );

      final results = await Future.wait([worksFuture, summaryFuture]);

      if (!mounted) return;
      state = state.copyWith(
        vehicleWorks: results[0] as List<ShowroomVehicleWork>,
        summary: results[1] as ShowroomOperationsSummary,
        isLoading: false,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (!silent) {
        state = state.copyWith(
          isLoading: false,
          errorMessage: e.message,
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        state = state.copyWith(
          isLoading: false,
          errorMessage: 'Failed to load operations data.',
        );
      }
    }
  }

  Future<void> refresh({bool silent = false}) =>
      loadOperationsData(silent: silent);

  void setDate(DateTime date) {
    if (state.selectedDate.year == date.year &&
        state.selectedDate.month == date.month &&
        state.selectedDate.day == date.day) {
      return;
    }
    loadOperationsData(date: date);
  }

  void shiftDate(int days) {
    final next = state.selectedDate.add(Duration(days: days));
    loadOperationsData(date: next);
  }

  void setStaffFilter(String? staffId) {
    state = state.copyWith(
      selectedStaffId: staffId,
      clearStaffFilter: staffId == null,
    );
  }

  void setVehicleTypeFilter(String? vehicleTypeId) {
    state = state.copyWith(
      selectedVehicleTypeId: vehicleTypeId,
      clearVehicleTypeFilter: vehicleTypeId == null,
    );
  }

  void clearFilters() {
    state = state.copyWith(
      clearStaffFilter: true,
      clearVehicleTypeFilter: true,
    );
  }

  Future<ShowroomVehicleWork?> createVehicleWork(
    CreateShowroomVehicleWorkRequest request,
  ) async {
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      final result = await _repository.createShowroomVehicleWork(
        state.showroomId,
        request,
      );

      // Refresh operations list & summary
      await loadOperationsData(date: state.selectedDate);

      // Also refresh daily staff so totalVehiclesAttended is updated
      _ref.read(dailyStaffProvider(state.showroomId).notifier).loadDailyStaff(date: state.selectedDate);
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return result;
      state = state.copyWith(isSaving: false, clearError: true);
      return result;
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isSaving: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Failed to record vehicle work.',
      );
      rethrow;
    }
  }

  Future<List<ShowroomVehicleWork>> createBatchVehicleWork(
    CreateBatchShowroomVehicleWorkRequest request,
  ) async {
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      final results = await _repository.createBatchShowroomVehicleWork(
        state.showroomId,
        request,
      );

      // Refresh operations list & summary
      await loadOperationsData(date: state.selectedDate);

      // Also refresh daily staff so totalVehiclesAttended is updated
      _ref.read(dailyStaffProvider(state.showroomId).notifier).loadDailyStaff(date: state.selectedDate);
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return results;
      state = state.copyWith(isSaving: false, clearError: true);
      return results;
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isSaving: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Failed to record batch vehicle work.',
      );
      rethrow;
    }
  }

  Future<ShowroomVehicleWork?> updateVehicleWork({
    required String workId,
    required UpdateShowroomVehicleWorkRequest request,
  }) async {
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      final result = await _repository.updateShowroomVehicleWork(
        state.showroomId,
        workId,
        request,
      );

      await loadOperationsData(date: state.selectedDate);
      _ref.read(dailyStaffProvider(state.showroomId).notifier).loadDailyStaff(date: state.selectedDate);
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return result;
      state = state.copyWith(isSaving: false, clearError: true);
      return result;
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isSaving: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Failed to update vehicle work.',
      );
      rethrow;
    }
  }

  Future<void> deleteVehicleWork(String workId) async {
    state = state.copyWith(isDeleting: true, clearError: true);
    try {
      await _repository.deleteShowroomVehicleWork(state.showroomId, workId);

      await loadOperationsData(date: state.selectedDate);
      _ref.read(dailyStaffProvider(state.showroomId).notifier).loadDailyStaff(date: state.selectedDate);
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return;
      state = state.copyWith(isDeleting: false, clearError: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isDeleting: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isDeleting: false,
        errorMessage: 'Failed to delete vehicle work.',
      );
      rethrow;
    }
  }

  Future<void> closeStaffWorkSession({
    required String sessionId,
    String? clockOutTime,
    String? clockOutNotes,
  }) async {
    state = state.copyWith(isClosingSession: true, clearError: true);
    try {
      final request = CloseShowroomStaffWorkSessionRequest(
        endTime: clockOutTime,
        notes: clockOutNotes,
      );
      await _repository.closeShowroomStaffWorkSession(
        state.showroomId,
        sessionId,
        request,
      );

      // Refresh operations summary & daily staff sessions
      await loadOperationsData(date: state.selectedDate);
      _ref.read(dailyStaffProvider(state.showroomId).notifier).loadDailyStaff(date: state.selectedDate);
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return;
      state = state.copyWith(isClosingSession: false, clearError: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isClosingSession: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isClosingSession: false,
        errorMessage: 'Failed to close work session.',
      );
      rethrow;
    }
  }
}

final showroomOperationsProvider = StateNotifierProvider.autoDispose
    .family<ShowroomOperationsNotifier, ShowroomOperationsState, String>((ref, showroomId) {
  final repository = ref.watch(showroomRepositoryProvider);
  return ShowroomOperationsNotifier(repository, ref, showroomId);
});
