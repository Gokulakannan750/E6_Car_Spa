import 'package:dio/dio.dart';
import '../models/showroom_model.dart';
import '../models/showroom_staff_assignment_model.dart';

class ShowroomApi {
  final Dio _dio;

  ShowroomApi(this._dio);

  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    final queryParameters = <String, dynamic>{};
    if (search != null && search.trim().isNotEmpty) {
      queryParameters['search'] = search.trim();
    }
    if (isActive != null) {
      queryParameters['isActive'] = isActive;
    }

    final response = await _dio.get(
      '/showrooms',
      queryParameters: queryParameters,
    );

    final rawList = response.data as List<dynamic>? ?? [];
    return rawList.map((e) => Showroom.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Showroom> getShowroomById(String id) async {
    final response = await _dio.get('/showrooms/$id');
    return Showroom.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Showroom> createShowroom(CreateShowroomRequest request) async {
    final response = await _dio.post(
      '/showrooms',
      data: request.toJson(),
    );
    return Showroom.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Showroom> updateShowroom(String id, UpdateShowroomRequest request) async {
    final response = await _dio.put(
      '/showrooms/$id',
      data: request.toJson(),
    );
    return Showroom.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteShowroom(String id) async {
    await _dio.delete('/showrooms/$id');
  }

  Future<void> toggleShowroomActive(String id) async {
    await _dio.patch('/showrooms/$id/toggle-active');
  }

  Future<DailyStaffResponse> getDailyStaff(String showroomId, DateTime date) async {
    final dateStr = date.toIso8601String().split('T').first;
    final response = await _dio.get(
      '/showrooms/$showroomId/daily-staff',
      queryParameters: {'date': dateStr},
    );
    return DailyStaffResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<DailyStaffAssignment> assignDailyStaff(
    String showroomId,
    CreateDailyStaffAssignmentRequest request,
  ) async {
    final response = await _dio.post(
      '/showrooms/$showroomId/daily-staff',
      data: request.toJson(),
    );
    return DailyStaffAssignment.fromJson(response.data as Map<String, dynamic>);
  }

  Future<DailyStaffAssignment> updateDailyStaffVehicles(
    String assignmentId,
    UpdateDailyStaffAssignmentRequest request,
  ) async {
    final response = await _dio.put(
      '/showroom-staff-assignments/$assignmentId',
      data: request.toJson(),
    );
    return DailyStaffAssignment.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> removeDailyStaff(String assignmentId) async {
    await _dio.delete('/showroom-staff-assignments/$assignmentId');
  }

  Future<DailyStaffResponse> confirmDailyStaffAttendance(
    String showroomId,
    DateTime date,
  ) async {
    final dateStr = date.toIso8601String().split('T').first;
    final response = await _dio.post(
      '/showrooms/$showroomId/daily-staff/confirm',
      queryParameters: {'date': dateStr},
    );
    return DailyStaffResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<DailyStaffResponse> unlockDailyStaffAttendance(
    String showroomId,
    DateTime date,
  ) async {
    final dateStr = date.toIso8601String().split('T').first;
    final response = await _dio.post(
      '/showrooms/$showroomId/daily-staff/unlock',
      queryParameters: {'date': dateStr},
    );
    return DailyStaffResponse.fromJson(response.data as Map<String, dynamic>);
  }
}
