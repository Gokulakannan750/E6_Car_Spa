import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/staff_repository.dart';
import '../models/staff_attendance_models.dart';

final selectedAttendanceDateProvider = StateProvider<String>((ref) {
  return DateTime.now().toIso8601String().split('T')[0];
});

final selectedMonthlyYearMonthProvider = StateProvider<({int year, int month})>((ref) {
  final now = DateTime.now();
  return (year: now.year, month: now.month);
});

final selectedMonthlyStaffFilterProvider = StateProvider<String?>((ref) => null);

final dailyAttendanceProvider = FutureProvider.autoDispose.family<DailyAttendanceResponse, String>((ref, date) async {
  final repo = ref.watch(staffRepositoryProvider);
  return repo.getDailyAttendance(date);
});

final monthlyAttendanceReportProvider = FutureProvider.autoDispose<MonthlyAttendanceReportResponse>((ref) async {
  final ym = ref.watch(selectedMonthlyYearMonthProvider);
  final staffId = ref.watch(selectedMonthlyStaffFilterProvider);
  final repo = ref.watch(staffRepositoryProvider);
  return repo.getMonthlyAttendanceReport(year: ym.year, month: ym.month, staffId: staffId);
});

class AttendanceActionState {
  final bool isSubmitting;
  final String? errorMessage;
  final String? successMessage;

  const AttendanceActionState({
    this.isSubmitting = false,
    this.errorMessage,
    this.successMessage,
  });

  AttendanceActionState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    String? successMessage,
    bool clearError = false,
    bool clearSuccess = false,
  }) {
    return AttendanceActionState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
    );
  }
}

class AttendanceActionNotifier extends StateNotifier<AttendanceActionState> {
  final StaffRepository _repository;
  final Ref _ref;

  AttendanceActionNotifier(this._repository, this._ref) : super(const AttendanceActionState());

  Future<String?> markAttendance({
    required String staffId,
    required String attendanceDate,
    required String status,
    String? checkInTime,
    String? checkOutTime,
    double? workingHours,
    String? notes,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);
    try {
      await _repository.upsertAttendance(
        staffId: staffId,
        attendanceDate: attendanceDate,
        status: status,
        checkInTime: checkInTime,
        checkOutTime: checkOutTime,
        workingHours: workingHours,
        notes: notes,
      );
      state = state.copyWith(isSubmitting: false, successMessage: 'Attendance recorded');
      _ref.invalidate(dailyAttendanceProvider(attendanceDate));
      _ref.invalidate(monthlyAttendanceReportProvider);
      return null;
    } catch (e) {
      final msg = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: msg);
      return msg;
    }
  }

  Future<String?> confirmDailyAttendance({
    required String date,
    String? notes,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);
    try {
      await _repository.confirmDailyAttendance(date: date, notes: notes);
      state = state.copyWith(isSubmitting: false, successMessage: 'Daily attendance confirmed & locked');
      _ref.invalidate(dailyAttendanceProvider(date));
      return null;
    } catch (e) {
      final msg = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: msg);
      return msg;
    }
  }
}

final attendanceActionProvider = StateNotifierProvider<AttendanceActionNotifier, AttendanceActionState>((ref) {
  final repo = ref.watch(staffRepositoryProvider);
  return AttendanceActionNotifier(repo, ref);
});
