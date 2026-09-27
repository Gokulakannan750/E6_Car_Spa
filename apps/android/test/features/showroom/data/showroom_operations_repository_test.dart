import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_operations_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeOperationsShowroomApi extends ShowroomApi {
  FakeOperationsShowroomApi() : super(Dio());

  final List<ShowroomVehicleType> vehicleTypes = [
    ShowroomVehicleType(
      id: 'vt-1',
      code: 'SEDAN',
      name: 'Sedan',
      createdAt: DateTime.now(),
    ),
    ShowroomVehicleType(
      id: 'vt-2',
      code: 'SUV',
      name: 'SUV',
      createdAt: DateTime.now(),
    ),
  ];

  final List<ShowroomWorkType> workTypes = [
    ShowroomWorkType(
      id: 'wt-1',
      code: 'WASH',
      name: 'Full Wash',
      createdAt: DateTime.now(),
    ),
  ];

  final List<ShowroomVehicleWork> vehicleWorks = [];
  bool shouldThrowDioError = false;

  @override
  Future<List<ShowroomVehicleType>> getShowroomVehicleTypes({bool? isActive}) async {
    if (shouldThrowDioError) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/showroom-vehicle-types'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/showroom-vehicle-types'),
          statusCode: 500,
          data: {'message': 'Server error loading vehicle types'},
        ),
      );
    }
    return vehicleTypes;
  }

  @override
  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async {
    if (shouldThrowDioError) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/showroom-work-types'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/showroom-work-types'),
          statusCode: 500,
          data: {'message': 'Server error loading work types'},
        ),
      );
    }
    return workTypes;
  }

  @override
  Future<List<ShowroomVehicleWork>> getShowroomVehicleWorks(
    String showroomId, {
    DateTime? date,
    String? staffId,
    String? vehicleTypeId,
  }) async {
    if (shouldThrowDioError) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/showrooms/$showroomId/vehicle-works'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/showrooms/$showroomId/vehicle-works'),
          statusCode: 400,
          data: {'message': 'Invalid query parameters'},
        ),
      );
    }
    var list = vehicleWorks.where((w) => w.showroomId == showroomId).toList();
    if (staffId != null) {
      list = list.where((w) => w.staffId == staffId).toList();
    }
    if (vehicleTypeId != null) {
      list = list.where((w) => w.vehicleTypeId == vehicleTypeId).toList();
    }
    return list;
  }

  @override
  Future<ShowroomVehicleWork> getShowroomVehicleWorkById(String showroomId, String id) async {
    final work = vehicleWorks.firstWhere((w) => w.id == id && w.showroomId == showroomId);
    return work;
  }

  @override
  Future<ShowroomVehicleWork> createShowroomVehicleWork(
    String showroomId,
    CreateShowroomVehicleWorkRequest request,
  ) async {
    if (shouldThrowDioError) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/showrooms/$showroomId/vehicle-works'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/showrooms/$showroomId/vehicle-works'),
          statusCode: 409,
          data: {'message': 'Conflict creating vehicle work'},
        ),
      );
    }
    final created = ShowroomVehicleWork(
      id: 'work-${vehicleWorks.length + 1}',
      showroomId: showroomId,
      staffId: request.staffId,
      staffName: 'Staff Member',
      vehicleTypeId: request.vehicleTypeId,
      vehicleTypeName: 'Sedan',
      vehicleQuantity: request.vehicleQuantity,
      date: request.date,
      notes: request.notes,
      serviceItems: (request.serviceItems ?? [])
          .map((s) => ShowroomVehicleWorkItem(
                id: 'item-${DateTime.now().millisecondsSinceEpoch}',
                showroomVehicleWorkId: 'work-${vehicleWorks.length + 1}',
                workTypeId: s.workTypeId,
                workTypeCode: 'WASH',
                workTypeName: 'Full Wash',
                quantity: s.quantity,
                createdAt: DateTime.now(),
              ))
          .toList(),
      createdAt: DateTime.now(),
    );
    vehicleWorks.add(created);
    return created;
  }

  @override
  Future<List<ShowroomVehicleWork>> createBatchShowroomVehicleWork(
    String showroomId,
    CreateBatchShowroomVehicleWorkRequest request,
  ) async {
    final List<ShowroomVehicleWork> batchCreated = [];
    for (final v in request.vehicles) {
      final created = ShowroomVehicleWork(
        id: 'work-batch-${vehicleWorks.length + 1}',
        showroomId: showroomId,
        staffId: request.staffId,
        staffName: 'Staff Member',
        vehicleTypeId: v.vehicleTypeId,
        vehicleTypeName: 'SUV',
        vehicleQuantity: 1,
        date: request.date,
        notes: v.notes ?? request.notes,
        serviceItems: v.workTypeIds
            .map((id) => ShowroomVehicleWorkItem(
                  id: 'item-${DateTime.now().millisecondsSinceEpoch}',
                  showroomVehicleWorkId: 'work-batch-${vehicleWorks.length + 1}',
                  workTypeId: id,
                  workTypeCode: 'WASH',
                  workTypeName: 'Full Wash',
                  quantity: 1,
                  createdAt: DateTime.now(),
                ))
            .toList(),
        createdAt: DateTime.now(),
      );
      vehicleWorks.add(created);
      batchCreated.add(created);
    }
    return batchCreated;
  }

  @override
  Future<ShowroomVehicleWork> updateShowroomVehicleWork(
    String showroomId,
    String workId,
    UpdateShowroomVehicleWorkRequest request,
  ) async {
    final idx = vehicleWorks.indexWhere((w) => w.id == workId && w.showroomId == showroomId);
    final prev = vehicleWorks[idx];
    final updated = ShowroomVehicleWork(
      id: prev.id,
      showroomId: prev.showroomId,
      staffId: request.staffId ?? prev.staffId,
      staffName: prev.staffName,
      vehicleTypeId: request.vehicleTypeId ?? prev.vehicleTypeId,
      vehicleTypeName: prev.vehicleTypeName,
      vehicleQuantity: request.vehicleQuantity ?? prev.vehicleQuantity,
      date: request.date ?? prev.date,
      notes: request.notes ?? prev.notes,
      serviceItems: prev.serviceItems,
      createdAt: prev.createdAt,
      updatedAt: DateTime.now(),
    );
    vehicleWorks[idx] = updated;
    return updated;
  }

  @override
  Future<void> deleteShowroomVehicleWork(String showroomId, String workId) async {
    vehicleWorks.removeWhere((w) => w.id == workId && w.showroomId == showroomId);
  }

  @override
  Future<ShowroomOperationsSummary> getShowroomOperationsSummary(
    String showroomId,
    DateTime date,
  ) async {
    final works = vehicleWorks.where((w) => w.showroomId == showroomId).toList();
    final totalVehicles = works.fold<int>(0, (sum, w) => sum + w.vehicleQuantity);
    final totalServices = works.fold<int>(0, (sum, w) => sum + w.serviceItems.length);

    return ShowroomOperationsSummary(
      showroomId: showroomId,
      showroomMasterId: 'SR001',
      showroomName: 'Anna Nagar',
      fromDate: date,
      toDate: date,
      totalVehiclesHandled: totalVehicles,
      totalServicesPerformed: totalServices,
      totalActiveStaffSessions: 2,
      vehicleTypeBreakdown: [
        VehicleTypeWorkSummary(
          vehicleTypeId: 'vt-1',
          vehicleTypeCode: 'SEDAN',
          vehicleTypeName: 'Sedan',
          totalVehicles: totalVehicles,
        ),
      ],
      workTypeBreakdown: [
        WorkTypeWorkSummary(
          workTypeId: 'wt-1',
          workTypeCode: 'WASH',
          workTypeName: 'Full Wash',
          totalQuantity: totalServices,
        ),
      ],
      staffProductivityBreakdown: const [],
    );
  }

  @override
  Future<DailyStaffAssignment> closeShowroomStaffWorkSession(
    String showroomId,
    String sessionId,
    CloseShowroomStaffWorkSessionRequest? request,
  ) async {
    return DailyStaffAssignment(
      id: sessionId,
      showroomId: showroomId,
      showroomName: 'Anna Nagar',
      staffId: 'staff-1',
      staffMasterId: 'STF001',
      staffName: 'Staff Member',
      staffPhone: '9840123456',
      date: DateTime.now(),
      startTime: '09:00',
      endTime: request?.endTime ?? '18:00',
      assignmentType: 'Regular',
      notes: request?.notes,
      createdAt: DateTime.now(),
    );
  }
}

void main() {
  late FakeOperationsShowroomApi fakeApi;
  late ShowroomRepository repository;

  setUp(() {
    fakeApi = FakeOperationsShowroomApi();
    repository = ShowroomRepository(fakeApi);
  });

  group('ShowroomRepository Operations APIs', () {
    test('getShowroomVehicleTypes returns catalog list', () async {
      final types = await repository.getShowroomVehicleTypes();
      expect(types.length, 2);
      expect(types[0].name, 'Sedan');
    });

    test('getShowroomWorkTypes returns service list', () async {
      final workTypes = await repository.getShowroomWorkTypes();
      expect(workTypes.length, 1);
      expect(workTypes[0].name, 'Full Wash');
    });

    test('createShowroomVehicleWork adds record and retrieves list', () async {
      final request = CreateShowroomVehicleWorkRequest(
        staffId: 'staff-1',
        vehicleTypeId: 'vt-1',
        date: DateTime(2026, 9, 27),
        vehicleQuantity: 1,
        notes: 'Wash only',
        serviceItems: [
          const CreateShowroomVehicleWorkItemRequest(workTypeId: 'wt-1'),
        ],
      );

      final created = await repository.createShowroomVehicleWork('sr-1', request);
      expect(created.id, isNotEmpty);
      expect(created.vehicleTypeName, 'Sedan');

      final list = await repository.getShowroomVehicleWorks('sr-1');
      expect(list.length, 1);
      expect(list[0].id, created.id);
    });

    test('createBatchShowroomVehicleWork adds multiple vehicles', () async {
      final batchRequest = CreateBatchShowroomVehicleWorkRequest(
        staffId: 'staff-1',
        date: DateTime(2026, 9, 27),
        vehicles: [
          const IndividualVehicleWorkEntry(
            vehicleTypeId: 'vt-2',
            workTypeIds: ['wt-1'],
            notes: 'Batch 1',
          ),
          const IndividualVehicleWorkEntry(
            vehicleTypeId: 'vt-2',
            workTypeIds: ['wt-1'],
            notes: 'Batch 2',
          ),
        ],
      );

      final results = await repository.createBatchShowroomVehicleWork('sr-1', batchRequest);
      expect(results.length, 2);
      final list = await repository.getShowroomVehicleWorks('sr-1');
      expect(list.length, 2);
    });

    test('updateShowroomVehicleWork modifies existing work', () async {
      final created = await repository.createShowroomVehicleWork(
        'sr-1',
        CreateShowroomVehicleWorkRequest(
          staffId: 'staff-1',
          vehicleTypeId: 'vt-1',
          date: DateTime(2026, 9, 27),
          notes: 'Old note',
        ),
      );

      const updateReq = UpdateShowroomVehicleWorkRequest(
        notes: 'Updated note',
        vehicleTypeId: 'vt-2',
      );

      final updated = await repository.updateShowroomVehicleWork('sr-1', created.id, updateReq);
      expect(updated.notes, 'Updated note');
      expect(updated.vehicleTypeId, 'vt-2');
    });

    test('deleteShowroomVehicleWork removes record', () async {
      final created = await repository.createShowroomVehicleWork(
        'sr-1',
        CreateShowroomVehicleWorkRequest(
          staffId: 'staff-1',
          vehicleTypeId: 'vt-1',
          date: DateTime(2026, 9, 27),
        ),
      );

      await repository.deleteShowroomVehicleWork('sr-1', created.id);
      final list = await repository.getShowroomVehicleWorks('sr-1');
      expect(list.isEmpty, true);
    });

    test('getShowroomOperationsSummary calculates totals', () async {
      await repository.createShowroomVehicleWork(
        'sr-1',
        CreateShowroomVehicleWorkRequest(
          staffId: 'staff-1',
          vehicleTypeId: 'vt-1',
          date: DateTime(2026, 9, 27),
          vehicleQuantity: 3,
          serviceItems: [
            const CreateShowroomVehicleWorkItemRequest(workTypeId: 'wt-1'),
          ],
        ),
      );

      final summary = await repository.getShowroomOperationsSummary('sr-1', DateTime(2026, 9, 27));
      expect(summary.totalVehiclesHandled, 3);
      expect(summary.totalServicesPerformed, 1);
      expect(summary.totalActiveStaffSessions, 2);
    });

    test('closeShowroomStaffWorkSession executes without error', () async {
      expect(
        () async => repository.closeShowroomStaffWorkSession(
          'sr-1',
          'session-1',
          const CloseShowroomStaffWorkSessionRequest(endTime: '18:00'),
        ),
        returnsNormally,
      );
    });

    test('ApiException mapping works on errors', () async {
      fakeApi.shouldThrowDioError = true;
      expect(
        () => repository.getShowroomVehicleTypes(),
        throwsA(isA<ApiException>()),
      );
      expect(
        () => repository.getShowroomVehicleWorks('sr-1'),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
