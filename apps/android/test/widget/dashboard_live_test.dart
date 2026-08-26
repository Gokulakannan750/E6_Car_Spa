import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/dashboard/presentation/pages/dashboard_screen.dart';
import 'package:e6_car_spa/features/dashboard/providers/dashboard_providers.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/reports/models/report_dashboard_model.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final sampleSummary = DashboardSummaryModel(
    dateRange: DateRangeModel(fromDate: DateTime(2026, 8, 1), toDate: DateTime(2026, 8, 31)),
    sales: const DashboardSalesModel(
      grossSubtotal: 125000.0,
      totalDiscount: 5000.0,
      gstAmount: 21600.0,
      netSales: 141600.0,
      paymentCollection: 110000.0,
      outstanding: 31600.0,
    ),
    paymentCollection: const DashboardPaymentCollectionModel(
      totalReceived: 110000.0,
      transactionCount: 45,
      breakdownByMethod: [],
    ),
    jobCardKpis: const JobCardKpisModel(
      totalJobCards: 50,
      newJobCards: 5,
      inProgressJobCards: 8,
      completedJobCards: 35,
      cancelledJobCards: 2,
      invoicedJobCards: 30,
    ),
    vehicleActivity: const VehicleActivityModel(
      vehiclesServiced: 48,
      totalServicesCompleted: 120,
      uniqueVehiclesServiced: 42,
    ),
    invoiceKpis: const InvoiceKpisModel(
      draftCount: 2,
      generatedCount: 20,
      partiallyPaidCount: 5,
      paidCount: 15,
      cancelledCount: 1,
      totalInvoicedAmount: 141600.0,
      totalPaidAmount: 110000.0,
      totalOutstandingAmount: 31600.0,
    ),
    showroom: const DashboardShowroomModel(
      activeShowroomsCount: 2,
      staffAssignmentsCount: 10,
      vehiclesAttended: 25,
      totalBilled: 50000.0,
      totalReceived: 40000.0,
      totalOutstanding: 10000.0,
      paidDaysCount: 15,
      partiallyPaidDaysCount: 3,
      unpaidDaysCount: 2,
    ),
    staffAdvances: const DashboardStaffAdvanceModel(
      outstandingCount: 3,
      outstandingAmount: 15000.0,
      settledCount: 12,
      settledAmount: 60000.0,
      obsoleteCount: 1,
    ),
    outstanding: const DashboardOutstandingModel(
      invoiceOutstanding: 31600.0,
      showroomOutstanding: 10000.0,
      staffAdvanceOutstanding: 15000.0,
      totalOutstandingCombined: 56600.0,
    ),
    recentActivity: const [],
  );

  final sampleRecentJobs = JobCardListResponse(
    items: [
      JobCardListItem(
        id: 'jc-1',
        jobCardNumber: 'JC-2026-0001',
        customerName: 'Alice Smith',
        customerPhone: '9876543210',
        registrationNumber: 'TN01AA1111',
        status: JobCardStatus.inProgress,
        totalAmount: 3500.0,
        createdAt: DateTime(2026, 8, 26, 11, 0),
      ),
    ],
    totalCount: 1,
    page: 1,
    pageSize: 5,
  );

  testWidgets('DashboardScreen displays live backend KPIs and recent jobs', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authNotifierProvider.overrideWith((ref) => _FakeAuthNotifier()),
          dashboardSummaryProvider.overrideWith((ref) => sampleSummary),
          dashboardRecentJobsProvider.overrideWith((ref) => sampleRecentJobs),
        ],
        child: const MaterialApp(
          home: DashboardScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify Title & Greeting
    expect(find.text('Dashboard'), findsOneWidget);
    expect(find.text('Welcome, Admin User'), findsOneWidget);

    // Verify 4 Authoritative KPIs
    expect(find.text('Total Customers'), findsOneWidget);
    expect(find.text('42'), findsOneWidget); // uniqueVehiclesServiced

    expect(find.text('Active Jobs'), findsOneWidget);
    expect(find.text('13'), findsOneWidget); // 8 inProgress + 5 new

    expect(find.text('Revenue (MTD)'), findsOneWidget);
    expect(find.text('₹125000.00'), findsOneWidget); // grossSubtotal

    expect(find.text('Completed'), findsWidgets);
    expect(find.text('35'), findsWidgets); // completedJobCards

    // Verify Financial Overview
    expect(find.text('Financial Overview'), findsOneWidget);
    expect(find.text('₹110000.00'), findsOneWidget); // Collections (MTD)
    expect(find.text('₹56600.00'), findsOneWidget); // Total Outstanding Combined

    // Verify Status Breakdown
    expect(find.text('Job Status Distribution'), findsOneWidget);
    expect(find.text('In Progress'), findsOneWidget);
    expect(find.text('8'), findsOneWidget);

    // Scroll to reveal recent jobs section
    await tester.drag(find.byType(ListView), const Offset(0, -350));
    await tester.pumpAndSettle();

    // Verify Recent Jobs item
    expect(find.text('Recent Job Cards'), findsOneWidget);
    expect(find.text('JC-2026-0001'), findsOneWidget);
    expect(find.text('Alice Smith · TN01AA1111'), findsOneWidget);
    expect(find.text('₹3500.00'), findsOneWidget);
  });
}

class _FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  _FakeAuthNotifier()
      : super(
          const Authenticated(
            AuthUser(
              id: 'user-admin',
              username: 'admin',
              fullName: 'Admin User',
              role: 'Owner',
              permissions: ['*'],
              isOwner: true,
            ),
          ),
        );

  @override
  void clearError() {}

  @override
  Future<void> restoreSession() async {}

  @override
  Future<bool> login(String username, String password) async => true;

  @override
  Future<void> logout() async {}
}
