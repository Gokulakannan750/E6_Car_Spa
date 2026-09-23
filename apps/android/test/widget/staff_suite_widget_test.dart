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
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:e6_car_spa/config/routes.dart';

void main() {
  const testUser = AuthUser(
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

  Widget createTestWidget({int initialTabIndex = 0}) {
    final now = DateTime.now();
    final todayStr = "${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

    return ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(testUser),
        authNotifierProvider.overrideWith(
          (ref) => FakeAuthNotifier(const Authenticated(testUser)),
        ),
        staffProvider.overrideWith(
          (ref) => FakeStaffNotifier(
            StaffState(
              staffList: [sampleStaff],
              isLoading: false,
            ),
          ),
        ),
        dailyAttendanceProvider(todayStr).overrideWith(
          (ref) => Future.value(sampleAttendanceResp),
        ),
        dailyAttendanceProvider('2026-09-22').overrideWith(
          (ref) => Future.value(sampleAttendanceResp),
        ),
        salaryRosterProvider.overrideWith(
          (ref) => Future.value(sampleSalaryResp),
        ),
      ],
      child: MaterialApp(
        home: StaffScreen(initialTabIndex: initialTabIndex),
      ),
    );
  }

  group('Staff Hub Screen & Tab Tests', () {
    testWidgets('renders all 4 Staff tabs correctly', (tester) async {
      await tester.pumpWidget(createTestWidget(initialTabIndex: 0));
      await tester.pumpAndSettle();

      expect(find.text('Staff Suite'), findsOneWidget);
      expect(find.text('Directory'), findsOneWidget);
      expect(find.text('Attendance'), findsOneWidget);
      expect(find.text('Monthly Report'), findsOneWidget);
      expect(find.text('Salary'), findsOneWidget);

      // Tab 0 (Directory)
      expect(find.text('Ramesh Kumar'), findsOneWidget);
    });

    testWidgets('opens Attendance tab directly and displays locked banner', (tester) async {
      await tester.pumpWidget(createTestWidget(initialTabIndex: 1));
      await tester.pumpAndSettle();

      expect(find.text('Attendance Confirmed & Locked'), findsOneWidget);
      expect(find.text('Present'), findsWidgets);
    });

    testWidgets('opens Salary tab directly and displays financial breakdown', (tester) async {
      await tester.pumpWidget(createTestWidget(initialTabIndex: 3));
      await tester.pumpAndSettle();

      expect(find.text('Salary Period (Arbitrary Range)'), findsOneWidget);
      expect(find.text('Total Entered'), findsOneWidget);
      expect(find.text('Advance Rec.'), findsOneWidget);
      expect(find.text('Net Payable'), findsOneWidget);
      expect(find.text('Ready for Settlement'), findsOneWidget);
    });

    testWidgets('Tapping back button in Staff Suite navigates back to Dashboard', (tester) async {
      final router = GoRouter(
        initialLocation: AppRoutes.staff,
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            builder: (context, state) => const Scaffold(body: Text('Dashboard Destination')),
          ),
          GoRoute(
            path: AppRoutes.staff,
            builder: (context, state) => const StaffScreen(initialTabIndex: 0),
          ),
        ],
      );

      final now = DateTime.now();
      final todayStr = "${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(testUser),
            authNotifierProvider.overrideWith(
              (ref) => FakeAuthNotifier(const Authenticated(testUser)),
            ),
            staffProvider.overrideWith(
              (ref) => FakeStaffNotifier(
                StaffState(staffList: [sampleStaff], isLoading: false),
              ),
            ),
            dailyAttendanceProvider(todayStr).overrideWith(
              (ref) => Future.value(sampleAttendanceResp),
            ),
            dailyAttendanceProvider('2026-09-22').overrideWith(
              (ref) => Future.value(sampleAttendanceResp),
            ),
            salaryRosterProvider.overrideWith(
              (ref) => Future.value(sampleSalaryResp),
            ),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('staff_suite_back_button')), findsOneWidget);
      await tester.tap(find.byKey(const Key('staff_suite_back_button')));
      await tester.pumpAndSettle();

      expect(find.text('Dashboard Destination'), findsOneWidget);
    });

    testWidgets('unauthorized user receives restricted access screen', (tester) async {
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
          child: const MaterialApp(
            home: StaffScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(find.textContaining('staff.view'), findsOneWidget);
    });
  });
}

class FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  FakeAuthNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeStaffNotifier extends StateNotifier<StaffState> implements StaffNotifier {
  FakeStaffNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
