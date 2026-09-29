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
  final bool isConfirming;
  final bool isUnlocking;
  final String? errorMessage;

  const DailyStaffState({
    required this.showroomId,
    required this.selectedDate,
    this.dailyStaffResponse,
    this.isLoading = false,
    this.isAssigning = false,
    this.isRemoving = false,
    this.isConfirming = false,
    this.isUnlocking = false,
    this.errorMessage,
  });

  List<DailyStaffAssignment> get staffAssignments =>
      dailyStaffResponse?.staffAssignments ?? const [];

  int get totalStaffCount => staffAssignments.length;
  double get totalScheduledHours =>
      dailyStaffResponse?.totalScheduledHours ??
      staffAssignments.fold<double>(0.0, (sum, a) {
        final hours = a.workingHours ?? calculateSessionHours(a.startTime, a.endTime) ?? 0.0;
        return sum + hours;
      });
  int get totalVehiclesAttended => dailyStaffResponse?.totalVehiclesAttended ?? 0;
  bool get isAttendanceConfirmed => dailyStaffResponse?.isAttendanceConfirmed ?? false;
  DateTime? get attendanceConfirmedAt => dailyStaffResponse?.attendanceConfirmedAt;
  String? get attendanceConfirmedByName => dailyStaffResponse?.attendanceConfirmedByName;
  String? get attendanceConfirmedByUserId => dailyStaffResponse?.attendanceConfirmedByUserId;

  DailyStaffState copyWith({
    String? showroomId,
    DateTime? selectedDate,
    DailyStaffResponse? dailyStaffResponse,
    bool? isLoading,
    bool? isAssigning,
    bool? isRemoving,
    bool? isConfirming,
    bool? isUnlocking,
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
      isConfirming: isConfirming ?? this.isConfirming,
      isUnlocking: isUnlocking ?? this.isUnlocking,
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

  Future<void> loadDailyStaff({DateTime? date, bool silent = false}) async {
    final targetDate = date ?? state.selectedDate;
    if (!silent) {
      state = state.copyWith(
        selectedDate: targetDate,
        isLoading: true,
        clearError: true,
      );
    }

    try {
      final response = await _repository.getDailyStaff(
        state.showroomId,
        targetDate,
      );
      if (!mounted) return;
      state = state.copyWith(
        dailyStaffResponse: response,
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
          errorMessage: 'Failed to load daily staff assignments.',
        );
      }
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

  Future<DailyStaffAssignment?> assignWorkSession({
    required String staffId,
    required String startTime,
    required String endTime,
    required String assignmentType,
    String? transferReason,
    String? notes,
  }) async {
    state = state.copyWith(isAssigning: true, clearError: true);
    try {
      final request = CreateDailyStaffAssignmentRequest(
        staffId: staffId,
        date: state.selectedDate,
        startTime: startTime,
        endTime: endTime,
        assignmentType: assignmentType,
        transferReason: transferReason,
        notes: notes,
      );
      final assignment = await _repository.assignDailyStaff(
        state.showroomId,
        request,
      );

      // Refresh daily roster
      await loadDailyStaff(date: state.selectedDate);

      // Invalidate master showrooms list so today counts update
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return assignment;
      state = state.copyWith(isAssigning: false, clearError: true);
      return assignment;
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isAssigning: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isAssigning: false,
        errorMessage: 'Failed to assign staff work session.',
      );
      rethrow;
    }
  }

  Future<DailyStaffAssignment?> updateWorkSession({
    required String assignmentId,
    required String startTime,
    required String endTime,
    String? status,
    String? transferReason,
    String? notes,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final request = UpdateDailyStaffAssignmentRequest(
        startTime: startTime,
        endTime: endTime,
        status: status,
        transferReason: transferReason,
        notes: notes,
      );
      final updated = await _repository.updateDailyStaffAssignment(
        assignmentId,
        request,
      );

      await loadDailyStaff(date: state.selectedDate);
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
      if (!mounted) return updated;
      state = state.copyWith(isLoading: false, clearError: true);
      return updated;
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to update work session.',
      );
      rethrow;
    }
  }

  Future<DailyStaffAssignment?> assignStaff({
    required String staffId,
    int vehiclesAttended = 0,
    String startTime = '09:00',
    String endTime = '18:00',
    String assignmentType = 'Regular',
    String? transferReason,
    String? notes,
  }) async {
    return assignWorkSession(
      staffId: staffId,
      startTime: startTime,
      endTime: endTime,
      assignmentType: assignmentType,
      transferReason: transferReason,
      notes: notes,
    );
  }

  Future<void> assignMultipleStaff({
    required List<String> staffIds,
    int vehiclesAttended = 0,
    String startTime = '09:00',
    String endTime = '18:00',
    String assignmentType = 'Regular',
  }) async {
    if (staffIds.isEmpty) return;
    state = state.copyWith(isAssigning: true, clearError: true);
    try {
      for (final staffId in staffIds) {
        final request = CreateDailyStaffAssignmentRequest(
          staffId: staffId,
          date: state.selectedDate,
          startTime: startTime,
          endTime: endTime,
          assignmentType: assignmentType,
        );
        await _repository.assignDailyStaff(state.showroomId, request);
      }

      await loadDailyStaff(date: state.selectedDate);
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
      if (!mounted) return;
      state = state.copyWith(isAssigning: false, clearError: true);
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isAssigning: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isAssigning: false,
        errorMessage: 'Failed to assign staff members.',
      );
      rethrow;
    }
  }

  Future<DailyStaffAssignment?> updateVehicles({
    required String assignmentId,
    required int vehiclesAttended,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final request = UpdateDailyStaffAssignmentRequest(
        vehiclesAttended: vehiclesAttended,
      );
      final updated = await _repository.updateDailyStaffVehicles(
        assignmentId,
        request,
      );

      await loadDailyStaff(date: state.selectedDate);
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
      if (!mounted) return updated;
      state = state.copyWith(isLoading: false, clearError: true);
      return updated;
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to update vehicles attended.',
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
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return;
      state = state.copyWith(isRemoving: false, clearError: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isRemoving: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isRemoving: false,
        errorMessage: 'Failed to remove staff assignment.',
      );
      rethrow;
    }
  }

  Future<DailyStaffResponse?> confirmAttendance() async {
    state = state.copyWith(isConfirming: true, clearError: true);
    try {
      final response = await _repository.confirmDailyStaffAttendance(
        state.showroomId,
        state.selectedDate,
      );

      if (!mounted) return response;
      state = state.copyWith(
        dailyStaffResponse: response,
        isConfirming: false,
        clearError: true,
      );

      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
      return response;
    } on ApiException {
      if (!mounted) return null;
      state = state.copyWith(
        isConfirming: false,
      );
      rethrow;
    } catch (e) {
      if (!mounted) return null;
      state = state.copyWith(
        isConfirming: false,
      );
      rethrow;
    }
  }

  Future<DailyStaffResponse?> unlockAttendance() async {
    state = state.copyWith(isUnlocking: true, clearError: true);
    try {
      final response = await _repository.unlockDailyStaffAttendance(
        state.showroomId,
        state.selectedDate,
      );

      if (!mounted) return response;
      state = state.copyWith(
        dailyStaffResponse: response,
        isUnlocking: false,
        clearError: true,
      );

      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
      return response;
    } on ApiException {
      if (!mounted) return null;
      state = state.copyWith(
        isUnlocking: false,
      );
      rethrow;
    } catch (e) {
      if (!mounted) return null;
      state = state.copyWith(
        isUnlocking: false,
      );
      rethrow;
    }
  }

  // --- Staff Swap Actions ---

  Future<ShowroomStaffSwap> swapStaff({
    required String staffAId,
    required String staffBId,
    required String showroomBId,
    String? coverageStartTime,
    String? coverageEndTime,
    String? reason,
    String? notes,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final request = CreateStaffSwapRequest(
        date: state.selectedDate,
        staffAId: staffAId,
        showroomAId: state.showroomId,
        staffBId: staffBId,
        showroomBId: showroomBId,
        coverageStartTime: coverageStartTime,
        coverageEndTime: coverageEndTime,
        reason: reason,
        notes: notes,
      );
      final swapResult = await _repository.swapStaff(request);

      // Refresh daily roster
      await loadDailyStaff(date: state.selectedDate);

      // Invalidate master showrooms list
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return swapResult;
      state = state.copyWith(isLoading: false, clearError: true);
      return swapResult;
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to complete staff swap.',
      );
      rethrow;
    }
  }

  Future<ShowroomStaffSwap> reverseSwap({
    required String swapId,
    String? reason,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final request = ReverseStaffSwapRequest(reason: reason);
      final result = await _repository.reverseSwap(swapId, request);

      // Refresh daily roster
      await loadDailyStaff(date: state.selectedDate);

      // Invalidate master showrooms list
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);

      if (!mounted) return result;
      state = state.copyWith(isLoading: false, clearError: true);
      return result;
    } on ApiException catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.message,
      );
      rethrow;
    } catch (e) {
      if (!mounted) rethrow;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to reverse staff swap.',
      );
      rethrow;
    }
  }

  Future<ShowroomStaffSwap> getSwapDetails(String swapId) async {
    return await _repository.getSwapById(swapId);
  }

  Future<List<ShowroomStaffSwap>> getSwapHistory() async {
    return await _repository.getShowroomSwapHistory(
      state.showroomId,
      date: state.selectedDate,
    );
  }
}

final dailyStaffProvider = StateNotifierProvider.autoDispose
    .family<DailyStaffNotifier, DailyStaffState, String>((ref, showroomId) {
  final repository = ref.watch(showroomRepositoryProvider);
  return DailyStaffNotifier(repository, ref, showroomId);
});
