import '../models/audit_log_model.dart';
import '../models/audit_log_query_parameters.dart';

class AuditLogsState {
  final List<AuditLogModel> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final int totalPages;
  final AuditLogQueryParameters query;
  final bool isLoading;
  final bool isLoadingMore;
  final bool isRefreshing;
  final String? errorMessage;
  final bool hasLoaded;

  const AuditLogsState({
    this.items = const [],
    this.totalCount = 0,
    this.page = 1,
    this.pageSize = 50,
    this.totalPages = 1,
    this.query = const AuditLogQueryParameters(),
    this.isLoading = false,
    this.isLoadingMore = false,
    this.isRefreshing = false,
    this.errorMessage,
    this.hasLoaded = false,
  });

  bool get hasNextPage => page < totalPages;
  bool get hasActiveFilters =>
      (query.search != null && query.search!.isNotEmpty) ||
      (query.module != null && query.module!.isNotEmpty) ||
      (query.outcome != null && query.outcome!.isNotEmpty) ||
      query.fromDate != null ||
      query.toDate != null;

  AuditLogsState copyWith({
    List<AuditLogModel>? items,
    int? totalCount,
    int? page,
    int? pageSize,
    int? totalPages,
    AuditLogQueryParameters? query,
    bool? isLoading,
    bool? isLoadingMore,
    bool? isRefreshing,
    String? errorMessage,
    bool? hasLoaded,
    bool clearError = false,
  }) {
    return AuditLogsState(
      items: items ?? this.items,
      totalCount: totalCount ?? this.totalCount,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      totalPages: totalPages ?? this.totalPages,
      query: query ?? this.query,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      hasLoaded: hasLoaded ?? this.hasLoaded,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuditLogsState &&
          runtimeType == other.runtimeType &&
          page == other.page &&
          totalCount == other.totalCount &&
          isLoading == other.isLoading &&
          errorMessage == other.errorMessage;

  @override
  int get hashCode =>
      page.hashCode ^
      totalCount.hashCode ^
      isLoading.hashCode ^
      (errorMessage?.hashCode ?? 0);
}
