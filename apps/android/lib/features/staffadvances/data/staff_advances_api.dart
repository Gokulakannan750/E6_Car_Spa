import 'package:dio/dio.dart';
import '../models/staff_advance_model.dart';
import '../models/staff_advance_request_models.dart';

class StaffAdvancesApi {
  final Dio _dio;

  StaffAdvancesApi(this._dio);

  Future<StaffAdvanceListResponse> getStaffAdvances({
    int page = 1,
    int pageSize = 20,
    String? staffId,
    String? status,
    DateTime? fromDate,
    DateTime? toDate,
    String? search,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
      if (status != null && status.isNotEmpty && status.toLowerCase() != 'all') 'status': status,
      if (fromDate != null) 'fromDate': fromDate.toIso8601String(),
      if (toDate != null) 'toDate': toDate.toIso8601String(),
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    };

    final response = await _dio.get(
      '/staff-advances',
      queryParameters: queryParameters,
    );

    return StaffAdvanceListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<StaffAdvance> getStaffAdvanceById(String id) async {
    final response = await _dio.get('/staff-advances/$id');
    return StaffAdvance.fromJson(response.data as Map<String, dynamic>);
  }

  Future<StaffAdvance> createStaffAdvance(CreateStaffAdvanceRequest request) async {
    final response = await _dio.post(
      '/staff-advances',
      data: request.toJson(),
    );
    return StaffAdvance.fromJson(response.data as Map<String, dynamic>);
  }

  Future<StaffAdvance> settleStaffAdvance(String id) async {
    final response = await _dio.post('/staff-advances/$id/settle');
    return StaffAdvance.fromJson(response.data as Map<String, dynamic>);
  }

  Future<StaffAdvance> obsoleteStaffAdvance(String id, ObsoleteStaffAdvanceRequest request) async {
    final response = await _dio.post(
      '/staff-advances/$id/obsolete',
      data: request.toJson(),
    );
    return StaffAdvance.fromJson(response.data as Map<String, dynamic>);
  }

  Future<StaffAdvanceHistory> getStaffAdvanceHistory(String staffId) async {
    final response = await _dio.get('/staff-advances/staff/$staffId/history');
    return StaffAdvanceHistory.fromJson(response.data as Map<String, dynamic>);
  }
}
