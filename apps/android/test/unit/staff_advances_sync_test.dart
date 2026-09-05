import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_api.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_repository.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_model.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_request_models.dart';
import 'package:e6_car_spa/features/staffadvances/providers/staff_advances_provider.dart';
import 'package:e6_car_spa/features/staff/data/staff_api.dart';
import 'package:e6_car_spa/features/staff/data/staff_repository.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/providers/staff_provider.dart';

class _FakeStaffRepository extends StaffRepository {
  int loadStaffCallCount = 0;

  _FakeStaffRepository() : super(StaffApi(Dio()));

  @override
  Future<List<Staff>> getStaff() async {
    loadStaffCallCount++;
    return [
      const Staff(
        id: 'staff-1',
        name: 'Rajesh Kumar',
        phoneNumber: '9876543210',
        role: 'Technician',
        isActive: true,
        totalAdvances: 2,
        totalAdvanceAmount: 5000.0,
      ),
    ];
  }
}

class _FakeAdvancesRepository extends StaffAdvancesRepository {
  bool shouldFail = false;
  int createCallCount = 0;
  int settleCallCount = 0;
  int obsoleteCallCount = 0;

  _FakeAdvancesRepository() : super(StaffAdvancesApi(Dio()));

  @override
  Future<StaffAdvanceListResponse> getStaffAdvances({
    int page = 1,
    int pageSize = 20,
    String? status,
    String? staffId,
    String? search,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return const StaffAdvanceListResponse(
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      summary: StaffAdvanceSummary(
        outstandingAmount: 5000,
        settledAmount: 2000,
        totalActiveCount: 1,
      ),
    );
  }

  @override
  Future<StaffAdvance> createStaffAdvance(CreateStaffAdvanceRequest request) async {
    createCallCount++;
    if (shouldFail) {
      throw Exception('Server error creating advance');
    }
    return StaffAdvance(
      id: 'adv-1',
      staffId: request.staffId,
      staffName: 'Rajesh Kumar',
      amount: request.amount,
      advanceDate: request.advanceDate,
      reason: request.reason,
      status: StaffAdvanceStatus.outstanding,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<StaffAdvance> settleStaffAdvance(String advanceId) async {
    settleCallCount++;
    if (shouldFail) {
      throw Exception('Server error settling advance');
    }
    return StaffAdvance(
      id: advanceId,
      staffId: 'staff-1',
      staffName: 'Rajesh Kumar',
      amount: 2000,
      advanceDate: DateTime.now(),
      reason: 'Advance',
      status: StaffAdvanceStatus.settled,
      settledAt: DateTime.now(),
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<StaffAdvance> obsoleteStaffAdvance(String advanceId, ObsoleteStaffAdvanceRequest request) async {
    obsoleteCallCount++;
    if (shouldFail) {
      throw Exception('Server error cancelling advance');
    }
    return StaffAdvance(
      id: advanceId,
      staffId: 'staff-1',
      staffName: 'Rajesh Kumar',
      amount: 2000,
      advanceDate: DateTime.now(),
      reason: 'Advance',
      status: StaffAdvanceStatus.obsolete,
      obsoletedAt: DateTime.now(),
      obsoleteReason: request.reason,
      createdAt: DateTime.now(),
    );
  }
}

void main() {
  group('Task 1 — Staff Advance Mutation Triggers Immediate Staff Directory Sync', () {
    late ProviderContainer container;
    late _FakeAdvancesRepository advancesRepo;
    late _FakeStaffRepository staffRepo;

    setUp(() {
      advancesRepo = _FakeAdvancesRepository();
      staffRepo = _FakeStaffRepository();

      container = ProviderContainer(
        overrides: [
          staffAdvancesRepositoryProvider.overrideWithValue(advancesRepo),
          staffRepositoryProvider.overrideWithValue(staffRepo),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    test('Creating advance refreshes staff directory immediately on success without full screen loading', () async {
      await container.read(staffProvider.notifier).loadStaff();
      final initialCount = staffRepo.loadStaffCallCount;
      expect(initialCount, greaterThanOrEqualTo(1));

      final request = CreateStaffAdvanceRequest(
        staffId: 'staff-1',
        amount: 1500,
        advanceDate: DateTime.now(),
        reason: 'Festival advance',
      );

      final error = await container.read(staffAdvancesProvider.notifier).createAdvance(request);
      expect(error, isNull);

      // Verify staff directory was reloaded silently
      expect(staffRepo.loadStaffCallCount, equals(initialCount + 1));
      expect(container.read(staffProvider).isLoading, isFalse);
    });

    test('Settling advance refreshes staff directory immediately on success', () async {
      await container.read(staffProvider.notifier).loadStaff();
      final initialCount = staffRepo.loadStaffCallCount;

      final error = await container.read(staffAdvancesProvider.notifier).settleAdvance('adv-1');
      expect(error, isNull);
      expect(staffRepo.loadStaffCallCount, equals(initialCount + 1));
    });

    test('Obsoleting advance refreshes staff directory immediately on success', () async {
      await container.read(staffProvider.notifier).loadStaff();
      final initialCount = staffRepo.loadStaffCallCount;

      final error = await container.read(staffAdvancesProvider.notifier).obsoleteAdvance('adv-1', 'Created in error');
      expect(error, isNull);
      expect(staffRepo.loadStaffCallCount, equals(initialCount + 1));
    });

    test('Failed advance mutation does NOT refresh staff directory and retains error message', () async {
      await container.read(staffProvider.notifier).loadStaff();
      final initialCount = staffRepo.loadStaffCallCount;

      advancesRepo.shouldFail = true;

      final request = CreateStaffAdvanceRequest(
        staffId: 'staff-1',
        amount: 2000,
        advanceDate: DateTime.now(),
        reason: 'Emergency',
      );

      final error = await container.read(staffAdvancesProvider.notifier).createAdvance(request);
      expect(error, isNotNull);

      // Staff directory must not be refreshed when mutation failed
      expect(staffRepo.loadStaffCallCount, equals(initialCount));

      // Error message should remain visible in state
      final advancesState = container.read(staffAdvancesProvider);
      expect(advancesState.errorMessage, contains('Server error creating advance'));
    });
  });
}
