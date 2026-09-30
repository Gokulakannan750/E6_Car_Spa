import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Work Session & Attendance Models Tests', () {
    test('ShowroomSessionType enum has standardized desktop presets', () {
      expect(ShowroomSessionType.fullDay.defaultStart, '09:00');
      expect(ShowroomSessionType.fullDay.defaultEnd, '18:00');
      expect(ShowroomSessionType.fullDay.defaultHours, 9.0);

      expect(ShowroomSessionType.morning.defaultStart, '09:00');
      expect(ShowroomSessionType.morning.defaultEnd, '14:00');
      expect(ShowroomSessionType.morning.defaultHours, 5.0);

      expect(ShowroomSessionType.afternoon.defaultStart, '14:00');
      expect(ShowroomSessionType.afternoon.defaultEnd, '18:00');
      expect(ShowroomSessionType.afternoon.defaultHours, 4.0);
    });

    test('calculateSessionHours and formatSessionHours compute correctly', () {
      // Full day 09:00 to 18:00 (9h)
      final fullDay = calculateSessionHours('09:00', '18:00');
      expect(fullDay, 9.0);
      expect(formatSessionHours(fullDay!), '9h');

      // Morning 09:00 to 14:00 (5h)
      final morning = calculateSessionHours('09:00', '14:00');
      expect(morning, 5.0);
      expect(formatSessionHours(morning!), '5h');

      // Afternoon 14:00 to 18:00 (4h)
      final afternoon = calculateSessionHours('14:00', '18:00');
      expect(afternoon, 4.0);
      expect(formatSessionHours(afternoon!), '4h');

      // Custom 10:15 to 14:45 (4.5h)
      final custom = calculateSessionHours('10:15', '14:45');
      expect(custom, 4.5);
      expect(formatSessionHours(custom!), '4h 30m');

      // Invalid: End before start
      final invalid = calculateSessionHours('18:00', '09:00');
      expect(invalid, isNull);

      // Invalid: Malformed string
      expect(calculateSessionHours('invalid', '18:00'), isNull);
    });

    test(
      'DailyStaffAssignment fromJson & toJson round-trip with work session fields',
      () {
        final json = {
          'id': 'assign-123',
          'showroomId': 'sr-456',
          'showroomName': 'Skoda Showroom',
          'staffId': 'staff-789',
          'staffMasterId': 'STF-01',
          'staffName': 'Ramesh Detailer',
          'staffPhone': '9840154321',
          'staffRole': 'Detailer',
          'date': '2026-10-19T00:00:00.000',
          'startTime': '09:00',
          'endTime': '14:00',
          'workingHours': 5.0,
          'workingHoursFormatted': '5h',
          'status': 'Present',
          'assignmentType': 'TemporaryTransfer',
          'homeShowroomId': 'sr-honda',
          'homeShowroomMasterId': 'SR-HD',
          'homeShowroomName': 'Honda Showroom',
          'transferReason': 'Covering morning shift',
          'notes': 'Priority detail work',
          'createdAt': '2026-10-19T08:00:00.000',
        };

        final assignment = DailyStaffAssignment.fromJson(json);

        expect(assignment.id, 'assign-123');
        expect(assignment.showroomId, 'sr-456');
        expect(assignment.showroomName, 'Skoda Showroom');
        expect(assignment.staffId, 'staff-789');
        expect(assignment.staffMasterId, 'STF-01');
        expect(assignment.staffName, 'Ramesh Detailer');
        expect(assignment.startTime, '09:00');
        expect(assignment.endTime, '14:00');
        expect(assignment.workingHours, 5.0);
        expect(assignment.status, 'Present');
        expect(assignment.assignmentType, 'TemporaryTransfer');
        expect(assignment.isTemporaryTransfer, isTrue);
        expect(assignment.displayHomeShowroom, 'Honda Showroom');
        expect(assignment.displayTimeRange, '09:00 – 14:00');
        expect(assignment.displayHours, '5h');
        expect(assignment.transferReason, 'Covering morning shift');
        expect(assignment.notes, 'Priority detail work');

        final serialized = assignment.toJson();
        expect(serialized['id'], 'assign-123');
        expect(serialized['startTime'], '09:00');
        expect(serialized['endTime'], '14:00');
        expect(serialized['assignmentType'], 'TemporaryTransfer');
        expect(serialized['homeShowroomId'], 'sr-honda');
      },
    );

    test(
      'Regular assignment detected when homeShowroomId matches current showroom',
      () {
        final assignment = DailyStaffAssignment(
          id: 'a1',
          showroomId: 'sr-skoda',
          showroomName: 'Skoda Showroom',
          staffId: 'st-1',
          staffName: 'Ramesh',
          staffPhone: '9876543210',
          date: DateTime(2026, 10, 19),
          startTime: '09:00',
          endTime: '18:00',
          assignmentType: 'Regular',
          homeShowroomId: 'sr-skoda',
          homeShowroomName: 'Skoda Showroom',
          createdAt: DateTime.now(),
        );

        expect(assignment.isTemporaryTransfer, isFalse);
        expect(assignment.displayHomeShowroom, 'Skoda Showroom');
      },
    );

    test(
      'DailyStaffResponse calculates totalScheduledHours from assignments',
      () {
        final response = DailyStaffResponse(
          showroomId: 'sr-skoda',
          showroomName: 'Skoda Showroom',
          date: DateTime(2026, 10, 19),
          isAttendanceConfirmed: true,
          attendanceConfirmedByName: 'Manager',
          attendanceConfirmedAt: DateTime.now(),
          staffAssignments: [
            DailyStaffAssignment(
              id: 'a1',
              showroomId: 'sr-skoda',
              showroomName: 'Skoda Showroom',
              staffId: 's1',
              staffName: 'Ramesh',
              staffPhone: '9876543210',
              date: DateTime(2026, 10, 19),
              startTime: '09:00',
              endTime: '14:00',
              workingHours: 5.0,
              createdAt: DateTime.now(),
            ),
            DailyStaffAssignment(
              id: 'a2',
              showroomId: 'sr-skoda',
              showroomName: 'Skoda Showroom',
              staffId: 's2',
              staffName: 'Kumar',
              staffPhone: '9876543211',
              date: DateTime(2026, 10, 19),
              startTime: '14:00',
              endTime: '18:00',
              workingHours: 4.0,
              createdAt: DateTime.now(),
            ),
          ],
        );

        expect(response.totalScheduledHours, 9.0);
        expect(response.staffAssignments.length, 2);
        expect(response.isAttendanceConfirmed, isTrue);
      },
    );

    test(
      'CreateDailyStaffAssignmentRequest serializes work session fields',
      () {
        final req = CreateDailyStaffAssignmentRequest(
          staffId: 'staff-001',
          date: DateTime(2026, 10, 19),
          startTime: '09:00',
          endTime: '14:00',
          assignmentType: 'TemporaryTransfer',
          transferReason: 'Covering Ramesh shift',
          notes: 'Session notes',
        );

        final json = req.toJson();
        expect(json['staffId'], 'staff-001');
        expect(json['date'], '2026-10-19');
        expect(json['startTime'], '09:00');
        expect(json['endTime'], '14:00');
        expect(json['assignmentType'], 'TemporaryTransfer');
        expect(json['transferReason'], 'Covering Ramesh shift');
        expect(json['notes'], 'Session notes');
      },
    );

    test(
      'UpdateDailyStaffAssignmentRequest serializes work session edit fields',
      () {
        const req = UpdateDailyStaffAssignmentRequest(
          startTime: '10:00',
          endTime: '16:00',
          status: 'Present',
          transferReason: 'Extended transfer',
          notes: 'Updated notes',
        );

        final json = req.toJson();
        expect(json['startTime'], '10:00');
        expect(json['endTime'], '16:00');
        expect(json['status'], 'Present');
        expect(json['transferReason'], 'Extended transfer');
        expect(json['notes'], 'Updated notes');
      },
    );
  });
}
