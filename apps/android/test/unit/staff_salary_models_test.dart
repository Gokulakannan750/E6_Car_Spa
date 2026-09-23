import 'dart:math';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/staff/models/staff_salary_models.dart';

void main() {
  group('StaffSalaryItem Business Rules & Model Tests', () {
    test('Advance recovery is min(Applicable Advance, Entered Salary)', () {
      const enteredSalary = 20000.0;
      const outstandingAdvance = 8000.0;

      final advanceRecovery = min(outstandingAdvance, enteredSalary);
      final finalSalary = max(0.0, enteredSalary - advanceRecovery);
      final remainingAdvance = max(0.0, outstandingAdvance - enteredSalary);

      expect(advanceRecovery, 8000.0);
      expect(finalSalary, 12000.0);
      expect(remainingAdvance, 0.0);
    });

    test('Advance recovery capped when advance exceeds salary', () {
      const enteredSalary = 15000.0;
      const outstandingAdvance = 25000.0;

      final advanceRecovery = min(outstandingAdvance, enteredSalary);
      final finalSalary = max(0.0, enteredSalary - advanceRecovery);
      final remainingAdvance = max(0.0, outstandingAdvance - enteredSalary);

      expect(advanceRecovery, 15000.0);
      expect(finalSalary, 0.0);
      expect(remainingAdvance, 10000.0);
    });

    test('StaffSalaryItem fromJson & status flags', () {
      final json = {
        'staffId': 'staff-1',
        'staffName': 'Gokul Kannan',
        'staffRole': 'Manager',
        'staffPhoneNumber': '9876543210',
        'isActive': true,
        'periodFrom': '2026-09-01',
        'periodTo': '2026-09-30',
        'enteredSalary': 25000.0,
        'outstandingAdvance': 5000.0,
        'advanceDeduction': 5000.0,
        'finalSalary': 20000.0,
        'remainingAdvance': 0.0,
        'status': 'Ready',
      };

      final item = StaffSalaryItem.fromJson(json);

      expect(item.staffId, 'staff-1');
      expect(item.staffName, 'Gokul Kannan');
      expect(item.enteredSalary, 25000.0);
      expect(item.outstandingAdvance, 5000.0);
      expect(item.advanceDeduction, 5000.0);
      expect(item.finalSalary, 20000.0);
      expect(item.isReady, true);
      expect(item.isSettled, false);
      expect(item.isNotEntered, false);
    });

    test('StaffSalaryItem settled status flag', () {
      final json = {
        'staffId': 'staff-1',
        'staffName': 'Gokul Kannan',
        'staffPhoneNumber': '9876543210',
        'periodFrom': '2026-09-01',
        'periodTo': '2026-09-30',
        'enteredSalary': 25000.0,
        'outstandingAdvance': 0.0,
        'advanceDeduction': 0.0,
        'finalSalary': 25000.0,
        'status': 'Settled',
        'settlementId': 'settle-999',
        'settledAt': '2026-09-30T18:00:00Z',
        'settledByName': 'Owner Admin',
      };

      final item = StaffSalaryItem.fromJson(json);
      expect(item.isSettled, true);
      expect(item.isReady, false);
      expect(item.settlementId, 'settle-999');
      expect(item.settledByName, 'Owner Admin');
    });
  });

  group('StaffSalaryRosterResponse', () {
    test('fromJson aggregates totals correctly', () {
      final json = {
        'periodFrom': '2026-09-01',
        'periodTo': '2026-09-30',
        'totalStaffCount': 3,
        'notEnteredCount': 1,
        'readyCount': 1,
        'settledCount': 1,
        'totalEnteredSalary': 55000.0,
        'totalAdvanceDeductions': 8000.0,
        'totalFinalSalary': 47000.0,
        'items': [
          {
            'staffId': 's-1',
            'staffName': 'Staff 1',
            'staffPhoneNumber': '1111111111',
            'periodFrom': '2026-09-01',
            'periodTo': '2026-09-30',
            'enteredSalary': 30000.0,
            'outstandingAdvance': 5000.0,
            'advanceDeduction': 5000.0,
            'finalSalary': 25000.0,
            'status': 'Settled',
          },
          {
            'staffId': 's-2',
            'staffName': 'Staff 2',
            'staffPhoneNumber': '2222222222',
            'periodFrom': '2026-09-01',
            'periodTo': '2026-09-30',
            'enteredSalary': 25000.0,
            'outstandingAdvance': 3000.0,
            'advanceDeduction': 3000.0,
            'finalSalary': 22000.0,
            'status': 'Ready',
          },
          {
            'staffId': 's-3',
            'staffName': 'Staff 3',
            'staffPhoneNumber': '3333333333',
            'periodFrom': '2026-09-01',
            'periodTo': '2026-09-30',
            'outstandingAdvance': 0.0,
            'status': 'NotEntered',
          },
        ],
      };

      final roster = StaffSalaryRosterResponse.fromJson(json);

      expect(roster.periodFrom, '2026-09-01');
      expect(roster.periodTo, '2026-09-30');
      expect(roster.totalStaffCount, 3);
      expect(roster.notEnteredCount, 1);
      expect(roster.readyCount, 1);
      expect(roster.settledCount, 1);
      expect(roster.totalEnteredSalary, 55000.0);
      expect(roster.totalAdvanceDeductions, 8000.0);
      expect(roster.totalFinalSalary, 47000.0);
      expect(roster.items.length, 3);
    });
  });

  group('StaffSalarySettlement DTO', () {
    test('fromJson deserializes settlement record properly', () {
      final json = {
        'id': 'settle-1',
        'staffId': 'staff-1',
        'staffName': 'Ramesh Kumar',
        'periodFrom': '2026-09-01',
        'periodTo': '2026-09-30',
        'enteredSalary': 20000.0,
        'outstandingAdvanceBeforeSettlement': 5000.0,
        'advanceDeduction': 4000.0,
        'remainingAdvanceAfterSettlement': 1000.0,
        'finalSalary': 16000.0,
        'settledAt': '2026-09-30T17:30:00Z',
        'settledByName': 'Admin',
        'notes': 'Bank transfer ref: TXN12345',
      };

      final settlement = StaffSalarySettlement.fromJson(json);

      expect(settlement.id, 'settle-1');
      expect(settlement.staffId, 'staff-1');
      expect(settlement.enteredSalary, 20000.0);
      expect(settlement.outstandingAdvanceBeforeSettlement, 5000.0);
      expect(settlement.advanceDeduction, 4000.0);
      expect(settlement.remainingAdvanceAfterSettlement, 1000.0);
      expect(settlement.finalSalary, 16000.0);
      expect(settlement.notes, 'Bank transfer ref: TXN12345');
    });
  });
}
