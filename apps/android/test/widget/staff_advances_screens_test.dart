import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_api.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_repository.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_model.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/widgets/advance_kpi_card.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/widgets/advance_card.dart';
import 'package:e6_car_spa/features/staff/data/staff_api.dart';
import 'package:e6_car_spa/features/staff/data/staff_repository.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/staff_card.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/pages/staff_advances_screen.dart';

class FakeStaffAdvancesApi extends StaffAdvancesApi {
  FakeStaffAdvancesApi() : super(Dio());

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
    return const StaffAdvanceListResponse(
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
  }
}

class FakeStaffApi extends StaffApi {
  FakeStaffApi() : super(Dio());

  @override
  Future<List<Staff>> getStaff() async {
    return [];
  }
}

void main() {
  group('Staff Advances Widget Tests', () {
    testWidgets('AdvanceKpiSection renders KPI figures accurately', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AdvanceKpiSection(
              outstandingAmount: 3000.0,
              settledAmount: 4500.0,
              activeCount: 2,
            ),
          ),
        ),
      );

      expect(find.text('Outstanding'), findsOneWidget);
      expect(find.text('₹3,000.00'), findsOneWidget);
      expect(find.text('Settled'), findsOneWidget);
      expect(find.text('₹4,500.00'), findsOneWidget);
      expect(find.text('Active Total'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
    });

    testWidgets('AdvanceCard renders advance data and action buttons', (tester) async {
      final advance = StaffAdvance(
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

      bool settleClicked = false;
      bool obsoleteClicked = false;
      bool historyClicked = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdvanceCard(
              advance: advance,
              canSettle: true,
              canObsolete: true,
              onSettle: () => settleClicked = true,
              onObsolete: () => obsoleteClicked = true,
              onHistory: () => historyClicked = true,
            ),
          ),
        ),
      );

      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Detailer'), findsOneWidget);
      expect(find.text('₹3,000.00'), findsOneWidget);
      expect(find.text('Outstanding'), findsOneWidget);
      expect(find.text('Settle'), findsOneWidget);
      expect(find.text('Mark Obsolete'), findsOneWidget);
      expect(find.text('History'), findsOneWidget);

      await tester.tap(find.text('Settle'));
      expect(settleClicked, isTrue);

      await tester.tap(find.text('Mark Obsolete'));
      expect(obsoleteClicked, isTrue);

      await tester.tap(find.text('History'));
      expect(historyClicked, isTrue);
    });

    testWidgets('StaffCard renders staff details and history action', (tester) async {
      const staff = Staff(
        id: 'staff-1',
        name: 'Ramesh Kumar',
        phoneNumber: '9840123456',
        email: 'ramesh@e6carspa.com',
        role: 'Supervisor',
        isActive: true,
        totalAdvances: 2,
        totalAdvanceAmount: 4500.0,
      );

      bool editClicked = false;
      bool historyClicked = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StaffCard(
              staff: staff,
              canEdit: true,
              onEdit: () => editClicked = true,
              onHistory: () => historyClicked = true,
            ),
          ),
        ),
      );

      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Supervisor'), findsOneWidget);
      expect(find.text('9840123456'), findsOneWidget);
      expect(find.text('ramesh@e6carspa.com'), findsOneWidget);
      expect(find.text('Total Advances: 2'), findsOneWidget);
      expect(find.text('₹4,500.00'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.edit_outlined));
      expect(editClicked, isTrue);

      await tester.tap(find.text('Advance History'));
      expect(historyClicked, isTrue);
    });

    testWidgets('StaffAdvancesScreen renders tabs and app bar', (tester) async {
      final fakeAdvancesApi = FakeStaffAdvancesApi();
      final fakeStaffApi = FakeStaffApi();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            staffAdvancesApiProvider.overrideWithValue(fakeAdvancesApi),
            staffApiProvider.overrideWithValue(fakeStaffApi),
          ],
          child: const MaterialApp(
            home: StaffAdvancesScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify title & tabs
      expect(find.text('Staff Advances'), findsOneWidget);
      expect(find.text('Advances'), findsOneWidget);
      expect(find.text('Staff Directory'), findsOneWidget);
    });
  });
}
