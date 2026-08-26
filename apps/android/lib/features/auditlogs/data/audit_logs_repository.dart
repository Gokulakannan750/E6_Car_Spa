import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/audit_log_model.dart';
import '../models/audit_log_query_parameters.dart';
import 'audit_logs_api.dart';

final auditLogsApiProvider = Provider<AuditLogsApi>((ref) {
  final dio = ref.watch(dioProvider);
  return AuditLogsApi(dio);
});

final auditLogsRepositoryProvider = Provider<AuditLogsRepository>((ref) {
  final api = ref.watch(auditLogsApiProvider);
  return AuditLogsRepository(api);
});

class AuditLogsRepository {
  final AuditLogsApi _api;

  AuditLogsRepository(this._api);

  Future<PagedAuditLogsModel> getLogs(AuditLogQueryParameters query) async {
    try {
      return await _api.getLogs(query);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(message: e.toString());
    }
  }
}
