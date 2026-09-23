import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/staff_model.dart';
import '../models/staff_request_models.dart';
import '../models/staff_attendance_models.dart';
import '../models/staff_salary_models.dart';
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

  // ── Staff Directory ────────────────────────────────────────────────────────

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

  Future<String> revealAadhaar(String staffId) async {
    try {
      return await _api.revealAadhaar(staffId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Staff> uploadAadhaarDocument(String staffId, List<int> fileBytes, String fileName) async {
    try {
      return await _api.uploadAadhaarDocument(staffId, fileBytes, fileName);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Staff> deleteAadhaarDocument(String staffId) async {
    try {
      return await _api.deleteAadhaarDocument(staffId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // ── Staff Attendance ───────────────────────────────────────────────────────

  Future<DailyAttendanceResponse> getDailyAttendance(String date) async {
    try {
      return await _api.getDailyAttendance(date);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
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
    try {
      return await _api.upsertAttendance(
        staffId: staffId,
        attendanceDate: attendanceDate,
        status: status,
        checkInTime: checkInTime,
        checkOutTime: checkOutTime,
        workingHours: workingHours,
        notes: notes,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> confirmDailyAttendance({
    required String date,
    String? notes,
  }) async {
    try {
      return await _api.confirmDailyAttendance(date: date, notes: notes);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<MonthlyAttendanceReportResponse> getMonthlyAttendanceReport({
    required int year,
    required int month,
    String? staffId,
  }) async {
    try {
      return await _api.getMonthlyAttendanceReport(
        year: year,
        month: month,
        staffId: staffId,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // ── Staff Salary ───────────────────────────────────────────────────────────

  Future<StaffSalaryRosterResponse> getSalaryRoster({
    required String fromDate,
    required String toDate,
    String? staffId,
    String? status,
    String? search,
  }) async {
    try {
      return await _api.getSalaryRoster(
        fromDate: fromDate,
        toDate: toDate,
        staffId: staffId,
        status: status,
        search: search,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffSalaryPreviewResponse> getSalaryPreview({
    required String staffId,
    required String fromDate,
    required String toDate,
    required double enteredSalary,
  }) async {
    try {
      return await _api.getSalaryPreview(
        staffId: staffId,
        fromDate: fromDate,
        toDate: toDate,
        enteredSalary: enteredSalary,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffSalaryItem> saveEnteredSalary({
    required String staffId,
    required String periodFrom,
    required String periodTo,
    required double enteredSalary,
    String? notes,
  }) async {
    try {
      return await _api.saveEnteredSalary(
        staffId: staffId,
        periodFrom: periodFrom,
        periodTo: periodTo,
        enteredSalary: enteredSalary,
        notes: notes,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffSalarySettlement> settleSalary({
    required String staffId,
    required String periodFrom,
    required String periodTo,
    required double enteredSalary,
    String? notes,
  }) async {
    try {
      return await _api.settleSalary(
        staffId: staffId,
        periodFrom: periodFrom,
        periodTo: periodTo,
        enteredSalary: enteredSalary,
        notes: notes,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<StaffSalarySettlement>> getSettlementHistory(String staffId) async {
    try {
      return await _api.getSettlementHistory(staffId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
