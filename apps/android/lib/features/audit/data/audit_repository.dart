import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/audit_log_model.dart';

final auditRepositoryProvider = Provider<AuditRepository>((ref) {
  return AuditRepository(ref.watch(dioProvider));
});

class AuditRepository {
  final Dio _dio;

  AuditRepository(this._dio);

  static String _day(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<AuditLogPage> getLogs(
    AuditFilters filters, {
    int page = 1,
    int pageSize = 25,
  }) async {
    try {
      final response = await _dio.get(
        '/audit-logs',
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
          if (filters.search.trim().isNotEmpty) 'search': filters.search.trim(),
          if (filters.module.isNotEmpty) 'module': filters.module,
          if (filters.outcome.isNotEmpty) 'outcome': filters.outcome,
          if (filters.from != null) 'fromDate': _day(filters.from!),
          if (filters.to != null) 'toDate': _day(filters.to!),
        },
      );
      return AuditLogPage.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
