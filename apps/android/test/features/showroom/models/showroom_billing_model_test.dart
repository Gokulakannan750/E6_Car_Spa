import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_billing_model.dart';

void main() {
  group('ShowroomPayment Model Tests', () {
    test('fromJson and toJson parse correctly with camelCase keys', () {
      final json = {
        'id': 'pay-1',
        'showroomDailyBillId': 'bill-1',
        'amount': 2500.50,
        'paymentMethod': 'UPI',
        'reference': 'UPI-REF-999',
        'paymentDate': '2026-09-27T10:30:00.000Z',
        'notes': 'Advance payment',
        'createdAt': '2026-09-27T10:30:00.000Z',
      };

      final payment = ShowroomPayment.fromJson(json);
      expect(payment.id, 'pay-1');
      expect(payment.showroomDailyBillId, 'bill-1');
      expect(payment.amount, 2500.50);
      expect(payment.paymentMethod, 'UPI');
      expect(payment.reference, 'UPI-REF-999');
      expect(payment.notes, 'Advance payment');
      expect(payment.formattedAmount, contains('2,500.50'));

      final outJson = payment.toJson();
      expect(outJson['id'], 'pay-1');
      expect(outJson['amount'], 2500.50);
      expect(outJson['paymentMethod'], 'UPI');
    });

    test('handles PascalCase keys from backend C# DTOs', () {
      final json = {
        'Id': 'pay-2',
        'ShowroomDailyBillId': 'bill-2',
        'Amount': 1000.0,
        'PaymentMethod': 'Cash',
        'Reference': null,
        'PaymentDate': '2026-09-27T12:00:00.000Z',
        'Notes': null,
        'CreatedAt': '2026-09-27T12:00:00.000Z',
      };

      final payment = ShowroomPayment.fromJson(json);
      expect(payment.id, 'pay-2');
      expect(payment.amount, 1000.0);
      expect(payment.paymentMethod, 'Cash');
      expect(payment.reference, isNull);
    });
  });

  group('ShowroomDailyBill Model Tests', () {
    test('parses bill with payments and evaluates status getters', () {
      final json = {
        'id': 'bill-10',
        'showroomId': 'sr-10',
        'showroomName': 'BMW Showroom',
        'date': '2026-09-27T00:00:00.000Z',
        'amount': 5000.0,
        'amountReceived': 3000.0,
        'balanceAmount': 2000.0,
        'status': 'PartiallyPaid',
        'notes': 'Saturday rush',
        'payments': [
          {
            'id': 'pay-101',
            'showroomDailyBillId': 'bill-10',
            'amount': 3000.0,
            'paymentMethod': 'Card',
            'paymentDate': '2026-09-27T14:00:00.000Z',
            'createdAt': '2026-09-27T14:00:00.000Z',
          }
        ],
        'createdAt': '2026-09-27T09:00:00.000Z',
      };

      final bill = ShowroomDailyBill.fromJson(json);
      expect(bill.id, 'bill-10');
      expect(bill.showroomName, 'BMW Showroom');
      expect(bill.amount, 5000.0);
      expect(bill.amountReceived, 3000.0);
      expect(bill.balanceAmount, 2000.0);
      expect(bill.isPartiallyPaid, isTrue);
      expect(bill.isPaid, isFalse);
      expect(bill.isUnpaid, isFalse);
      expect(bill.payments.length, 1);
      expect(bill.payments.first.paymentMethod, 'Card');
      expect(bill.formattedAmount, contains('5,000.00'));
      expect(bill.formattedReceived, contains('3,000.00'));
      expect(bill.formattedBalance, contains('2,000.00'));
    });

    test('evaluates isPaid when balance is zero or status is Paid', () {
      final paidBill = ShowroomDailyBill(
        id: 'bill-20',
        showroomId: 'sr-20',
        showroomName: 'Audi Showroom',
        date: DateTime(2026, 9, 27),
        amount: 4000.0,
        amountReceived: 4000.0,
        balanceAmount: 0.0,
        status: 'Paid',
        createdAt: DateTime(2026, 9, 27),
      );

      expect(paidBill.isPaid, isTrue);
      expect(paidBill.isPartiallyPaid, isFalse);
      expect(paidBill.isUnpaid, isFalse);
    });

    test('evaluates isUnpaid when no amount received', () {
      final unpaidBill = ShowroomDailyBill(
        id: 'bill-30',
        showroomId: 'sr-30',
        showroomName: 'Audi Showroom',
        date: DateTime(2026, 9, 27),
        amount: 4000.0,
        amountReceived: 0.0,
        balanceAmount: 4000.0,
        status: 'Unpaid',
        createdAt: DateTime(2026, 9, 27),
      );

      expect(unpaidBill.isUnpaid, isTrue);
      expect(unpaidBill.isPaid, isFalse);
    });
  });

  group('Request DTOs Serialization', () {
    test('SetShowroomDailyBillRequest serializes correctly', () {
      const req = SetShowroomDailyBillRequest(
        amount: 3500.0,
        notes: 'Monthly negotiated rate',
      );
      final json = req.toJson();
      expect(json['amount'], 3500.0);
      expect(json['notes'], 'Monthly negotiated rate');
    });

    test('RecordShowroomPaymentRequest serializes correctly', () {
      final now = DateTime.utc(2026, 9, 27, 12, 0, 0);
      final req = RecordShowroomPaymentRequest(
        amount: 1500.0,
        paymentMethod: 'UPI',
        reference: 'UPI/1234567890',
        paymentDate: now,
        notes: 'GPay payment',
      );
      final json = req.toJson();
      expect(json['amount'], 1500.0);
      expect(json['paymentMethod'], 'UPI');
      expect(json['reference'], 'UPI/1234567890');
      expect(json['paymentDate'], now.toIso8601String());
      expect(json['notes'], 'GPay payment');
    });
  });

  group('Showroom Summary & History Models', () {
    test('ShowroomDailyHistoryRow parses correctly', () {
      final json = {
        'date': '2026-09-25T00:00:00.000Z',
        'staffCount': 4,
        'totalVehicles': 18,
        'billedAmount': 4500.0,
        'receivedAmount': 4500.0,
        'balanceAmount': 0.0,
        'status': 'Paid',
        'hasBill': true,
      };

      final row = ShowroomDailyHistoryRow.fromJson(json);
      expect(row.staffCount, 4);
      expect(row.totalVehicles, 18);
      expect(row.billedAmount, 4500.0);
      expect(row.balanceAmount, 0.0);
      expect(row.status, 'Paid');
      expect(row.hasBill, isTrue);
      expect(row.dateString, '2026-09-25');
    });

    test('ShowroomSummary parses aggregate totals and lists', () {
      final json = {
        'showroomId': 'sr-1',
        'showroomName': 'Mercedes-Benz Center',
        'fromDate': '2026-09-01T00:00:00.000Z',
        'toDate': '2026-09-30T00:00:00.000Z',
        'totalDaysWithActivity': 22,
        'totalStaffAssignments': 88,
        'totalVehiclesAttended': 350,
        'averageVehiclesPerDay': 15.9,
        'totalBilled': 120000.0,
        'totalReceived': 100000.0,
        'outstandingAmount': 20000.0,
        'paidDaysCount': 18,
        'partiallyPaidDaysCount': 2,
        'unpaidDaysCount': 2,
        'dailyHistory': [
          {
            'date': '2026-09-01T00:00:00.000Z',
            'staffCount': 4,
            'totalVehicles': 15,
            'billedAmount': 5000.0,
            'receivedAmount': 5000.0,
            'balanceAmount': 0.0,
            'status': 'Paid',
            'hasBill': true,
          }
        ],
        'staffProductivity': [
          {
            'staffId': 'st-1',
            'staffName': 'Ramesh Kumar',
            'staffPhone': '9876543210',
            'staffRole': 'Detailer',
            'daysAssigned': 20,
            'totalVehiclesAttended': 180,
            'averageVehiclesPerDay': 9.0,
          }
        ],
      };

      final summary = ShowroomSummary.fromJson(json);
      expect(summary.showroomId, 'sr-1');
      expect(summary.totalDaysWithActivity, 22);
      expect(summary.totalBilled, 120000.0);
      expect(summary.totalReceived, 100000.0);
      expect(summary.outstandingAmount, 20000.0);
      expect(summary.paidDaysCount, 18);
      expect(summary.unpaidDaysCount, 2);
      expect(summary.dailyHistory.length, 1);
      expect(summary.staffProductivity.length, 1);
      expect(summary.formattedBilled, contains('1,20,000.00'));
      expect(summary.formattedOutstanding, contains('20,000.00'));
    });

    test('ShowroomOutstandingOverview parses cross-showroom totals', () {
      final json = {
        'showroomId': 'sr-1',
        'showroomName': 'Audi Chennai',
        'address': 'Mount Road, Chennai',
        'phone': '9876543210',
        'isActive': true,
        'totalBilled': 80000.0,
        'totalReceived': 65000.0,
        'outstandingAmount': 15000.0,
        'unpaidDaysCount': 3,
      };

      final overview = ShowroomOutstandingOverview.fromJson(json);
      expect(overview.showroomName, 'Audi Chennai');
      expect(overview.totalBilled, 80000.0);
      expect(overview.totalReceived, 65000.0);
      expect(overview.outstandingAmount, 15000.0);
      expect(overview.unpaidDaysCount, 3);
      expect(overview.formattedOutstanding, contains('15,000.00'));
    });
  });
}
