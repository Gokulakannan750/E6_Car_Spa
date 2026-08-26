import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_api.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_repository.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_model.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_request_models.dart';
import 'package:e6_car_spa/features/staff/data/staff_api.dart';
import 'package:e6_car_spa/features/staff/data/staff_repository.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/models/staff_request_models.dart';

class MockStaffAdvancesApi extends StaffAdvancesApi {
  MockStaffAdvancesApi() : super(Dio());

  List<StaffAdvance> advancesToReturn = [];
  StaffAdvanceSummary summaryToReturn = const StaffAdvanceSummary(
    outstandingAmount: 3000.0,
    settledAmount: 0.0,
    totalActiveCount: 1,
  );
  StaffAdvance? singleAdvanceToReturn;
  StaffAdvanceHistory? historyToReturn;
  bool shouldThrow = false;
  String errorMessage = 'API Error';

  @override
  Future<StaffAdvanceListResponse> getStaffAdvances({
    int page = 1,
    int pageSize = 20,
    String? staffId,
    String? status,
    DateTime? fromDate,
    DateTime? toDate,
    String? search,
  }) async {
    if (shouldThrow) throw Exception(errorMessage);
    return StaffAdvanceListResponse(
      items: advancesToReturn,
      totalCount: advancesToReturn.length,
      page: page,
      pageSize: pageSize,
      summary: summaryToReturn,
    );
  }

  @override
  Future<StaffAdvance> getStaffAdvanceById(String id) async {
    if (shouldThrow) throw Exception(errorMessage);
    return singleAdvanceToReturn!;
  }

  @override
  Future<StaffAdvance> createStaffAdvance(CreateStaffAdvanceRequest request) async {
    if (shouldThrow) throw Exception(errorMessage);
    return StaffAdvance(
      id: 'adv-new',
      staffId: request.staffId,
      staffName: 'Ramesh Kumar',
      amount: request.amount,
      advanceDate: request.advanceDate,
      reason: request.reason,
      notes: request.notes,
      status: StaffAdvanceStatus.outstanding,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<StaffAdvance> settleStaffAdvance(String id) async {
    if (shouldThrow) throw Exception(errorMessage);
    return StaffAdvance(
      id: id,
      staffId: 's-1',
      staffName: 'Ramesh Kumar',
      amount: 3000.0,
      advanceDate: DateTime.now(),
      reason: 'Salary Advance',
      status: StaffAdvanceStatus.settled,
      settledAt: DateTime.now(),
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<StaffAdvance> obsoleteStaffAdvance(String id, ObsoleteStaffAdvanceRequest request) async {
    if (shouldThrow) throw Exception(errorMessage);
    return StaffAdvance(
      id: id,
      staffId: 's-1',
      staffName: 'Ramesh Kumar',
      amount: 3000.0,
      advanceDate: DateTime.now(),
      reason: 'Salary Advance',
      status: StaffAdvanceStatus.obsolete,
      obsoleteReason: request.reason,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<StaffAdvanceHistory> getStaffAdvanceHistory(String staffId) async {
    if (shouldThrow) throw Exception(errorMessage);
    return historyToReturn!;
  }
}

class MockStaffApi extends StaffApi {
  MockStaffApi() : super(Dio());

  List<Staff> staffListToReturn = [];
  bool shouldThrow = false;
  String errorMessage = 'API Error';

  @override
  Future<List<Staff>> getStaff() async {
    if (shouldThrow) throw Exception(errorMessage);
    return staffListToReturn;
  }

  @override
  Future<Staff> createStaff(CreateStaffRequest request) async {
    if (shouldThrow) throw Exception(errorMessage);
    return Staff(
      id: 'staff-created',
      name: request.name,
      phoneNumber: request.phoneNumber,
      email: request.email,
      address: request.address,
      role: request.role,
      isActive: request.isActive,
    );
  }

  @override
  Future<Staff> updateStaff(String id, UpdateStaffRequest request) async {
    if (shouldThrow) throw Exception(errorMessage);
    return Staff(
      id: id,
      name: request.name ?? 'Ramesh Kumar',
      phoneNumber: request.phoneNumber ?? '9840123456',
      email: request.email,
      address: request.address,
      role: request.role,
      isActive: request.isActive ?? true,
    );
  }
}

void main() {
  group('StaffAdvancesRepository Tests', () {
    late MockStaffAdvancesApi mockApi;
    late StaffAdvancesRepository repository;

    setUp(() {
      mockApi = MockStaffAdvancesApi();
      repository = StaffAdvancesRepository(mockApi);
    });

    test('getStaffAdvances returns successful response from API', () async {
      mockApi.advancesToReturn = [
        StaffAdvance(
          id: 'adv-1',
          staffId: 's-1',
          staffName: 'Ramesh Kumar',
          amount: 3000.0,
          advanceDate: DateTime.now(),
          reason: 'Salary Advance',
          status: StaffAdvanceStatus.outstanding,
          createdAt: DateTime.now(),
        )
      ];

      final result = await repository.getStaffAdvances();

      expect(result.items.length, 1);
      expect(result.items.first.staffName, 'Ramesh Kumar');
      expect(result.summary.outstandingAmount, 3000.0);
    });

    test('createStaffAdvance creates and returns newly created advance', () async {
      final request = CreateStaffAdvanceRequest(
        staffId: 's-1',
        amount: 3000.0,
        advanceDate: DateTime.now(),
        reason: 'Personal Advance',
      );

      final advance = await repository.createStaffAdvance(request);

      expect(advance.id, 'adv-new');
      expect(advance.amount, 3000.0);
      expect(advance.status, StaffAdvanceStatus.outstanding);
    });

    test('settleStaffAdvance calls API without error', () async {
      expect(() async => await repository.settleStaffAdvance('adv-1'), returnsNormally);
    });

    test('obsoleteStaffAdvance calls API without error', () async {
      final request = ObsoleteStaffAdvanceRequest(reason: 'Wrongly entered');
      expect(() async => await repository.obsoleteStaffAdvance('adv-1', request), returnsNormally);
    });

    test('getStaffAdvanceHistory returns full history DTO', () async {
      mockApi.historyToReturn = const StaffAdvanceHistory(
        staffId: 's-1',
        staffName: 'Ramesh Kumar',
        totalAdvancesAmount: 5000.0,
        outstandingAmount: 2000.0,
        settledAmount: 3000.0,
        advances: [],
      );

      final history = await repository.getStaffAdvanceHistory('s-1');

      expect(history.staffName, 'Ramesh Kumar');
      expect(history.totalAdvancesAmount, 5000.0);
    });
  });

  group('StaffRepository Tests', () {
    late MockStaffApi mockStaffApi;
    late StaffRepository staffRepository;

    setUp(() {
      mockStaffApi = MockStaffApi();
      staffRepository = StaffRepository(mockStaffApi);
    });

    test('getStaff returns list of staff members', () async {
      mockStaffApi.staffListToReturn = [
        const Staff(
          id: 'staff-1',
          name: 'Ramesh Kumar',
          phoneNumber: '9840123456',
          isActive: true,
        )
      ];

      final list = await staffRepository.getStaff();

      expect(list.length, 1);
      expect(list.first.name, 'Ramesh Kumar');
    });

    test('createStaff creates and returns new staff entity', () async {
      final req = CreateStaffRequest(
        name: 'Ramesh Kumar',
        phoneNumber: '9840123456',
        role: 'Detailer',
      );

      final staff = await staffRepository.createStaff(req);

      expect(staff.id, 'staff-created');
      expect(staff.name, 'Ramesh Kumar');
      expect(staff.role, 'Detailer');
    });

    test('updateStaff updates existing staff member', () async {
      final req = UpdateStaffRequest(
        name: 'Ramesh Kumar (Updated)',
        phoneNumber: '9840123456',
        role: 'Supervisor',
        isActive: true,
      );

      final staff = await staffRepository.updateStaff('staff-1', req);

      expect(staff.id, 'staff-1');
      expect(staff.name, 'Ramesh Kumar (Updated)');
      expect(staff.role, 'Supervisor');
    });
  });
}
