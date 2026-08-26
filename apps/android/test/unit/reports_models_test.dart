import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/reports/models/report_dashboard_model.dart';
import 'package:e6_car_spa/features/reports/models/sales_report_model.dart';
import 'package:e6_car_spa/features/reports/models/payment_report_model.dart';
import 'package:e6_car_spa/features/reports/models/outstanding_invoice_model.dart';
import 'package:e6_car_spa/features/reports/models/gst_report_model.dart';
import 'package:e6_car_spa/features/reports/models/job_card_report_model.dart';
import 'package:e6_car_spa/features/reports/models/showroom_report_model.dart';
import 'package:e6_car_spa/features/reports/models/staff_productivity_report_model.dart';
import 'package:e6_car_spa/features/reports/models/staff_advances_report_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';

void main() {
  group('Reports Models Unit Tests', () {
    test('DashboardSummaryModel deserializes full JSON successfully', () {
      final json = {
        'dateRange': {
          'fromDate': '2026-08-01T00:00:00Z',
          'toDate': '2026-08-26T23:59:59Z',
        },
        'jobCardKpis': {
          'totalJobCards': 25,
          'newJobCards': 2,
          'inProgressJobCards': 5,
          'completedJobCards': 18,
          'cancelledJobCards': 0,
          'invoicedJobCards': 15,
        },
        'vehicleActivity': {
          'vehiclesServiced': 18,
          'totalServicesCompleted': 36,
          'uniqueVehiclesServiced': 14,
        },
        'invoiceKpis': {
          'draftCount': 1,
          'generatedCount': 4,
          'partiallyPaidCount': 2,
          'paidCount': 8,
          'cancelledCount': 0,
          'totalInvoicedAmount': 75000.0,
          'totalPaidAmount': 60000.0,
          'totalOutstandingAmount': 15000.0,
        },
        'sales': {
          'grossSubtotal': 65000.0,
          'totalDiscount': 2500.0,
          'gstAmount': 11250.0,
          'netSales': 73750.0,
          'paymentCollection': 60000.0,
          'outstanding': 13750.0,
        },
        'paymentCollection': {
          'totalReceived': 60000.0,
          'transactionCount': 12,
          'breakdownByMethod': [
            {'method': 'Cash', 'transactionCount': 4, 'amount': 15000.0},
            {'method': 'UPI', 'transactionCount': 6, 'amount': 35000.0},
            {'method': 'Card', 'transactionCount': 2, 'amount': 10000.0},
          ],
        },
        'showroom': {
          'activeShowroomsCount': 2,
          'staffAssignmentsCount': 14,
          'vehiclesAttended': 52,
          'totalBilled': 35000.0,
          'totalReceived': 30000.0,
          'totalOutstanding': 5000.0,
          'paidDaysCount': 5,
          'partiallyPaidDaysCount': 1,
          'unpaidDaysCount': 0,
        },
        'staffAdvances': {
          'outstandingCount': 3,
          'outstandingAmount': 12000.0,
          'settledCount': 5,
          'settledAmount': 20000.0,
          'obsoleteCount': 0,
        },
        'outstanding': {
          'invoiceOutstanding': 13750.0,
          'showroomOutstanding': 5000.0,
          'staffAdvanceOutstanding': 12000.0,
          'totalOutstandingCombined': 30750.0,
        },
        'recentActivity': [
          {
            'activityType': 'Payment',
            'title': 'Payment received (UPI)',
            'description': 'Received from John Doe for INV-2026-000012',
            'amount': 5000.0,
            'timestamp': '2026-08-25T14:30:00Z',
            'referenceId': 'e6f9a0c1-0000-0000-0000-000000000001',
            'status': 'Success',
          }
        ],
      };

      final model = DashboardSummaryModel.fromJson(json);

      expect(model.jobCardKpis.totalJobCards, 25);
      expect(model.jobCardKpis.completedJobCards, 18);
      expect(model.sales.netSales, 73750.0);
      expect(model.paymentCollection.totalReceived, 60000.0);
      expect(model.paymentCollection.breakdownByMethod.length, 3);
      expect(model.showroom.vehiclesAttended, 52);
      expect(model.staffAdvances.outstandingAmount, 12000.0);
      expect(model.outstanding.totalOutstandingCombined, 30750.0);
      expect(model.recentActivity.length, 1);
      expect(model.recentActivity.first.title, 'Payment received (UPI)');
    });

    test('SalesReportResponseModel deserializes rows and summary correctly', () {
      final json = {
        'items': [
          {
            'invoiceId': 'inv-1',
            'invoiceNumber': 'INV-2026-000001',
            'invoiceDate': '2026-08-20T10:00:00Z',
            'customerName': 'Alice Smith',
            'customerPhone': '+91 9876543210',
            'registrationNumber': 'TN 38 AA 1234',
            'subtotal': 2000.0,
            'discount': 200.0,
            'gst': 324.0,
            'totalAmount': 2124.0,
            'paidAmount': 2124.0,
            'balanceAmount': 0.0,
            'status': 2, // Paid
          }
        ],
        'totalCount': 1,
        'page': 1,
        'pageSize': 20,
        'summary': {
          'totalSubtotal': 2000.0,
          'totalDiscount': 200.0,
          'totalGst': 324.0,
          'totalAmount': 2124.0,
          'totalPaid': 2124.0,
          'totalBalance': 0.0,
          'invoiceCount': 1,
        }
      };

      final model = SalesReportResponseModel.fromJson(json);

      expect(model.totalCount, 1);
      expect(model.items.first.customerName, 'Alice Smith');
      expect(model.items.first.status, InvoiceStatus.paid);
      expect(model.summary.totalAmount, 2124.0);
    });

    test('PaymentReportResponseModel parses voided and active payments', () {
      final json = {
        'items': [
          {
            'paymentId': 'pay-1',
            'invoiceId': 'inv-1',
            'invoiceNumber': 'INV-2026-000001',
            'customerName': 'Bob',
            'paymentDate': '2026-08-21T11:00:00Z',
            'paymentMethod': 'UPI',
            'reference': 'UPI-REF-123456',
            'amount': 2500.0,
            'isVoided': false,
            'voidedAt': null,
          }
        ],
        'totalCount': 1,
        'page': 1,
        'pageSize': 20,
        'summary': {
          'totalCollected': 2500.0,
          'transactionCount': 1,
          'cashAmount': 0.0,
          'upiAmount': 2500.0,
          'cardAmount': 0.0,
          'bankTransferAmount': 0.0,
          'voidedTransactionCount': 0,
          'voidedAmount': 0.0,
        }
      };

      final model = PaymentReportResponseModel.fromJson(json);

      expect(model.items.first.paymentMethod, 'UPI');
      expect(model.items.first.amount, 2500.0);
      expect(model.summary.totalCollected, 2500.0);
    });

    test('OutstandingInvoiceReportResponseModel handles aging days', () {
      final json = {
        'items': [
          {
            'invoiceId': 'inv-2',
            'invoiceNumber': 'INV-2026-000002',
            'invoiceDate': '2026-08-01T09:00:00Z',
            'customerName': 'Charlie',
            'customerPhone': '+91 9123456780',
            'vehicleRegistration': 'TN 33 BB 5678',
            'totalAmount': 5000.0,
            'paidAmount': 2000.0,
            'balanceAmount': 3000.0,
            'status': 'PartiallyPaid',
            'ageInDays': 25,
          }
        ],
        'totalCount': 1,
        'page': 1,
        'pageSize': 20,
        'summary': {
          'totalOutstandingAmount': 3000.0,
          'totalInvoiceAmount': 5000.0,
          'totalPaidAmount': 2000.0,
          'invoiceCount': 1,
        }
      };

      final model = OutstandingInvoiceReportResponseModel.fromJson(json);

      expect(model.items.first.ageInDays, 25);
      expect(model.items.first.balanceAmount, 3000.0);
      expect(model.items.first.status, InvoiceStatus.partiallyPaid);
    });

    test('GstReportModel parses CGST, SGST, and invoices list', () {
      final json = {
        'invoiceCount': 2,
        'grossSubtotal': 10000.0,
        'totalDiscount': 0.0,
        'taxableBase': 10000.0,
        'cgstAmount': 900.0,
        'sgstAmount': 900.0,
        'totalGstAmount': 1800.0,
        'totalAmount': 11800.0,
        'invoices': [
          {
            'invoiceId': 'inv-1',
            'invoiceNumber': 'INV-2026-000001',
            'invoiceDate': '2026-08-20T10:00:00Z',
            'customerName': 'David',
            'registrationNumber': 'TN 38 CC 9999',
            'isGstEnabled': true,
            'taxableAmount': 5000.0,
            'gstAmount': 900.0,
            'totalAmount': 5900.0,
          }
        ],
      };

      final model = GstReportModel.fromJson(json);

      expect(model.cgstAmount, 900.0);
      expect(model.sgstAmount, 900.0);
      expect(model.totalGstAmount, 1800.0);
      expect(model.invoices.first.isGstEnabled, true);
    });

    test('JobCardReportResponseModel parses job card statuses', () {
      final json = {
        'items': [
          {
            'jobCardId': 'jc-1',
            'jobCardNumber': 'JC-2026-000001',
            'date': '2026-08-22T08:00:00Z',
            'customerName': 'Eve',
            'customerPhone': '+91 9999988888',
            'vehicleRegistration': 'TN 38 DD 1111',
            'vehicleDetails': 'Hyundai Creta (White)',
            'status': 3, // Ready
            'totalAmount': 3500.0,
            'invoiceId': 'inv-3',
            'invoiceNumber': 'INV-2026-000003',
            'invoiceStatus': 2,
          }
        ],
        'totalCount': 1,
        'page': 1,
        'pageSize': 20,
        'summary': {
          'totalCount': 1,
          'draftCount': 0,
          'inProgressCount': 0,
          'completedCount': 1,
          'cancelledCount': 0,
          'invoicedCount': 1,
          'totalRevenue': 3500.0,
        }
      };

      final model = JobCardReportResponseModel.fromJson(json);

      expect(model.items.first.status, JobCardStatus.ready);
      expect(model.items.first.invoiceStatus, InvoiceStatus.paid);
      expect(model.summary.completedCount, 1);
    });

    test('ShowroomReportResponseModel parses showroom daily records', () {
      final json = {
        'items': [
          {
            'showroomId': 'sh-1',
            'showroomName': 'E6 Main Spa',
            'date': '2026-08-24T00:00:00Z',
            'staffCount': 3,
            'vehiclesAttended': 12,
            'billedAmount': 15000.0,
            'receivedAmount': 15000.0,
            'balanceAmount': 0.0,
            'paymentStatus': 'Paid',
            'attendanceConfirmed': true,
            'attendanceConfirmedAt': '2026-08-24T18:00:00Z',
          }
        ],
        'totalCount': 1,
        'page': 1,
        'pageSize': 20,
        'summary': {
          'totalBilled': 15000.0,
          'totalReceived': 15000.0,
          'totalOutstanding': 0.0,
          'totalVehiclesAttended': 12,
          'totalAssignments': 3,
          'paidDaysCount': 1,
          'partiallyPaidDaysCount': 0,
          'unpaidDaysCount': 0,
        }
      };

      final model = ShowroomReportResponseModel.fromJson(json);

      expect(model.items.first.showroomName, 'E6 Main Spa');
      expect(model.items.first.vehiclesAttended, 12);
      expect(model.items.first.paymentStatus, 'Paid');
    });

    test('StaffProductivityReportResponseModel parses staff metrics', () {
      final json = {
        'items': [
          {
            'staffId': 'st-1',
            'staffName': 'Ramesh Kumar',
            'staffPhone': '+91 9444455555',
            'role': 'Senior Detailer',
            'daysAssigned': 6,
            'totalVehiclesAttended': 24,
            'dailyAverage': 4.0,
          }
        ],
        'totalStaff': 1,
        'totalDaysAssigned': 6,
        'totalVehiclesAttended': 24,
        'overallDailyAverage': 4.0,
      };

      final model = StaffProductivityReportResponseModel.fromJson(json);

      expect(model.items.first.staffName, 'Ramesh Kumar');
      expect(model.items.first.dailyAverage, 4.0);
      expect(model.totalVehiclesAttended, 24);
    });

    test('StaffAdvanceReportResponseModel parses advance history & obsolescence', () {
      final json = {
        'items': [
          {
            'id': 'adv-1',
            'staffId': 'st-1',
            'staffName': 'Ramesh Kumar',
            'staffPhone': '+91 9444455555',
            'staffRole': 'Senior Detailer',
            'advanceDate': '2026-08-10T10:00:00Z',
            'amount': 3000.0,
            'reason': 'Medical emergency',
            'notes': 'Salary deduction in Aug payroll',
            'status': 'Outstanding',
            'settledAt': null,
            'settledByName': null,
            'obsoletedAt': null,
            'obsoletedByName': null,
            'obsoleteReason': null,
          }
        ],
        'totalCount': 1,
        'page': 1,
        'pageSize': 20,
        'summary': {
          'outstandingAmount': 3000.0,
          'settledAmount': 0.0,
          'obsoleteAmount': 0.0,
          'outstandingCount': 1,
          'settledCount': 0,
          'obsoleteCount': 0,
        }
      };

      final model = StaffAdvanceReportResponseModel.fromJson(json);

      expect(model.items.first.amount, 3000.0);
      expect(model.items.first.status, 'Outstanding');
      expect(model.summary.outstandingAmount, 3000.0);
    });
  });
}
