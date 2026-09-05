import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/providers/daily_staff_provider.dart';

class _FakeShowroomRepository extends ShowroomRepository {
  final List<DailyStaffAssignment> assignments = [];
  final List<CreateDailyStaffAssignmentRequest> createRequests = [];
  final Map<String, int> updatedVehicles = {};
  final List<String> removedAssignments = [];
  int loadDailyStaffCount = 0;

  _FakeShowroomRepository() : super(ShowroomApi(Dio()));

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    return [
      Showroom(
        id: 'showroom-1',
        name: 'Showroom Alpha',
        address: 'Main Road',
        phone: '9876543210',
        isActive: true,
        activeStaffCountToday: 2,
        createdAt: DateTime.now(),
      ),
    ];
  }

  bool shouldFailConfirmation = false;
  int confirmAttendanceCallCount = 0;
  int unlockAttendanceCallCount = 0;
  bool isConfirmed = false;

  @override
  Future<DailyStaffResponse> getDailyStaff(String showroomId, DateTime date) async {
    loadDailyStaffCount++;
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Showroom Alpha',
      date: date,
      isAttendanceConfirmed: isConfirmed,
      attendanceConfirmedByName: isConfirmed ? 'Admin User' : null,
      attendanceConfirmedAt: isConfirmed ? DateTime.now() : null,
      staffAssignments: List.unmodifiable(assignments),
      totalVehiclesAttended: assignments.fold<int>(
        0,
        (sum, a) => sum + a.vehiclesAttended,
      ),
    );
  }

  @override
  Future<DailyStaffResponse> confirmDailyStaffAttendance(String showroomId, DateTime date) async {
    confirmAttendanceCallCount++;
    if (shouldFailConfirmation) {
      throw ApiException(message: 'Server error confirming attendance');
    }
    isConfirmed = true;
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Showroom Alpha',
      date: date,
      isAttendanceConfirmed: true,
      attendanceConfirmedByName: 'Admin User',
      attendanceConfirmedAt: DateTime.now(),
      staffAssignments: List.unmodifiable(assignments),
      totalVehiclesAttended: assignments.fold<int>(
        0,
        (sum, a) => sum + a.vehiclesAttended,
      ),
    );
  }

  @override
  Future<DailyStaffResponse> unlockDailyStaffAttendance(String showroomId, DateTime date) async {
    unlockAttendanceCallCount++;
    isConfirmed = false;
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Showroom Alpha',
      date: date,
      isAttendanceConfirmed: false,
      staffAssignments: List.unmodifiable(assignments),
      totalVehiclesAttended: assignments.fold<int>(
        0,
        (sum, a) => sum + a.vehiclesAttended,
      ),
    );
  }

  @override
  Future<DailyStaffAssignment> assignDailyStaff(
    String showroomId,
    CreateDailyStaffAssignmentRequest request,
  ) async {
    createRequests.add(request);
    final assignment = DailyStaffAssignment(
      id: 'assign-${assignments.length + 1}',
      showroomId: showroomId,
      showroomName: 'Showroom Alpha',
      staffId: request.staffId,
      staffName: 'Staff ${request.staffId}',
      staffPhone: '9876543210',
      date: request.date,
      vehiclesAttended: request.vehiclesAttended,
      createdAt: DateTime.now(),
    );
    assignments.add(assignment);
    return assignment;
  }

  @override
  Future<DailyStaffAssignment> updateDailyStaffVehicles(
    String assignmentId,
    UpdateDailyStaffAssignmentRequest request,
  ) async {
    updatedVehicles[assignmentId] = request.vehiclesAttended;
    final index = assignments.indexWhere((a) => a.id == assignmentId);
    if (index >= 0) {
      final existing = assignments[index];
      final updated = DailyStaffAssignment(
        id: existing.id,
        showroomId: existing.showroomId,
        showroomName: existing.showroomName,
        staffId: existing.staffId,
        staffName: existing.staffName,
        staffPhone: existing.staffPhone,
        staffRole: existing.staffRole,
        date: existing.date,
        vehiclesAttended: request.vehiclesAttended,
        createdAt: existing.createdAt,
      );
      assignments[index] = updated;
      return updated;
    }
    throw Exception('Assignment not found');
  }

  @override
  Future<void> removeDailyStaff(String assignmentId) async {
    removedAssignments.add(assignmentId);
    assignments.removeWhere((a) => a.id == assignmentId);
  }
}

void main() {
  group('Task 2 — Showroom Multiple Staff & Vehicles Attended Tests', () {
    late ProviderContainer container;
    late _FakeShowroomRepository fakeRepo;

    setUp(() {
      fakeRepo = _FakeShowroomRepository();
      container = ProviderContainer(
        overrides: [
          showroomRepositoryProvider.overrideWithValue(fakeRepo),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    test('Assigning multiple staff creates assignments sequentially and updates roster & counts', () async {
      final notifier = container.read(dailyStaffProvider('showroom-1').notifier);

      // Initially 0 assignments
      expect(container.read(dailyStaffProvider('showroom-1')).totalStaffCount, 0);
      expect(container.read(dailyStaffProvider('showroom-1')).totalVehiclesAttended, 0);

      // Assign multiple staff with initial vehicles count = 3
      await notifier.assignMultipleStaff(
        staffIds: ['staff-1', 'staff-2', 'staff-3'],
        vehiclesAttended: 3,
      );

      expect(fakeRepo.createRequests.length, 3);
      expect(fakeRepo.createRequests[0].staffId, 'staff-1');
      expect(fakeRepo.createRequests[0].vehiclesAttended, 3);
      expect(fakeRepo.createRequests[1].staffId, 'staff-2');
      expect(fakeRepo.createRequests[2].staffId, 'staff-3');

      final state = container.read(dailyStaffProvider('showroom-1'));
      expect(state.totalStaffCount, 3);
      expect(state.totalVehiclesAttended, 9); // 3 staff * 3 vehicles = 9
      expect(state.staffAssignments.length, 3);
    });

    test('Single staff assignment works and preserves individual vehicles count', () async {
      final notifier = container.read(dailyStaffProvider('showroom-1').notifier);

      await notifier.assignStaff(staffId: 'staff-4', vehiclesAttended: 5);

      final state = container.read(dailyStaffProvider('showroom-1'));
      expect(state.totalStaffCount, 1);
      expect(state.totalVehiclesAttended, 5);
      expect(state.staffAssignments.first.vehiclesAttended, 5);
    });

    test('Updating vehicles attended updates count and recalculates total summary', () async {
      final notifier = container.read(dailyStaffProvider('showroom-1').notifier);

      await notifier.assignMultipleStaff(
        staffIds: ['staff-1', 'staff-2'],
        vehiclesAttended: 2,
      );

      final initialAssignment = container.read(dailyStaffProvider('showroom-1')).staffAssignments.first;
      expect(initialAssignment.vehiclesAttended, 2);

      // Update vehicles attended for staff-1 to 7
      final updated = await notifier.updateVehicles(
        assignmentId: initialAssignment.id,
        vehiclesAttended: 7,
      );

      expect(updated, isNotNull);
      expect(updated!.vehiclesAttended, 7);

      final state = container.read(dailyStaffProvider('showroom-1'));
      expect(state.staffAssignments.first.vehiclesAttended, 7);
      expect(state.totalVehiclesAttended, 9); // 7 + 2 = 9
    });

    test('Removing staff assignment immediately updates roster and summary metrics', () async {
      final notifier = container.read(dailyStaffProvider('showroom-1').notifier);

      await notifier.assignMultipleStaff(
        staffIds: ['staff-1', 'staff-2'],
        vehiclesAttended: 4,
      );

      expect(container.read(dailyStaffProvider('showroom-1')).totalStaffCount, 2);
      expect(container.read(dailyStaffProvider('showroom-1')).totalVehiclesAttended, 8);

      final firstAssignment = container.read(dailyStaffProvider('showroom-1')).staffAssignments.first;
      await notifier.removeAssignment(firstAssignment.id);

      final state = container.read(dailyStaffProvider('showroom-1'));
      expect(state.totalStaffCount, 1);
      expect(state.totalVehiclesAttended, 4);
      expect(fakeRepo.removedAssignments, contains(firstAssignment.id));
    });

    test('Confirming attendance updates confirmed state, locks roster, and populates confirmed metadata', () async {
      final notifier = container.read(dailyStaffProvider('showroom-1').notifier);

      await notifier.assignStaff(staffId: 'staff-1', vehiclesAttended: 4);
      expect(container.read(dailyStaffProvider('showroom-1')).isAttendanceConfirmed, isFalse);

      final res = await notifier.confirmAttendance();
      expect(res, isNotNull);
      expect(res!.isAttendanceConfirmed, isTrue);
      expect(fakeRepo.confirmAttendanceCallCount, 1);

      final state = container.read(dailyStaffProvider('showroom-1'));
      expect(state.isAttendanceConfirmed, isTrue);
      expect(state.attendanceConfirmedByName, 'Admin User');
      expect(state.attendanceConfirmedAt, isNotNull);
    });

    test('Failed attendance confirmation does not mark state as confirmed and sets error message', () async {
      final notifier = container.read(dailyStaffProvider('showroom-1').notifier);
      fakeRepo.shouldFailConfirmation = true;

      try {
        await notifier.confirmAttendance();
      } catch (_) {}

      final state = container.read(dailyStaffProvider('showroom-1'));
      expect(state.isAttendanceConfirmed, isFalse);
      expect(state.errorMessage, contains('Server error confirming attendance'));
    });

    test('Unlocking attendance resets confirmation state to unconfirmed (owner correction mode)', () async {
      final notifier = container.read(dailyStaffProvider('showroom-1').notifier);

      await notifier.confirmAttendance();
      expect(container.read(dailyStaffProvider('showroom-1')).isAttendanceConfirmed, isTrue);

      final unlockedRes = await notifier.unlockAttendance();
      expect(unlockedRes, isNotNull);
      expect(unlockedRes!.isAttendanceConfirmed, isFalse);
      expect(fakeRepo.unlockAttendanceCallCount, 1);

      final state = container.read(dailyStaffProvider('showroom-1'));
      expect(state.isAttendanceConfirmed, isFalse);
    });
  });
}
