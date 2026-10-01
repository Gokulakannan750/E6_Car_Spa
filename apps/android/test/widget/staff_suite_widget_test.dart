import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/staff/models/staff_attendance_models.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/models/staff_salary_models.dart';
import 'package:e6_car_spa/features/staff/presentation/pages/staff_screen.dart';
import 'package:e6_car_spa/features/staff/providers/staff_attendance_providers.dart';
import 'package:e6_car_spa/features/staff/providers/staff_provider.dart';
import 'package:e6_car_spa/features/staff/providers/staff_salary_providers.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_model.dart';
import 'package:e6_car_spa/features/staffadvances/providers/staff_advances_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  const testOwnerUser = AuthUser(
    id: 'user-1',
    username: 'admin',
    fullName: 'Admin User',
    email: 'admin@e6carspa.com',
    role: 'Owner',
    isOwner: true,
    permissions: [
      'staff.view',
      'staff.create',
      'staff.edit',
      'staff_attendance.manage',
      'staff_attendance.confirm',
      'staff_salary.manage',
      'staff_salary.settle',
      'staff_advances.view',
      'staff_advances.create',
      'staff_advances.settle',
      'staff_advances.obsolete',
    ],
  );

  final sampleStaff = Staff(
    id: 'staff-1',
    name: 'Ramesh Kumar',
    phoneNumber: '9876543210',
    email: 'ramesh@e6carspa.com',
    role: 'Detailer',
    isActive: true,
    totalAdvances: 1,
    totalAdvanceAmount: 3000.0,
    hasAadhaarDocument: true,
  );

  final sampleAdvance = StaffAdvance(
    id: 'adv-100',
    staffId: 'staff-1',
    staffName: 'Ramesh Kumar',
    staffRole: 'Detailer',
    amount: 3000.0,
    advanceDate: DateTime(2026, 8, 26),
    reason: 'Salary Advance',
    notes: 'Monthly advance request',
    status: StaffAdvanceStatus.outstanding,
    createdAt: DateTime(2026, 8, 26),
  );

  final sampleAttendanceResp = DailyAttendanceResponse(
    date: '2026-09-22',
    isAttendanceConfirmed: true,
    attendanceConfirmedByName: 'Admin',
    summary: const DailyAttendanceSummary(
      totalActiveStaff: 1,
      presentCount: 1,
      halfDayCount: 0,
      leaveCount: 0,
      unmarkedCount: 0,
    ),
    staffMembers: [
      const DailyStaffAttendanceItem(
        staffId: 'staff-1',
        staffName: 'Ramesh Kumar',
        staffRole: 'Detailer',
        staffPhoneNumber: '9876543210',
        isActive: true,
        status: 'Present',
        attendanceDate: '2026-09-22',
      ),
    ],
  );

  final sampleSalaryResp = StaffSalaryRosterResponse(
    periodFrom: '2026-09-01',
    periodTo: '2026-09-30',
    totalStaffCount: 1,
    readyCount: 1,
    totalEnteredSalary: 20000.0,
    totalAdvanceDeductions: 3000.0,
    totalFinalSalary: 17000.0,
    items: [
      const StaffSalaryItem(
        staffId: 'staff-1',
        staffName: 'Ramesh Kumar',
        staffRole: 'Detailer',
        staffPhoneNumber: '9876543210',
        periodFrom: '2026-09-01',
        periodTo: '2026-09-30',
        enteredSalary: 20000.0,
        outstandingAdvance: 3000.0,
        advanceDeduction: 3000.0,
        finalSalary: 17000.0,
        remainingAdvance: 0.0,
        status: 'Ready',
      ),
    ],
  );

  Widget createTestWidget({
    int initialTabIndex = 0,
    AuthUser user = testOwnerUser,
  }) {
    final now = DateTime.now();
    final todayStr =
        "${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

    return ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(user),
        authNotifierProvider.overrideWith(
          (ref) => FakeAuthNotifier(Authenticated(user)),
        ),
        staffProvider.overrideWith(
          (ref) => FakeStaffNotifier(
            StaffState(staffList: [sampleStaff], isLoading: false),
          ),
        ),
        staffAdvancesProvider.overrideWith(
          (ref) => FakeStaffAdvancesNotifier(
            StaffAdvancesState(
              advances: [sampleAdvance],
              summary: const StaffAdvanceSummary(
                outstandingAmount: 3000.0,
                settledAmount: 0.0,
                totalActiveCount: 1,
              ),
              isLoading: false,
            ),
          ),
        ),
        dailyAttendanceProvider(
          todayStr,
        ).overrideWith((ref) => Future.value(sampleAttendanceResp)),
        dailyAttendanceProvider(
          '2026-09-22',
        ).overrideWith((ref) => Future.value(sampleAttendanceResp)),
        salaryRosterProvider.overrideWith(
          (ref) => Future.value(sampleSalaryResp),
        ),
      ],
      child: MaterialApp(home: StaffScreen(initialTabIndex: initialTabIndex)),
    );
  }

  group('Staff Hub Screen & Tab Tests', () {
    testWidgets(
      'Staff Suite contains exactly four primary tabs: Directory, Attendance, Staff Advances, Salary',
      (tester) async {
        await tester.pumpWidget(createTestWidget(initialTabIndex: 0));
        await tester.pumpAndSettle();

        expect(find.text('Staff Suite'), findsOneWidget);
        expect(find.text('Directory'), findsOneWidget);
        expect(find.text('Attendance'), findsOneWidget);
        expect(find.text('Staff Advances'), findsOneWidget);
        expect(find.text('Salary'), findsOneWidget);

        // Monthly Report must NOT be displayed as a tab
        expect(find.text('Monthly Report'), findsNothing);

        // Tab 0 (Directory) content
        expect(find.text('Ramesh Kumar'), findsOneWidget);
      },
    );

    testWidgets('Tab index 0: renders Directory tab content', (tester) async {
      await tester.pumpWidget(createTestWidget(initialTabIndex: 0));
      await tester.pumpAndSettle();

      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.byKey(const Key('add_staff_fab')), findsOneWidget);
    });

    testWidgets(
      'Tab index 1: opens Attendance tab directly and displays locked banner',
      (tester) async {
        await tester.pumpWidget(createTestWidget(initialTabIndex: 1));
        await tester.pumpAndSettle();

        expect(find.text('Attendance Confirmed & Locked'), findsOneWidget);
        expect(find.text('Present'), findsWidgets);
      },
    );

    testWidgets(
      'Tab index 2: opens Staff Advances tab directly and renders KPIs & advances',
      (tester) async {
        await tester.pumpWidget(createTestWidget(initialTabIndex: 2));
        await tester.pumpAndSettle();

        // Verify Staff Advances tab content
        expect(find.text('Outstanding'), findsWidgets);
        expect(find.text('Active Total'), findsOneWidget);
        expect(find.textContaining('Salary Advance'), findsOneWidget);
        expect(find.byKey(const Key('add_advance_fab')), findsOneWidget);
      },
    );

    testWidgets(
      'Tab index 3: opens Salary tab directly and displays financial breakdown',
      (tester) async {
        await tester.pumpWidget(createTestWidget(initialTabIndex: 3));
        await tester.pumpAndSettle();

        expect(find.text('Salary Period (Arbitrary Range)'), findsOneWidget);
        expect(find.text('Total Entered'), findsOneWidget);
        expect(find.text('Advance Rec.'), findsOneWidget);
        expect(find.text('Net Payable'), findsOneWidget);
        expect(find.text('Ready for Settlement'), findsWidgets);
      },
    );

    testWidgets(
      'Tapping back button in Staff Suite navigates back to Dashboard',
      (tester) async {
        final router = GoRouter(
          initialLocation: AppRoutes.staff,
          routes: [
            GoRoute(
              path: AppRoutes.dashboard,
              builder: (context, state) =>
                  const Scaffold(body: Text('Dashboard Destination')),
            ),
            GoRoute(
              path: AppRoutes.staff,
              builder: (context, state) =>
                  const StaffScreen(initialTabIndex: 0),
            ),
          ],
        );

        final now = DateTime.now();
        final todayStr =
            "${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentUserProvider.overrideWithValue(testOwnerUser),
              authNotifierProvider.overrideWith(
                (ref) => FakeAuthNotifier(const Authenticated(testOwnerUser)),
              ),
              staffProvider.overrideWith(
                (ref) => FakeStaffNotifier(
                  StaffState(staffList: [sampleStaff], isLoading: false),
                ),
              ),
              staffAdvancesProvider.overrideWith(
                (ref) => FakeStaffAdvancesNotifier(
                  StaffAdvancesState(
                    advances: [sampleAdvance],
                    summary: const StaffAdvanceSummary(
                      outstandingAmount: 3000.0,
                      settledAmount: 0.0,
                      totalActiveCount: 1,
                    ),
                    isLoading: false,
                  ),
                ),
              ),
              dailyAttendanceProvider(
                todayStr,
              ).overrideWith((ref) => Future.value(sampleAttendanceResp)),
              dailyAttendanceProvider(
                '2026-09-22',
              ).overrideWith((ref) => Future.value(sampleAttendanceResp)),
              salaryRosterProvider.overrideWith(
                (ref) => Future.value(sampleSalaryResp),
              ),
            ],
            child: MaterialApp.router(routerConfig: router),
          ),
        );
        await tester.pumpAndSettle();

        expect(
          find.byKey(const Key('staff_suite_back_button')),
          findsOneWidget,
        );
        await tester.tap(find.byKey(const Key('staff_suite_back_button')));
        await tester.pumpAndSettle();

        expect(find.text('Dashboard Destination'), findsOneWidget);
      },
    );

    testWidgets('unauthorized user receives restricted access screen', (
      tester,
    ) async {
      const unauthorizedUser = AuthUser(
        id: 'user-2',
        username: 'unauth',
        fullName: 'Unauthorized User',
        role: 'Guest',
        isOwner: false,
        permissions: [],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(unauthorizedUser),
            authNotifierProvider.overrideWith(
              (ref) => FakeAuthNotifier(const Authenticated(unauthorizedUser)),
            ),
          ],
          child: const MaterialApp(home: StaffScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(find.textContaining('staff.view'), findsOneWidget);
    });

    testWidgets(
      'user without staff_advances.view receives restricted access on Staff Advances tab',
      (tester) async {
        const staffOnlyUser = AuthUser(
          id: 'user-3',
          username: 'staff_viewer',
          fullName: 'Staff Viewer',
          role: 'Viewer',
          isOwner: false,
          permissions: ['staff.view'],
        );

        await tester.pumpWidget(
          createTestWidget(initialTabIndex: 2, user: staffOnlyUser),
        );
        await tester.pumpAndSettle();

        // Staff Advances tab shows access restricted for staff_advances.view
        expect(find.text('Access Restricted'), findsOneWidget);
        expect(find.textContaining('staff_advances.view'), findsOneWidget);
      },
    );

    testWidgets(
      'Owner user without explicit staff_advances.view can access Staff Advances tab',
      (tester) async {
        const ownerWithoutExplicitPerms = AuthUser(
          id: 'user-owner',
          username: 'owner',
          fullName: 'Owner User',
          role: 'Owner',
          isOwner: true,
          permissions: ['staff.view'],
        );

        await tester.pumpWidget(
          createTestWidget(initialTabIndex: 2, user: ownerWithoutExplicitPerms),
        );
        await tester.pumpAndSettle();

        expect(find.text('Access Restricted'), findsNothing);
        expect(find.textContaining('Salary Advance'), findsOneWidget);
      },
    );

    testWidgets(
      'Switching tabs preserves state without crashing or duplicate timers',
      (tester) async {
        await tester.pumpWidget(createTestWidget(initialTabIndex: 0));
        await tester.pumpAndSettle();

        // Start at Tab 0: Directory
        expect(find.text('Ramesh Kumar'), findsOneWidget);

        // Switch to Tab 2: Staff Advances
        await tester.tap(find.text('Staff Advances'));
        await tester.pumpAndSettle();
        expect(find.textContaining('Salary Advance'), findsOneWidget);

        // Switch to Tab 3: Salary
        await tester.tap(find.text('Salary'));
        await tester.pumpAndSettle();
        expect(find.text('Total Entered'), findsOneWidget);

        // Switch back to Tab 2: Staff Advances
        await tester.tap(find.text('Staff Advances'));
        await tester.pumpAndSettle();
        expect(find.textContaining('Salary Advance'), findsOneWidget);
      },
    );
  });
}

class FakeStaffAdvancesNotifier extends StateNotifier<StaffAdvancesState>
    implements StaffAdvancesNotifier {
  FakeStaffAdvancesNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  FakeAuthNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeStaffNotifier extends StateNotifier<StaffState>
    implements StaffNotifier {
  FakeStaffNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
