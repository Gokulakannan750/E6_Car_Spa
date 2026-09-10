import 'dart:async';
import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/customers/presentation/widgets/add_customer_dialog.dart';
import 'package:e6_car_spa/features/dashboard/presentation/pages/dashboard_screen.dart';
import 'package:e6_car_spa/features/dashboard/providers/dashboard_providers.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/reports/models/report_dashboard_model.dart';
import 'package:e6_car_spa/shared/widgets/app_error_state.dart';
import 'package:e6_car_spa/shared/widgets/app_loading_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  _FakeAuthNotifier()
      : super(
          const Authenticated(
            AuthUser(
              id: 'user-1',
              username: 'owner',
              fullName: 'E6 Owner',
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

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

DashboardSummaryModel _createSampleSummary({
  int uniqueVehicles = 15,
  int newJobs = 2,
  int inProgressJobs = 4,
  int completedJobs = 8,
  double grossSubtotal = 45000.0,
}) {
  return DashboardSummaryModel(
    dateRange: DateRangeModel(fromDate: DateTime(2026, 9, 1), toDate: DateTime(2026, 9, 9)),
    sales: DashboardSalesModel(
      grossSubtotal: grossSubtotal,
      totalDiscount: 0.0,
      gstAmount: 8100.0,
      netSales: grossSubtotal + 8100.0,
      paymentCollection: 40000.0,
      outstanding: 5000.0,
    ),
    paymentCollection: const DashboardPaymentCollectionModel(
      totalReceived: 40000.0,
      transactionCount: 10,
      breakdownByMethod: [],
    ),
    jobCardKpis: JobCardKpisModel(
      totalJobCards: newJobs + inProgressJobs + completedJobs,
      newJobCards: newJobs,
      inProgressJobCards: inProgressJobs,
      completedJobCards: completedJobs,
      cancelledJobCards: 0,
      invoicedJobCards: completedJobs,
    ),
    vehicleActivity: VehicleActivityModel(
      vehiclesServiced: uniqueVehicles,
      totalServicesCompleted: uniqueVehicles * 2,
      uniqueVehiclesServiced: uniqueVehicles,
    ),
    invoiceKpis: const InvoiceKpisModel(
      draftCount: 0,
      generatedCount: 8,
      partiallyPaidCount: 1,
      paidCount: 7,
      cancelledCount: 0,
      totalInvoicedAmount: 45000.0,
      totalPaidAmount: 40000.0,
      totalOutstandingAmount: 5000.0,
    ),
    showroom: const DashboardShowroomModel(
      activeShowroomsCount: 1,
      staffAssignmentsCount: 2,
      vehiclesAttended: 5,
      totalBilled: 10000.0,
      totalReceived: 8000.0,
      totalOutstanding: 2000.0,
      paidDaysCount: 3,
      partiallyPaidDaysCount: 1,
      unpaidDaysCount: 0,
    ),
    staffAdvances: const DashboardStaffAdvanceModel(
      outstandingCount: 1,
      outstandingAmount: 2000.0,
      settledCount: 3,
      settledAmount: 6000.0,
      obsoleteCount: 0,
    ),
    outstanding: const DashboardOutstandingModel(
      invoiceOutstanding: 5000.0,
      showroomOutstanding: 2000.0,
      staffAdvanceOutstanding: 2000.0,
      totalOutstandingCombined: 9000.0,
    ),
    recentActivity: const [],
  );
}

Widget _buildTestApp({
  required List<Override> overrides,
  GoRouter? customRouter,
}) {
  final router = customRouter ??
      GoRouter(
        initialLocation: AppRoutes.dashboard,
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: AppRoutes.newJobCard,
            builder: (context, state) => const Scaffold(body: Text('New Job Card Destination')),
          ),
          GoRoute(
            path: AppRoutes.customers,
            builder: (context, state) => const Scaffold(body: Text('Customers Destination')),
          ),
          GoRoute(
            path: AppRoutes.jobCards,
            builder: (context, state) => const Scaffold(body: Text('Job Cards Destination')),
          ),
          GoRoute(
            path: AppRoutes.quotationsInvoices,
            builder: (context, state) => const Scaffold(body: Text('Invoices Destination')),
          ),
          GoRoute(
            path: '/job-cards/:id',
            builder: (context, state) => Scaffold(
              body: Text('Job Card Details Destination ${state.pathParameters['id']}'),
            ),
          ),
        ],
      );

  return ProviderScope(
    overrides: [
      authNotifierProvider.overrideWith((ref) => _FakeAuthNotifier()),
      ...overrides,
    ],
    child: MaterialApp.router(
      routerConfig: router,
    ),
  );
}

void main() {
  group('DashboardScreen Operations & Observable Behavior', () {
    testWidgets('Renders AppLoadingState while dashboard summary is loading', (tester) async {
      final completer = Completer<DashboardSummaryModel>();

      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => completer.future),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => Future.value(JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5)),
            ),
          ],
        ),
      );

      await tester.pump();

      expect(find.byType(AppLoadingState), findsOneWidget);
      expect(find.text('Loading live business dashboard...'), findsOneWidget);
    });

    testWidgets('Renders AppErrorState when dashboard summary API fails and handles retry', (tester) async {
      int summaryCalls = 0;

      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) {
              summaryCalls++;
              if (summaryCalls == 1) {
                return Future.error('Server 500: Database unavailable');
              }
              return Future.value(_createSampleSummary());
            }),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => Future.value(JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5)),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(AppErrorState), findsOneWidget);
      expect(find.textContaining('Failed to load live dashboard data: Server 500: Database unavailable'), findsOneWidget);

      // Tap 'Try Again' button
      expect(find.text('Try Again'), findsOneWidget);
      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();

      // Upon retry, summary reloads successfully
      expect(find.byType(AppErrorState), findsNothing);
      expect(find.text('Total Customers'), findsOneWidget);
      expect(summaryCalls, 2);
    });

    testWidgets('Displays fallback empty state subtitles when KPI counts are zero', (tester) async {
      final zeroSummary = _createSampleSummary(
        uniqueVehicles: 0,
        newJobs: 0,
        inProgressJobs: 0,
        completedJobs: 0,
        grossSubtotal: 0.0,
      );

      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => zeroSummary),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No customers yet'), findsOneWidget);
      expect(find.text('No active jobs'), findsOneWidget);
      expect(find.text('0 delivered'), findsOneWidget);
    });

    testWidgets('Renders empty state when recent jobs list is empty', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView), const Offset(0, -350));
      await tester.pumpAndSettle();

      expect(find.text('Recent Job Cards'), findsOneWidget);
      expect(find.text('No recent job cards found.'), findsOneWidget);
    });

    testWidgets('Renders error banner when recent jobs query fails', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => Future.error('Connection timed out'),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView), const Offset(0, -350));
      await tester.pumpAndSettle();

      expect(find.textContaining('Could not load recent jobs: Connection timed out'), findsOneWidget);
    });

    testWidgets('+ New Job Card button navigates to AppRoutes.newJobCard', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      final newJobBtn = find.byKey(const Key('dashboard_new_job_card_button'));
      expect(newJobBtn, findsOneWidget);
      await tester.tap(newJobBtn);
      await tester.pumpAndSettle();

      expect(find.text('New Job Card Destination'), findsOneWidget);
    });

    testWidgets('+ Add Customer button opens AddCustomerDialog', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      final addCustomerBtn = find.byKey(const Key('dashboard_add_customer_button'));
      expect(addCustomerBtn, findsOneWidget);
      await tester.tap(addCustomerBtn);
      await tester.pumpAndSettle();

      expect(find.byType(AddCustomerDialog), findsOneWidget);
    });

    testWidgets('Tapping Total Customers KPI card navigates to AppRoutes.customers', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.text('Total Customers'));
      await tester.pumpAndSettle();

      expect(find.text('Customers Destination'), findsOneWidget);
    });

    testWidgets('Tapping Active Jobs KPI card navigates to AppRoutes.jobCards', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.text('Active Jobs'));
      await tester.pumpAndSettle();

      expect(find.text('Job Cards Destination'), findsOneWidget);
    });

    testWidgets('Tapping Revenue (MTD) KPI card navigates to AppRoutes.quotationsInvoices', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.text('Revenue (MTD)'));
      await tester.pumpAndSettle();

      expect(find.text('Invoices Destination'), findsOneWidget);
    });

    testWidgets('Tapping View All on recent jobs navigates to AppRoutes.jobCards', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView), const Offset(0, -350));
      await tester.pumpAndSettle();

      final viewAllBtn = find.byKey(const Key('dashboard_view_all_jobs_button'));
      expect(viewAllBtn, findsOneWidget);
      await tester.tap(viewAllBtn);
      await tester.pumpAndSettle();

      expect(find.text('Job Cards Destination'), findsOneWidget);
    });

    testWidgets('Tapping an individual recent job card tile navigates to details', (tester) async {
      final sampleJob = JobCardListItem(
        id: 'jc-42',
        jobCardNumber: 'JC-2026-0042',
        customerName: 'Kavitha R',
        customerPhone: '9840012345',
        registrationNumber: 'TN33AZ9999',
        status: JobCardStatus.inProgress,
        totalAmount: 1800.0,
        createdAt: DateTime(2026, 9, 8, 14, 30),
      );

      await tester.pumpWidget(
        _buildTestApp(
          overrides: [
            dashboardSummaryProvider.overrideWith((ref) => _createSampleSummary()),
            dashboardRecentJobsProvider.overrideWith(
              (ref) => JobCardListResponse(items: [sampleJob], totalCount: 1, page: 1, pageSize: 5),
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView), const Offset(0, -350));
      await tester.pumpAndSettle();

      expect(find.text('JC-2026-0042'), findsOneWidget);
      await tester.tap(find.text('JC-2026-0042'));
      await tester.pumpAndSettle();

      expect(find.text('Job Card Details Destination jc-42'), findsOneWidget);
    });
  });
}
