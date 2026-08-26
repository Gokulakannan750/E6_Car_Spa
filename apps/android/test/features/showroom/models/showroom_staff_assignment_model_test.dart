import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DailyStaffAssignment & DailyStaffResponse Model Tests', () {
    test('DailyStaffAssignment fromJson & toJson round-trip', () {
      final json = {
        'id': 'assign-123',
        'showroomId': 'sr-456',
        'showroomName': 'Anna Nagar Hub',
        'staffId': 'staff-789',
        'staffName': 'Anand Varma',
        'staffPhone': '9840154321',
        'staffRole': 'Detailer',
        'date': '2026-08-26T00:00:00.000',
        'vehiclesAttended': 5,
        'createdAt': '2026-08-26T08:00:00.000',
      };

      final assignment = DailyStaffAssignment.fromJson(json);

      expect(assignment.id, 'assign-123');
      expect(assignment.showroomId, 'sr-456');
      expect(assignment.showroomName, 'Anna Nagar Hub');
      expect(assignment.staffId, 'staff-789');
      expect(assignment.staffName, 'Anand Varma');
      expect(assignment.staffPhone, '9840154321');
      expect(assignment.staffRole, 'Detailer');
      expect(assignment.vehiclesAttended, 5);
      expect(assignment.initials, 'AV');

      final serialized = assignment.toJson();
      expect(serialized['id'], 'assign-123');
      expect(serialized['vehiclesAttended'], 5);
    });

    test('DailyStaffResponse deserializes assignments array and confirmed state', () {
      final json = {
        'showroomId': 'sr-456',
        'showroomName': 'Anna Nagar Hub',
        'date': '2026-08-26T00:00:00.000',
        'totalVehiclesAttended': 15,
        'isAttendanceConfirmed': true,
        'attendanceConfirmedAt': '2026-08-26T18:00:00.000',
        'attendanceConfirmedByName': 'Manager',
        'staffAssignments': [
          {
            'id': 'a1',
            'showroomId': 'sr-456',
            'showroomName': 'Anna Nagar Hub',
            'staffId': 's1',
            'staffName': 'Ramesh Kumar',
            'staffPhone': '9876543210',
            'staffRole': 'Supervisor',
            'date': '2026-08-26T00:00:00.000',
            'vehiclesAttended': 8,
            'createdAt': '2026-08-26T08:00:00.000',
          },
          {
            'id': 'a2',
            'showroomId': 'sr-456',
            'showroomName': 'Anna Nagar Hub',
            'staffId': 's2',
            'staffName': 'Anand Varma',
            'staffPhone': '9840154321',
            'staffRole': 'Detailer',
            'date': '2026-08-26T00:00:00.000',
            'vehiclesAttended': 7,
            'createdAt': '2026-08-26T08:30:00.000',
          }
        ],
      };

      final response = DailyStaffResponse.fromJson(json);

      expect(response.showroomId, 'sr-456');
      expect(response.showroomName, 'Anna Nagar Hub');
      expect(response.totalVehiclesAttended, 15);
      expect(response.isAttendanceConfirmed, true);
      expect(response.attendanceConfirmedByName, 'Manager');
      expect(response.staffAssignments.length, 2);
      expect(response.staffAssignments[0].staffName, 'Ramesh Kumar');
      expect(response.staffAssignments[1].staffName, 'Anand Varma');
    });

    test('CreateDailyStaffAssignmentRequest serializes date cleanly', () {
      final req = CreateDailyStaffAssignmentRequest(
        staffId: 'staff-001',
        date: DateTime(2026, 8, 26),
        vehiclesAttended: 2,
      );

      final json = req.toJson();
      expect(json['staffId'], 'staff-001');
      expect(json['date'], '2026-08-26');
      expect(json['vehiclesAttended'], 2);
    });
  });
}
