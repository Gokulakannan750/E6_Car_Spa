import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/showroom_repository.dart';
import '../models/showroom_staff_assignment_model.dart';
import 'showroom_provider.dart';

@immutable
class DailyStaffState {
  final String showroomId;
  final DateTime selectedDate;
  final DailyStaffResponse? dailyStaffResponse;
  final bool isLoading;
  final bool isAssigning;
  final bool isRemoving;
  final String? errorMessage;

  const DailyStaffState({
    required this.showroomId,
    required this.selectedDate,
    this.dailyStaffResponse,
    this.isLoading = false,
    this.isAssigning = false,
    this.isRemoving = false,
    this.errorMessage,
  });

  List<DailyStaffAssignment> get staffAssignments =>
      dailyStaffResponse?.staffAssignments ?? const [];

  int get totalStaffCount => staffAssignments.length;
  int get totalVehiclesAttended => dailyStaffResponse?.totalVehiclesAttended ?? 0;
  bool get isAttendanceConfirmed => dailyStaffResponse?.isAttendanceConfirmed ?? false;

  DailyStaffState copyWith({
    String? showroomId,
    DateTime? selectedDate,
    DailyStaffResponse? dailyStaffResponse,
    bool? isLoading,
    bool? isAssigning,
    bool? isRemoving,
    String? errorMessage,
    bool clearError = false,
  }) {
    return DailyStaffState(
      showroomId: showroomId ?? this.showroomId,
      selectedDate: selectedDate ?? this.selectedDate,
      dailyStaffResponse: dailyStaffResponse ?? this.dailyStaffResponse,
      isLoading: isLoading ?? this.isLoading,
      isAssigning: isAssigning ?? this.isAssigning,
      isRemoving: isRemoving ?? this.isRemoving,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class DailyStaffNotifier extends StateNotifier<DailyStaffState> {
  final ShowroomRepository _repository;
  final Ref _ref;

  DailyStaffNotifier(this._repository, this._ref, String showroomId)
      : super(DailyStaffState(
          showroomId: showroomId,
          selectedDate: DateTime.now(),
        )) {
    loadDailyStaff();
  }

  Future<void> loadDailyStaff({DateTime? date}) async {
    final targetDate = date ?? state.selectedDate;
    state = state.copyWith(
      selectedDate: targetDate,
      isLoading: true,
      clearError: true,
    );

    try {
      final response = await _repository.getDailyStaff(
        state.showroomId,
        targetDate,
      );
      state = state.copyWith(
        dailyStaffResponse: response,
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
        errorMessage: 'Failed to load daily staff assignments.',
      );
    }
  }

  void setDate(DateTime date) {
    if (state.selectedDate.year == date.year &&
        state.selectedDate.month == date.month &&
        state.selectedDate.day == date.day) {
      return;
    }
    loadDailyStaff(date: date);
  }

  void shiftDate(int days) {
    final next = state.selectedDate.add(Duration(days: days));
    loadDailyStaff(date: next);
  }

  Future<DailyStaffAssignment?> assignStaff({
    required String staffId,
    int vehiclesAttended = 0,
  }) async {
    state = state.copyWith(isAssigning: true, clearError: true);
    try {
      final request = CreateDailyStaffAssignmentRequest(
        staffId: staffId,
        date: state.selectedDate,
        vehiclesAttended: vehiclesAttended,
      );
      final assignment = await _repository.assignDailyStaff(
        state.showroomId,
        request,
      );

      // Refresh daily roster
      await loadDailyStaff(date: state.selectedDate);

      // Invalidate master showrooms list so today counts update
      _ref.read(showroomsProvider.notifier).loadShowrooms();

      state = state.copyWith(isAssigning: false, clearError: true);
      return assignment;
    } on ApiException catch (e) {
      state = state.copyWith(
        isAssigning: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isAssigning: false,
        errorMessage: 'Failed to assign staff member.',
      );
      rethrow;
    }
  }

  Future<void> removeAssignment(String assignmentId) async {
    state = state.copyWith(isRemoving: true, clearError: true);
    try {
      await _repository.removeDailyStaff(assignmentId);

      // Refresh daily roster
      await loadDailyStaff(date: state.selectedDate);

      // Invalidate master showrooms list so counts update
      _ref.read(showroomsProvider.notifier).loadShowrooms();

      state = state.copyWith(isRemoving: false, clearError: true);
    } on ApiException catch (e) {
      state = state.copyWith(
        isRemoving: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isRemoving: false,
        errorMessage: 'Failed to remove staff assignment.',
      );
      rethrow;
    }
  }
}

final dailyStaffProvider = StateNotifierProvider.autoDispose
    .family<DailyStaffNotifier, DailyStaffState, String>((ref, showroomId) {
  final repository = ref.watch(showroomRepositoryProvider);
  return DailyStaffNotifier(repository, ref, showroomId);
});
