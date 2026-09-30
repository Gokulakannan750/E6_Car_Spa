import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/outside_job_repository.dart';
import '../models/outside_job_model.dart';

// ── Outside Jobs State ──────────────────────────────────────────────────────

@immutable
class OutsideJobsState {
  final bool isLoading;
  final List<OutsideJob> jobs;
  final String? errorMessage;
  final bool isSubmitting;
  final String? submitError;

  const OutsideJobsState({
    this.isLoading = true,
    this.jobs = const [],
    this.errorMessage,
    this.isSubmitting = false,
    this.submitError,
  });

  /// The active job currently outside (status == Outside).
  OutsideJob? get activeJob {
    try {
      return jobs.firstWhere((j) => j.status == OutsideJobStatus.outside);
    } catch (_) {
      return null;
    }
  }

  /// Historical (completed/cancelled) jobs.
  List<OutsideJob> get historicalJobs =>
      jobs.where((j) => j.status != OutsideJobStatus.outside).toList();

  bool get isVehicleOutside => activeJob != null;

  OutsideJobsState copyWith({
    bool? isLoading,
    List<OutsideJob>? jobs,
    String? errorMessage,
    bool clearError = false,
    bool? isSubmitting,
    String? submitError,
    bool clearSubmitError = false,
  }) {
    return OutsideJobsState(
      isLoading: isLoading ?? this.isLoading,
      jobs: jobs ?? this.jobs,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitError: clearSubmitError ? null : (submitError ?? this.submitError),
    );
  }
}

class OutsideJobsNotifier extends StateNotifier<OutsideJobsState> {
  final String jobCardId;
  final OutsideJobRepository _repository;

  OutsideJobsNotifier(this.jobCardId, this._repository)
    : super(const OutsideJobsState()) {
    load();
  }

  Future<void> load() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final jobs = await _repository.getByJobCardId(jobCardId);
      if (!mounted) return;
      state = state.copyWith(isLoading: false, jobs: jobs, clearError: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(isLoading: false, errorMessage: e.message);
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load outside jobs.',
      );
    }
  }

  Future<bool> sendOutside(CreateOutsideJobRequest request) async {
    if (!mounted) return false;
    state = state.copyWith(isSubmitting: true, clearSubmitError: true);

    try {
      await _repository.createOutsideJob(jobCardId, request);
      if (!mounted) return true;
      state = state.copyWith(isSubmitting: false, clearSubmitError: true);
      await load();
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      state = state.copyWith(isSubmitting: false, submitError: e.message);
      return false;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isSubmitting: false,
        submitError: 'Failed to send vehicle outside.',
      );
      return false;
    }
  }

  Future<bool> markReturned(
    String outsideJobId,
    MarkOutsideJobReturnedRequest request,
  ) async {
    if (!mounted) return false;
    state = state.copyWith(isSubmitting: true, clearSubmitError: true);

    try {
      await _repository.markReturned(outsideJobId, request);
      if (!mounted) return true;
      state = state.copyWith(isSubmitting: false, clearSubmitError: true);
      await load();
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      state = state.copyWith(isSubmitting: false, submitError: e.message);
      return false;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isSubmitting: false,
        submitError: 'Failed to mark vehicle returned.',
      );
      return false;
    }
  }

  Future<bool> cancelJob(
    String outsideJobId,
    CancelOutsideJobRequest request,
  ) async {
    if (!mounted) return false;
    state = state.copyWith(isSubmitting: true, clearSubmitError: true);

    try {
      await _repository.cancel(outsideJobId, request);
      if (!mounted) return true;
      state = state.copyWith(isSubmitting: false, clearSubmitError: true);
      await load();
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      state = state.copyWith(isSubmitting: false, submitError: e.message);
      return false;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isSubmitting: false,
        submitError: 'Failed to cancel outside job.',
      );
      return false;
    }
  }

  Future<bool> updateCost(String outsideJobId, double vendorCost) async {
    if (!mounted) return false;
    state = state.copyWith(isSubmitting: true, clearSubmitError: true);

    try {
      await _repository.updateCost(
        outsideJobId,
        UpdateOutsideJobCostRequest(vendorCost: vendorCost),
      );
      if (!mounted) return true;
      state = state.copyWith(isSubmitting: false, clearSubmitError: true);
      await load();
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      state = state.copyWith(isSubmitting: false, submitError: e.message);
      return false;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isSubmitting: false,
        submitError: 'Failed to update vendor cost.',
      );
      return false;
    }
  }

  Future<bool> deleteJob(String outsideJobId) async {
    if (!mounted) return false;
    state = state.copyWith(isSubmitting: true, clearSubmitError: true);

    try {
      await _repository.deleteOutsideJob(outsideJobId);
      if (!mounted) return true;
      state = state.copyWith(isSubmitting: false, clearSubmitError: true);
      await load();
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      state = state.copyWith(isSubmitting: false, submitError: e.message);
      return false;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isSubmitting: false,
        submitError: 'Failed to delete outside job record.',
      );
      return false;
    }
  }
}

final outsideJobsProvider =
    StateNotifierProvider.family<OutsideJobsNotifier, OutsideJobsState, String>(
      (ref, jobCardId) {
        final repo = ref.watch(outsideJobRepositoryProvider);
        return OutsideJobsNotifier(jobCardId, repo);
      },
    );

// ── Vendors State ───────────────────────────────────────────────────────────

@immutable
class VendorsState {
  final bool isLoading;
  final List<Vendor> vendors;
  final String? errorMessage;
  final bool isSubmitting;
  final String? submitError;

  const VendorsState({
    this.isLoading = true,
    this.vendors = const [],
    this.errorMessage,
    this.isSubmitting = false,
    this.submitError,
  });

  VendorsState copyWith({
    bool? isLoading,
    List<Vendor>? vendors,
    String? errorMessage,
    bool clearError = false,
    bool? isSubmitting,
    String? submitError,
    bool clearSubmitError = false,
  }) {
    return VendorsState(
      isLoading: isLoading ?? this.isLoading,
      vendors: vendors ?? this.vendors,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitError: clearSubmitError ? null : (submitError ?? this.submitError),
    );
  }
}

class VendorsNotifier extends StateNotifier<VendorsState> {
  final OutsideJobRepository _repository;

  VendorsNotifier(this._repository) : super(const VendorsState()) {
    load();
  }

  Future<void> load() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final vendors = await _repository.getVendors(activeOnly: true);
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        vendors: vendors,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(isLoading: false, errorMessage: e.message);
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load vendors.',
      );
    }
  }

  Future<Vendor?> createVendor(CreateVendorRequest request) async {
    if (!mounted) return null;
    state = state.copyWith(isSubmitting: true, clearSubmitError: true);

    try {
      final vendor = await _repository.createVendor(request);
      if (!mounted) return vendor;
      state = state.copyWith(isSubmitting: false, clearSubmitError: true);
      await load();
      return vendor;
    } on ApiException catch (e) {
      if (!mounted) return null;
      state = state.copyWith(isSubmitting: false, submitError: e.message);
      return null;
    } catch (e) {
      if (!mounted) return null;
      state = state.copyWith(
        isSubmitting: false,
        submitError: 'Failed to create vendor.',
      );
      return null;
    }
  }
}

final vendorsProvider = StateNotifierProvider<VendorsNotifier, VendorsState>((
  ref,
) {
  final repo = ref.watch(outsideJobRepositoryProvider);
  return VendorsNotifier(repo);
});
