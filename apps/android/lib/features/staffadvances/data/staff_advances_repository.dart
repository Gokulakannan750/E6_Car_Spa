import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/staff_advance_model.dart';
import '../models/staff_advance_request_models.dart';
import 'staff_advances_api.dart';

final staffAdvancesApiProvider = Provider<StaffAdvancesApi>((ref) {
  final dio = ref.watch(dioProvider);
  return StaffAdvancesApi(dio);
});

final staffAdvancesRepositoryProvider = Provider<StaffAdvancesRepository>((ref) {
  final api = ref.watch(staffAdvancesApiProvider);
  return StaffAdvancesRepository(api);
});

class StaffAdvancesRepository {
  final StaffAdvancesApi _api;

  StaffAdvancesRepository(this._api);

  Future<StaffAdvanceListResponse> getStaffAdvances({
    int page = 1,
    int pageSize = 20,
    String? staffId,
    String? status,
    DateTime? fromDate,
    DateTime? toDate,
    String? search,
  }) async {
    try {
      return await _api.getStaffAdvances(
        page: page,
        pageSize: pageSize,
        staffId: staffId,
        status: status,
        fromDate: fromDate,
        toDate: toDate,
        search: search,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffAdvance> getStaffAdvanceById(String id) async {
    try {
      return await _api.getStaffAdvanceById(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffAdvance> createStaffAdvance(CreateStaffAdvanceRequest request) async {
    try {
      return await _api.createStaffAdvance(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffAdvance> settleStaffAdvance(String id) async {
    try {
      return await _api.settleStaffAdvance(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffAdvance> obsoleteStaffAdvance(String id, ObsoleteStaffAdvanceRequest request) async {
    try {
      return await _api.obsoleteStaffAdvance(id, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffAdvanceHistory> getStaffAdvanceHistory(String staffId) async {
    try {
      return await _api.getStaffAdvanceHistory(staffId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
