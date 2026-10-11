import 'package:e6_car_spa/features/reports/export/billing_excel.dart';
import 'package:e6_car_spa/features/reports/export/outside_jobs_excel.dart';
import 'package:e6_car_spa/features/reports/export/report_file_service.dart';
import 'package:e6_car_spa/features/reports/export/showroom_excel.dart';
import 'package:e6_car_spa/features/reports/export/staff_advances_excel.dart';
import 'package:e6_car_spa/features/reports/export/xlsx_sheet.dart';
import 'package:e6_car_spa/features/reports/models/monthly_billing_report_model.dart';
import 'package:e6_car_spa/features/reports/models/outside_job_report_model.dart';
import 'package:e6_car_spa/features/reports/models/showroom_report_model.dart';
import 'package:e6_car_spa/features/reports/models/staff_advances_report_model.dart';
import 'package:excel/excel.dart';
import 'package:flutter_test/flutter_test.dart';

/// Opens a finished workbook again, the way a spreadsheet program would.
Excel open(ReportFile file) => Excel.decodeBytes(file.bytes);

String? text(Excel book, String sheet, int row, int col) => book[sheet]
    .cell(CellIndex.indexByColumnRow(columnIndex: col, rowIndex: row))
    .value
    ?.toString();

/// Every value on a sheet as text, to look for something without caring where it is.
List<String> everything(Excel book, String sheet) => [
  for (final row in book[sheet].rows)
    for (final cell in row)
      if (cell?.value != null) cell!.value.toString(),
];

void main() {
  group('Helpers', () {
    test('sheet names are cut, cleaned and never repeated', () {
      final used = <String>{};
      expect(uniqueSheetName('Priya/Sharma: [A]', used), 'Priya Sharma   A');
      expect(
        uniqueSheetName('Priya/Sharma: [A]', used),
        'Priya Sharma   A (2)',
      );
      expect(uniqueSheetName('x' * 40, used).length, 31);
      expect(uniqueSheetName('   ', used), 'Sheet');
    });

    test('company name becomes a file prefix and a title', () {
      expect(
        reportFilePrefix('Sunrise Detailing Co.'),
        'Sunrise_Detailing_Co_',
      );
      expect(reportFilePrefix(''), '');
      expect(reportFilePrefix(null), '');
      expect(reportTitle('BILLING', 'Sunrise'), 'SUNRISE — BILLING');
      expect(reportTitle('BILLING', null), 'BILLING');
    });
  });

  group('Billing workbook', () {
    final report = MonthlyBillingReportResponseModel.fromJson({
      'year': 2026,
      'month': 10,
      'monthName': 'October 2026',
      'fromDate': '2026-10-01',
      'toDate': '2026-10-31',
      'daysInMonth': 31,
      'summary': {
        'monthName': 'October 2026',
        'totalJobCardsCreated': 12,
        'totalJobCardsFinished': 9,
        'totalInvoices': 8,
        'totalInvoicesPaid': 5,
        'totalInvoicesPendingPayment': 3,
        'totalInvoiceAmount': 25000.5,
        'totalAmountPaid': 15000,
        'totalAmountPending': 10000.5,
        'totalServicesPerformed': 14,
        'totalServiceQuantity': 16,
      },
      'dailySheets': [
        {
          'day': 1,
          'date': '2026-10-01',
          'dateFormatted': '01 Oct 2026',
          'sheetName': '01-Oct',
          'hasActivity': true,
          'totals': {
            'invoiceTotal': 1180,
            'amountPaid': 1000,
            'amountPending': 180,
            'jobCardCount': 1,
            'invoiceCount': 1,
            'serviceCount': 1,
            'serviceTotalQuantity': 2,
          },
          'jobCards': [
            {
              'jobCardNumber': 'JC-1',
              'jobCardDate': '2026-10-01T09:00:00',
              'customerName': 'Priya Sharma',
              'vehicleRegistration': 'TN01AB1234',
              'vehicle': 'Honda City',
              'jobCardStatus': 'Paid',
              'totalServices': 1,
              'jobCardTotal': 1180,
            },
          ],
          'invoices': [
            {
              'invoiceNumber': 'INV-1',
              'invoiceDate': '2026-10-01T10:00:00',
              'jobCardNumber': 'JC-1',
              'customerName': 'Priya Sharma',
              'vehicleRegistration': 'TN01AB1234',
              'invoiceStatus': 'Partially Paid',
              'invoiceTotal': 1180,
              'amountPaid': 1000,
              'amountPending': 180,
            },
          ],
          'services': [
            {
              'jobCardNumber': 'JC-1',
              'invoiceNumber': 'INV-1',
              'customerName': 'Priya Sharma',
              'serviceName': 'Ceramic coating',
              'quantity': 2,
              'rate': 500,
              'amount': 1000,
            },
          ],
        },
        {
          'day': 2,
          'date': '2026-10-02',
          'dateFormatted': '02 Oct 2026',
          'sheetName': '02-Oct',
          'hasActivity': false,
          'totals': <String, dynamic>{},
        },
      ],
    });

    test('has a summary, then one sheet for each day', () {
      final file = BillingExcel.build(report, companyName: 'Sunrise Detailing');
      final book = open(file);

      expect(
        file.fileName,
        'Sunrise_Detailing_Billing_Report_October_2026.xlsx',
      );
      expect(book.sheets.keys.toList(), [
        'Monthly Summary',
        '01-Oct',
        '02-Oct',
      ]);
    });

    test('the summary shows the month totals', () {
      final book = open(BillingExcel.build(report));
      final values = everything(book, 'Monthly Summary');

      expect(values, contains('MONTHLY BILLING REPORT'));
      expect(values, contains('25000.5'));
      expect(values, contains('15000'));
      expect(values, contains('Job cards created'));
    });

    test(
      'a busy day lists its job cards, invoices and services with totals',
      () {
        final book = open(BillingExcel.build(report));
        final values = everything(book, '01-Oct');

        expect(
          values,
          containsAll(['JC-1', 'INV-1', 'Priya Sharma', 'Ceramic coating']),
        );
        expect(values, contains('SECTION 1: JOB CARDS (1 records)'));
        expect(values, contains('SECTION 2: INVOICES (1 records)'));
        expect(values, contains('SECTION 3: SERVICES (1 items)'));
        expect(values, contains('Total'));
      },
    );

    test('a quiet day says so', () {
      final values = everything(open(BillingExcel.build(report)), '02-Oct');
      expect(values, contains('No billing activity on this day.'));
    });
  });

  group('Outside jobs workbook', () {
    final report = OutsideJobReportResponseModel.fromJson({
      'currentlyOutside': [
        {
          'id': '1',
          'jobCardNumber': 'JC-7',
          'vehicleRegistration': 'KA05MN1111',
          'vehicleModel': 'Swift',
          'customerName': 'Arun',
          'customerPhone': '9840000001',
          'vendorName': 'Paint Works',
          'serviceName': 'Respray',
          'sentAt': '2026-10-05T10:00:00',
          'expectedReturnAt': '2026-10-06T10:00:00',
          'isOverdue': true,
          'overdueHours': 5.5,
          'vendorCost': 3000,
        },
      ],
      'history': [
        {
          'id': '2',
          'jobCardNumber': 'JC-3',
          'vehicleRegistration': 'TN09ZZ0001',
          'customerName': 'Meera',
          'vendorName': 'Paint Works',
          'serviceName': 'Respray',
          'status': 1,
          'statusName': 'Returned',
          'sentAt': '2026-10-01T10:00:00',
          'returnedAt': '2026-10-02T12:30:00',
          'expectedReturnAt': '2026-10-02T10:00:00',
          'durationHours': 26.5,
          'vendorCost': 2000,
        },
      ],
      'vendorSummary': [
        {
          'vendorId': 'v1',
          'vendorName': 'Paint Works',
          'totalJobs': 4,
          'completedJobs': 3,
          'currentlyOutside': 1,
          'overdueJobs': 1,
          'cancelledJobs': 0,
          'totalVendorCost': 5000,
        },
      ],
      'totalOutsideCount': 1,
      'totalOverdueCount': 1,
      'totalActiveCost': 3000,
      'totalHistoricalCost': 2000,
    });

    test('has the four sheets and a dated file name', () {
      final file = OutsideJobsExcel.build(
        report,
        scopeLabel: 'This Month',
        companyName: 'Sunrise',
        now: DateTime(2026, 10, 11),
      );
      expect(
        file.fileName,
        'Sunrise_Outside_Jobs_Report_This_Month_2026-10-11.xlsx',
      );
      expect(open(file).sheets.keys.toList(), [
        'Executive Summary',
        'Currently Outside',
        'Movement History',
        'Vendor Analysis',
      ]);
    });

    test('the sheets carry the jobs, the history and the vendor rates', () {
      final book = open(OutsideJobsExcel.build(report));

      expect(
        everything(book, 'Currently Outside'),
        containsAll(['JC-7', 'Overdue', 'Paint Works', '5.5']),
      );
      expect(
        everything(book, 'Movement History'),
        containsAll(['JC-3', 'Returned', '26h 30m']),
      );
      // 3 of 4 jobs completed, and the one vendor takes all of the cost.
      expect(everything(book, 'Vendor Analysis'), containsAll(['75', '100']));
      expect(everything(book, 'Executive Summary'), contains('Returned'));
    });
  });

  group('Staff advances workbook', () {
    StaffAdvanceReportRowModel row(
      String id,
      String staff,
      String status,
      double amount,
      String date,
    ) => StaffAdvanceReportRowModel.fromJson({
      'id': id,
      'staffId': staff,
      'staffName': staff == 's1' ? 'Ravi Kumar' : 'Anita Devi',
      'staffRole': 'Detailer',
      'advanceDate': date,
      'amount': amount,
      'reason': 'Festival',
      'status': status,
    });

    test('has a summary and a sheet for each staff member', () {
      final file = StaffAdvancesExcel.build(
        [
          row('a', 's1', 'Outstanding', 1000, '2026-10-02'),
          row('b', 's1', 'Settled', 500, '2026-10-01'),
          row('c', 's2', 'Outstanding', 2000, '2026-10-03'),
        ],
        from: DateTime(2026, 10, 1),
        to: DateTime(2026, 10, 31),
        companyName: 'Sunrise',
      );
      final book = open(file);

      expect(
        file.fileName,
        'Sunrise_Staff_Advances_Report_2026-10-01_to_2026-10-31.xlsx',
      );
      expect(book.sheets.keys.toList(), [
        'Staff Summary',
        'Anita Devi',
        'Ravi Kumar',
      ]);

      final summary = everything(book, 'Staff Summary');
      expect(
        summary,
        containsAll(['Ravi Kumar', 'Anita Devi', '3500', '3000', '500']),
      );
      expect(
        everything(book, 'Ravi Kumar'),
        containsAll(['Festival', 'Settled', 'Outstanding', '1500']),
      );
    });

    test('with no advances it is still a valid workbook', () {
      final file = StaffAdvancesExcel.build(
        const [],
        from: DateTime(2026, 10, 1),
        to: DateTime(2026, 10, 31),
      );
      expect(open(file).sheets.keys.toList(), ['Staff Summary']);
    });
  });

  group('Showroom workbook', () {
    Map<String, dynamic> showroom(String id, String name) => {
      'showroomId': id,
      'showroomMasterId': 'SR-$id',
      'showroomName': name,
      'showroomAddress': 'Main Road',
      'summary': {
        'totalVehiclesServiced': 20,
        'totalBilledAmount': 9000,
        'totalCollectedAmount': 6000,
      },
      'vehicleWorks': <dynamic>[],
      'attendanceRecords': <dynamic>[],
      'swaps': <dynamic>[],
      'vehicleTypeSummary': [
        {
          'vehicleTypeName': 'Hatchback',
          'totalVehicles': 12,
          'totalServices': 20,
          'totalStaffHours': 18,
          'sharePercentage': 60,
        },
      ],
      'serviceSummary': [
        {
          'serviceCategory': 'Wash',
          'serviceName': 'Foam wash',
          'totalVehicles': 12,
          'totalQuantity': 12,
          'totalStaffHours': 8,
          'sharePercentage': 50,
        },
      ],
      'staffSummary': [
        {
          'staffName': 'Ravi Kumar',
          'staffMasterId': 'S1',
          'totalVehicles': 9,
          'totalServices': 14,
          'totalHours': 20,
          'attendanceDays': 5,
          'workloadSharePercent': 45,
        },
      ],
    };

    MonthlyShowroomReportResponseModel report(
      List<Map<String, dynamic>> showrooms,
    ) => MonthlyShowroomReportResponseModel.fromJson({
      'year': 2026,
      'month': 10,
      'monthName': 'October 2026',
      'fromDate': '2026-10-01',
      'toDate': '2026-10-31',
      'showrooms': showrooms,
    });

    test('each showroom gets its own workbook with seven sheets', () {
      final files = ShowroomExcel.build(
        report([showroom('1', 'Prime Motors'), showroom('2', 'City Cars')]),
        companyName: 'Sunrise',
      );

      expect(files.map((f) => f.fileName), [
        'Sunrise_Prime_Motors_Report_October_2026.xlsx',
        'Sunrise_City_Cars_Report_October_2026.xlsx',
      ]);
      expect(open(files.first).sheets.keys.toList(), [
        'Summary',
        'Vehicle Service Details',
        'Staff Productivity',
        'Attendance',
        'Staff Swaps',
        'Vehicle Type Summary',
        'Service Summary',
      ]);
    });

    test('the summary and breakdown sheets show the showroom figures', () {
      final book = open(
        ShowroomExcel.build(report([showroom('1', 'Prime Motors')])).single,
      );

      expect(
        everything(book, 'Summary'),
        containsAll(['Prime Motors', 'Main Road', '9000', '6000', '20']),
      );
      expect(
        everything(book, 'Staff Productivity'),
        containsAll(['Ravi Kumar', '45']),
      );
      expect(
        everything(book, 'Vehicle Type Summary'),
        containsAll(['Hatchback', '60']),
      );
      expect(
        everything(book, 'Service Summary'),
        containsAll(['Foam wash', 'Wash']),
      );
    });

    test('no showrooms still gives a file that says so', () {
      final files = ShowroomExcel.build(report([]));
      expect(files, hasLength(1));
      expect(
        everything(open(files.single), 'No Data'),
        contains('No showroom data available for export.'),
      );
    });
  });
}
