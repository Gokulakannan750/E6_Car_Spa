import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/staff_repository.dart';
import '../models/staff_salary_models.dart';

String _getDefaultPeriodFrom() {
  final now = DateTime.now();
  final monthStr = now.month.toString().padLeft(2, '0');
  return '${now.year}-$monthStr-01';
}

String _getDefaultPeriodTo() {
  final now = DateTime.now();
  final lastDay = DateTime(now.year, now.month + 1, 0).day;
  final monthStr = now.month.toString().padLeft(2, '0');
  final dayStr = lastDay.toString().padLeft(2, '0');
  return '${now.year}-$monthStr-$dayStr';
}

final salaryPeriodFromProvider = StateProvider<String>((ref) => _getDefaultPeriodFrom());
final salaryPeriodToProvider = StateProvider<String>((ref) => _getDefaultPeriodTo());
final salaryStatusFilterProvider = StateProvider<String>((ref) => 'All');
final salarySearchQueryProvider = StateProvider<String>((ref) => '');

final salaryRosterProvider = FutureProvider.autoDispose<StaffSalaryRosterResponse>((ref) async {
  final fromDate = ref.watch(salaryPeriodFromProvider);
  final toDate = ref.watch(salaryPeriodToProvider);
  final status = ref.watch(salaryStatusFilterProvider);
  final search = ref.watch(salarySearchQueryProvider);
  final repo = ref.watch(staffRepositoryProvider);

  final apiStatus = status == 'All' ? null : status;
  final apiSearch = search.trim().isEmpty ? null : search.trim();

  return repo.getSalaryRoster(
    fromDate: fromDate,
    toDate: toDate,
    status: apiStatus,
    search: apiSearch,
  );
});

final salarySettlementHistoryProvider = FutureProvider.autoDispose.family<List<StaffSalarySettlement>, String>((ref, staffId) async {
  final repo = ref.watch(staffRepositoryProvider);
  return repo.getSettlementHistory(staffId);
});

class SalaryActionState {
  final bool isSubmitting;
  final String? errorMessage;
  final String? successMessage;

  const SalaryActionState({
    this.isSubmitting = false,
    this.errorMessage,
    this.successMessage,
  });

  SalaryActionState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    String? successMessage,
    bool clearError = false,
    bool clearSuccess = false,
  }) {
    return SalaryActionState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
    );
  }
}

class SalaryActionNotifier extends StateNotifier<SalaryActionState> {
  final StaffRepository _repository;
  final Ref _ref;

  SalaryActionNotifier(this._repository, this._ref) : super(const SalaryActionState());

  Future<String?> saveEnteredSalary({
    required String staffId,
    required String periodFrom,
    required String periodTo,
    required double enteredSalary,
    String? notes,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);
    try {
      await _repository.saveEnteredSalary(
        staffId: staffId,
        periodFrom: periodFrom,
        periodTo: periodTo,
        enteredSalary: enteredSalary,
        notes: notes,
      );
      state = state.copyWith(isSubmitting: false, successMessage: 'Salary amount saved successfully');
      _ref.invalidate(salaryRosterProvider);
      return null;
    } catch (e) {
      final msg = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: msg);
      return msg;
    }
  }

  Future<String?> settleSalary({
    required String staffId,
    required String periodFrom,
    required String periodTo,
    required double enteredSalary,
    String? notes,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true, clearSuccess: true);
    try {
      await _repository.settleSalary(
        staffId: staffId,
        periodFrom: periodFrom,
        periodTo: periodTo,
        enteredSalary: enteredSalary,
        notes: notes,
      );
      state = state.copyWith(isSubmitting: false, successMessage: 'Salary settled & advances recovered atomically');
      _ref.invalidate(salaryRosterProvider);
      _ref.invalidate(salarySettlementHistoryProvider(staffId));
      return null;
    } catch (e) {
      final msg = e is ApiException ? e.message : e.toString();
      state = state.copyWith(isSubmitting: false, errorMessage: msg);
      return msg;
    }
  }
}

final salaryActionProvider = StateNotifierProvider<SalaryActionNotifier, SalaryActionState>((ref) {
  final repo = ref.watch(staffRepositoryProvider);
  return SalaryActionNotifier(repo, ref);
});
