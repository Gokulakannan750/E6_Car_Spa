import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/staff_model.dart';
import '../models/staff_request_models.dart';
import 'staff_api.dart';

final staffApiProvider = Provider<StaffApi>((ref) {
  final dio = ref.watch(dioProvider);
  return StaffApi(dio);
});

final staffRepositoryProvider = Provider<StaffRepository>((ref) {
  final api = ref.watch(staffApiProvider);
  return StaffRepository(api);
});

class StaffRepository {
  final StaffApi _api;

  StaffRepository(this._api);

  Future<List<Staff>> getStaff() async {
    try {
      return await _api.getStaff();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Staff> getStaffById(String staffId) async {
    try {
      return await _api.getStaffById(staffId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Staff> createStaff(CreateStaffRequest request) async {
    try {
      return await _api.createStaff(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Staff> updateStaff(String staffId, UpdateStaffRequest request) async {
    try {
      return await _api.updateStaff(staffId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteStaff(String staffId) async {
    try {
      await _api.deleteStaff(staffId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
