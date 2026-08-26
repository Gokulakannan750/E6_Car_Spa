import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeShowroomApi extends ShowroomApi {
  FakeShowroomApi() : super(Dio());

  final List<Showroom> showrooms = [
    Showroom(
      id: 'sr-1',
      name: 'Anna Nagar',
      address: 'Plot 10, Anna Nagar',
      phone: '9840154321',
      isActive: true,
      activeStaffCountToday: 2,
      totalVehiclesToday: 6,
      createdAt: DateTime(2026, 8, 26),
    ),
  ];

  final Map<String, List<DailyStaffAssignment>> assignments = {};

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    var list = showrooms;
    if (isActive != null) {
      list = list.where((s) => s.isActive == isActive).toList();
    }
    if (search != null && search.isNotEmpty) {
      list = list.where((s) => s.name.contains(search)).toList();
    }
    return list;
  }

  @override
  Future<Showroom> getShowroomById(String id) async {
    return showrooms.firstWhere((s) => s.id == id);
  }

  @override
  Future<Showroom> createShowroom(CreateShowroomRequest request) async {
    final created = Showroom(
      id: 'sr-${showrooms.length + 1}',
      name: request.name,
      address: request.address,
      phone: request.phone,
      isActive: request.isActive,
      createdAt: DateTime.now(),
    );
    showrooms.add(created);
    return created;
  }

  @override
  Future<Showroom> updateShowroom(String id, UpdateShowroomRequest request) async {
    final idx = showrooms.indexWhere((s) => s.id == id);
    final prev = showrooms[idx];
    final updated = prev.copyWith(
      name: request.name ?? prev.name,
      address: request.address ?? prev.address,
      phone: request.phone ?? prev.phone,
      isActive: request.isActive ?? prev.isActive,
    );
    showrooms[idx] = updated;
    return updated;
  }

  @override
  Future<void> toggleShowroomActive(String id) async {
    final idx = showrooms.indexWhere((s) => s.id == id);
    final prev = showrooms[idx];
    showrooms[idx] = prev.copyWith(isActive: !prev.isActive);
  }

  @override
  Future<void> deleteShowroom(String id) async {
    showrooms.removeWhere((s) => s.id == id);
  }

  @override
  Future<DailyStaffResponse> getDailyStaff(String showroomId, DateTime date) async {
    final sr = showrooms.firstWhere((s) => s.id == showroomId);
    final list = assignments[showroomId] ?? [];
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: sr.name,
      date: date,
      totalVehiclesAttended: list.fold(0, (sum, a) => sum + a.vehiclesAttended),
      isAttendanceConfirmed: false,
      staffAssignments: list,
    );
  }

  @override
  Future<DailyStaffAssignment> assignDailyStaff(
    String showroomId,
    CreateDailyStaffAssignmentRequest request,
  ) async {
    final sr = showrooms.firstWhere((s) => s.id == showroomId);
    final newAssignment = DailyStaffAssignment(
      id: 'assign-${DateTime.now().millisecondsSinceEpoch}',
      showroomId: showroomId,
      showroomName: sr.name,
      staffId: request.staffId,
      staffName: 'Test Staff',
      staffPhone: '9876543210',
      staffRole: 'Detailer',
      date: request.date,
      vehiclesAttended: request.vehiclesAttended,
      createdAt: DateTime.now(),
    );
    assignments.putIfAbsent(showroomId, () => []).add(newAssignment);
    return newAssignment;
  }

  @override
  Future<void> removeDailyStaff(String assignmentId) async {
    for (final list in assignments.values) {
      list.removeWhere((a) => a.id == assignmentId);
    }
  }
}

void main() {
  group('ShowroomRepository Tests', () {
    late FakeShowroomApi fakeApi;
    late ShowroomRepository repo;

    setUp(() {
      fakeApi = FakeShowroomApi();
      repo = ShowroomRepository(fakeApi);
    });

    test('getShowrooms returns list of showrooms', () async {
      final list = await repo.getShowrooms();
      expect(list.length, 1);
      expect(list.first.name, 'Anna Nagar');
    });

    test('createShowroom adds new showroom to list', () async {
      final created = await repo.createShowroom(
        const CreateShowroomRequest(
          name: 'Velachery Hub',
          address: 'Velachery Main Rd',
          phone: '9840112233',
        ),
      );

      expect(created.name, 'Velachery Hub');
      final list = await repo.getShowrooms();
      expect(list.length, 2);
    });

    test('updateShowroom modifies showroom details', () async {
      final updated = await repo.updateShowroom(
        'sr-1',
        const UpdateShowroomRequest(name: 'Anna Nagar Prime Hub'),
      );

      expect(updated.name, 'Anna Nagar Prime Hub');
      final fetched = await repo.getShowroomById('sr-1');
      expect(fetched.name, 'Anna Nagar Prime Hub');
    });

    test('toggleShowroomActive inverts isActive state', () async {
      await repo.toggleShowroomActive('sr-1');
      var fetched = await repo.getShowroomById('sr-1');
      expect(fetched.isActive, false);

      await repo.toggleShowroomActive('sr-1');
      fetched = await repo.getShowroomById('sr-1');
      expect(fetched.isActive, true);
    });

    test('assignDailyStaff and removeDailyStaff manage roster correctly', () async {
      final assignment = await repo.assignDailyStaff(
        'sr-1',
        CreateDailyStaffAssignmentRequest(
          staffId: 'staff-99',
          date: DateTime(2026, 8, 26),
          vehiclesAttended: 3,
        ),
      );

      expect(assignment.staffId, 'staff-99');
      var dailyRoster = await repo.getDailyStaff('sr-1', DateTime(2026, 8, 26));
      expect(dailyRoster.staffAssignments.length, 1);
      expect(dailyRoster.totalVehiclesAttended, 3);

      await repo.removeDailyStaff(assignment.id);
      dailyRoster = await repo.getDailyStaff('sr-1', DateTime(2026, 8, 26));
      expect(dailyRoster.staffAssignments.isEmpty, true);
    });
  });
}
