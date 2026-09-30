import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_operations_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/providers/showroom_operations_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class MockOpsApi extends ShowroomApi {
  MockOpsApi() : super(Dio());

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

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async =>
      [];

  @override
  Future<DailyStaffResponse> getDailyStaff(
    String showroomId,
    DateTime date,
  ) async {
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      date: date,
      totalVehiclesAttended: 0,
      isAttendanceConfirmed: false,
      staffAssignments: [
        DailyStaffAssignment(
          id: 'session-1',
          showroomId: showroomId,
          showroomName: 'Test Showroom',
          staffId: 'staff-1',
          staffMasterId: 'STF001',
          staffName: 'Ramesh',
          staffPhone: '9840123456',
          date: date,
          startTime: '09:00',
          endTime: '18:00',
          assignmentType: 'Regular',
          vehiclesAttended: 0,
          createdAt: DateTime.now(),
        ),
      ],
    );
  }

  @override
  Future<List<ShowroomVehicleType>> getShowroomVehicleTypes({
    bool? isActive,
  }) async => vehicleTypes;

  @override
  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async =>
      workTypes;

  @override
  Future<List<ShowroomVehicleWork>> getShowroomVehicleWorks(
    String showroomId, {
    DateTime? date,
    String? staffId,
    String? vehicleTypeId,
  }) async {
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
  Future<ShowroomVehicleWork> createShowroomVehicleWork(
    String showroomId,
    CreateShowroomVehicleWorkRequest request,
  ) async {
    final work = ShowroomVehicleWork(
      id: 'work-${vehicleWorks.length + 1}',
      showroomId: showroomId,
      staffId: request.staffId,
      staffName: 'Ramesh',
      vehicleTypeId: request.vehicleTypeId,
      vehicleTypeName: request.vehicleTypeId == 'vt-1' ? 'Sedan' : 'SUV',
      vehicleQuantity: request.vehicleQuantity,
      date: request.date,
      notes: request.notes,
      serviceItems: (request.serviceItems ?? [])
          .map(
            (s) => ShowroomVehicleWorkItem(
              id: 'item-1',
              showroomVehicleWorkId: 'work-1',
              workTypeId: s.workTypeId,
              workTypeCode: 'WASH',
              workTypeName: 'Full Wash',
              quantity: s.quantity,
              createdAt: DateTime.now(),
            ),
          )
          .toList(),
      createdAt: DateTime.now(),
    );
    vehicleWorks.add(work);
    return work;
  }

  @override
  Future<List<ShowroomVehicleWork>> createBatchShowroomVehicleWork(
    String showroomId,
    CreateBatchShowroomVehicleWorkRequest request,
  ) async {
    final results = <ShowroomVehicleWork>[];
    for (final v in request.vehicles) {
      final work = ShowroomVehicleWork(
        id: 'work-b-${vehicleWorks.length + 1}',
        showroomId: showroomId,
        staffId: request.staffId,
        staffName: 'Ramesh',
        vehicleTypeId: v.vehicleTypeId,
        vehicleTypeName: 'SUV',
        vehicleQuantity: 1,
        date: request.date,
        notes: v.notes,
        serviceItems: const [],
        createdAt: DateTime.now(),
      );
      vehicleWorks.add(work);
      results.add(work);
    }
    return results;
  }

  @override
  Future<ShowroomVehicleWork> updateShowroomVehicleWork(
    String showroomId,
    String workId,
    UpdateShowroomVehicleWorkRequest request,
  ) async {
    final idx = vehicleWorks.indexWhere((w) => w.id == workId);
    final prev = vehicleWorks[idx];
    final updated = ShowroomVehicleWork(
      id: prev.id,
      showroomId: prev.showroomId,
      staffId: request.staffId ?? prev.staffId,
      staffName: prev.staffName,
      vehicleTypeId: request.vehicleTypeId ?? prev.vehicleTypeId,
      vehicleTypeName: prev.vehicleTypeName,
      vehicleQuantity: prev.vehicleQuantity,
      date: prev.date,
      notes: request.notes ?? prev.notes,
      serviceItems: prev.serviceItems,
      createdAt: prev.createdAt,
    );
    vehicleWorks[idx] = updated;
    return updated;
  }

  @override
  Future<void> deleteShowroomVehicleWork(
    String showroomId,
    String workId,
  ) async {
    vehicleWorks.removeWhere((w) => w.id == workId);
  }

  @override
  Future<ShowroomOperationsSummary> getShowroomOperationsSummary(
    String showroomId,
    DateTime date,
  ) async {
    final works = vehicleWorks
        .where((w) => w.showroomId == showroomId)
        .toList();
    final count = works.fold<int>(0, (s, w) => s + w.vehicleQuantity);
    return ShowroomOperationsSummary(
      showroomId: showroomId,
      showroomMasterId: 'SR001',
      showroomName: 'Test Showroom',
      fromDate: date,
      toDate: date,
      totalVehiclesHandled: count,
      totalServicesPerformed: count,
      totalActiveStaffSessions: 1,
      vehicleTypeBreakdown: const [],
      workTypeBreakdown: const [],
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
      showroomName: 'Test Showroom',
      staffId: 'staff-1',
      staffMasterId: 'STF001',
      staffName: 'Ramesh',
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
  late MockOpsApi mockApi;
  late ProviderContainer container;
  late ProviderSubscription<ShowroomOperationsState> subscription;

  setUp(() {
    mockApi = MockOpsApi();
    container = ProviderContainer(
      overrides: [showroomApiProvider.overrideWithValue(mockApi)],
    );
    subscription = container.listen(
      showroomOperationsProvider('sr-1'),
      (prev, next) {},
    );
  });

  tearDown(() {
    subscription.close();
    container.dispose();
  });

  group('ShowroomOperationsNotifier & State', () {
    test('initializes catalogs and loads empty operations data', () async {
      container.read(showroomOperationsProvider('sr-1').notifier);
      await Future.delayed(const Duration(milliseconds: 50));

      final state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.showroomId, 'sr-1');
      expect(state.vehicleTypes.length, 2);
      expect(state.workTypes.length, 1);
      expect(state.vehicleWorks, isEmpty);
      expect(state.totalVehiclesHandled, 0);
    });

    test('setDate and shiftDate change selected date and reload', () async {
      final notifier = container.read(
        showroomOperationsProvider('sr-1').notifier,
      );
      final newDate = DateTime(2026, 10, 15);

      notifier.setDate(newDate);
      var state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.selectedDate.year, 2026);
      expect(state.selectedDate.month, 10);
      expect(state.selectedDate.day, 15);

      notifier.shiftDate(2);
      state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.selectedDate.day, 17);
    });

    test('createVehicleWork adds record and updates summary KPIs', () async {
      final notifier = container.read(
        showroomOperationsProvider('sr-1').notifier,
      );
      await Future.delayed(const Duration(milliseconds: 50));

      final request = CreateShowroomVehicleWorkRequest(
        staffId: 'staff-1',
        vehicleTypeId: 'vt-1',
        date: DateTime.now(),
        vehicleQuantity: 2,
        notes: 'Sedan wash',
      );

      final created = await notifier.createVehicleWork(request);
      expect(created, isNotNull);
      expect(created!.vehicleQuantity, 2);

      final state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.vehicleWorks.length, 1);
      expect(state.totalVehiclesHandled, 2);
    });

    test('filtering by staff and vehicle type works correctly', () async {
      final notifier = container.read(
        showroomOperationsProvider('sr-1').notifier,
      );
      await Future.delayed(const Duration(milliseconds: 50));

      // Add 2 works: 1 for staff-1 on vt-1, 1 for staff-2 on vt-2
      await notifier.createVehicleWork(
        CreateShowroomVehicleWorkRequest(
          staffId: 'staff-1',
          vehicleTypeId: 'vt-1',
          date: DateTime.now(),
        ),
      );

      // Mock another work in api
      mockApi.vehicleWorks.add(
        ShowroomVehicleWork(
          id: 'work-other',
          showroomId: 'sr-1',
          staffId: 'staff-2',
          staffName: 'Suresh',
          vehicleTypeId: 'vt-2',
          vehicleTypeName: 'SUV',
          vehicleQuantity: 1,
          date: DateTime.now(),
          createdAt: DateTime.now(),
        ),
      );

      await notifier.loadOperationsData();
      var state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.vehicleWorks.length, 2);
      expect(state.filteredVehicleWorks.length, 2);

      // Filter by staff-1
      notifier.setStaffFilter('staff-1');
      state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.filteredVehicleWorks.length, 1);
      expect(state.filteredVehicleWorks.first.staffId, 'staff-1');

      // Filter by vehicle type vt-2 (with staff-1 filter, should be 0 matches)
      notifier.setVehicleTypeFilter('vt-2');
      state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.filteredVehicleWorks.isEmpty, true);

      // Clear filters
      notifier.clearFilters();
      state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.filteredVehicleWorks.length, 2);
    });

    test('createBatchVehicleWork creates batch entries', () async {
      final notifier = container.read(
        showroomOperationsProvider('sr-1').notifier,
      );
      await Future.delayed(const Duration(milliseconds: 50));

      final batchRequest = CreateBatchShowroomVehicleWorkRequest(
        staffId: 'staff-1',
        date: DateTime.now(),
        vehicles: [
          const IndividualVehicleWorkEntry(
            vehicleTypeId: 'vt-2',
            workTypeIds: ['wt-1'],
          ),
          const IndividualVehicleWorkEntry(
            vehicleTypeId: 'vt-2',
            workTypeIds: ['wt-1'],
          ),
        ],
      );

      final results = await notifier.createBatchVehicleWork(batchRequest);
      expect(results.length, 2);

      final state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.vehicleWorks.length, 2);
    });

    test('updateVehicleWork and deleteVehicleWork modify state', () async {
      final notifier = container.read(
        showroomOperationsProvider('sr-1').notifier,
      );
      await Future.delayed(const Duration(milliseconds: 50));

      final created = await notifier.createVehicleWork(
        CreateShowroomVehicleWorkRequest(
          staffId: 'staff-1',
          vehicleTypeId: 'vt-1',
          date: DateTime.now(),
          notes: 'Initial',
        ),
      );

      const updateReq = UpdateShowroomVehicleWorkRequest(notes: 'Updated Note');
      final updated = await notifier.updateVehicleWork(
        workId: created!.id,
        request: updateReq,
      );
      expect(updated!.notes, 'Updated Note');

      await notifier.deleteVehicleWork(created.id);
      final state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.vehicleWorks.isEmpty, true);
    });

    test('closeStaffWorkSession closes session successfully', () async {
      final notifier = container.read(
        showroomOperationsProvider('sr-1').notifier,
      );
      await Future.delayed(const Duration(milliseconds: 50));

      await notifier.closeStaffWorkSession(
        sessionId: 'session-1',
        clockOutTime: '18:00',
        clockOutNotes: 'Normal shift completion',
      );

      final state = container.read(showroomOperationsProvider('sr-1'));
      expect(state.isClosingSession, false);
      expect(state.errorMessage, isNull);
    });
  });
}
