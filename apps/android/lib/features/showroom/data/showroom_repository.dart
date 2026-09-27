import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/showroom_billing_model.dart';
import '../models/showroom_model.dart';
import '../models/showroom_operations_model.dart';
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

  Future<DailyStaffAssignment> updateDailyStaffAssignment(
    String assignmentId,
    UpdateDailyStaffAssignmentRequest request,
  ) async {
    try {
      return await _api.updateDailyStaffAssignment(assignmentId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DailyStaffAssignment> updateDailyStaffVehicles(
    String assignmentId,
    UpdateDailyStaffAssignmentRequest request,
  ) =>
      updateDailyStaffAssignment(assignmentId, request);

  Future<void> removeDailyStaff(String assignmentId) async {
    try {
      await _api.removeDailyStaff(assignmentId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DailyStaffResponse> confirmDailyStaffAttendance(
    String showroomId,
    DateTime date,
  ) async {
    try {
      return await _api.confirmDailyStaffAttendance(showroomId, date);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DailyStaffResponse> unlockDailyStaffAttendance(
    String showroomId,
    DateTime date,
  ) async {
    try {
      return await _api.unlockDailyStaffAttendance(showroomId, date);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // --- Operations Methods ---

  Future<List<ShowroomVehicleType>> getShowroomVehicleTypes({bool? isActive}) async {
    try {
      return await _api.getShowroomVehicleTypes(isActive: isActive);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async {
    try {
      return await _api.getShowroomWorkTypes(isActive: isActive);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<ShowroomVehicleWork>> getShowroomVehicleWorks(
    String showroomId, {
    DateTime? date,
    String? staffId,
    String? vehicleTypeId,
  }) async {
    try {
      return await _api.getShowroomVehicleWorks(
        showroomId,
        date: date,
        staffId: staffId,
        vehicleTypeId: vehicleTypeId,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShowroomVehicleWork> getShowroomVehicleWorkById(
    String showroomId,
    String id,
  ) async {
    try {
      return await _api.getShowroomVehicleWorkById(showroomId, id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShowroomVehicleWork> createShowroomVehicleWork(
    String showroomId,
    CreateShowroomVehicleWorkRequest request,
  ) async {
    try {
      return await _api.createShowroomVehicleWork(showroomId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<ShowroomVehicleWork>> createBatchShowroomVehicleWork(
    String showroomId,
    CreateBatchShowroomVehicleWorkRequest request,
  ) async {
    try {
      return await _api.createBatchShowroomVehicleWork(showroomId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShowroomVehicleWork> updateShowroomVehicleWork(
    String showroomId,
    String workId,
    UpdateShowroomVehicleWorkRequest request,
  ) async {
    try {
      return await _api.updateShowroomVehicleWork(showroomId, workId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteShowroomVehicleWork(
    String showroomId,
    String workId,
  ) async {
    try {
      await _api.deleteShowroomVehicleWork(showroomId, workId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShowroomOperationsSummary> getShowroomOperationsSummary(
    String showroomId,
    DateTime date,
  ) async {
    try {
      return await _api.getShowroomOperationsSummary(showroomId, date);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DailyStaffAssignment> closeShowroomStaffWorkSession(
    String showroomId,
    String sessionId,
    CloseShowroomStaffWorkSessionRequest? request,
  ) async {
    try {
      return await _api.closeShowroomStaffWorkSession(showroomId, sessionId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // --- Billing & Payment Methods ---

  Future<ShowroomDailyBill> getShowroomDailyBill(
    String showroomId,
    DateTime date,
  ) async {
    try {
      return await _api.getShowroomDailyBill(showroomId, date);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShowroomDailyBill> setShowroomDailyBill(
    String showroomId,
    DateTime date,
    SetShowroomDailyBillRequest request,
  ) async {
    try {
      return await _api.setShowroomDailyBill(showroomId, date, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShowroomDailyBill> recordShowroomPayment(
    String showroomId,
    DateTime date,
    RecordShowroomPaymentRequest request,
  ) async {
    try {
      return await _api.recordShowroomPayment(showroomId, date, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteShowroomPayment(String paymentId) async {
    try {
      await _api.deleteShowroomPayment(paymentId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // --- Summary & Outstanding Overview Methods ---

  Future<ShowroomSummary> getShowroomSummary(
    String showroomId, {
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    try {
      return await _api.getShowroomSummary(
        showroomId,
        fromDate: fromDate,
        toDate: toDate,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<ShowroomOutstandingOverview>> getShowroomsOutstanding({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    try {
      return await _api.getShowroomsOutstanding(
        fromDate: fromDate,
        toDate: toDate,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
