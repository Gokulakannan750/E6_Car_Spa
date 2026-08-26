import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/invoice_repository.dart';
import '../models/invoice_model.dart';
import '../models/invoice_request_models.dart';

// ── Invoice List State ────────────────────────────────────────────────────────

@immutable
class InvoiceListState {
  final bool isLoading;
  final bool isRefreshing;
  final List<InvoiceListItem> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final InvoiceStatus? selectedStatus;
  final String searchQuery;
  final String? errorMessage;

  const InvoiceListState({
    this.isLoading = false,
    this.isRefreshing = false,
    this.items = const [],
    this.totalCount = 0,
    this.page = 1,
    this.pageSize = 20,
    this.selectedStatus,
    this.searchQuery = '',
    this.errorMessage,
  });

  InvoiceListState copyWith({
    bool? isLoading,
    bool? isRefreshing,
    List<InvoiceListItem>? items,
    int? totalCount,
    int? page,
    int? pageSize,
    InvoiceStatus? selectedStatus,
    bool clearStatus = false,
    String? searchQuery,
    String? errorMessage,
    bool clearError = false,
  }) {
    return InvoiceListState(
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      items: items ?? this.items,
      totalCount: totalCount ?? this.totalCount,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      selectedStatus: clearStatus ? null : (selectedStatus ?? this.selectedStatus),
      searchQuery: searchQuery ?? this.searchQuery,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class InvoiceListNotifier extends StateNotifier<InvoiceListState> {
  final InvoiceRepository _repository;

  InvoiceListNotifier(this._repository) : super(const InvoiceListState()) {
    loadInvoices();
  }

  Future<void> loadInvoices({
    bool refresh = false,
    String? search,
    InvoiceStatus? status,
    bool clearStatus = false,
  }) async {
    if (!mounted) return;
    if (refresh) {
      state = state.copyWith(isRefreshing: true, clearError: true);
    } else {
      state = state.copyWith(isLoading: true, clearError: true);
    }

    try {
      final effectiveSearch = search != null
          ? (search.trim().isEmpty ? null : search.trim())
          : (state.searchQuery.trim().isEmpty ? null : state.searchQuery.trim());
      final effectiveStatus = clearStatus ? null : (status ?? state.selectedStatus);

      final response = await _repository.getInvoices(
        page: 1,
        pageSize: state.pageSize,
        search: effectiveSearch,
        status: effectiveStatus,
      );

      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        items: response.items,
        totalCount: response.totalCount,
        page: 1,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        errorMessage: e.message,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        errorMessage: 'Failed to load invoices. Please try again.',
      );
    }
  }

  void search(String query) {
    if (!mounted) return;
    state = state.copyWith(searchQuery: query);
    loadInvoices(search: query);
  }

  void setStatusFilter(InvoiceStatus? status) {
    if (!mounted) return;
    state = state.copyWith(
      selectedStatus: status,
      clearStatus: status == null,
    );
    loadInvoices(status: status, clearStatus: status == null);
  }
}

final invoiceListProvider = StateNotifierProvider<InvoiceListNotifier, InvoiceListState>((ref) {
  final repo = ref.watch(invoiceRepositoryProvider);
  return InvoiceListNotifier(repo);
});

// ── Invoice Details State ─────────────────────────────────────────────────────

@immutable
class InvoiceDetailsState {
  final bool isLoading;
  final bool isSaving;
  final bool isGenerating;
  final bool isRecordingPayment;
  final Invoice? invoice;
  final String? errorMessage;
  final String? actionSuccessMessage;

  const InvoiceDetailsState({
    this.isLoading = true,
    this.isSaving = false,
    this.isGenerating = false,
    this.isRecordingPayment = false,
    this.invoice,
    this.errorMessage,
    this.actionSuccessMessage,
  });

  InvoiceDetailsState copyWith({
    bool? isLoading,
    bool? isSaving,
    bool? isGenerating,
    bool? isRecordingPayment,
    Invoice? invoice,
    String? errorMessage,
    bool clearError = false,
    String? actionSuccessMessage,
    bool clearSuccess = false,
  }) {
    return InvoiceDetailsState(
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      isGenerating: isGenerating ?? this.isGenerating,
      isRecordingPayment: isRecordingPayment ?? this.isRecordingPayment,
      invoice: invoice ?? this.invoice,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      actionSuccessMessage: clearSuccess ? null : (actionSuccessMessage ?? this.actionSuccessMessage),
    );
  }
}

class InvoiceDetailsNotifier extends StateNotifier<InvoiceDetailsState> {
  final InvoiceRepository _repository;
  final String _invoiceId;
  final Ref _ref;

  InvoiceDetailsNotifier(this._repository, this._invoiceId, this._ref)
      : super(const InvoiceDetailsState()) {
    loadDetails();
  }

  Future<void> loadDetails() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);

    try {
      final invoice = await _repository.getInvoiceById(_invoiceId);
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        invoice: invoice,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.message,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load invoice details.',
      );
    }
  }

  Future<bool> updateDraft({
    double? discount,
    String? notes,
    bool? isGstEnabled,
  }) async {
    if (!mounted) return false;
    state = state.copyWith(isSaving: true, clearError: true, clearSuccess: true);

    try {
      final updated = await _repository.updateInvoice(
        _invoiceId,
        UpdateInvoiceRequest(
          discount: discount,
          notes: notes,
          isGstEnabled: isGstEnabled,
        ),
      );
      if (!mounted) return false;
      state = state.copyWith(
        isSaving: false,
        invoice: updated,
        actionSuccessMessage: 'Draft invoice updated successfully.',
        clearError: true,
      );
      _ref.read(invoiceListProvider.notifier).loadInvoices();
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isSaving: false,
        errorMessage: e.message,
      );
      return false;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Failed to update draft invoice.',
      );
      return false;
    }
  }

  Future<Invoice?> generateInvoice() async {
    if (!mounted) return null;
    state = state.copyWith(isGenerating: true, clearError: true, clearSuccess: true);

    try {
      final generated = await _repository.generateInvoice(_invoiceId);
      if (!mounted) return null;
      state = state.copyWith(
        isGenerating: false,
        invoice: generated,
        actionSuccessMessage: 'Invoice ${generated.invoiceNumber ?? ""} generated successfully!',
        clearError: true,
      );
      _ref.read(invoiceListProvider.notifier).loadInvoices();
      return generated;
    } on ApiException catch (e) {
      if (!mounted) return null;
      state = state.copyWith(
        isGenerating: false,
        errorMessage: e.message,
      );
      return null;
    } catch (e) {
      if (!mounted) return null;
      state = state.copyWith(
        isGenerating: false,
        errorMessage: 'Failed to generate invoice.',
      );
      return null;
    }
  }

  Future<bool> recordPayment(RecordPaymentRequest request) async {
    if (!mounted) return false;
    state = state.copyWith(isRecordingPayment: true, clearError: true, clearSuccess: true);

    try {
      await _repository.recordPayment(_invoiceId, request);
      // Reload full invoice details to fetch updated paid amount, balance, status, and payment history
      final refreshed = await _repository.getInvoiceById(_invoiceId);
      if (!mounted) return false;
      state = state.copyWith(
        isRecordingPayment: false,
        invoice: refreshed,
        actionSuccessMessage: 'Payment of ₹${request.amount.toStringAsFixed(2)} recorded successfully!',
        clearError: true,
      );
      _ref.read(invoiceListProvider.notifier).loadInvoices();
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isRecordingPayment: false,
        errorMessage: e.message,
      );
      return false;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isRecordingPayment: false,
        errorMessage: 'Failed to record payment.',
      );
      return false;
    }
  }
}

final invoiceDetailsProvider = StateNotifierProvider.family<InvoiceDetailsNotifier, InvoiceDetailsState, String>((ref, id) {
  final repo = ref.watch(invoiceRepositoryProvider);
  return InvoiceDetailsNotifier(repo, id, ref);
});
