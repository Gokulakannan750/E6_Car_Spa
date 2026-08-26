import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_model.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_request_models.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/models/staff_request_models.dart';

void main() {
  group('Staff Advance Models', () {
    test('StaffAdvance.fromJson parses outstanding advance correctly', () {
      final json = {
        'id': 'adv-123',
        'staffId': 'staff-456',
        'staffName': 'Ramesh Kumar',
        'staffRole': 'Detailer',
        'amount': 3000.0,
        'advanceDate': '2026-08-26T10:00:00Z',
        'reason': 'Salary Advance',
        'notes': 'Festival season advance',
        'status': 'Outstanding',
        'settledAt': null,
        'settledByName': null,
        'obsoleteReason': null,
        'createdAt': '2026-08-26T10:00:00Z',
      };

      final advance = StaffAdvance.fromJson(json);

      expect(advance.id, 'adv-123');
      expect(advance.staffId, 'staff-456');
      expect(advance.staffName, 'Ramesh Kumar');
      expect(advance.staffRole, 'Detailer');
      expect(advance.amount, 3000.0);
      expect(advance.reason, 'Salary Advance');
      expect(advance.notes, 'Festival season advance');
      expect(advance.status, StaffAdvanceStatus.outstanding);
      expect(advance.isOutstanding, isTrue);
      expect(advance.isSettled, isFalse);
      expect(advance.isObsolete, isFalse);
    });

    test('StaffAdvance.fromJson parses settled advance correctly', () {
      final json = {
        'id': 'adv-124',
        'staffId': 'staff-456',
        'staffName': 'Ramesh Kumar',
        'amount': 3000.0,
        'advanceDate': '2026-08-26T10:00:00Z',
        'reason': 'Salary Advance',
        'status': 'Settled',
        'settledAt': '2026-08-26T12:00:00Z',
        'settledByName': 'Owner Admin',
        'createdAt': '2026-08-26T10:00:00Z',
      };

      final advance = StaffAdvance.fromJson(json);

      expect(advance.status, StaffAdvanceStatus.settled);
      expect(advance.isSettled, isTrue);
      expect(advance.settledByName, 'Owner Admin');
      expect(advance.settledAt, isNotNull);
    });

    test('StaffAdvance.fromJson parses obsolete advance correctly', () {
      final json = {
        'id': 'adv-125',
        'staffId': 'staff-456',
        'staffName': 'Ramesh Kumar',
        'amount': 1500.0,
        'advanceDate': '2026-08-26T10:00:00Z',
        'reason': 'Medical',
        'status': 'Obsolete',
        'obsoleteReason': 'Wrongly entered',
        'createdAt': '2026-08-26T10:00:00Z',
      };

      final advance = StaffAdvance.fromJson(json);

      expect(advance.status, StaffAdvanceStatus.obsolete);
      expect(advance.isObsolete, isTrue);
      expect(advance.obsoleteReason, 'Wrongly entered');
    });

    test('StaffAdvanceSummary.fromJson parses correctly', () {
      final json = {
        'outstandingAmount': 3000.0,
        'settledAmount': 7000.0,
        'totalActiveCount': 5,
      };

      final summary = StaffAdvanceSummary.fromJson(json);

      expect(summary.outstandingAmount, 3000.0);
      expect(summary.settledAmount, 7000.0);
      expect(summary.totalActiveCount, 5);
    });

    test('StaffAdvanceListResponse.fromJson parses list and summary correctly', () {
      final json = {
        'items': [
          {
            'id': 'adv-1',
            'staffId': 'staff-1',
            'staffName': 'Suresh',
            'amount': 2000.0,
            'advanceDate': '2026-08-26T08:00:00Z',
            'reason': 'Personal Advance',
            'status': 'Outstanding',
            'createdAt': '2026-08-26T08:00:00Z',
          }
        ],
        'totalCount': 1,
        'page': 1,
        'pageSize': 20,
        'summary': {
          'outstandingAmount': 2000.0,
          'settledAmount': 0.0,
          'totalActiveCount': 1,
        }
      };

      final response = StaffAdvanceListResponse.fromJson(json);

      expect(response.items.length, 1);
      expect(response.totalCount, 1);
      expect(response.summary.outstandingAmount, 2000.0);
    });

    test('StaffAdvanceHistory.fromJson parses history DTO correctly', () {
      final json = {
        'staffId': 'staff-1',
        'staffName': 'Ramesh Kumar',
        'totalAdvancesAmount': 5000.0,
        'outstandingAmount': 2000.0,
        'settledAmount': 3000.0,
        'advances': [
          {
            'id': 'adv-1',
            'staffId': 'staff-1',
            'staffName': 'Ramesh Kumar',
            'amount': 3000.0,
            'advanceDate': '2026-08-20T00:00:00Z',
            'reason': 'Salary Advance',
            'status': 'Settled',
            'settledAt': '2026-08-25T00:00:00Z',
            'createdAt': '2026-08-20T00:00:00Z',
          },
          {
            'id': 'adv-2',
            'staffId': 'staff-1',
            'staffName': 'Ramesh Kumar',
            'amount': 2000.0,
            'advanceDate': '2026-08-26T00:00:00Z',
            'reason': 'Medical',
            'status': 'Outstanding',
            'createdAt': '2026-08-26T00:00:00Z',
          }
        ]
      };

      final history = StaffAdvanceHistory.fromJson(json);

      expect(history.staffId, 'staff-1');
      expect(history.staffName, 'Ramesh Kumar');
      expect(history.totalAdvancesAmount, 5000.0);
      expect(history.outstandingAmount, 2000.0);
      expect(history.settledAmount, 3000.0);
      expect(history.advances.length, 2);
    });
  });

  group('Staff Directory Models', () {
    test('Staff.fromJson parses correctly', () {
      final json = {
        'id': 'staff-101',
        'name': 'Ramesh Kumar',
        'phoneNumber': '9840123456',
        'email': 'ramesh@e6carspa.com',
        'address': 'Anna Nagar, Chennai',
        'role': 'Detailer',
        'isActive': true,
        'totalAdvances': 3,
        'totalAdvanceAmount': 6500.0,
      };

      final staff = Staff.fromJson(json);

      expect(staff.id, 'staff-101');
      expect(staff.name, 'Ramesh Kumar');
      expect(staff.phoneNumber, '9840123456');
      expect(staff.email, 'ramesh@e6carspa.com');
      expect(staff.address, 'Anna Nagar, Chennai');
      expect(staff.role, 'Detailer');
      expect(staff.isActive, isTrue);
      expect(staff.totalAdvances, 3);
      expect(staff.totalAdvanceAmount, 6500.0);
      expect(staff.initials, 'RK');
    });

    test('Staff initials generation handles single and multi-word names', () {
      const staff1 = Staff(
        id: '1',
        name: 'Ramesh',
        phoneNumber: '123',
        isActive: true,
      );
      expect(staff1.initials, 'R');

      const staff2 = Staff(
        id: '2',
        name: 'Ramesh Kumar Sharma',
        phoneNumber: '123',
        isActive: true,
      );
      expect(staff2.initials, 'RS');
    });

    test('CreateStaffRequest.toJson produces correct payload', () {
      final req = CreateStaffRequest(
        name: 'Ramesh Kumar',
        phoneNumber: '9840123456',
        email: 'ramesh@e6.com',
        address: 'Chennai',
        role: 'Technician',
        isActive: true,
      );

      final json = req.toJson();

      expect(json['name'], 'Ramesh Kumar');
      expect(json['phoneNumber'], '9840123456');
      expect(json['email'], 'ramesh@e6.com');
      expect(json['address'], 'Chennai');
      expect(json['role'], 'Technician');
      expect(json['isActive'], isTrue);
    });

    test('UpdateStaffRequest.toJson produces correct payload', () {
      final req = UpdateStaffRequest(
        name: 'Ramesh Kumar',
        phoneNumber: '9840123456',
        role: 'Supervisor',
        isActive: false,
      );

      final json = req.toJson();

      expect(json['name'], 'Ramesh Kumar');
      expect(json['role'], 'Supervisor');
      expect(json['isActive'], isFalse);
      expect(json['email'], isNull);
    });

    test('CreateStaffAdvanceRequest.toJson produces correct payload', () {
      final req = CreateStaffAdvanceRequest(
        staffId: 'staff-1',
        amount: 3000.0,
        advanceDate: DateTime.parse('2026-08-26T00:00:00Z'),
        reason: 'Salary Advance',
        notes: 'Urgent requirement',
      );

      final json = req.toJson();

      expect(json['staffId'], 'staff-1');
      expect(json['amount'], 3000.0);
      expect(json['reason'], 'Salary Advance');
      expect(json['notes'], 'Urgent requirement');
    });

    test('ObsoleteStaffAdvanceRequest.toJson produces correct payload', () {
      final req = ObsoleteStaffAdvanceRequest(reason: 'Wrongly entered');

      final json = req.toJson();

      expect(json['reason'], 'Wrongly entered');
    });
  });
}
