import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/staff/models/staff_attendance_models.dart';

void main() {
  group('DailyStaffAttendanceItem', () {
    test('fromJson & toJson preserves all fields correctly', () {
      final json = {
        'staffId': 'staff-1',
        'staffName': 'Ramesh Kumar',
        'staffRole': 'Senior Detailer',
        'staffPhoneNumber': '9876543210',
        'isActive': true,
        'attendanceId': 'att-101',
        'status': 'Present',
        'checkInTime': '09:00 AM',
        'checkOutTime': '06:00 PM',
        'workingHours': 9.0,
        'workingHoursFormatted': '9h 0m',
        'notes': 'On time',
        'attendanceDate': '2026-09-22',
      };

      final item = DailyStaffAttendanceItem.fromJson(json);

      expect(item.staffId, 'staff-1');
      expect(item.staffName, 'Ramesh Kumar');
      expect(item.staffRole, 'Senior Detailer');
      expect(item.staffPhoneNumber, '9876543210');
      expect(item.isActive, true);
      expect(item.attendanceId, 'att-101');
      expect(item.status, 'Present');
      expect(item.checkInTime, '09:00 AM');
      expect(item.checkOutTime, '06:00 PM');
      expect(item.workingHours, 9.0);
      expect(item.workingHoursFormatted, '9h 0m');
      expect(item.notes, 'On time');
      expect(item.attendanceDate, '2026-09-22');

      final serialized = item.toJson();
      expect(serialized['staffId'], 'staff-1');
      expect(serialized['status'], 'Present');
    });

    test('defaults to Unmarked when status is missing', () {
      final json = {
        'staffId': 'staff-2',
        'staffName': 'Suresh',
        'staffPhoneNumber': '9876543211',
        'attendanceDate': '2026-09-22',
      };

      final item = DailyStaffAttendanceItem.fromJson(json);
      expect(item.status, 'Unmarked');
      expect(item.isActive, true);
    });
  });

  group('DailyAttendanceResponse & Summary', () {
    test('fromJson parses summary and confirmation status', () {
      final json = {
        'date': '2026-09-22',
        'isAttendanceConfirmed': true,
        'attendanceConfirmedAt': '2026-09-22T19:00:00Z',
        'attendanceConfirmedByUserId': 'user-1',
        'attendanceConfirmedByName': 'Manager Gokul',
        'summary': {
          'date': '2026-09-22',
          'totalActiveStaff': 10,
          'presentCount': 7,
          'halfDayCount': 1,
          'leaveCount': 1,
          'unmarkedCount': 1,
        },
        'staffMembers': [
          {
            'staffId': 'staff-1',
            'staffName': 'Ramesh',
            'staffPhoneNumber': '9876543210',
            'status': 'Present',
            'attendanceDate': '2026-09-22',
          }
        ],
      };

      final resp = DailyAttendanceResponse.fromJson(json);
      expect(resp.date, '2026-09-22');
      expect(resp.isAttendanceConfirmed, true);
      expect(resp.isConfirmed, true);
      expect(resp.attendanceConfirmedByName, 'Manager Gokul');
      expect(resp.summary.totalActiveStaff, 10);
      expect(resp.summary.presentCount, 7);
      expect(resp.summary.halfDayCount, 1);
      expect(resp.summary.leaveCount, 1);
      expect(resp.summary.unmarkedCount, 1);
      expect(resp.staffMembers.length, 1);
    });
  });

  group('MonthlyAttendanceReportResponse', () {
    test('fromJson parses matrix and monthly stats', () {
      final json = {
        'year': 2026,
        'month': 9,
        'fromDate': '2026-09-01',
        'toDate': '2026-09-30',
        'totalCalendarDays': 30,
        'staffCount': 5,
        'summary': {
          'present': 120,
          'halfDay': 10,
          'leave': 15,
          'unmarked': 5,
        },
        'staffAttendance': [
          {
            'staffId': 'staff-1',
            'name': 'Ramesh Kumar',
            'role': 'Detailer',
            'phoneNumber': '9876543210',
            'presentDays': 24,
            'halfDays': 2,
            'leaveDays': 3,
            'unmarkedDays': 1,
            'attendanceDays': 25,
            'dailyRecords': [
              {
                'date': '2026-09-01',
                'day': 1,
                'dayOfWeek': 'Tuesday',
                'status': 'Present',
                'workingHours': 9.0,
                'workingHoursFormatted': '9.0 hrs',
              },
            ],
          }
        ],
      };

      final report = MonthlyAttendanceReportResponse.fromJson(json);
      expect(report.year, 2026);
      expect(report.month, 9);
      expect(report.fromDate, '2026-09-01');
      expect(report.toDate, '2026-09-30');
      expect(report.totalCalendarDays, 30);
      expect(report.staffAttendance.length, 1);

      final staffRec = report.staffAttendance.first;
      expect(staffRec.name, 'Ramesh Kumar');
      expect(staffRec.presentDays, 24);
      expect(staffRec.halfDays, 2);
      expect(staffRec.leaveDays, 3);
      expect(staffRec.unmarkedDays, 1);
      expect(staffRec.dailyRecords.length, 1);
      expect(staffRec.dailyRecords.first.status, 'Present');
    });
  });
}
