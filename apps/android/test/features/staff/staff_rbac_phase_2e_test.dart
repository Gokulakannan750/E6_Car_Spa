import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/dashboard/presentation/pages/dashboard_screen.dart';
import 'package:e6_car_spa/features/staff/models/staff_attendance_models.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/models/staff_salary_models.dart';
import 'package:e6_car_spa/features/staff/presentation/pages/staff_attendance_tab.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/salary_staff_card.dart';
import 'package:e6_car_spa/features/staff/providers/staff_attendance_providers.dart';
import 'package:e6_car_spa/features/staff/providers/staff_provider.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_model.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/pages/staff_advances_screen.dart';
import 'package:e6_car_spa/features/staffadvances/providers/staff_advances_provider.dart';

class FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  FakeAuthNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class TrackingStaffAdvancesNotifier extends StateNotifier<StaffAdvancesState>
    implements StaffAdvancesNotifier {
  int loadAdvancesCount = 0;

  TrackingStaffAdvancesNotifier() : super(const StaffAdvancesState());

  @override
  Future<void> loadAdvances({
    int page = 1,
    String? staffId,
    String? status,
    DateTime? fromDate,
    DateTime? toDate,
    String? search,
    bool refresh = false,
    bool silent = false,
  }) async {
    loadAdvancesCount++;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class TrackingStaffNotifier extends StateNotifier<StaffState>
    implements StaffNotifier {
  int loadStaffCount = 0;

  TrackingStaffNotifier() : super(const StaffState());

  @override
  Future<void> loadStaff({bool refresh = false, bool silent = false}) async {
    loadStaffCount++;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const readySalaryItem = StaffSalaryItem(
    staffId: 'staff-101',
    staffName: 'Ramesh Kumar',
    staffPhoneNumber: '9876543210',
    periodFrom: '2026-09-01',
    periodTo: '2026-09-30',
    enteredSalary: 25000.0,
    outstandingAdvance: 5000.0,
    advanceDeduction: 5000.0,
    finalSalary: 20000.0,
    remainingAdvance: 0.0,
    status: 'Ready',
    settlementId: 'db-ready-101',
  );

  DailyAttendanceResponse createAttendanceResponse({
    required bool isConfirmed,
  }) {
    return DailyAttendanceResponse(
      date: '2026-10-07',
      isAttendanceConfirmed: isConfirmed,
      attendanceConfirmedByName: isConfirmed ? 'Supervisor' : null,
      summary: const DailyAttendanceSummary(
        totalActiveStaff: 1,
        presentCount: 1,
        halfDayCount: 0,
        leaveCount: 0,
        unmarkedCount: 0,
      ),
      staffMembers: [
        const DailyStaffAttendanceItem(
          staffId: 'staff-101',
          staffName: 'Ramesh Kumar',
          staffRole: 'Detailer',
          staffPhoneNumber: '9876543210',
          isActive: true,
          status: 'Present',
          attendanceDate: '2026-10-07',
        ),
      ],
    );
  }

  group('Phase 2E-03: SalaryStaffCard Permission Elimination', () {
    testWidgets(
      'staff.edit does NOT grant salary enter/edit or settle actions',
      (tester) async {
        const user = AuthUser(
          id: 'u-1',
          username: 'staff_editor',
          fullName: 'Staff Editor',
          role: 'Editor',
          isOwner: false,
          permissions: ['staff.edit'],
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(user),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(Authenticated(user)),
              ),
            ],
            child: const MaterialApp(
              home: Scaffold(body: SalaryStaffCard(item: readySalaryItem)),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Edit Salary'), findsNothing);
        expect(find.text('Enter Salary'), findsNothing);
        expect(find.text('Settle'), findsNothing);
        expect(find.byIcon(Icons.visibility_outlined), findsWidgets);
      },
    );

    testWidgets(
      'staff.manage does NOT grant salary enter/edit or settle actions',
      (tester) async {
        const user = AuthUser(
          id: 'u-2',
          username: 'staff_manager',
          fullName: 'Staff Manager',
          role: 'Manager',
          isOwner: false,
          permissions: ['staff.manage'],
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(user),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(Authenticated(user)),
              ),
            ],
            child: const MaterialApp(
              home: Scaffold(body: SalaryStaffCard(item: readySalaryItem)),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Edit Salary'), findsNothing);
        expect(find.text('Enter Salary'), findsNothing);
        expect(find.text('Settle'), findsNothing);
      },
    );

    testWidgets(
      'staff_salary.manage grants Edit Salary but does NOT grant Settle',
      (tester) async {
        const user = AuthUser(
          id: 'u-3',
          username: 'salary_mgr',
          fullName: 'Salary Mgr',
          role: 'Manager',
          isOwner: false,
          permissions: ['staff_salary.manage'],
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(user),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(Authenticated(user)),
              ),
            ],
            child: const MaterialApp(
              home: Scaffold(body: SalaryStaffCard(item: readySalaryItem)),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Edit Salary'), findsOneWidget);
        expect(find.text('Settle'), findsNothing);
      },
    );

    testWidgets(
      'staff_salary.settle grants Settle but does NOT grant Edit Salary',
      (tester) async {
        const user = AuthUser(
          id: 'u-4',
          username: 'salary_settler',
          fullName: 'Salary Settler',
          role: 'Settler',
          isOwner: false,
          permissions: ['staff_salary.settle'],
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(user),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(Authenticated(user)),
              ),
            ],
            child: const MaterialApp(
              home: Scaffold(body: SalaryStaffCard(item: readySalaryItem)),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Settle'), findsOneWidget);
        expect(find.text('Edit Salary'), findsNothing);
      },
    );

    testWidgets('Owner user grants both Edit Salary and Settle', (
      tester,
    ) async {
      const user = AuthUser(
        id: 'u-owner',
        username: 'owner',
        fullName: 'Owner Admin',
        role: 'Owner',
        isOwner: true,
        permissions: [],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(user),
            authNotifierProvider.overrideWith(
              (ref) => FakeAuthNotifier(Authenticated(user)),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(body: SalaryStaffCard(item: readySalaryItem)),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Edit Salary'), findsOneWidget);
      expect(find.text('Settle'), findsOneWidget);
    });
  });

  group('Phase 2E-03: StaffAttendanceTab Permission Elimination', () {
    testWidgets(
      'staff.manage does NOT grant Confirm Day button on unconfirmed roster',
      (tester) async {
        const user = AuthUser(
          id: 'u-5',
          username: 'staff_mgr',
          fullName: 'Staff Mgr',
          role: 'Manager',
          isOwner: false,
          permissions: ['staff.manage', 'staff_attendance.view'],
        );

        final attendanceResp = createAttendanceResponse(isConfirmed: false);
        final dateStr = '2026-10-07';

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(user),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(Authenticated(user)),
              ),
              dailyAttendanceProvider(
                dateStr,
              ).overrideWith((ref) => Future.value(attendanceResp)),
              selectedAttendanceDateProvider.overrideWith((ref) => dateStr),
            ],
            child: const MaterialApp(home: StaffAttendanceTab()),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Pending Confirmation'), findsOneWidget);
        expect(find.text('Confirm Day'), findsNothing);
      },
    );

    testWidgets(
      'staff_attendance.confirm grants Confirm Day button on unconfirmed roster',
      (tester) async {
        const user = AuthUser(
          id: 'u-6',
          username: 'att_confirmer',
          fullName: 'Attendance Confirmer',
          role: 'Supervisor',
          isOwner: false,
          permissions: ['staff_attendance.confirm', 'staff_attendance.view'],
        );

        final attendanceResp = createAttendanceResponse(isConfirmed: false);
        final dateStr = '2026-10-07';

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(user),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(Authenticated(user)),
              ),
              dailyAttendanceProvider(
                dateStr,
              ).overrideWith((ref) => Future.value(attendanceResp)),
              selectedAttendanceDateProvider.overrideWith((ref) => dateStr),
            ],
            child: const MaterialApp(home: StaffAttendanceTab()),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Pending Confirmation'), findsOneWidget);
        expect(find.text('Confirm Day'), findsOneWidget);
      },
    );
  });

  group('Phase 2E-03: Dashboard Showroom Canonical Permission', () {
    testWidgets('typo showrooms.view does NOT unlock Showroom app launcher', (
      tester,
    ) async {
      const user = AuthUser(
        id: 'u-7',
        username: 'typo_user',
        fullName: 'Typo User',
        role: 'Viewer',
        isOwner: false,
        permissions: ['showrooms.view'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(user),
            authNotifierProvider.overrideWith(
              (ref) => FakeAuthNotifier(Authenticated(user)),
            ),
          ],
          child: const MaterialApp(home: DashboardScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Showroom'), findsNothing);
    });

    testWidgets('canonical showroom.view DOES unlock Showroom app launcher', (
      tester,
    ) async {
      const user = AuthUser(
        id: 'u-8',
        username: 'valid_showroom_user',
        fullName: 'Valid Showroom User',
        role: 'Viewer',
        isOwner: false,
        permissions: ['showroom.view'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(user),
            authNotifierProvider.overrideWith(
              (ref) => FakeAuthNotifier(Authenticated(user)),
            ),
          ],
          child: const MaterialApp(home: DashboardScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Showroom'), findsOneWidget);
    });
  });

  group('Phase 2E-03: StaffAdvancesScreen Decoupled Refresh Permissions', () {
    testWidgets(
      'staff.view triggers loadStaff but NOT loadAdvances on manual refresh',
      (tester) async {
        const user = AuthUser(
          id: 'u-9',
          username: 'staff_only_user',
          fullName: 'Staff Only User',
          role: 'Viewer',
          isOwner: false,
          permissions: ['staff.view'],
        );

        final trackingAdvancesNotifier = TrackingStaffAdvancesNotifier();
        final trackingStaffNotifier = TrackingStaffNotifier();

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(user),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(Authenticated(user)),
              ),
              staffAdvancesProvider.overrideWith(
                (ref) => trackingAdvancesNotifier,
              ),
              staffProvider.overrideWith((ref) => trackingStaffNotifier),
            ],
            child: const MaterialApp(home: StaffAdvancesScreen()),
          ),
        );
        await tester.pumpAndSettle();

        final initialAdvancesLoads = trackingAdvancesNotifier.loadAdvancesCount;
        final initialStaffLoads = trackingStaffNotifier.loadStaffCount;

        // Tap Refresh button
        final refreshBtn = find.byTooltip('Refresh');
        expect(refreshBtn, findsOneWidget);
        await tester.tap(refreshBtn);
        await tester.pumpAndSettle();

        // Staff was reloaded, advances was NOT reloaded
        expect(
          trackingStaffNotifier.loadStaffCount,
          greaterThan(initialStaffLoads),
        );
        expect(
          trackingAdvancesNotifier.loadAdvancesCount,
          equals(initialAdvancesLoads),
        );
      },
    );

    testWidgets(
      'staff_advances.view triggers loadAdvances but NOT loadStaff on manual refresh',
      (tester) async {
        const user = AuthUser(
          id: 'u-10',
          username: 'adv_only_user',
          fullName: 'Advances Only User',
          role: 'Viewer',
          isOwner: false,
          permissions: ['staff_advances.view'],
        );

        final trackingAdvancesNotifier = TrackingStaffAdvancesNotifier();
        final trackingStaffNotifier = TrackingStaffNotifier();

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(user),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(Authenticated(user)),
              ),
              staffAdvancesProvider.overrideWith(
                (ref) => trackingAdvancesNotifier,
              ),
              staffProvider.overrideWith((ref) => trackingStaffNotifier),
            ],
            child: const MaterialApp(home: StaffAdvancesScreen()),
          ),
        );
        await tester.pumpAndSettle();

        final initialAdvancesLoads = trackingAdvancesNotifier.loadAdvancesCount;
        final initialStaffLoads = trackingStaffNotifier.loadStaffCount;

        // Tap Refresh button
        final refreshBtn = find.byTooltip('Refresh');
        expect(refreshBtn, findsOneWidget);
        await tester.tap(refreshBtn);
        await tester.pumpAndSettle();

        // Advances was reloaded, staff was NOT reloaded
        expect(
          trackingAdvancesNotifier.loadAdvancesCount,
          greaterThan(initialAdvancesLoads),
        );
        expect(trackingStaffNotifier.loadStaffCount, equals(initialStaffLoads));
      },
    );
  });
}
