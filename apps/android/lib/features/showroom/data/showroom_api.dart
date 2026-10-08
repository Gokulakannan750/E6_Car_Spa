import 'package:dio/dio.dart';
import '../models/showroom_billing_model.dart';
import '../models/showroom_model.dart';
import '../models/showroom_operations_model.dart';
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
    return rawList
        .map((e) => Showroom.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Showroom> getShowroomById(String id) async {
    final response = await _dio.get('/showrooms/$id');
    return Showroom.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Showroom> createShowroom(CreateShowroomRequest request) async {
    final response = await _dio.post('/showrooms', data: request.toJson());
    return Showroom.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Showroom> updateShowroom(
    String id,
    UpdateShowroomRequest request,
  ) async {
    final response = await _dio.put('/showrooms/$id', data: request.toJson());
    return Showroom.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> toggleShowroomActive(String id) async {
    await _dio.patch('/showrooms/$id/toggle-active');
  }

  Future<DailyStaffResponse> getDailyStaff(
    String showroomId,
    DateTime date,
  ) async {
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

  Future<DailyStaffAssignment> updateDailyStaffAssignment(
    String assignmentId,
    UpdateDailyStaffAssignmentRequest request,
  ) async {
    final response = await _dio.put(
      '/showroom-staff-assignments/$assignmentId',
      data: request.toJson(),
    );
    return DailyStaffAssignment.fromJson(response.data as Map<String, dynamic>);
  }

  Future<DailyStaffAssignment> updateDailyStaffVehicles(
    String assignmentId,
    UpdateDailyStaffAssignmentRequest request,
  ) => updateDailyStaffAssignment(assignmentId, request);

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

  // ── Showroom Staff Swaps & Traceability ─────────────────────────────────────

  Future<ShowroomStaffSwap> swapStaff(CreateStaffSwapRequest request) async {
    final response = await _dio.post(
      '/showrooms/swap-staff',
      data: request.toJson(),
    );
    return ShowroomStaffSwap.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<ShowroomStaffSwap>> getSwaps({
    String? showroomId,
    String? staffId,
    DateTime? date,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (showroomId != null) queryParameters['showroomId'] = showroomId;
    if (staffId != null) queryParameters['staffId'] = staffId;
    if (date != null)
      queryParameters['date'] = date.toIso8601String().split('T').first;

    final response = await _dio.get(
      '/showrooms/swaps',
      queryParameters: queryParameters,
    );
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList
        .map((e) => ShowroomStaffSwap.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<ShowroomStaffSwap>> getShowroomSwapHistory(
    String showroomId, {
    DateTime? date,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (date != null)
      queryParameters['date'] = date.toIso8601String().split('T').first;

    final response = await _dio.get(
      '/showrooms/$showroomId/swap-history',
      queryParameters: queryParameters,
    );
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList
        .map((e) => ShowroomStaffSwap.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ShowroomStaffSwap> getSwapById(String swapId) async {
    final response = await _dio.get('/showrooms/swaps/$swapId');
    return ShowroomStaffSwap.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ShowroomStaffSwap> reverseSwap(
    String swapId,
    ReverseStaffSwapRequest request,
  ) async {
    final response = await _dio.post(
      '/showrooms/swaps/$swapId/reverse',
      data: request.toJson(),
    );
    return ShowroomStaffSwap.fromJson(response.data as Map<String, dynamic>);
  }

  // ── Showroom Operations (Vehicle Types & Work Types) ─────────────────────

  Future<List<ShowroomVehicleType>> getShowroomVehicleTypes({
    bool? isActive,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (isActive != null) queryParameters['isActive'] = isActive;

    final response = await _dio.get(
      '/showroom-vehicle-types',
      queryParameters: queryParameters,
    );
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList
        .map((e) => ShowroomVehicleType.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ShowroomVehicleType> createShowroomVehicleType({
    required String name,
    int displayOrder = 0,
    String? code,
  }) async {
    final response = await _dio.post(
      '/showroom-vehicle-types',
      data: {
        'name': name,
        'displayOrder': displayOrder,
        if (code != null && code.isNotEmpty) 'code': code,
      },
    );
    return ShowroomVehicleType.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ShowroomVehicleType> updateShowroomVehicleType(
    String id, {
    required String name,
    int displayOrder = 0,
    bool isActive = true,
    String? code,
  }) async {
    final response = await _dio.put(
      '/showroom-vehicle-types/$id',
      data: {
        'name': name,
        'displayOrder': displayOrder,
        'isActive': isActive,
        if (code != null && code.isNotEmpty) 'code': code,
      },
    );
    return ShowroomVehicleType.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ShowroomVehicleType> toggleVehicleTypeActive(String id) async {
    final response = await _dio.patch(
      '/showroom-vehicle-types/$id/toggle-active',
    );
    return ShowroomVehicleType.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async {
    final queryParameters = <String, dynamic>{};
    if (isActive != null) queryParameters['isActive'] = isActive;

    final response = await _dio.get(
      '/showroom-work-types',
      queryParameters: queryParameters,
    );
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList
        .map((e) => ShowroomWorkType.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ShowroomWorkType> createShowroomWorkType({
    required String name,
    String? description,
    int displayOrder = 0,
    String? code,
  }) async {
    final response = await _dio.post(
      '/showroom-work-types',
      data: {
        'name': name,
        if (description != null && description.isNotEmpty)
          'description': description,
        'displayOrder': displayOrder,
        if (code != null && code.isNotEmpty) 'code': code,
      },
    );
    return ShowroomWorkType.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ShowroomWorkType> updateShowroomWorkType(
    String id, {
    required String name,
    String? description,
    int displayOrder = 0,
    bool isActive = true,
    String? code,
  }) async {
    final response = await _dio.put(
      '/showroom-work-types/$id',
      data: {
        'name': name,
        'description': description,
        'displayOrder': displayOrder,
        'isActive': isActive,
        if (code != null && code.isNotEmpty) 'code': code,
      },
    );
    return ShowroomWorkType.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ShowroomWorkType> toggleWorkTypeActive(String id) async {
    final response = await _dio.patch('/showroom-work-types/$id/toggle-active');
    return ShowroomWorkType.fromJson(response.data as Map<String, dynamic>);
  }

  // ── Showroom Vehicle Work ────────────────────────────────────────────────

  Future<List<ShowroomVehicleWork>> getShowroomVehicleWorks(
    String showroomId, {
    DateTime? date,
    String? staffId,
    String? vehicleTypeId,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (date != null)
      queryParameters['date'] = date.toIso8601String().split('T').first;
    if (staffId != null && staffId.isNotEmpty)
      queryParameters['staffId'] = staffId;
    if (vehicleTypeId != null && vehicleTypeId.isNotEmpty) {
      queryParameters['vehicleTypeId'] = vehicleTypeId;
    }

    final response = await _dio.get(
      '/showrooms/$showroomId/vehicle-works',
      queryParameters: queryParameters,
    );
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList
        .map((e) => ShowroomVehicleWork.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ShowroomVehicleWork> getShowroomVehicleWorkById(
    String showroomId,
    String id,
  ) async {
    final response = await _dio.get('/showrooms/$showroomId/vehicle-works/$id');
    return ShowroomVehicleWork.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ShowroomVehicleWork> createShowroomVehicleWork(
    String showroomId,
    CreateShowroomVehicleWorkRequest request,
  ) async {
    final response = await _dio.post(
      '/showrooms/$showroomId/vehicle-works',
      data: request.toJson(),
    );
    return ShowroomVehicleWork.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<ShowroomVehicleWork>> createBatchShowroomVehicleWork(
    String showroomId,
    CreateBatchShowroomVehicleWorkRequest request,
  ) async {
    final response = await _dio.post(
      '/showrooms/$showroomId/vehicle-works/batch',
      data: request.toJson(),
    );
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList
        .map((e) => ShowroomVehicleWork.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ShowroomVehicleWork> updateShowroomVehicleWork(
    String showroomId,
    String workId,
    UpdateShowroomVehicleWorkRequest request,
  ) async {
    final response = await _dio.put(
      '/showrooms/$showroomId/vehicle-works/$workId',
      data: request.toJson(),
    );
    return ShowroomVehicleWork.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteShowroomVehicleWork(
    String showroomId,
    String workId,
  ) async {
    await _dio.delete('/showrooms/$showroomId/vehicle-works/$workId');
  }

  // ── Showroom Operations Summary ──────────────────────────────────────────

  Future<ShowroomOperationsSummary> getShowroomOperationsSummary(
    String showroomId,
    DateTime date,
  ) async {
    final dateStr = date.toIso8601String().split('T').first;
    final response = await _dio.get(
      '/showrooms/$showroomId/operations-summary',
      queryParameters: {'date': dateStr},
    );
    return ShowroomOperationsSummary.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  // ── Work Session Close ───────────────────────────────────────────────────

  Future<DailyStaffAssignment> closeShowroomStaffWorkSession(
    String showroomId,
    String sessionId,
    CloseShowroomStaffWorkSessionRequest? request,
  ) async {
    final response = await _dio.post(
      '/showrooms/$showroomId/work-sessions/$sessionId/close',
      data: request?.toJson() ?? {},
    );
    return DailyStaffAssignment.fromJson(response.data as Map<String, dynamic>);
  }

  // ── Showroom Billing & Payments ──────────────────────────────────────────

  Future<ShowroomDailyBill> getShowroomDailyBill(
    String showroomId,
    DateTime date,
  ) async {
    final dateStr = date.toIso8601String().split('T').first;
    final response = await _dio.get(
      '/showrooms/$showroomId/daily-bill',
      queryParameters: {'date': dateStr},
    );
    return ShowroomDailyBill.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ShowroomDailyBill> setShowroomDailyBill(
    String showroomId,
    DateTime date,
    SetShowroomDailyBillRequest request,
  ) async {
    final dateStr = date.toIso8601String().split('T').first;
    final response = await _dio.post(
      '/showrooms/$showroomId/daily-bill',
      queryParameters: {'date': dateStr},
      data: request.toJson(),
    );
    return ShowroomDailyBill.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ShowroomDailyBill> recordShowroomPayment(
    String showroomId,
    DateTime date,
    RecordShowroomPaymentRequest request,
  ) async {
    final dateStr = date.toIso8601String().split('T').first;
    final response = await _dio.post(
      '/showrooms/$showroomId/daily-bill/payments',
      queryParameters: {'date': dateStr},
      data: request.toJson(),
    );
    return ShowroomDailyBill.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteShowroomPayment(String paymentId) async {
    await _dio.delete('/showroom-payments/$paymentId');
  }

  // ── Showroom Financial Summary & Global Receivables ───────────────────────

  Future<ShowroomSummary> getShowroomSummary(
    String showroomId, {
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (fromDate != null) {
      queryParameters['fromDate'] = fromDate.toIso8601String().split('T').first;
    }
    if (toDate != null) {
      queryParameters['toDate'] = toDate.toIso8601String().split('T').first;
    }

    final response = await _dio.get(
      '/showrooms/$showroomId/summary',
      queryParameters: queryParameters.isNotEmpty ? queryParameters : null,
    );
    return ShowroomSummary.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<ShowroomOutstandingOverview>> getShowroomsOutstanding({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (fromDate != null) {
      queryParameters['fromDate'] = fromDate.toIso8601String().split('T').first;
    }
    if (toDate != null) {
      queryParameters['toDate'] = toDate.toIso8601String().split('T').first;
    }

    final response = await _dio.get(
      '/showrooms/outstanding',
      queryParameters: queryParameters.isNotEmpty ? queryParameters : null,
    );
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList
        .map(
          (e) =>
              ShowroomOutstandingOverview.fromJson(e as Map<String, dynamic>),
        )
        .toList();
  }
}
