import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/staff/data/staff_api.dart';
import 'package:e6_car_spa/features/staff/data/staff_repository.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_api.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_repository.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_model.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/pages/staff_advances_screen.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/widgets/create_advance_bottom_sheet.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/widgets/obsolete_advance_bottom_sheet.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/widgets/settle_advance_dialog.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:e6_car_spa/shared/widgets/app_empty_state.dart';
import 'package:e6_car_spa/shared/widgets/app_error_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class MockStaffAdvancesRepo extends StaffAdvancesRepository {
  MockStaffAdvancesRepo() : super(StaffAdvancesApi(Dio()));

  StaffAdvanceListResponse? advancesResponseToReturn;
  bool shouldThrow = false;
  int getCalls = 0;

  @override
  Future<StaffAdvanceListResponse> getStaffAdvances({
    int page = 1,
    int pageSize = 20,
    String? staffId,
    String? status,
    DateTime? fromDate,
    DateTime? toDate,
    String? search,
  }) async {
    getCalls++;
    if (shouldThrow) {
      throw const ApiException(message: 'Failed to load staff advances');
    }
    return advancesResponseToReturn!;
  }
}

class MockStaffRepo extends StaffRepository {
  MockStaffRepo() : super(StaffApi(Dio()));

  List<Staff> staffToReturn = [];

  @override
  Future<List<Staff>> getStaff() async => staffToReturn;
}

void main() {
  const sampleStaff = [
    Staff(
      id: 'staff-1',
      name: 'Ramesh Kumar',
      phoneNumber: '9840123456',
      email: 'ramesh@e6carspa.com',
      role: 'Supervisor',
      isActive: true,
      totalAdvances: 1,
      totalAdvanceAmount: 3000.0,
    ),
  ];

  final sampleAdvance = StaffAdvance(
    id: 'adv-101',
    staffId: 'staff-1',
    staffName: 'Ramesh Kumar',
    staffRole: 'Supervisor',
    amount: 3500.0,
    advanceDate: DateTime(2026, 9, 8),
    reason: 'Emergency advance',
    status: StaffAdvanceStatus.outstanding,
    createdAt: DateTime(2026, 9, 8),
  );

  group('CreateAdvanceBottomSheet Validations & Submissions', () {
    testWidgets('Validates non-positive amount on submit', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CreateAdvanceBottomSheet(
              activeStaff: sampleStaff,
              onSubmit: (req) async => null,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Submit without entering amount (default is empty/0)
      final submitBtn = find.widgetWithText(AppButton, 'Disburse Advance');
      expect(submitBtn, findsOneWidget);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(find.text('Please enter a valid advance amount greater than ₹0.'), findsOneWidget);
    });

    testWidgets('Validates amount exceeding maximum ceiling', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CreateAdvanceBottomSheet(
              activeStaff: sampleStaff,
              onSubmit: (req) async => null,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter amount > 999999.99
      await tester.enterText(find.byType(TextField).first, '1000000.00');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Disburse Advance'));
      await tester.pumpAndSettle();

      expect(find.text('Amount cannot exceed ₹999,999.99.'), findsOneWidget);
    });

    testWidgets('Validates custom reason when Other (Custom) is selected and reason is empty', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CreateAdvanceBottomSheet(
              activeStaff: sampleStaff,
              onSubmit: (req) async => null,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid amount
      await tester.enterText(find.byType(TextField).first, '2500');
      await tester.pumpAndSettle();

      // Select 'Other (Custom)' choice chip
      await tester.tap(find.text('Other (Custom)'));
      await tester.pumpAndSettle();

      // Submit without entering custom reason
      await tester.tap(find.widgetWithText(AppButton, 'Disburse Advance'));
      await tester.pumpAndSettle();

      expect(find.text('Please specify a reason for the advance.'), findsOneWidget);
    });

    testWidgets('Preserves form input and displays error when onSubmit fails', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CreateAdvanceBottomSheet(
              activeStaff: sampleStaff,
              onSubmit: (req) async => 'API 400: Monthly advance limit reached for staff member',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '4000');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Disburse Advance'));
      await tester.pumpAndSettle();

      // Verify error message is rendered
      expect(find.text('API 400: Monthly advance limit reached for staff member'), findsOneWidget);
      // Verify entered amount is preserved
      expect(find.text('4000'), findsOneWidget);
    });
  });

  group('SettleAdvanceDialog Operations', () {
    testWidgets('Renders advance details and handles settlement failure gracefully', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SettleAdvanceDialog(
              advance: sampleAdvance,
              onSettle: (id) async => 'API 409: Advance has already been settled.',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Settle Staff Advance'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Emergency advance'), findsOneWidget);
      expect(find.text('₹3,500.00'), findsOneWidget);

      // Tap settle button
      await tester.tap(find.widgetWithText(ElevatedButton, 'Settle Advance'));
      await tester.pumpAndSettle();

      expect(find.text('API 409: Advance has already been settled.'), findsOneWidget);
    });

    testWidgets('Successful settlement calls onSettle and dismisses dialog', (tester) async {
      String? settledId;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () => showDialog(
                  context: context,
                  builder: (_) => SettleAdvanceDialog(
                    advance: sampleAdvance,
                    onSettle: (id) async {
                      settledId = id;
                      return null;
                    },
                  ),
                ),
                child: const Text('Open Settle'),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      await tester.tap(find.text('Open Settle'));
      await tester.pumpAndSettle();

      expect(find.text('Settle Staff Advance'), findsOneWidget);
      await tester.tap(find.widgetWithText(ElevatedButton, 'Settle Advance'));
      await tester.pumpAndSettle();

      expect(settledId, 'adv-101');
      expect(find.text('Settle Staff Advance'), findsNothing);
    });
  });

  group('ObsoleteAdvanceBottomSheet Operations', () {
    testWidgets('Validates custom reason length minimum 3 characters', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ObsoleteAdvanceBottomSheet(
              advance: sampleAdvance,
              onObsolete: (id, reason) async => null,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap 'Other (Custom)'
      await tester.tap(find.text('Other (Custom)'));
      await tester.pumpAndSettle();

      // Enter less than 3 chars
      await tester.enterText(find.byType(TextField).first, 'ab');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Confirm Obsolete'));
      await tester.pumpAndSettle();

      expect(find.text('Reason must be at least 3 characters long.'), findsOneWidget);
    });

    testWidgets('Displays error when onObsolete fails and preserves reason', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ObsoleteAdvanceBottomSheet(
              advance: sampleAdvance,
              onObsolete: (id, reason) async => 'API 403: Insufficient permission to obsolete advances',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Confirm Obsolete'));
      await tester.pumpAndSettle();

      expect(find.text('API 403: Insufficient permission to obsolete advances'), findsOneWidget);
    });
  });

  group('StaffAdvancesScreen Empty and Error States', () {
    testWidgets('Renders empty state when advances list is empty', (tester) async {
      final mockAdvancesRepo = MockStaffAdvancesRepo()
        ..advancesResponseToReturn = const StaffAdvanceListResponse(
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 20,
          summary: StaffAdvanceSummary(
            outstandingAmount: 0.0,
            settledAmount: 0.0,
            totalActiveCount: 0,
          ),
        );
      final mockStaffRepo = MockStaffRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            staffAdvancesRepositoryProvider.overrideWithValue(mockAdvancesRepo),
            staffRepositoryProvider.overrideWithValue(mockStaffRepo),
          ],
          child: const MaterialApp(
            home: StaffAdvancesScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(AppEmptyState), findsOneWidget);
      expect(find.text('No staff advances found'), findsOneWidget);
    });

    testWidgets('Renders error state when repository throws and allows retry', (tester) async {
      final mockAdvancesRepo = MockStaffAdvancesRepo()..shouldThrow = true;
      final mockStaffRepo = MockStaffRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            staffAdvancesRepositoryProvider.overrideWithValue(mockAdvancesRepo),
            staffRepositoryProvider.overrideWithValue(mockStaffRepo),
          ],
          child: const MaterialApp(
            home: StaffAdvancesScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(AppErrorState), findsOneWidget);
      expect(find.text('Failed to load staff advances'), findsOneWidget);

      // Fix repo and retry
      mockAdvancesRepo.shouldThrow = false;
      mockAdvancesRepo.advancesResponseToReturn = StaffAdvanceListResponse(
        items: [sampleAdvance],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        summary: const StaffAdvanceSummary(
          outstandingAmount: 3500.0,
          settledAmount: 0.0,
          totalActiveCount: 1,
        ),
      );

      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();

      expect(find.byType(AppErrorState), findsNothing);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
    });
  });
}
