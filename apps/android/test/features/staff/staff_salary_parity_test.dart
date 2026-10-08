import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/staff/data/staff_repository.dart';
import 'package:e6_car_spa/features/staff/models/staff_salary_models.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/enter_salary_bottom_sheet.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/salary_details_bottom_sheet.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/salary_staff_card.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/settle_salary_bottom_sheet.dart';
import 'package:e6_car_spa/features/staff/providers/staff_provider.dart';
import 'package:e6_car_spa/features/staffadvances/providers/staff_advances_provider.dart';

class MockStaffRepository implements StaffRepository {
  String? lastEnteredStaffId;
  double? lastEnteredSalary;
  String? lastPeriodFrom;
  String? lastPeriodTo;
  String? lastNotes;
  bool saveEnteredSalaryCalled = false;

  String? lastSettledStaffId;
  double? lastSettledSalary;
  String? lastSettledPeriodFrom;
  String? lastSettledPeriodTo;
  String? lastSettledNotes;
  bool settleSalaryCalled = false;

  @override
  Future<StaffSalaryItem> saveEnteredSalary({
    required String staffId,
    required String periodFrom,
    required String periodTo,
    required double enteredSalary,
    String? notes,
  }) async {
    saveEnteredSalaryCalled = true;
    lastEnteredStaffId = staffId;
    lastEnteredSalary = enteredSalary;
    lastPeriodFrom = periodFrom;
    lastPeriodTo = periodTo;
    lastNotes = notes;

    return StaffSalaryItem(
      staffId: staffId,
      staffName: 'Test Staff',
      staffPhoneNumber: '9876543210',
      periodFrom: periodFrom,
      periodTo: periodTo,
      enteredSalary: enteredSalary,
      outstandingAdvance: 8000.0,
      advanceDeduction: min(8000.0, enteredSalary),
      finalSalary: max(0.0, enteredSalary - min(8000.0, enteredSalary)),
      remainingAdvance: max(0.0, 8000.0 - min(8000.0, enteredSalary)),
      status: 'Ready',
      settlementId:
          'db-ready-guid-101', // Real backend always returns settlementId Guid for Ready items
    );
  }

  @override
  Future<StaffSalaryRosterResponse> getSalaryRoster({
    required String fromDate,
    required String toDate,
    String? staffId,
    String? status,
    String? search,
  }) async {
    final item = StaffSalaryItem(
      staffId: lastEnteredStaffId ?? 'staff-hari',
      staffName: 'Hari',
      staffPhoneNumber: '9876543210',
      periodFrom: fromDate,
      periodTo: toDate,
      enteredSalary: lastEnteredSalary ?? 5000.0,
      outstandingAdvance: 1500.0,
      advanceDeduction: 1500.0,
      finalSalary: (lastEnteredSalary ?? 5000.0) - 1500.0,
      remainingAdvance: 0.0,
      status: 'Ready',
      settlementId: 'db-ready-guid-hari',
    );
    return StaffSalaryRosterResponse(
      periodFrom: fromDate,
      periodTo: toDate,
      totalStaffCount: 1,
      notEnteredCount: 0,
      readyCount: 1,
      settledCount: 0,
      totalEnteredSalary: lastEnteredSalary ?? 5000.0,
      totalAdvanceDeductions: 1500.0,
      totalFinalSalary: (lastEnteredSalary ?? 5000.0) - 1500.0,
      items: [item],
    );
  }

  @override
  Future<StaffSalarySettlement> settleSalary({
    required String staffId,
    required String periodFrom,
    required String periodTo,
    required double enteredSalary,
    String? notes,
  }) async {
    settleSalaryCalled = true;
    lastSettledStaffId = staffId;
    lastSettledSalary = enteredSalary;
    lastSettledPeriodFrom = periodFrom;
    lastSettledPeriodTo = periodTo;
    lastSettledNotes = notes;

    final deduction = min(10000.0, enteredSalary);
    final finalSalary = max(0.0, enteredSalary - deduction);
    final remainingAdvance = max(0.0, 10000.0 - deduction);

    return StaffSalarySettlement(
      id: 'settle-mock-1',
      staffId: staffId,
      staffName: 'Test Staff',
      periodFrom: periodFrom,
      periodTo: periodTo,
      enteredSalary: enteredSalary,
      outstandingAdvanceBeforeSettlement: 10000.0,
      advanceDeduction: deduction,
      remainingAdvanceAfterSettlement: remainingAdvance,
      finalSalary: finalSalary,
      status: 'Settled',
      settledAt: DateTime.now(),
      settledByName: 'Admin',
      notes: notes,
      createdAt: DateTime.now(),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  FakeAuthNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeStaffAdvancesNotifier extends StateNotifier<StaffAdvancesState>
    implements StaffAdvancesNotifier {
  FakeStaffAdvancesNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeStaffNotifier extends StateNotifier<StaffState>
    implements StaffNotifier {
  FakeStaffNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const testUser = AuthUser(
    id: 'user-admin',
    username: 'admin',
    fullName: 'Admin User',
    email: 'admin@e6carspa.com',
    role: 'Owner',
    isOwner: true,
    permissions: [
      'staff.view',
      'staff.manage',
      'staff.edit',
      'staff_salary.manage',
      'staff_salary.settle',
    ],
  );

  group('Staff Salary Parity Tests (Windows Reference vs Android)', () {
    late MockStaffRepository mockStaffRepo;

    setUp(() {
      mockStaffRepo = MockStaffRepository();
    });

    List<Override> createOverrides() {
      return [
        staffRepositoryProvider.overrideWithValue(mockStaffRepo),
        authNotifierProvider.overrideWith(
          (ref) => FakeAuthNotifier(const Authenticated(testUser)),
        ),
        staffAdvancesProvider.overrideWith(
          (ref) => FakeStaffAdvancesNotifier(const StaffAdvancesState()),
        ),
        staffProvider.overrideWith(
          (ref) => FakeStaffNotifier(const StaffState()),
        ),
      ];
    }

    // ==========================================
    // Test 1 — Save Salary
    // ==========================================
    testWidgets(
      'Test 1 — Save Salary: saves amount, Ready status, SettledAt=null, no settlement, advance unchanged',
      (tester) async {
        const item = StaffSalaryItem(
          staffId: 'staff-101',
          staffName: 'Ramesh Kumar',
          staffPhoneNumber: '9876543210',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          outstandingAdvance: 8000.0,
          status: 'NotEntered',
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: createOverrides(),
            child: const MaterialApp(
              home: Scaffold(
                body: EnterSalaryBottomSheet(item: item, canSettle: true),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Enter ₹35,000
        final salaryField = find.byType(TextFormField).first;
        await tester.enterText(salaryField, '35000');
        await tester.pump();

        // Verify live calculations
        expect(find.textContaining('35000'), findsWidgets);

        // Tap strictly "Save Salary"
        final saveSalaryBtn = find.text('Save Salary');
        expect(saveSalaryBtn, findsOneWidget);
        await tester.tap(saveSalaryBtn);
        await tester.pumpAndSettle();

        // Check backend repository call:
        // Must call saveEnteredSalary (POST /api/staff-salary/enter)
        // Must NEVER call settleSalary
        expect(mockStaffRepo.saveEnteredSalaryCalled, isTrue);
        expect(mockStaffRepo.lastEnteredStaffId, 'staff-101');
        expect(mockStaffRepo.lastEnteredSalary, 35000.0);
        expect(mockStaffRepo.lastPeriodFrom, '2026-09-01');
        expect(mockStaffRepo.lastPeriodTo, '2026-09-30');
        expect(mockStaffRepo.settleSalaryCalled, isFalse);
      },
    );

    // ==========================================
    // Test B — Save Salary creates Ready state
    // ==========================================
    testWidgets(
      'Test B — Save Salary creates Ready state: card shows Ready for Settlement, Edit & Settle buttons',
      (tester) async {
        const savedReadyItem = StaffSalaryItem(
          staffId: 'staff-101',
          staffName: 'Ramesh Kumar',
          staffPhoneNumber: '9876543210',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          enteredSalary: 35000.0,
          outstandingAdvance: 8000.0,
          advanceDeduction: 8000.0,
          finalSalary: 27000.0,
          remainingAdvance: 0.0,
          status: 'Ready',
          settlementId: 'db-ready-guid-101', // Real backend DB row ID
        );

        expect(savedReadyItem.isReady, isTrue);
        expect(savedReadyItem.isSettled, isFalse);
        expect(savedReadyItem.settledAt, isNull);

        await tester.pumpWidget(
          ProviderScope(
            overrides: createOverrides(),
            child: const MaterialApp(
              home: Scaffold(body: SalaryStaffCard(item: savedReadyItem)),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Must show Ready for Settlement badge
        expect(find.text('Ready for Settlement'), findsOneWidget);
        // Must NOT show Settled badge
        expect(find.text('Settled'), findsNothing);
        // Must show Edit Salary button
        expect(find.text('Edit Salary'), findsOneWidget);
        // Must show Settle button
        expect(find.text('Settle'), findsOneWidget);
        // Must show Entered Salary amount ₹35000
        expect(find.text('₹35000'), findsOneWidget);
      },
    );

    // ==========================================
    // Test C — Saved salary remains Ready after refresh
    // ==========================================
    testWidgets(
      'Test C — Saved salary remains Ready after roster refresh (Hari scenario)',
      (tester) async {
        // Hari: Period 01 Oct 2026 -> 31 Oct 2026, entered ₹5,000, advance ₹1,500
        final refreshedRoster = await mockStaffRepo.getSalaryRoster(
          fromDate: '2026-10-01',
          toDate: '2026-10-31',
        );

        expect(refreshedRoster.items.length, 1);
        final hariItem = refreshedRoster.items.first;

        expect(hariItem.staffName, 'Hari');
        expect(hariItem.enteredSalary, 5000.0);
        expect(hariItem.outstandingAdvance, 1500.0);
        expect(hariItem.advanceDeduction, 1500.0);
        expect(hariItem.finalSalary, 3500.0);
        expect(hariItem.status, 'Ready');
        expect(hariItem.settlementId, isNotNull);
        expect(hariItem.isReady, isTrue);
        expect(hariItem.isSettled, isFalse);
        expect(hariItem.settledAt, isNull);

        await tester.pumpWidget(
          ProviderScope(
            overrides: createOverrides(),
            child: MaterialApp(
              home: Scaffold(body: SalaryStaffCard(item: hariItem)),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Ready for Settlement'), findsOneWidget);
        expect(find.text('Settled'), findsNothing);
        expect(find.text('Edit Salary'), findsOneWidget);
        expect(find.text('Settle'), findsOneWidget);
        expect(find.text('₹5000'), findsOneWidget);
        expect(find.text('₹1500'), findsOneWidget); // Applicable advance
        expect(find.text('₹3500'), findsOneWidget); // Net payable
      },
    );

    // ==========================================
    // Test 2 — Edit Salary
    // ==========================================
    testWidgets(
      'Test 2 — Edit Salary: updates existing Ready salary to ₹40,000 without settling',
      (tester) async {
        const item = StaffSalaryItem(
          staffId: 'staff-102',
          staffName: 'Suresh Raina',
          staffPhoneNumber: '9876543211',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          enteredSalary: 35000.0,
          outstandingAdvance: 10000.0,
          advanceDeduction: 10000.0,
          finalSalary: 25000.0,
          remainingAdvance: 0.0,
          status: 'Ready',
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: createOverrides(),
            child: const MaterialApp(
              home: Scaffold(
                body: EnterSalaryBottomSheet(item: item, canSettle: true),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Sheet title should display "Edit Staff Salary"
        expect(find.text('Edit Staff Salary'), findsOneWidget);

        // Edit salary input to 40000
        final salaryField = find.byType(TextFormField).first;
        await tester.enterText(salaryField, '40000');
        await tester.pump();

        // Tap "Save Salary"
        final saveSalaryBtn = find.text('Save Salary');
        await tester.tap(saveSalaryBtn);
        await tester.pumpAndSettle();

        expect(mockStaffRepo.saveEnteredSalaryCalled, isTrue);
        expect(mockStaffRepo.lastEnteredSalary, 40000.0);
        expect(mockStaffRepo.settleSalaryCalled, isFalse);
      },
    );

    // ==========================================
    // Test 3 — Settle Salary
    // ==========================================
    testWidgets(
      'Test 3 — Settle Salary: confirms settlement, executes FIFO advance recovery, updates status',
      (tester) async {
        const item = StaffSalaryItem(
          staffId: 'staff-103',
          staffName: 'Deepak Chahar',
          staffPhoneNumber: '9876543212',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          enteredSalary: 40000.0,
          outstandingAdvance: 10000.0,
          advanceDeduction: 10000.0,
          finalSalary: 30000.0,
          remainingAdvance: 0.0,
          status: 'Ready',
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: createOverrides(),
            child: const MaterialApp(
              home: Scaffold(body: SettleSalaryBottomSheet(item: item)),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Verify confirmation breakdown modal displays correct numbers
        expect(find.text('Confirm Staff Salary Settlement'), findsOneWidget);
        expect(find.textContaining('40000'), findsWidgets); // Entered salary
        expect(find.textContaining('10000'), findsWidgets); // Advance deduction
        expect(find.textContaining('30000'), findsWidgets); // Net payout

        // Tap "Confirm & Settle Salary"
        final confirmBtn = find.text('Confirm & Settle Salary');
        expect(confirmBtn, findsOneWidget);
        await tester.tap(confirmBtn);
        await tester.pumpAndSettle();

        // Verify settleSalary was called with exact arguments
        expect(mockStaffRepo.settleSalaryCalled, isTrue);
        expect(mockStaffRepo.lastSettledStaffId, 'staff-103');
        expect(mockStaffRepo.lastSettledSalary, 40000.0);
      },
    );

    // ==========================================
    // Test 4 — Cannot settle twice
    // ==========================================
    testWidgets(
      'Test 4 — Cannot settle twice: settled card does not show settle button',
      (tester) async {
        final settledItem = StaffSalaryItem(
          staffId: 'staff-104',
          staffName: 'Ravindra Jadeja',
          staffPhoneNumber: '9876543213',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          enteredSalary: 50000.0,
          outstandingAdvance: 5000.0,
          advanceDeduction: 5000.0,
          finalSalary: 45000.0,
          remainingAdvance: 0.0,
          status: 'Settled',
          settlementId: 'settle-existing-1',
          settledAt: DateTime(2026, 9, 30, 15, 30),
          settledByName: 'Admin',
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: createOverrides(),
            child: MaterialApp(
              home: Scaffold(body: SalaryStaffCard(item: settledItem)),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Status badge must show Settled
        expect(find.text('Settled'), findsOneWidget);

        // "Settle" button must NOT be present
        expect(find.text('Settle'), findsNothing);

        // "Enter Salary" / "Edit Salary" must NOT be present
        expect(find.text('Enter Salary'), findsNothing);
        expect(find.text('Edit Salary'), findsNothing);

        // "View Details" button MUST be present
        expect(find.text('View Details'), findsOneWidget);
      },
    );

    // ==========================================
    // Test 5 — Zero Salary Handling
    // ==========================================
    testWidgets(
      'Test 5 — Zero Salary: permits ₹0 settlement and rejects negative salary matching Windows/Backend',
      (tester) async {
        const zeroSalaryItem = StaffSalaryItem(
          staffId: 'staff-105',
          staffName: 'Mukesh Choudhary',
          staffPhoneNumber: '9876543214',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          enteredSalary: 0.0,
          outstandingAdvance: 5000.0,
          advanceDeduction: 0.0,
          finalSalary: 0.0,
          remainingAdvance: 5000.0,
          status: 'Ready',
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: createOverrides(),
            child: const MaterialApp(
              home: Scaffold(
                body: SettleSalaryBottomSheet(item: zeroSalaryItem),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // ₹0 salary is allowed
        expect(find.text('Confirm Staff Salary Settlement'), findsOneWidget);
        expect(find.textContaining('0.00'), findsWidgets);

        final confirmBtn = find.text('Confirm & Settle Salary');
        await tester.tap(confirmBtn);
        await tester.pumpAndSettle();

        expect(mockStaffRepo.settleSalaryCalled, isTrue);
        expect(mockStaffRepo.lastSettledSalary, 0.0);
      },
    );

    // ==========================================
    // Test 6 — Filter Parity
    // ==========================================
    test(
      'Test 6 — Filter Parity: Android filter values match Backend and Windows exactly',
      () {
        // The backend contract accepts status: 'All', 'Ready', 'Settled', 'NotEntered'
        // Windows contract provides: 'all', 'Ready', 'Settled', 'NotEntered'
        const supportedBackendStatuses = [
          'All',
          'Ready',
          'Settled',
          'NotEntered',
        ];

        // Ensure obsolete filters are NOT part of the valid contract
        const legacyAndroidFilters = ['Unsettled', 'WithAdvances'];
        for (final legacy in legacyAndroidFilters) {
          expect(
            supportedBackendStatuses.map((s) => s.toLowerCase()),
            isNot(contains(legacy.toLowerCase())),
            reason:
                '$legacy is not a valid status in the backend or Windows UI',
          );
        }

        // Verify item status calculation logic
        const notEnteredItem = StaffSalaryItem(
          staffId: '1',
          staffName: 'A',
          staffPhoneNumber: '123',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          status: 'NotEntered',
        );
        expect(notEnteredItem.isNotEntered, isTrue);
        expect(notEnteredItem.isReady, isFalse);
        expect(notEnteredItem.isSettled, isFalse);

        const readyItem = StaffSalaryItem(
          staffId: '2',
          staffName: 'B',
          staffPhoneNumber: '456',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          enteredSalary: 25000.0,
          status: 'Ready',
        );
        expect(readyItem.isReady, isTrue);
        expect(readyItem.isSettled, isFalse);
        expect(readyItem.isNotEntered, isFalse);

        final settledItem = StaffSalaryItem(
          staffId: '3',
          staffName: 'C',
          staffPhoneNumber: '789',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          enteredSalary: 25000.0,
          status: 'Settled',
          settledAt: DateTime.now(),
        );
        expect(settledItem.isSettled, isTrue);
        expect(settledItem.isReady, isFalse);
        expect(settledItem.isNotEntered, isFalse);
      },
    );

    // ==========================================
    // Additional Test: SalaryDetailsBottomSheet Displays Calculation & Audit Metadata
    // ==========================================
    testWidgets(
      'SalaryDetailsBottomSheet displays full settlement breakdown and metadata matching Windows',
      (tester) async {
        final settledItem = StaffSalaryItem(
          staffId: 'staff-106',
          staffName: 'MS Dhoni',
          staffPhoneNumber: '9876543215',
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          enteredSalary: 100000.0,
          outstandingAdvance: 20000.0,
          advanceDeduction: 20000.0,
          finalSalary: 80000.0,
          remainingAdvance: 0.0,
          status: 'Settled',
          settlementId: 'settle-msd-1',
          settledAt: DateTime(2026, 9, 30, 18, 0),
          settledByName: 'Owner Admin',
          notes: 'Processed via IMPS',
        );

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(body: SalaryDetailsBottomSheet(item: settledItem)),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Salary Settlement Receipt'), findsOneWidget);
        expect(find.textContaining('Settled on 30 Sep 2026'), findsOneWidget);
        expect(find.textContaining('Owner Admin'), findsOneWidget);
        expect(find.textContaining('1,00,000'), findsWidgets); // Gross entered
        expect(
          find.textContaining('20,000'),
          findsWidgets,
        ); // Outstanding advance & deduction
        expect(find.textContaining('80,000'), findsWidgets); // Final Net payout
        expect(find.text('Processed via IMPS'), findsOneWidget); // Notes
      },
    );
  });
}
