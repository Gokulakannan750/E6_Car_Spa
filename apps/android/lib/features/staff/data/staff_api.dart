import 'package:dio/dio.dart';
import '../models/staff_model.dart';
import '../models/staff_request_models.dart';

class StaffApi {
  final Dio _dio;

  StaffApi(this._dio);

  Future<List<Staff>> getStaff() async {
    final response = await _dio.get('/staff-advances/staff');
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList.map((e) => Staff.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Staff> getStaffById(String staffId) async {
    final response = await _dio.get('/staff-advances/staff/$staffId');
    return Staff.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Staff> createStaff(CreateStaffRequest request) async {
    final response = await _dio.post(
      '/staff-advances/staff',
      data: request.toJson(),
    );
    return Staff.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Staff> updateStaff(String staffId, UpdateStaffRequest request) async {
    final response = await _dio.put(
      '/staff-advances/staff/$staffId',
      data: request.toJson(),
    );
    return Staff.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteStaff(String staffId) async {
    await _dio.delete('/staff-advances/staff/$staffId');
  }
}
