import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/reports/models/report_dashboard_model.dart';
import 'package:e6_car_spa/features/reports/presentation/pages/reports_screen.dart';
import 'package:e6_car_spa/features/reports/presentation/widgets/report_kpi_card.dart';
import 'package:e6_car_spa/features/reports/presentation/widgets/revenue_chart.dart';
import 'package:e6_car_spa/features/reports/presentation/widgets/job_status_chart.dart';
import 'package:e6_car_spa/features/reports/providers/reports_provider.dart';

void main() {
  final testDashboard = DashboardSummaryModel(
    dateRange: DateRangeModel(
      fromDate: DateTime(2026, 8, 1),
      toDate: DateTime(2026, 8, 26),
    ),
    jobCardKpis: const JobCardKpisModel(
      totalJobCards: 20,
      newJobCards: 2,
      inProgressJobCards: 4,
      completedJobCards: 14,
      cancelledJobCards: 0,
      invoicedJobCards: 14,
    ),
    vehicleActivity: const VehicleActivityModel(
      vehiclesServiced: 14,
      totalServicesCompleted: 28,
      uniqueVehiclesServiced: 12,
    ),
    invoiceKpis: const InvoiceKpisModel(
      draftCount: 0,
      generatedCount: 2,
      partiallyPaidCount: 2,
      paidCount: 10,
      cancelledCount: 0,
      totalInvoicedAmount: 50000.0,
      totalPaidAmount: 40000.0,
      totalOutstandingAmount: 10000.0,
    ),
    sales: const DashboardSalesModel(
      grossSubtotal: 45000.0,
      totalDiscount: 2000.0,
      gstAmount: 7000.0,
      netSales: 50000.0,
      paymentCollection: 40000.0,
      outstanding: 10000.0,
    ),
    paymentCollection: const DashboardPaymentCollectionModel(
      totalReceived: 40000.0,
      transactionCount: 10,
      breakdownByMethod: [
        PaymentMethodBreakdownModel(method: 'Cash', transactionCount: 4, amount: 15000.0),
        PaymentMethodBreakdownModel(method: 'UPI', transactionCount: 6, amount: 25000.0),
      ],
    ),
    showroom: const DashboardShowroomModel(
      activeShowroomsCount: 1,
      staffAssignmentsCount: 8,
      vehiclesAttended: 32,
      totalBilled: 20000.0,
      totalReceived: 20000.0,
      totalOutstanding: 0.0,
      paidDaysCount: 4,
      partiallyPaidDaysCount: 0,
      unpaidDaysCount: 0,
    ),
    staffAdvances: const DashboardStaffAdvanceModel(
      outstandingCount: 1,
      outstandingAmount: 2500.0,
      settledCount: 2,
      settledAmount: 5000.0,
      obsoleteCount: 0,
    ),
    outstanding: const DashboardOutstandingModel(
      invoiceOutstanding: 10000.0,
      showroomOutstanding: 0.0,
      staffAdvanceOutstanding: 2500.0,
      totalOutstandingCombined: 12500.0,
    ),
    recentActivity: [
      RecentActivityItemModel(
        activityType: 'Payment',
        title: 'UPI Payment Received',
        description: 'Received for INV-001',
        amount: 5000.0,
        timestamp: DateTime(2026, 8, 25, 12, 0),
      ),
    ],
  );

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

  group('Reports Widgets & Dashboard Screen Tests', () {
    testWidgets('ReportKpiCard renders formatted currency and title', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReportKpiCard(
              title: 'Billed Revenue',
              amountValue: 50000.0,
              subtitle: '14 finalized invoices',
              icon: Icons.receipt_long,
              accentColor: Colors.blue,
            ),
          ),
        ),
      );

      expect(find.text('BILLED REVENUE'), findsOneWidget);
      expect(find.text('₹50,000.00'), findsOneWidget);
      expect(find.text('14 finalized invoices'), findsOneWidget);
    });

    testWidgets('RevenueChart renders net sales and collections comparison', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: RevenueChart(
                sales: testDashboard.sales,
                paymentCollection: testDashboard.paymentCollection,
              ),
            ),
          ),
        ),
      );

      expect(find.text('Revenue vs. Collections'), findsOneWidget);
      expect(find.text('Net Billed Sales'), findsOneWidget);
      expect(find.text('Collections Received'), findsOneWidget);
      expect(find.text('₹50,000.00'), findsOneWidget);
      expect(find.text('₹40,000.00'), findsOneWidget);
    });

    testWidgets('JobStatusChart renders status breakdown progress bars', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: JobStatusChart(
                jobCardKpis: testDashboard.jobCardKpis,
              ),
            ),
          ),
        ),
      );

      expect(find.text('Job Cards Distribution'), findsOneWidget);
      expect(find.text('20 Total'), findsOneWidget);
      expect(find.text('Completed / Delivered'), findsOneWidget);
    });

    testWidgets('ReportsScreen renders full dashboard when user has permissions', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(testUser),
            reportsDashboardProvider.overrideWith((ref) => Future.value(testDashboard)),
          ],
          child: const MaterialApp(
            home: ReportsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Reports & Analytics'), findsOneWidget);
      expect(find.text('BILLED REVENUE'), findsOneWidget);
      expect(find.text('COLLECTIONS'), findsOneWidget);
      expect(find.text('OUTSTANDING'), findsOneWidget);
      expect(find.text('JOB CARDS'), findsOneWidget);
      expect(find.text('Detailed Analytical Reports'), findsOneWidget);
      expect(find.text('Sales Report'), findsOneWidget);
      expect(find.text('GST Summary'), findsOneWidget);
      expect(find.text('Staff Advances'), findsWidgets);
    });
  });
}
