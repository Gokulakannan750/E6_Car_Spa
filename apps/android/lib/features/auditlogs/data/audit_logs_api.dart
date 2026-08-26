import 'package:dio/dio.dart';
import '../models/audit_log_model.dart';
import '../models/audit_log_query_parameters.dart';

class AuditLogsApi {
  final Dio _dio;

  AuditLogsApi(this._dio);

  Future<PagedAuditLogsModel> getLogs(AuditLogQueryParameters query) async {
    final response = await _dio.get(
      '/audit-logs',
      queryParameters: query.toQueryParameters(),
    );
    return PagedAuditLogsModel.fromJson(response.data as Map<String, dynamic>);
  }
}
