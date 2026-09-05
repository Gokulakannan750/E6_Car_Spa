import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_detail_screen.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/assign_staff_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/daily_staff_assignment_card.dart';
import 'package:e6_car_spa/features/staff/data/staff_api.dart';
import 'package:e6_car_spa/features/staff/data/staff_repository.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';

class _FakeStaffRepository extends StaffRepository {
  _FakeStaffRepository() : super(StaffApi(Dio()));

  @override
  Future<List<Staff>> getStaff() async {
    return [
      const Staff(
        id: 'staff-1',
        name: 'Arun Kumar',
        phoneNumber: '9876543210',
        role: 'Technician',
        isActive: true,
      ),
      const Staff(
        id: 'staff-2',
        name: 'Bala Chandran',
        phoneNumber: '9876543211',
        role: 'Washer',
        isActive: true,
      ),
      const Staff(
        id: 'staff-3',
        name: 'Dinesh Karthik',
        phoneNumber: '9876543212',
        role: 'Detailer',
        isActive: true,
      ),
    ];
  }
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  group('Showroom Multi-Staff & Vehicles Attended Widget Tests', () {
    testWidgets('AssignStaffModalSheet allows selecting multiple staff and entering vehicles attended', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      List<String>? assignedStaffIds;
      int? assignedVehicles;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            staffRepositoryProvider.overrideWithValue(_FakeStaffRepository()),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => ElevatedButton(
                  onPressed: () {
                    showModalBottomSheet(
                      context: context,
                      builder: (_) => AssignStaffModalSheet(
                        showroomName: 'Erode Showroom',
                        selectedDate: DateTime(2026, 9, 5),
                        alreadyAssignedStaffIds: const {'staff-3'}, // staff-3 already assigned
                        onAssign: (staffIds, initialVehicles) async {
                          assignedStaffIds = staffIds;
                          assignedVehicles = initialVehicles;
                        },
                      ),
                    );
                  },
                  child: const Text('Open Sheet'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      // Check header and initial UI
      expect(find.text('Assign Staff Members'), findsOneWidget);
      expect(find.text('Showroom: Erode Showroom'), findsOneWidget);
      expect(find.text('Arun Kumar'), findsOneWidget);
      expect(find.text('Bala Chandran'), findsOneWidget);
      expect(find.text('Dinesh Karthik'), findsOneWidget);
      expect(find.text('Already Assigned'), findsOneWidget); // staff-3 is disabled

      // Vehicles attended defaults to 0
      expect(find.byKey(const Key('vehicles_attended_input')), findsOneWidget);
      expect(find.text('0'), findsWidgets);

      // Select staff-1 (Arun Kumar)
      await tester.tap(find.widgetWithText(ListTile, 'Arun Kumar'));
      await tester.pumpAndSettle();

      // Verify chip appeared
      expect(find.text('Selected Staff (1):'), findsOneWidget);
      expect(find.text('Assign Staff'), findsOneWidget);

      // Select staff-2 (Bala Chandran)
      await tester.tap(find.widgetWithText(ListTile, 'Bala Chandran'));
      await tester.pumpAndSettle();

      // Verify multiple selection
      expect(find.text('Selected Staff (2):'), findsOneWidget);
      expect(find.text('Assign (2) Staff'), findsOneWidget);

      // Change vehicles attended to 4
      await tester.enterText(find.byKey(const Key('vehicles_attended_input')), '4');
      await tester.pumpAndSettle();

      // Submit
      await tester.tap(find.byKey(const Key('modal_assign_button')));
      await tester.pumpAndSettle();

      expect(assignedStaffIds, containsAll(['staff-1', 'staff-2']));
      expect(assignedVehicles, 4);
    });

    testWidgets('AssignStaffModalSheet allows removing selected staff chip before submission', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      List<String>? assignedStaffIds;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            staffRepositoryProvider.overrideWithValue(_FakeStaffRepository()),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => ElevatedButton(
                  onPressed: () {
                    showModalBottomSheet(
                      context: context,
                      builder: (_) => AssignStaffModalSheet(
                        showroomName: 'Erode Showroom',
                        selectedDate: DateTime(2026, 9, 5),
                        alreadyAssignedStaffIds: const {},
                        onAssign: (staffIds, initialVehicles) async {
                          assignedStaffIds = staffIds;
                        },
                      ),
                    );
                  },
                  child: const Text('Open Sheet'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      // Select two staff
      await tester.tap(find.widgetWithText(ListTile, 'Arun Kumar'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ListTile, 'Bala Chandran'));
      await tester.pumpAndSettle();

      expect(find.text('Selected Staff (2):'), findsOneWidget);

      // Delete Arun Kumar chip
      final closeIcons = find.byIcon(Icons.close);
      expect(closeIcons, findsWidgets);
      await tester.tap(closeIcons.first);
      await tester.pumpAndSettle();

      expect(find.text('Selected Staff (1):'), findsOneWidget);

      // Submit
      await tester.tap(find.byKey(const Key('modal_assign_button')));
      await tester.pumpAndSettle();

      expect(assignedStaffIds, equals(['staff-2']));
    });

    testWidgets('DailyStaffAssignmentCard displays vehicles attended and opens edit dialog', (tester) async {
      int? editedVehicles;

      final assignment = DailyStaffAssignment(
        id: 'assign-1',
        showroomId: 'sr-1',
        showroomName: 'Erode Showroom',
        staffId: 'staff-1',
        staffName: 'Arun Kumar',
        staffPhone: '9876543210',
        staffRole: 'Technician',
        date: DateTime.now(),
        vehiclesAttended: 3,
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DailyStaffAssignmentCard(
              assignment: assignment,
              onEditVehicles: (newCount) async {
                editedVehicles = newCount;
              },
            ),
          ),
        ),
      );

      expect(find.text('Arun Kumar'), findsOneWidget);
      expect(find.text('Technician'), findsOneWidget);
      expect(find.text('3'), findsOneWidget); // vehicles attended badge

      // Tap on the vehicles badge to edit
      await tester.tap(find.text('3'));
      await tester.pumpAndSettle();

      expect(find.text('Edit Vehicles Attended'), findsOneWidget);
      expect(find.byKey(const Key('edit_vehicles_attended_input')), findsOneWidget);

      // Change value to 8
      await tester.enterText(find.byKey(const Key('edit_vehicles_attended_input')), '8');
      await tester.pumpAndSettle();

      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(editedVehicles, 8);
    });

    testWidgets('DailyStaffAssignmentCard respects isLocked: true (no edit, no delete, lock icon visible)', (tester) async {
      bool removeCalled = false;
      bool editCalled = false;

      final assignment = DailyStaffAssignment(
        id: 'assign-1',
        showroomId: 'sr-1',
        showroomName: 'Erode Showroom',
        staffId: 'staff-1',
        staffName: 'Arun Kumar',
        staffPhone: '9876543210',
        staffRole: 'Technician',
        date: DateTime.now(),
        vehiclesAttended: 5,
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DailyStaffAssignmentCard(
              assignment: assignment,
              isLocked: true,
              onRemove: () => removeCalled = true,
              onEditVehicles: (newCount) async {
                editCalled = true;
              },
            ),
          ),
        ),
      );

      expect(find.text('Arun Kumar'), findsOneWidget);
      expect(find.text('5'), findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget); // Lock icon shown

      // Delete icon button should NOT exist when isLocked is true
      expect(find.byIcon(Icons.delete_outline), findsNothing);

      // Tapping badge should not open dialog
      await tester.tap(find.text('5'));
      await tester.pumpAndSettle();

      expect(find.text('Edit Vehicles Attended'), findsNothing);
      expect(editCalled, isFalse);
      expect(removeCalled, isFalse);
    });

    testWidgets('ShowroomDetailScreen renders unconfirmed attendance banner on narrow 320px width without overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final fakeShowroomRepo = _FakeShowroomRepositoryForWidget();
      final showroom = Showroom(
        id: 'showroom-1',
        name: 'Erode Prime Hub',
        address: '142 Brough Road, Erode',
        phone: '9840154321',
        isActive: true,
        activeStaffCountToday: 2,
        createdAt: DateTime(2026, 9, 5),
      );

      const user = AuthUser(
        id: 'user-1',
        fullName: 'Admin User',
        username: 'admin',
        role: 'Owner',
        isOwner: true,
        permissions: ['showroom.confirm_attendance', 'showroom.assign_staff'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(user),
            showroomRepositoryProvider.overrideWithValue(fakeShowroomRepo),
            staffRepositoryProvider.overrideWithValue(_FakeStaffRepository()),
          ],
          child: MaterialApp(
            home: ShowroomDetailScreen(showroom: showroom),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // No RenderFlex overflow
      expect(tester.takeException(), isNull);

      // Verify Unconfirmed banner elements
      expect(find.text('Attendance Not Confirmed'), findsOneWidget);
      expect(find.text('Open for edits'), findsOneWidget);
      expect(find.text('Confirm Attendance'), findsOneWidget);
      expect(find.byKey(const Key('confirm_attendance_button')), findsOneWidget);
    });

    testWidgets('ShowroomDetailScreen renders confirmed attendance banner on narrow 320px width without overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final fakeShowroomRepo = _FakeShowroomRepositoryForWidget(isConfirmed: true);
      final showroom = Showroom(
        id: 'showroom-1',
        name: 'Erode Prime Hub',
        address: '142 Brough Road, Erode',
        phone: '9840154321',
        isActive: true,
        activeStaffCountToday: 2,
        createdAt: DateTime(2026, 9, 5),
      );

      const user = AuthUser(
        id: 'user-1',
        fullName: 'Admin User',
        username: 'admin',
        role: 'Owner',
        isOwner: true,
        permissions: ['showroom.confirm_attendance', 'showroom.assign_staff'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(user),
            showroomRepositoryProvider.overrideWithValue(fakeShowroomRepo),
            staffRepositoryProvider.overrideWithValue(_FakeStaffRepository()),
          ],
          child: MaterialApp(
            home: ShowroomDetailScreen(showroom: showroom),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // No RenderFlex overflow
      expect(tester.takeException(), isNull);

      // Verify Confirmed banner elements
      expect(find.text('Attendance Confirmed'), findsOneWidget);
      expect(find.text('Locked'), findsOneWidget);
      expect(find.byKey(const Key('unlock_attendance_button')), findsOneWidget);
    });
  });
}

class _FakeShowroomRepositoryForWidget extends ShowroomRepository {
  final bool isConfirmed;

  _FakeShowroomRepositoryForWidget({this.isConfirmed = false})
      : super(ShowroomApi(Dio()));

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    return [
      Showroom(
        id: 'showroom-1',
        name: 'Erode Prime Hub',
        address: '142 Brough Road, Erode',
        phone: '9840154321',
        isActive: true,
        activeStaffCountToday: 2,
        createdAt: DateTime(2026, 9, 5),
      ),
    ];
  }

  @override
  Future<DailyStaffResponse> getDailyStaff(String showroomId, DateTime date) async {
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Erode Prime Hub',
      date: date,
      isAttendanceConfirmed: isConfirmed,
      attendanceConfirmedByName: isConfirmed ? 'Admin User' : null,
      attendanceConfirmedAt: isConfirmed ? DateTime(2026, 9, 5, 14, 30) : null,
      staffAssignments: [
        DailyStaffAssignment(
          id: 'assign-1',
          showroomId: showroomId,
          showroomName: 'Erode Prime Hub',
          staffId: 'staff-1',
          staffName: 'Arun Kumar',
          staffPhone: '9876543210',
          staffRole: 'Technician',
          date: date,
          vehiclesAttended: 4,
          createdAt: DateTime(2026, 9, 5),
        ),
      ],
      totalVehiclesAttended: 4,
    );
  }
}
