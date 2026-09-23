import 'package:dio/dio.dart';
import '../models/staff_model.dart';
import '../models/staff_request_models.dart';
import '../models/staff_attendance_models.dart';
import '../models/staff_salary_models.dart';

class StaffApi {
  final Dio _dio;

  StaffApi(this._dio);

  // ── Staff Directory ────────────────────────────────────────────────────────

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

  Future<String> revealAadhaar(String staffId) async {
    final response = await _dio.get('/staff-advances/staff/$staffId/aadhaar');
    final data = response.data as Map<String, dynamic>;
    return (data['aadhaarNumber'] ?? data['AadhaarNumber'] ?? '') as String;
  }

  Future<Staff> uploadAadhaarDocument(String staffId, List<int> fileBytes, String fileName) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(fileBytes, filename: fileName),
    });
    final response = await _dio.post(
      '/staff-advances/staff/$staffId/aadhaar-document',
      data: formData,
    );
    return Staff.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Staff> deleteAadhaarDocument(String staffId) async {
    final response = await _dio.delete('/staff-advances/staff/$staffId/aadhaar-document');
    return Staff.fromJson(response.data as Map<String, dynamic>);
  }

  // ── Staff Attendance ───────────────────────────────────────────────────────

  Future<DailyAttendanceResponse> getDailyAttendance(String date) async {
    final response = await _dio.get('/staff-attendance', queryParameters: {'date': date});
    return DailyAttendanceResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<DailyStaffAttendanceItem> upsertAttendance({
    required String staffId,
    required String attendanceDate,
    required String status,
    String? checkInTime,
    String? checkOutTime,
    double? workingHours,
    String? notes,
  }) async {
    final payload = {
      'staffId': staffId,
      'attendanceDate': attendanceDate,
      'status': status,
      if (checkInTime != null && checkInTime.isNotEmpty) 'checkInTime': checkInTime,
      if (checkOutTime != null && checkOutTime.isNotEmpty) 'checkOutTime': checkOutTime,
      'workingHours': ?workingHours,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };

    final response = await _dio.post('/staff-attendance', data: payload);
    return DailyStaffAttendanceItem.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> confirmDailyAttendance({
    required String date,
    String? notes,
  }) async {
    final payload = {
      'date': date,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };
    final response = await _dio.post(
      '/staff-attendance/confirm',
      queryParameters: {'date': date},
      data: payload,
    );
    return response.data as Map<String, dynamic>;
  }

  Future<MonthlyAttendanceReportResponse> getMonthlyAttendanceReport({
    required int year,
    required int month,
    String? staffId,
  }) async {
    final queryParams = <String, dynamic>{
      'year': year,
      'month': month,
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
    };

    final response = await _dio.get('/staff-attendance/monthly-report', queryParameters: queryParams);
    return MonthlyAttendanceReportResponse.fromJson(response.data as Map<String, dynamic>);
  }

  // ── Staff Salary ───────────────────────────────────────────────────────────

  Future<StaffSalaryRosterResponse> getSalaryRoster({
    required String fromDate,
    required String toDate,
    String? staffId,
    String? status,
    String? search,
  }) async {
    final queryParams = <String, dynamic>{
      'fromDate': fromDate,
      'toDate': toDate,
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
      if (status != null && status.isNotEmpty) 'status': status,
      if (search != null && search.isNotEmpty) 'search': search,
    };

    final response = await _dio.get('/staff-salary', queryParameters: queryParams);
    return StaffSalaryRosterResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<StaffSalaryPreviewResponse> getSalaryPreview({
    required String staffId,
    required String fromDate,
    required String toDate,
    required double enteredSalary,
  }) async {
    final queryParams = <String, dynamic>{
      'staffId': staffId,
      'fromDate': fromDate,
      'toDate': toDate,
      'enteredSalary': enteredSalary,
    };

    final response = await _dio.get('/staff-salary/preview', queryParameters: queryParams);
    return StaffSalaryPreviewResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<StaffSalaryItem> saveEnteredSalary({
    required String staffId,
    required String periodFrom,
    required String periodTo,
    required double enteredSalary,
    String? notes,
  }) async {
    final payload = {
      'staffId': staffId,
      'periodFrom': periodFrom,
      'periodTo': periodTo,
      'enteredSalary': enteredSalary,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };

    final response = await _dio.post('/staff-salary/enter', data: payload);
    return StaffSalaryItem.fromJson(response.data as Map<String, dynamic>);
  }

  Future<StaffSalarySettlement> settleSalary({
    required String staffId,
    required String periodFrom,
    required String periodTo,
    required double enteredSalary,
    String? notes,
  }) async {
    final payload = {
      'staffId': staffId,
      'periodFrom': periodFrom,
      'periodTo': periodTo,
      'enteredSalary': enteredSalary,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };

    final response = await _dio.post('/staff-salary/settle', data: payload);
    return StaffSalarySettlement.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<StaffSalarySettlement>> getSettlementHistory(String staffId) async {
    final response = await _dio.get('/staff-salary/settlements/$staffId');
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList.map((e) => StaffSalarySettlement.fromJson(e as Map<String, dynamic>)).toList();
  }
}
