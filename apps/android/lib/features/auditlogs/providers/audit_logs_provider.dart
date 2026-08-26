import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/audit_logs_repository.dart';
import '../models/audit_log_query_parameters.dart';
import 'audit_logs_state.dart';

final auditLogsNotifierProvider =
    StateNotifierProvider.autoDispose<AuditLogsNotifier, AuditLogsState>((ref) {
  final repository = ref.watch(auditLogsRepositoryProvider);
  return AuditLogsNotifier(repository)..loadLogs();
});

class AuditLogsNotifier extends StateNotifier<AuditLogsState> {
  final AuditLogsRepository _repository;

  AuditLogsNotifier(this._repository) : super(const AuditLogsState());

  Future<void> loadLogs({bool resetPage = false}) async {
    final query = resetPage
        ? state.query.copyWith(page: 1)
        : state.query;

    state = state.copyWith(
      isLoading: true,
      clearError: true,
      query: query,
    );

    try {
      final pagedResult = await _repository.getLogs(query);
      state = state.copyWith(
        items: pagedResult.items,
        totalCount: pagedResult.totalCount,
        page: pagedResult.page,
        pageSize: pagedResult.pageSize,
        totalPages: pagedResult.totalPages,
        isLoading: false,
        hasLoaded: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('ApiException: ', ''),
      );
    }
  }

  Future<void> refresh() async {
    state = state.copyWith(isRefreshing: true, clearError: true);
    final query = state.query.copyWith(page: 1);

    try {
      final pagedResult = await _repository.getLogs(query);
      state = state.copyWith(
        items: pagedResult.items,
        totalCount: pagedResult.totalCount,
        page: pagedResult.page,
        pageSize: pagedResult.pageSize,
        totalPages: pagedResult.totalPages,
        isRefreshing: false,
        hasLoaded: true,
        query: query,
      );
    } catch (e) {
      state = state.copyWith(
        isRefreshing: false,
        errorMessage: e.toString().replaceAll('ApiException: ', ''),
      );
    }
  }

  Future<void> loadMore() async {
    if (state.isLoading || state.isLoadingMore || !state.hasNextPage) return;

    final nextPage = state.page + 1;
    final query = state.query.copyWith(page: nextPage);

    state = state.copyWith(isLoadingMore: true);

    try {
      final pagedResult = await _repository.getLogs(query);
      state = state.copyWith(
        items: [...state.items, ...pagedResult.items],
        totalCount: pagedResult.totalCount,
        page: pagedResult.page,
        pageSize: pagedResult.pageSize,
        totalPages: pagedResult.totalPages,
        isLoadingMore: false,
        query: query,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        errorMessage: e.toString().replaceAll('ApiException: ', ''),
      );
    }
  }

  void setSearch(String search) {
    if (state.query.search == search.trim()) return;
    final newQuery = state.query.copyWith(
      search: search.trim().isEmpty ? null : search.trim(),
      clearSearch: search.trim().isEmpty,
      page: 1,
    );
    state = state.copyWith(query: newQuery);
    loadLogs(resetPage: true);
  }

  void setModule(String? module) {
    if (state.query.module == module) return;
    final newQuery = state.query.copyWith(
      module: module,
      clearModule: module == null || module.isEmpty,
      page: 1,
    );
    state = state.copyWith(query: newQuery);
    loadLogs(resetPage: true);
  }

  void setOutcome(String? outcome) {
    if (state.query.outcome == outcome) return;
    final newQuery = state.query.copyWith(
      outcome: outcome,
      clearOutcome: outcome == null || outcome.isEmpty,
      page: 1,
    );
    state = state.copyWith(query: newQuery);
    loadLogs(resetPage: true);
  }

  void setDateRange(DateTime? from, DateTime? to) {
    final newQuery = state.query.copyWith(
      fromDate: from,
      toDate: to,
      clearDates: from == null && to == null,
      page: 1,
    );
    state = state.copyWith(query: newQuery);
    loadLogs(resetPage: true);
  }

  void clearFilters() {
    final newQuery = const AuditLogQueryParameters();
    state = state.copyWith(query: newQuery);
    loadLogs(resetPage: true);
  }
}
