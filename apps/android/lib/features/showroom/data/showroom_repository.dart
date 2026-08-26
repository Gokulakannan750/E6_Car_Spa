import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/showroom_model.dart';
import '../models/showroom_staff_assignment_model.dart';
import 'showroom_api.dart';

final showroomApiProvider = Provider<ShowroomApi>((ref) {
  final dio = ref.watch(dioProvider);
  return ShowroomApi(dio);
});

final showroomRepositoryProvider = Provider<ShowroomRepository>((ref) {
  final api = ref.watch(showroomApiProvider);
  return ShowroomRepository(api);
});

class ShowroomRepository {
  final ShowroomApi _api;

  ShowroomRepository(this._api);

  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    try {
      return await _api.getShowrooms(search: search, isActive: isActive);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Showroom> getShowroomById(String id) async {
    try {
      return await _api.getShowroomById(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Showroom> createShowroom(CreateShowroomRequest request) async {
    try {
      return await _api.createShowroom(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Showroom> updateShowroom(String id, UpdateShowroomRequest request) async {
    try {
      return await _api.updateShowroom(id, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteShowroom(String id) async {
    try {
      await _api.deleteShowroom(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> toggleShowroomActive(String id) async {
    try {
      await _api.toggleShowroomActive(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DailyStaffResponse> getDailyStaff(String showroomId, DateTime date) async {
    try {
      return await _api.getDailyStaff(showroomId, date);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DailyStaffAssignment> assignDailyStaff(
    String showroomId,
    CreateDailyStaffAssignmentRequest request,
  ) async {
    try {
      return await _api.assignDailyStaff(showroomId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> removeDailyStaff(String assignmentId) async {
    try {
      await _api.removeDailyStaff(assignmentId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
