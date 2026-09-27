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
  final List<UpdateDailyStaffAssignmentRequest> updateRequests = [];
  final List<String> removedAssignments = [];
  int loadDailyStaffCount = 0;

  bool shouldThrowConflictOnAssign = false;
  String conflictMessage = 'Ramesh is already assigned to Skoda from 09:00 to 14:00 on this date.';

  bool shouldFailConfirmation = false;
  int confirmAttendanceCallCount = 0;
  int unlockAttendanceCallCount = 0;
  bool isConfirmed = false;

  _FakeShowroomRepository() : super(ShowroomApi(Dio()));

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    return [
      Showroom(
        id: 'showroom-skoda',
        name: 'Skoda Showroom',
        address: 'Main Road',
        phone: '9876543210',
        isActive: true,
        activeStaffCountToday: 2,
        createdAt: DateTime.now(),
      ),
      Showroom(
        id: 'showroom-honda',
        name: 'Honda Showroom',
        address: 'Ring Road',
        phone: '9876543211',
        isActive: true,
        activeStaffCountToday: 1,
        createdAt: DateTime.now(),
      ),
    ];
  }

  @override
  Future<DailyStaffResponse> getDailyStaff(String showroomId, DateTime date) async {
    loadDailyStaffCount++;
    final filtered = assignments.where((a) =>
        a.showroomId == showroomId &&
        a.date.year == date.year &&
        a.date.month == date.month &&
        a.date.day == date.day).toList();

    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: showroomId == 'showroom-skoda' ? 'Skoda Showroom' : 'Honda Showroom',
      date: date,
      isAttendanceConfirmed: isConfirmed,
      attendanceConfirmedByName: isConfirmed ? 'Admin User' : null,
      attendanceConfirmedAt: isConfirmed ? DateTime.now() : null,
      staffAssignments: List.unmodifiable(filtered),
      totalVehiclesAttended: 0,
    );
  }

  @override
  Future<DailyStaffResponse> confirmDailyStaffAttendance(String showroomId, DateTime date) async {
    confirmAttendanceCallCount++;
    if (shouldFailConfirmation) {
      throw const ApiException(message: 'Server error confirming attendance');
    }
    isConfirmed = true;
    final filtered = assignments.where((a) =>
        a.showroomId == showroomId &&
        a.date.year == date.year &&
        a.date.month == date.month &&
        a.date.day == date.day).toList();

    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Skoda Showroom',
      date: date,
      isAttendanceConfirmed: true,
      attendanceConfirmedByName: 'Admin User',
      attendanceConfirmedAt: DateTime.now(),
      staffAssignments: List.unmodifiable(filtered),
      totalVehiclesAttended: 0,
    );
  }

  @override
  Future<DailyStaffResponse> unlockDailyStaffAttendance(String showroomId, DateTime date) async {
    unlockAttendanceCallCount++;
    isConfirmed = false;
    final filtered = assignments.where((a) =>
        a.showroomId == showroomId &&
        a.date.year == date.year &&
        a.date.month == date.month &&
        a.date.day == date.day).toList();

    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Skoda Showroom',
      date: date,
      isAttendanceConfirmed: false,
      staffAssignments: List.unmodifiable(filtered),
      totalVehiclesAttended: 0,
    );
  }

  @override
  Future<DailyStaffAssignment> assignDailyStaff(
    String showroomId,
    CreateDailyStaffAssignmentRequest request,
  ) async {
    if (shouldThrowConflictOnAssign) {
      throw ConflictException(message: conflictMessage);
    }
    createRequests.add(request);
    final hours = calculateSessionHours(request.startTime, request.endTime);
    final assignment = DailyStaffAssignment(
      id: 'assign-${assignments.length + 1}',
      showroomId: showroomId,
      showroomName: showroomId == 'showroom-skoda' ? 'Skoda Showroom' : 'Honda Showroom',
      staffId: request.staffId,
      staffName: 'Staff ${request.staffId}',
      staffPhone: '9876543210',
      date: request.date,
      startTime: request.startTime,
      endTime: request.endTime,
      workingHours: hours,
      assignmentType: request.assignmentType,
      transferReason: request.transferReason,
      notes: request.notes,
      createdAt: DateTime.now(),
    );
    assignments.add(assignment);
    return assignment;
  }

  @override
  Future<DailyStaffAssignment> updateDailyStaffAssignment(
    String assignmentId,
    UpdateDailyStaffAssignmentRequest request,
  ) async {
    updateRequests.add(request);
    final index = assignments.indexWhere((a) => a.id == assignmentId);
    if (index >= 0) {
      final existing = assignments[index];
      final newStart = request.startTime ?? existing.startTime;
      final newEnd = request.endTime ?? existing.endTime;
      final updated = DailyStaffAssignment(
        id: existing.id,
        showroomId: existing.showroomId,
        showroomName: existing.showroomName,
        staffId: existing.staffId,
        staffName: existing.staffName,
        staffPhone: existing.staffPhone,
        staffRole: existing.staffRole,
        date: existing.date,
        startTime: newStart,
        endTime: newEnd,
        workingHours: calculateSessionHours(newStart, newEnd),
        status: request.status ?? existing.status,
        assignmentType: existing.assignmentType,
        homeShowroomId: existing.homeShowroomId,
        homeShowroomName: existing.homeShowroomName,
        transferReason: request.transferReason ?? existing.transferReason,
        notes: request.notes ?? existing.notes,
        createdAt: existing.createdAt,
      );
      assignments[index] = updated;
      return updated;
    }
    throw const ApiException(message: 'Assignment not found');
  }

  @override
  Future<void> removeDailyStaff(String assignmentId) async {
    removedAssignments.add(assignmentId);
    assignments.removeWhere((a) => a.id == assignmentId);
  }
}

void main() {
  group('Showroom Work Sessions Provider & Repository Tests', () {
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

    test('1. Load work sessions loads date-specific sessions', () async {
      final targetDate = DateTime(2026, 10, 19);
      final otherDate = DateTime(2026, 10, 20);

      // Preload sessions on two different dates
      fakeRepo.assignments.addAll([
        DailyStaffAssignment(
          id: 'asg-1',
          showroomId: 'showroom-skoda',
          showroomName: 'Skoda Showroom',
          staffId: 'staff-1',
          staffName: 'Ramesh',
          staffPhone: '9876543210',
          date: targetDate,
          startTime: '09:00',
          endTime: '14:00',
          workingHours: 5.0,
          createdAt: DateTime.now(),
        ),
        DailyStaffAssignment(
          id: 'asg-2',
          showroomId: 'showroom-skoda',
          showroomName: 'Skoda Showroom',
          staffId: 'staff-2',
          staffName: 'Suresh',
          staffPhone: '9876543211',
          date: otherDate,
          startTime: '09:00',
          endTime: '18:00',
          workingHours: 9.0,
          createdAt: DateTime.now(),
        ),
      ]);

      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);
      await notifier.loadDailyStaff(date: targetDate);

      final state = container.read(dailyStaffProvider('showroom-skoda'));
      expect(state.totalStaffCount, 1);
      expect(state.staffAssignments.first.staffName, 'Ramesh');
      expect(state.totalScheduledHours, 5.0);
    });

    test('2. Assign regular staff with Full Day preset (09:00 – 18:00)', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);

      final assignment = await notifier.assignWorkSession(
        staffId: 'staff-101',
        startTime: '09:00',
        endTime: '18:00',
        assignmentType: 'Regular',
      );

      expect(assignment, isNotNull);
      expect(fakeRepo.createRequests.length, 1);
      expect(fakeRepo.createRequests.first.assignmentType, 'Regular');
      expect(fakeRepo.createRequests.first.startTime, '09:00');
      expect(fakeRepo.createRequests.first.endTime, '18:00');

      final state = container.read(dailyStaffProvider('showroom-skoda'));
      expect(state.totalStaffCount, 1);
      expect(state.totalScheduledHours, 9.0);
    });

    test('3. Assign temporary transfer staff with transfer reason', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);

      final assignment = await notifier.assignWorkSession(
        staffId: 'staff-102',
        startTime: '14:00',
        endTime: '18:00',
        assignmentType: 'TemporaryTransfer',
        transferReason: 'Covering afternoon shift',
        notes: 'Transferred from Honda',
      );

      expect(assignment, isNotNull);
      expect(fakeRepo.createRequests.first.assignmentType, 'TemporaryTransfer');
      expect(fakeRepo.createRequests.first.transferReason, 'Covering afternoon shift');
      expect(fakeRepo.createRequests.first.notes, 'Transferred from Honda');

      final state = container.read(dailyStaffProvider('showroom-skoda'));
      expect(state.totalStaffCount, 1);
      expect(state.totalScheduledHours, 4.0);
    });

    test('4. Support Morning (09:00 – 14:00, 5h) and Afternoon (14:00 – 18:00, 4h) sessions', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);

      // Morning session (5h)
      await notifier.assignWorkSession(
        staffId: 'staff-m',
        startTime: '09:00',
        endTime: '14:00',
        assignmentType: 'Regular',
      );

      // Afternoon session (4h)
      await notifier.assignWorkSession(
        staffId: 'staff-a',
        startTime: '14:00',
        endTime: '18:00',
        assignmentType: 'Regular',
      );

      final state = container.read(dailyStaffProvider('showroom-skoda'));
      expect(state.totalStaffCount, 2);
      expect(state.totalScheduledHours, 9.0); // 5.0h + 4.0h = 9.0h
    });

    test('5. Support Custom session timing (10:15 – 15:45, 5.5h)', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);

      await notifier.assignWorkSession(
        staffId: 'staff-c',
        startTime: '10:15',
        endTime: '15:45',
        assignmentType: 'Regular',
      );

      final state = container.read(dailyStaffProvider('showroom-skoda'));
      expect(state.totalStaffCount, 1);
      expect(state.totalScheduledHours, 5.5);
    });

    test('6. Edit session updates timing, status, and recalculates working hours', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);

      await notifier.assignWorkSession(
        staffId: 'staff-edit',
        startTime: '09:00',
        endTime: '14:00',
        assignmentType: 'Regular',
      );

      final initial = container.read(dailyStaffProvider('showroom-skoda')).staffAssignments.first;
      expect(initial.workingHours, 5.0);

      // Edit session to extended hours (09:00 to 18:00) with status 'HalfDay'
      final updated = await notifier.updateWorkSession(
        assignmentId: initial.id,
        startTime: '09:00',
        endTime: '18:00',
        status: 'HalfDay',
        notes: 'Extended shift',
      );

      expect(updated, isNotNull);
      expect(updated!.workingHours, 9.0);
      expect(updated.status, 'HalfDay');

      final state = container.read(dailyStaffProvider('showroom-skoda'));
      expect(state.totalScheduledHours, 9.0);
      expect(state.staffAssignments.first.status, 'HalfDay');
    });

    test('7. Delete / remove session removes record from roster', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);

      await notifier.assignWorkSession(
        staffId: 'staff-del',
        startTime: '09:00',
        endTime: '18:00',
        assignmentType: 'Regular',
      );

      expect(container.read(dailyStaffProvider('showroom-skoda')).totalStaffCount, 1);

      final assignment = container.read(dailyStaffProvider('showroom-skoda')).staffAssignments.first;
      await notifier.removeAssignment(assignment.id);

      expect(container.read(dailyStaffProvider('showroom-skoda')).totalStaffCount, 0);
      expect(fakeRepo.removedAssignments, contains(assignment.id));
    });

    test('8. Handles HTTP 409 Conflict error on overlapping assignments', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);
      fakeRepo.shouldThrowConflictOnAssign = true;
      fakeRepo.conflictMessage = 'Ramesh is already assigned to Skoda from 09:00 to 14:00 on this date.';

      await expectLater(
        () => notifier.assignWorkSession(
          staffId: 'staff-conflict',
          startTime: '12:00',
          endTime: '16:00',
          assignmentType: 'TemporaryTransfer',
        ),
        throwsA(isA<ConflictException>()),
      );

      final state = container.read(dailyStaffProvider('showroom-skoda'));
      expect(state.errorMessage, contains('Ramesh is already assigned to Skoda from 09:00 to 14:00'));
      expect(state.totalStaffCount, 0);
    });

    test('9. Back-to-back sessions on exact boundary (09:00–14:00 and 14:00–18:00) are allowed', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);

      await notifier.assignWorkSession(
        staffId: 'staff-1',
        startTime: '09:00',
        endTime: '14:00',
        assignmentType: 'Regular',
      );

      await notifier.assignWorkSession(
        staffId: 'staff-2',
        startTime: '14:00',
        endTime: '18:00',
        assignmentType: 'TemporaryTransfer',
      );

      final state = container.read(dailyStaffProvider('showroom-skoda'));
      expect(state.totalStaffCount, 2);
      expect(state.totalScheduledHours, 9.0);
    });

    test('10. Confirm and unlock attendance transitions locked state correctly', () async {
      final notifier = container.read(dailyStaffProvider('showroom-skoda').notifier);

      await notifier.assignWorkSession(
        staffId: 'staff-lock',
        startTime: '09:00',
        endTime: '18:00',
        assignmentType: 'Regular',
      );

      expect(container.read(dailyStaffProvider('showroom-skoda')).isAttendanceConfirmed, isFalse);

      // Confirm attendance
      final confirmed = await notifier.confirmAttendance();
      expect(confirmed!.isAttendanceConfirmed, isTrue);
      expect(container.read(dailyStaffProvider('showroom-skoda')).isAttendanceConfirmed, isTrue);

      // Unlock attendance (owner correction)
      final unlocked = await notifier.unlockAttendance();
      expect(unlocked!.isAttendanceConfirmed, isFalse);
      expect(container.read(dailyStaffProvider('showroom-skoda')).isAttendanceConfirmed, isFalse);
    });
  });
}
