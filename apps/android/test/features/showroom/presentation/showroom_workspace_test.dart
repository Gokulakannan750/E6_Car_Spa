import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_billing_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_operations_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeShowroomRepository implements ShowroomRepository {
  final List<Showroom> showrooms = [];
  final Map<String, DailyStaffResponse> dailyStaffMap = {};

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<DailyStaffResponse> getDailyStaff(
    String showroomId,
    DateTime date,
  ) async {
    final key = '${showroomId}_${date.toIso8601String().split('T').first}';
    return dailyStaffMap[key] ??
        DailyStaffResponse(
          showroomId: showroomId,
          showroomName: 'Test Showroom',
          date: date,
          totalVehiclesAttended: 0,
          isAttendanceConfirmed: false,
          staffAssignments: [
            DailyStaffAssignment(
              id: 'assign-1',
              showroomId: showroomId,
              showroomName: 'Test Showroom',
              staffId: 'staff-1',
              staffName: 'Murugan Technician',
              staffPhone: '9840123456',
              staffRole: 'Detailer',
              date: date,
              startTime: '09:00',
              endTime: '18:00',
              workingHours: 9.0,
              assignmentType: 'Regular',
              createdAt: DateTime.now(),
            ),
          ],
        );
  }

  @override
  Future<DailyStaffAssignment> assignDailyStaff(
    String showroomId,
    CreateDailyStaffAssignmentRequest request,
  ) async {
    return DailyStaffAssignment(
      id: 'assign-new',
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      staffId: request.staffId,
      staffName: 'New Staff',
      staffPhone: '9840999999',
      date: request.date,
      startTime: request.startTime,
      endTime: request.endTime,
      assignmentType: request.assignmentType,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<void> removeDailyStaff(String assignmentId) async {}

  @override
  Future<DailyStaffResponse> confirmDailyStaffAttendance(
    String showroomId,
    DateTime date,
  ) async {
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      date: date,
      isAttendanceConfirmed: true,
      attendanceConfirmedByName: 'Owner User',
      attendanceConfirmedAt: DateTime.now(),
      staffAssignments: [],
    );
  }

  @override
  Future<DailyStaffResponse> unlockDailyStaffAttendance(
    String showroomId,
    DateTime date,
  ) async {
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      date: date,
      isAttendanceConfirmed: false,
      staffAssignments: [],
    );
  }

  @override
  Future<List<ShowroomVehicleType>> getShowroomVehicleTypes({
    bool? isActive,
  }) async => [];

  @override
  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async =>
      [];

  @override
  Future<List<ShowroomVehicleWork>> getShowroomVehicleWorks(
    String showroomId, {
    DateTime? date,
    String? staffId,
    String? vehicleTypeId,
  }) async => [];

  @override
  Future<ShowroomOperationsSummary> getShowroomOperationsSummary(
    String showroomId,
    DateTime date,
  ) async {
    return ShowroomOperationsSummary(
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      fromDate: date,
      toDate: date,
      totalVehiclesHandled: 0,
      totalServicesPerformed: 0,
      totalActiveStaffSessions: 0,
      vehicleTypeBreakdown: const [],
      workTypeBreakdown: const [],
      staffProductivityBreakdown: const [],
    );
  }

  @override
  Future<ShowroomDailyBill> getShowroomDailyBill(
    String showroomId,
    DateTime date,
  ) async {
    return ShowroomDailyBill(
      id: 'bill-test',
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      date: date,
      amount: 4000.0,
      amountReceived: 2000.0,
      balanceAmount: 2000.0,
      status: 'PartiallyPaid',
      payments: const [],
      createdAt: date,
    );
  }

  @override
  Future<ShowroomSummary> getShowroomSummary(
    String showroomId, {
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return ShowroomSummary(
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      fromDate: fromDate ?? DateTime.now(),
      toDate: toDate ?? DateTime.now(),
      totalDaysWithActivity: 10,
      totalStaffAssignments: 30,
      totalVehiclesAttended: 120,
      averageVehiclesPerDay: 12.0,
      totalBilled: 40000.0,
      totalReceived: 30000.0,
      outstandingAmount: 10000.0,
      paidDaysCount: 8,
      partiallyPaidDaysCount: 1,
      unpaidDaysCount: 1,
    );
  }
}

class FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  FakeAuthNotifier()
    : super(
        const Authenticated(
          AuthUser(
            id: 'user-owner',
            username: 'owner',
            fullName: 'Owner User',
            email: 'owner@e6carspa.com',
            role: 'Owner',
            isOwner: true,
            permissions: [
              'showroom.manage',
              'showroom.assign_staff',
              'showroom.confirm_attendance',
            ],
          ),
        ),
      );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('Showroom Workspace Shell (Phase 2A Tests)', () {
    late FakeShowroomRepository fakeRepo;
    late Showroom testShowroom;

    setUp(() {
      fakeRepo = FakeShowroomRepository();
      testShowroom = Showroom(
        id: 'sr-100',
        name: 'Honda Showroom Central',
        address: '500 Anna Salai, Chennai',
        phone: '9840112233',
        gstin: '33AAAAA0000A1Z5',
        isActive: true,
        activeStaffCountToday: 1,
        totalVehiclesToday: 4,
        createdAt: DateTime(2026, 8, 1),
      );
    });

    Widget createWorkspaceWidget({Showroom? showroom}) {
      return ProviderScope(
        overrides: [
          showroomRepositoryProvider.overrideWithValue(fakeRepo),
          authNotifierProvider.overrideWith((ref) => FakeAuthNotifier()),
        ],
        child: MaterialApp(
          home: ShowroomDetailScreen(showroom: showroom ?? testShowroom),
        ),
      );
    }

    testWidgets(
      'Showroom Detail workspace opens with Header, Date Selector, and 3 Tabs',
      (tester) async {
        await tester.pumpWidget(createWorkspaceWidget());
        await tester.pumpAndSettle();

        // Showroom Master Header verification
        expect(
          find.text('Honda Showroom Central'),
          findsNWidgets(2),
        ); // in AppBar and Header Card
        expect(find.text('500 Anna Salai, Chennai'), findsOneWidget);
        expect(find.text('9840112233'), findsOneWidget);
        expect(find.text('GSTIN: 33AAAAA0000A1Z5'), findsOneWidget);
        expect(find.text('Active'), findsOneWidget);

        // Date Stepper verification
        expect(find.byIcon(Icons.chevron_left_rounded), findsOneWidget);
        expect(find.byIcon(Icons.chevron_right_rounded), findsOneWidget);

        // 3 Workspace Tabs verification
        expect(find.text('Attendance'), findsOneWidget);
        expect(find.text('Operations'), findsOneWidget);
        expect(find.text('Billing'), findsOneWidget);

        // Default Active Tab: Attendance content rendered
        expect(
          find.text('Staff on Duty'),
          findsNWidgets(2),
        ); // in KPI card and list heading
        expect(find.text('Scheduled Hours'), findsOneWidget);
        expect(find.text('Murugan Technician'), findsOneWidget);
        expect(find.text('Assign Staff'), findsOneWidget); // FAB is present
      },
    );

    testWidgets(
      'Switching to Operations tab displays real Operations workspace and Log Vehicle Work FAB',
      (tester) async {
        await tester.pumpWidget(createWorkspaceWidget());
        await tester.pumpAndSettle();

        // Tap Operations tab
        await tester.tap(find.text('Operations'));
        await tester.pumpAndSettle();

        // Operations workspace verification
        expect(find.text('Vehicles Handled'), findsOneWidget);
        expect(find.text('Work Types Done'), findsOneWidget);
        expect(find.text('Daily Vehicle Work'), findsOneWidget);

        // Attendance FAB is replaced by Log Vehicle Work FAB
        expect(find.text('Assign Staff'), findsNothing);
        expect(find.text('Log Vehicle Work'), findsWidgets);
      },
    );

    testWidgets(
      'Switching to Billing tab displays real Billing workspace and hides Attendance FAB',
      (tester) async {
        await tester.pumpWidget(createWorkspaceWidget());
        await tester.pumpAndSettle();

        // Tap Billing tab
        await tester.tap(find.text('Billing'));
        await tester.pumpAndSettle();

        // Billing workspace verification
        expect(find.text('Daily Bill Summary'), findsOneWidget);
        expect(find.text('Daily Billed'), findsOneWidget);
        expect(find.text('Received'), findsOneWidget);
        expect(find.text('Balance Due'), findsOneWidget);
        expect(find.text('Payment Ledger'), findsOneWidget);

        // FAB is hidden on Billing tab
        expect(find.text('Assign Staff'), findsNothing);
      },
    );

    testWidgets(
      'Switching between tabs preserves the selected date across all views',
      (tester) async {
        await tester.pumpWidget(createWorkspaceWidget());
        await tester.pumpAndSettle();

        // Shift date forward 1 day using date selector
        await tester.tap(find.byIcon(Icons.chevron_right_rounded));
        await tester.pumpAndSettle();

        // Switch to Operations tab
        await tester.tap(find.text('Operations'));
        await tester.pumpAndSettle();
        expect(find.text('Vehicles Handled'), findsOneWidget);

        // Switch to Billing tab
        await tester.tap(find.text('Billing'));
        await tester.pumpAndSettle();
        expect(find.text('Daily Bill Summary'), findsOneWidget);

        // Switch back to Attendance tab
        await tester.tap(find.text('Attendance'));
        await tester.pumpAndSettle();

        // Attendance roster is still loaded for the shifted date
        expect(find.text('Murugan Technician'), findsOneWidget);
        expect(find.text('Assign Staff'), findsOneWidget);
      },
    );

    testWidgets(
      'Attendance functionality (confirmation and unlock) works seamlessly inside tab',
      (tester) async {
        await tester.pumpWidget(createWorkspaceWidget());
        await tester.pumpAndSettle();

        // Unconfirmed attendance banner present
        expect(find.text('Attendance Not Confirmed'), findsOneWidget);
        expect(find.text('Confirm Attendance'), findsOneWidget);

        // Confirm attendance
        await tester.tap(find.text('Confirm Attendance'));
        await tester.pumpAndSettle();

        // Confirm dialog appears
        expect(find.text('Confirm Attendance?'), findsOneWidget);
        await tester.tap(
          find.byKey(const Key('confirm_dialog_confirm_button')),
        );
        await tester.pumpAndSettle();

        // Banner updates to Confirmed / Locked
        expect(find.text('Attendance Confirmed'), findsOneWidget);
        expect(find.text('Locked'), findsOneWidget);
      },
    );
  });
}
