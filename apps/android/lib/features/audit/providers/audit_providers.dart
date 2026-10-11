import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../auth/providers/auth_provider.dart';
import '../data/audit_repository.dart';
import '../models/audit_log_model.dart';

class AuditLogState {
  final List<AuditLogEntry> items;
  final int totalCount;
  final int page;
  final int totalPages;
  final AuditFilters filters;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;

  const AuditLogState({
    this.items = const [],
    this.totalCount = 0,
    this.page = 0,
    this.totalPages = 0,
    this.filters = const AuditFilters(),
    this.isLoading = true,
    this.isLoadingMore = false,
    this.error,
  });

  bool get hasMore => page < totalPages;

  AuditLogState copyWith({
    List<AuditLogEntry>? items,
    int? totalCount,
    int? page,
    int? totalPages,
    AuditFilters? filters,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool clearError = false,
  }) => AuditLogState(
    items: items ?? this.items,
    totalCount: totalCount ?? this.totalCount,
    page: page ?? this.page,
    totalPages: totalPages ?? this.totalPages,
    filters: filters ?? this.filters,
    isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
  );
}

/// The audit log as a list that grows page by page, newest first, under the current filters.
class AuditLogNotifier extends StateNotifier<AuditLogState> {
  final AuditRepository _repository;

  AuditLogNotifier(this._repository) : super(const AuditLogState()) {
    load();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.getLogs(state.filters);
      if (!mounted) return;
      state = state.copyWith(
        items: result.items,
        totalCount: result.totalCount,
        page: result.page,
        totalPages: result.totalPages,
        isLoading: false,
      );
    } on ApiException catch (e) {
      if (mounted) state = state.copyWith(isLoading: false, error: e.message);
    } catch (_) {
      if (mounted) {
        state = state.copyWith(
          isLoading: false,
          error: 'Could not load the audit trail.',
        );
      }
    }
  }

  Future<void> loadMore() async {
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final result = await _repository.getLogs(
        state.filters,
        page: state.page + 1,
      );
      if (!mounted) return;
      state = state.copyWith(
        items: [...state.items, ...result.items],
        totalCount: result.totalCount,
        page: result.page,
        totalPages: result.totalPages,
        isLoadingMore: false,
      );
    } on ApiException catch (e) {
      if (mounted) {
        state = state.copyWith(isLoadingMore: false, error: e.message);
      }
    } catch (_) {
      if (mounted) {
        state = state.copyWith(
          isLoadingMore: false,
          error: 'Could not load more.',
        );
      }
    }
  }

  Future<void> applyFilters(AuditFilters filters) {
    state = state.copyWith(filters: filters);
    return load();
  }
}

final auditLogProvider =
    StateNotifierProvider.autoDispose<AuditLogNotifier, AuditLogState>((ref) {
      // A different user (or company) must never see the previous one's list.
      ref.watch(currentUserProvider);
      return AuditLogNotifier(ref.watch(auditRepositoryProvider));
    });
