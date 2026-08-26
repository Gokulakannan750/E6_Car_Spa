import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/staff_card.dart';
import 'package:e6_car_spa/features/staff/providers/staff_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final staffList = [
    const Staff(
      id: 'staff-1',
      name: 'Ramesh Supervisor',
      phoneNumber: '9876543210',
      email: 'ramesh@e6carspa.com',
      role: 'Floor Manager',
      isActive: true,
      totalAdvances: 2,
      totalAdvanceAmount: 5000.0,
    ),
    const Staff(
      id: 'staff-2',
      name: 'Suresh Detailer',
      phoneNumber: '9876543211',
      email: 'suresh@e6carspa.com',
      role: 'Detailer',
      isActive: false,
      totalAdvances: 0,
      totalAdvanceAmount: 0.0,
    ),
  ];

  test('StaffState filters by status and search query', () {
    var state = StaffState(staffList: staffList);

    expect(state.filteredStaff.length, 2);
    expect(state.activeStaff.length, 1);

    // Filter Active only
    state = state.copyWith(statusFilter: StaffStatusFilter.active);
    expect(state.filteredStaff.length, 1);
    expect(state.filteredStaff.first.name, 'Ramesh Supervisor');

    // Filter Inactive only
    state = state.copyWith(statusFilter: StaffStatusFilter.inactive);
    expect(state.filteredStaff.length, 1);
    expect(state.filteredStaff.first.name, 'Suresh Detailer');

    // Search query
    state = state.copyWith(statusFilter: StaffStatusFilter.all, searchQuery: 'Ramesh');
    expect(state.filteredStaff.length, 1);
    expect(state.filteredStaff.first.name, 'Ramesh Supervisor');
  });

  testWidgets('StaffCard renders + Advance and triggers callback', (tester) async {
    bool advanceTapped = false;
    bool editTapped = false;
    bool historyTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StaffCard(
            staff: staffList.first,
            canEdit: true,
            canCreateAdvance: true,
            onAddAdvance: () => advanceTapped = true,
            onEdit: () => editTapped = true,
            onHistory: () => historyTapped = true,
          ),
        ),
      ),
    );

    expect(find.text('Ramesh Supervisor'), findsOneWidget);
    expect(find.text('Floor Manager'), findsOneWidget);
    expect(find.text('+ Advance'), findsOneWidget);
    expect(find.text('Advance History'), findsOneWidget);

    await tester.tap(find.text('+ Advance'));
    expect(advanceTapped, isTrue);

    await tester.tap(find.text('Advance History'));
    expect(historyTapped, isTrue);

    await tester.tap(find.byTooltip('Edit Staff Member'));
    expect(editTapped, isTrue);
  });
}
