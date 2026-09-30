import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/showroom_repository.dart';
import '../models/showroom_billing_model.dart';
import 'showroom_provider.dart';

enum ShowroomBillingTabMode { daily, history }

enum BillingHistoryPreset { today, thisWeek, thisMonth, lastMonth, custom }

class ShowroomBillingState {
  final String showroomId;
  final DateTime selectedDate;
  final ShowroomBillingTabMode activeTab;
  final ShowroomDailyBill? dailyBill;
  final bool isLoading;
  final bool isSaving;
  final String? errorMessage;
  final BillingHistoryPreset historyPreset;
  final DateTime? customFromDate;
  final DateTime? customToDate;
  final ShowroomSummary? summary;
  final bool isSummaryLoading;
  final String? summaryErrorMessage;

  const ShowroomBillingState({
    required this.showroomId,
    required this.selectedDate,
    this.activeTab = ShowroomBillingTabMode.daily,
    this.dailyBill,
    this.isLoading = false,
    this.isSaving = false,
    this.errorMessage,
    this.historyPreset = BillingHistoryPreset.thisMonth,
    this.customFromDate,
    this.customToDate,
    this.summary,
    this.isSummaryLoading = false,
    this.summaryErrorMessage,
  });

  ShowroomBillingState copyWith({
    String? showroomId,
    DateTime? selectedDate,
    ShowroomBillingTabMode? activeTab,
    ShowroomDailyBill? Function()? dailyBill,
    bool? isLoading,
    bool? isSaving,
    String? Function()? errorMessage,
    BillingHistoryPreset? historyPreset,
    DateTime? Function()? customFromDate,
    DateTime? Function()? customToDate,
    ShowroomSummary? Function()? summary,
    bool? isSummaryLoading,
    String? Function()? summaryErrorMessage,
  }) {
    return ShowroomBillingState(
      showroomId: showroomId ?? this.showroomId,
      selectedDate: selectedDate ?? this.selectedDate,
      activeTab: activeTab ?? this.activeTab,
      dailyBill: dailyBill != null ? dailyBill() : this.dailyBill,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      historyPreset: historyPreset ?? this.historyPreset,
      customFromDate: customFromDate != null
          ? customFromDate()
          : this.customFromDate,
      customToDate: customToDate != null ? customToDate() : this.customToDate,
      summary: summary != null ? summary() : this.summary,
      isSummaryLoading: isSummaryLoading ?? this.isSummaryLoading,
      summaryErrorMessage: summaryErrorMessage != null
          ? summaryErrorMessage()
          : this.summaryErrorMessage,
    );
  }

  double get billedAmount => dailyBill?.amount ?? 0.0;
  double get receivedAmount => dailyBill?.amountReceived ?? 0.0;
  double get balanceAmount => dailyBill?.balanceAmount ?? 0.0;
  String get status => dailyBill?.status ?? 'Unpaid';
  List<ShowroomPayment> get payments => dailyBill?.payments ?? const [];

  DateTime get historyFromDate {
    final now = DateTime.now();
    switch (historyPreset) {
      case BillingHistoryPreset.today:
        return DateTime(now.year, now.month, now.day);
      case BillingHistoryPreset.thisWeek:
        final weekday = now.weekday; // Mon=1, Sun=7
        return DateTime(
          now.year,
          now.month,
          now.day,
        ).subtract(Duration(days: weekday - 1));
      case BillingHistoryPreset.thisMonth:
        return DateTime(now.year, now.month, 1);
      case BillingHistoryPreset.lastMonth:
        return DateTime(now.year, now.month - 1, 1);
      case BillingHistoryPreset.custom:
        return customFromDate ?? DateTime(now.year, now.month, 1);
    }
  }

  DateTime get historyToDate {
    final now = DateTime.now();
    switch (historyPreset) {
      case BillingHistoryPreset.today:
        return DateTime(now.year, now.month, now.day);
      case BillingHistoryPreset.thisWeek:
        return DateTime(now.year, now.month, now.day);
      case BillingHistoryPreset.thisMonth:
        return DateTime(now.year, now.month, now.day);
      case BillingHistoryPreset.lastMonth:
        return DateTime(now.year, now.month, 0); // Last day of previous month
      case BillingHistoryPreset.custom:
        return customToDate ?? DateTime(now.year, now.month, now.day);
    }
  }
}

class ShowroomBillingNotifier extends StateNotifier<ShowroomBillingState> {
  final ShowroomRepository _repository;
  final Ref _ref;

  ShowroomBillingNotifier(this._repository, this._ref, String showroomId)
    : super(
        ShowroomBillingState(
          showroomId: showroomId,
          selectedDate: DateTime.now(),
        ),
      ) {
    loadDailyBill();
  }

  void setDate(DateTime date) {
    state = state.copyWith(selectedDate: date, errorMessage: () => null);
    loadDailyBill();
  }

  void shiftDate(int days) {
    setDate(state.selectedDate.add(Duration(days: days)));
  }

  void setTab(ShowroomBillingTabMode tab) {
    state = state.copyWith(activeTab: tab);
    if (tab == ShowroomBillingTabMode.history && state.summary == null) {
      loadSummary();
    }
  }

  void setHistoryPreset(
    BillingHistoryPreset preset, {
    DateTime? customStart,
    DateTime? customEnd,
  }) {
    state = state.copyWith(
      historyPreset: preset,
      customFromDate: () => customStart,
      customToDate: () => customEnd,
    );
    loadSummary();
  }

  Future<void> loadDailyBill({bool silent = false}) async {
    if (!silent) {
      state = state.copyWith(isLoading: true, errorMessage: () => null);
    }

    try {
      final bill = await _repository.getShowroomDailyBill(
        state.showroomId,
        state.selectedDate,
      );
      state = state.copyWith(
        dailyBill: () => bill,
        isLoading: false,
        errorMessage: () => null,
      );
    } on ApiException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: () => e.message);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: () => 'Failed to load daily bill: $e',
      );
    }
  }

  Future<void> loadSummary({bool silent = false}) async {
    if (!silent) {
      state = state.copyWith(
        isSummaryLoading: true,
        summaryErrorMessage: () => null,
      );
    }

    try {
      final summary = await _repository.getShowroomSummary(
        state.showroomId,
        fromDate: state.historyFromDate,
        toDate: state.historyToDate,
      );
      state = state.copyWith(
        summary: () => summary,
        isSummaryLoading: false,
        summaryErrorMessage: () => null,
      );
    } on ApiException catch (e) {
      state = state.copyWith(
        isSummaryLoading: false,
        summaryErrorMessage: () => e.message,
      );
    } catch (e) {
      state = state.copyWith(
        isSummaryLoading: false,
        summaryErrorMessage: () => 'Failed to load billing summary: $e',
      );
    }
  }

  Future<bool> setDailyBill(SetShowroomDailyBillRequest request) async {
    state = state.copyWith(isSaving: true, errorMessage: () => null);

    try {
      final updatedBill = await _repository.setShowroomDailyBill(
        state.showroomId,
        state.selectedDate,
        request,
      );
      state = state.copyWith(
        dailyBill: () => updatedBill,
        isSaving: false,
        errorMessage: () => null,
      );
      // Refresh summary and showrooms directory in background
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
      if (state.summary != null) {
        loadSummary(silent: true);
      }
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(isSaving: false, errorMessage: () => e.message);
      return false;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: () => 'Failed to set daily bill: $e',
      );
      return false;
    }
  }

  Future<bool> recordPayment(RecordShowroomPaymentRequest request) async {
    state = state.copyWith(isSaving: true, errorMessage: () => null);

    try {
      final updatedBill = await _repository.recordShowroomPayment(
        state.showroomId,
        state.selectedDate,
        request,
      );
      state = state.copyWith(
        dailyBill: () => updatedBill,
        isSaving: false,
        errorMessage: () => null,
      );
      // Refresh summary and showrooms directory in background
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
      if (state.summary != null) {
        loadSummary(silent: true);
      }
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(isSaving: false, errorMessage: () => e.message);
      return false;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: () => 'Failed to record payment: $e',
      );
      return false;
    }
  }

  Future<bool> deletePayment(String paymentId) async {
    state = state.copyWith(isSaving: true, errorMessage: () => null);

    try {
      await _repository.deleteShowroomPayment(paymentId);
      // Reload daily bill
      final updatedBill = await _repository.getShowroomDailyBill(
        state.showroomId,
        state.selectedDate,
      );
      state = state.copyWith(
        dailyBill: () => updatedBill,
        isSaving: false,
        errorMessage: () => null,
      );
      // Refresh summary and showrooms directory in background
      _ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
      if (state.summary != null) {
        loadSummary(silent: true);
      }
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(isSaving: false, errorMessage: () => e.message);
      return false;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: () => 'Failed to void payment: $e',
      );
      return false;
    }
  }

  Future<void> refresh() async {
    await loadDailyBill(silent: false);
    if (state.activeTab == ShowroomBillingTabMode.history) {
      await loadSummary(silent: false);
    }
  }
}

final showroomBillingProvider = StateNotifierProvider.autoDispose
    .family<ShowroomBillingNotifier, ShowroomBillingState, String>((
      ref,
      showroomId,
    ) {
      final repository = ref.watch(showroomRepositoryProvider);
      return ShowroomBillingNotifier(repository, ref, showroomId);
    });

final showroomsOutstandingProvider =
    FutureProvider.autoDispose<List<ShowroomOutstandingOverview>>((ref) async {
      final repository = ref.watch(showroomRepositoryProvider);
      return await repository.getShowroomsOutstanding();
    });
