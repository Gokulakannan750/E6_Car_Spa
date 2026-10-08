import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/reports/models/monthly_billing_report_model.dart';
import 'package:e6_car_spa/features/reports/models/outside_job_report_model.dart';
import 'package:e6_car_spa/features/reports/presentation/pages/billing_report_screen.dart';
import 'package:e6_car_spa/features/reports/presentation/pages/outside_jobs_report_screen.dart';
import 'package:e6_car_spa/features/reports/providers/reports_provider.dart';

void main() {
  const testUser = AuthUser(
    id: 'usr-1',
    fullName: 'Owner User',
    username: 'owner',
    role: 'Owner',
    isOwner: true,
    permissions: [
      'reports.view',
      'reports.sales',
      'reports.payments',
      'reports.invoices',
      'reports.gst',
      'reports.job_cards',
      'reports.showrooms',
      'reports.staff_productivity',
      'reports.staff_advances',
    ],
  );

  final testMonthlyBillingReport = MonthlyBillingReportResponseModel(
    year: 2026,
    month: 8,
    monthName: 'August 2026',
    fromDate: '2026-08-01',
    toDate: '2026-08-31',
    daysInMonth: 31,
    summary: const MonthlyBillingSummaryModel(
      monthName: 'August 2026',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      generatedAt: '2026-08-31T23:59:59Z',
      totalJobCardsCreated: 45,
      totalJobCardsFinished: 42,
      totalInvoices: 40,
      totalInvoicesPaid: 35,
      totalInvoicesPendingPayment: 5,
      totalInvoicesDraft: 2,
      totalInvoicesCancelled: 1,
      totalInvoiceAmount: 150000.0,
      totalAmountPaid: 135000.0,
      totalAmountPending: 15000.0,
      totalServicesPerformed: 90,
      totalServiceQuantity: 95,
    ),
    dailySheets: [
      DailyBillingSheetModel(
        day: 1,
        date: '2026-08-01',
        dateFormatted: '01 Aug 2026',
        sheetName: 'Day 01',
        hasActivity: true,
        totals: const DailyTotalsModel(
          invoiceTotal: 15000.0,
          amountPaid: 15000.0,
          amountPending: 0.0,
          jobCardCount: 4,
          invoiceCount: 4,
          serviceCount: 8,
          serviceTotalQuantity: 8,
        ),
        jobCards: [
          DailyJobCardRowModel(
            jobCardId: 'jc-1',
            jobCardNumber: 'JC-1001',
            jobCardDate: DateTime(2026, 8, 1),
            customerName: 'Rahul Verma',
            vehicleRegistration: 'TN 01 AB 1234',
            vehicle: 'Honda City',
            jobCardStatus: 'Completed',
            totalServices: 2,
            jobCardTotal: 4500.0,
          ),
        ],
        invoices: [
          DailyInvoiceRowModel(
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-2026-001',
            invoiceDate: DateTime(2026, 8, 1),
            jobCardNumber: 'JC-1001',
            customerName: 'Rahul Verma',
            vehicleRegistration: 'TN 01 AB 1234',
            invoiceStatus: 'Paid',
            invoiceTotal: 4500.0,
            amountPaid: 4500.0,
            amountPending: 0.0,
          ),
        ],
        services: const [],
      ),
    ],
  );

  final testOutsideJobsReport = OutsideJobReportResponseModel(
    currentlyOutside: [
      CurrentlyOutsideJobModel(
        id: 'out-1',
        jobCardId: 'jc-201',
        jobCardNumber: 'JC-201',
        vehicleId: 'veh-1',
        vehicleRegistration: 'TN 09 XY 9999',
        vehicleModel: 'BMW 3 Series',
        customerId: 'cust-1',
        customerName: 'Vikram Seth',
        customerPhone: '9876543210',
        vendorId: 'v-1',
        vendorName: 'Apex Tinkering',
        vendorPhone: '9123456780',
        serviceName: 'Dent Removal',
        sentAt: DateTime(2026, 8, 20, 10, 0),
        expectedReturnAt: DateTime(2026, 8, 20, 18, 0),
        isOverdue: true,
        overdueHours: 12.5,
        vendorCost: 3500.0,
        notes: 'Door dent repair',
      ),
    ],
    history: [
      OutsideJobHistoryReportModel(
        id: 'hist-1',
        jobCardId: 'jc-199',
        jobCardNumber: 'JC-199',
        vehicleId: 'veh-2',
        vehicleRegistration: 'TN 02 BB 5555',
        vehicleModel: 'Hyundai Creta',
        customerId: 'cust-2',
        customerName: 'Anitha Raj',
        customerPhone: '9888877777',
        vendorId: 'v-2',
        vendorName: 'Glass Fix Solutions',
        serviceName: 'Windshield Replacement',
        status: 2,
        statusName: 'Returned',
        sentAt: DateTime(2026, 8, 18, 9, 0),
        returnedAt: DateTime(2026, 8, 18, 15, 0),
        expectedReturnAt: DateTime(2026, 8, 18, 16, 0),
        durationHours: 6.0,
        vendorCost: 8000.0,
      ),
    ],
    vendorSummary: const [
      OutsideJobVendorSummaryModel(
        vendorId: 'v-1',
        vendorName: 'Apex Tinkering',
        phone: '9123456780',
        totalJobs: 5,
        completedJobs: 4,
        currentlyOutside: 1,
        overdueJobs: 1,
        cancelledJobs: 0,
        totalVendorCost: 17500.0,
      ),
    ],
    totalOutsideCount: 1,
    totalOverdueCount: 1,
    totalActiveCost: 3500.0,
    totalHistoricalCost: 8000.0,
  );

  group('BillingReportScreen Tests', () {
    testWidgets('Renders Monthly Billing KPIs and Daily Sheets', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(testUser),
            monthlyBillingReportProvider.overrideWith(
              (ref) => Future.value(testMonthlyBillingReport),
            ),
          ],
          child: const MaterialApp(home: BillingReportScreen()),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Monthly Billing Report'), findsOneWidget);
      expect(find.text('TOTAL INVOICED'), findsOneWidget);
      expect(find.text('₹1,50,000.00'), findsOneWidget);
      expect(find.text('TOTAL PAID'), findsOneWidget);
      expect(find.text('₹1,35,000.00'), findsOneWidget);
      expect(find.text('RECEIVABLES'), findsOneWidget);
      expect(find.text('₹15,000.00'), findsOneWidget);
      expect(find.text('Invoice Status Breakdown'), findsOneWidget);
      expect(find.text('Fully Paid Invoices'), findsOneWidget);
      expect(find.text('35 invoices'), findsOneWidget);
      expect(find.text('01 Aug 2026'), findsOneWidget);
    });
  });

  group('OutsideJobsReportScreen Tests', () {
    testWidgets('Renders Outside Jobs KPIs and Currently Outside Tab', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(testUser),
            outsideJobsReportProvider.overrideWith(
              (ref) => Future.value(testOutsideJobsReport),
            ),
          ],
          child: const MaterialApp(home: OutsideJobsReportScreen()),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Outside Jobs & Movements'), findsOneWidget);
      expect(find.text('TOTAL MOVEMENTS'), findsOneWidget);
      expect(find.text('CURRENTLY OUTSIDE'), findsOneWidget);
      expect(find.text('OVERDUE OUTSIDE'), findsOneWidget);
      expect(find.text('RETURNED'), findsOneWidget);
      expect(find.text('TN 09 XY 9999'), findsOneWidget);
      expect(find.text('OVERDUE'), findsOneWidget);
      expect(find.text('Vendor: Apex Tinkering'), findsOneWidget);
    });
  });
}
