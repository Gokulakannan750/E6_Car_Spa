import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
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
    return const [
      Staff(
        id: 'staff-1',
        staffMasterId: 'STF-01',
        name: 'Arun Kumar',
        phoneNumber: '9876543210',
        role: 'Technician',
        defaultShowroomId: 'sr-honda',
        defaultShowroomName: 'Honda Showroom',
        isActive: true,
      ),
      Staff(
        id: 'staff-2',
        staffMasterId: 'STF-02',
        name: 'Bala Chandran',
        phoneNumber: '9876543211',
        role: 'Washer',
        defaultShowroomId: 'sr-skoda',
        defaultShowroomName: 'Skoda Showroom',
        isActive: true,
      ),
      Staff(
        id: 'staff-3',
        staffMasterId: 'STF-03',
        name: 'Dinesh Karthik',
        phoneNumber: '9876543212',
        role: 'Detailer',
        defaultShowroomId: 'sr-skoda',
        defaultShowroomName: 'Skoda Showroom',
        isActive: true,
      ),
    ];
  }
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  group('Showroom Work Sessions Widget Tests', () {
    testWidgets(
      'AssignStaffModalSheet handles selection, presets, and auto-calculates hours',
      (tester) async {
        tester.view.physicalSize = const Size(1080, 2400);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(() => tester.view.resetPhysicalSize());

        String? assignedStaffId;
        String? assignedStart;
        String? assignedEnd;
        String? assignedType;
        String? assignedReason;

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
                        isScrollControlled: true,
                        builder: (_) => AssignStaffModalSheet(
                          showroomId: 'sr-skoda',
                          showroomName: 'Skoda Showroom',
                          selectedDate: DateTime(2026, 10, 19),
                          alreadyAssignedStaffIds: const {'staff-3'},
                          onAssign:
                              ({
                                required staffId,
                                required startTime,
                                required endTime,
                                required assignmentType,
                                transferReason,
                                notes,
                              }) async {
                                assignedStaffId = staffId;
                                assignedStart = startTime;
                                assignedEnd = endTime;
                                assignedType = assignmentType;
                                assignedReason = transferReason;
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
        expect(find.text('Assign Staff Work Session'), findsOneWidget);
        expect(find.text('Showroom: Skoda Showroom'), findsOneWidget);
        expect(find.text('Arun Kumar'), findsOneWidget);
        expect(find.text('Bala Chandran'), findsOneWidget);
        expect(find.text('Dinesh Karthik'), findsOneWidget);
        expect(
          find.text('Assigned'),
          findsOneWidget,
        ); // staff-3 already assigned

        // Select staff-1 (Arun Kumar whose home showroom is Honda -> Temporary Transfer to Skoda)
        await tester.tap(find.widgetWithText(ListTile, 'Arun Kumar'));
        await tester.pumpAndSettle();

        // Verify Temporary Transfer detection and home showroom display
        expect(find.text('Temporary Transfer'), findsWidgets);
        expect(find.text('Home: Honda Showroom'), findsOneWidget);

        // Verify default Full Day preset hours (09:00 to 18:00 = 9h)
        expect(find.text('09:00'), findsOneWidget);
        expect(find.text('18:00'), findsOneWidget);
        expect(find.text('9h'), findsOneWidget);

        // Select Morning preset (09:00 to 14:00 = 5h)
        await tester.tap(find.text('Morning (09:00 – 14:00)'));
        await tester.pumpAndSettle();

        expect(find.text('14:00'), findsOneWidget);
        expect(find.text('5h'), findsOneWidget);

        // Select Afternoon preset (14:00 to 18:00 = 4h)
        await tester.tap(find.text('Afternoon (14:00 – 18:00)'));
        await tester.pumpAndSettle();

        expect(find.text('14:00'), findsOneWidget);
        expect(find.text('18:00'), findsOneWidget);
        expect(find.text('4h'), findsOneWidget);

        // Re-select Morning preset (09:00 to 14:00 = 5h) for submission
        await tester.tap(find.text('Morning (09:00 – 14:00)'));
        await tester.pumpAndSettle();

        expect(find.text('09:00'), findsOneWidget);
        expect(find.text('14:00'), findsOneWidget);
        expect(find.text('5h'), findsOneWidget);

        // Enter transfer reason
        await tester.enterText(
          find.widgetWithText(
            TextField,
            'e.g. Covering shift / Cross-showroom support',
          ),
          'Covering morning shift',
        );
        await tester.pumpAndSettle();

        // Submit assignment
        await tester.tap(find.byKey(const Key('modal_assign_button')));
        await tester.pumpAndSettle();

        expect(assignedStaffId, 'staff-1');
        expect(assignedStart, '09:00');
        expect(assignedEnd, '14:00');
        expect(assignedType, 'TemporaryTransfer');
        expect(assignedReason, 'Covering morning shift');
      },
    );

    testWidgets(
      'AssignStaffModalSheet displays error banner when backend returns 409 conflict',
      (tester) async {
        tester.view.physicalSize = const Size(1080, 2400);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(() => tester.view.resetPhysicalSize());

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
                        isScrollControlled: true,
                        builder: (_) => AssignStaffModalSheet(
                          showroomId: 'sr-skoda',
                          showroomName: 'Skoda Showroom',
                          selectedDate: DateTime(2026, 10, 19),
                          alreadyAssignedStaffIds: const {},
                          onAssign:
                              ({
                                required staffId,
                                required startTime,
                                required endTime,
                                required assignmentType,
                                transferReason,
                                notes,
                              }) async {
                                throw const ConflictException(
                                  message:
                                      'Ramesh is already assigned to Skoda from 09:00 to 14:00 on this date.',
                                );
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

        // Select staff-2 (Bala Chandran)
        await tester.tap(find.widgetWithText(ListTile, 'Bala Chandran'));
        await tester.pumpAndSettle();

        // Tap Assign
        await tester.tap(find.byKey(const Key('modal_assign_button')));
        await tester.pumpAndSettle();

        // Modal must stay open and display conflict error
        expect(
          find.textContaining(
            'Ramesh is already assigned to Skoda from 09:00 to 14:00',
          ),
          findsOneWidget,
        );
        expect(find.byKey(const Key('modal_assign_button')), findsOneWidget);
      },
    );

    testWidgets(
      'DailyStaffAssignmentCard displays staff work session details without vehicle counts',
      (tester) async {
        bool editCalled = false;
        bool removeCalled = false;

        final assignment = DailyStaffAssignment(
          id: 'assign-1',
          showroomId: 'sr-skoda',
          showroomName: 'Skoda Showroom',
          staffId: 'staff-1',
          staffMasterId: 'STF-01',
          staffName: 'Ramesh Detailer',
          staffPhone: '9876543210',
          staffRole: 'Detailer',
          date: DateTime(2026, 10, 19),
          startTime: '09:00',
          endTime: '14:00',
          workingHours: 5.0,
          assignmentType: 'TemporaryTransfer',
          homeShowroomId: 'sr-honda',
          homeShowroomName: 'Honda Showroom',
          transferReason: 'Covering Ramesh shift',
          createdAt: DateTime.now(),
        );

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: DailyStaffAssignmentCard(
                assignment: assignment,
                onEdit: () => editCalled = true,
                onRemove: () => removeCalled = true,
              ),
            ),
          ),
        );

        // Verify staff info
        expect(find.text('Ramesh Detailer'), findsOneWidget);
        expect(find.text('Detailer'), findsOneWidget);
        expect(find.text('#STF-01'), findsOneWidget);

        // Verify timing & hours
        expect(find.text('09:00 – 14:00'), findsOneWidget);
        expect(find.text('5h'), findsOneWidget);

        // Verify Temporary Transfer and Home showroom
        expect(find.text('Temporary Transfer'), findsOneWidget);
        expect(find.text('Home: Honda Showroom'), findsOneWidget);
        expect(find.textContaining('Covering Ramesh shift'), findsOneWidget);

        // Verify NO vehicle counters
        expect(find.byIcon(Icons.directions_car_outlined), findsNothing);

        // Test Edit button
        final editBtn = find.byTooltip('Edit Session');
        expect(editBtn, findsOneWidget);
        await tester.tap(editBtn);
        expect(editCalled, isTrue);

        // Test Remove button
        final removeBtn = find.byTooltip('Remove Session');
        expect(removeBtn, findsOneWidget);
        await tester.tap(removeBtn);
        await tester.pumpAndSettle();

        // Dialog confirmation
        expect(find.text('Remove Staff Assignment'), findsOneWidget);
        await tester.tap(find.widgetWithText(FilledButton, 'Remove'));
        await tester.pumpAndSettle();
        expect(removeCalled, isTrue);
      },
    );

    testWidgets(
      'DailyStaffAssignmentCard respects isLocked: true (hides edit and remove buttons)',
      (tester) async {
        final assignment = DailyStaffAssignment(
          id: 'assign-1',
          showroomId: 'sr-skoda',
          showroomName: 'Skoda Showroom',
          staffId: 'staff-1',
          staffName: 'Arun Kumar',
          staffPhone: '9876543210',
          date: DateTime.now(),
          startTime: '09:00',
          endTime: '18:00',
          workingHours: 9.0,
          createdAt: DateTime.now(),
        );

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: DailyStaffAssignmentCard(
                assignment: assignment,
                isLocked: true,
              ),
            ),
          ),
        );

        expect(find.text('Arun Kumar'), findsOneWidget);
        expect(find.text('09:00 – 18:00'), findsOneWidget);
        expect(find.text('9h'), findsOneWidget);
        expect(find.text('Locked'), findsOneWidget);

        // Edit and remove buttons must not exist
        expect(find.byIcon(Icons.edit_outlined), findsNothing);
        expect(find.byIcon(Icons.delete_outline), findsNothing);
      },
    );

    testWidgets(
      'ShowroomDetailScreen renders unconfirmed and confirmed banners on narrow 320px screen',
      (tester) async {
        tester.view.physicalSize = const Size(320, 800);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(() => tester.view.resetPhysicalSize());

        final fakeShowroomRepo = _FakeShowroomRepositoryForWidget();
        final showroom = Showroom(
          id: 'showroom-1',
          name: 'Skoda Prime Hub',
          address: '142 Brough Road',
          phone: '9840154321',
          isActive: true,
          activeStaffCountToday: 1,
          createdAt: DateTime(2026, 10, 19),
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
            child: MaterialApp(home: ShowroomDetailScreen(showroom: showroom)),
          ),
        );

        await tester.pumpAndSettle();

        // No RenderFlex overflow
        expect(tester.takeException(), isNull);

        // Verify Work Session metrics and unconfirmed banner
        expect(find.text('Staff on Duty'), findsWidgets);
        expect(find.text('Scheduled Hours'), findsOneWidget);
        expect(find.text('Attendance Not Confirmed'), findsOneWidget);
        expect(find.text('Confirm Attendance'), findsOneWidget);
      },
    );

    testWidgets(
      'ShowroomDetailScreen renders confirmed locked banner on narrow 320px screen',
      (tester) async {
        tester.view.physicalSize = const Size(320, 800);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(() => tester.view.resetPhysicalSize());

        final fakeShowroomRepo = _FakeShowroomRepositoryForWidget(
          isConfirmed: true,
        );
        final showroom = Showroom(
          id: 'showroom-1',
          name: 'Skoda Prime Hub',
          address: '142 Brough Road',
          phone: '9840154321',
          isActive: true,
          activeStaffCountToday: 1,
          createdAt: DateTime(2026, 10, 19),
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
            child: MaterialApp(home: ShowroomDetailScreen(showroom: showroom)),
          ),
        );

        await tester.pumpAndSettle();

        // No RenderFlex overflow
        expect(tester.takeException(), isNull);

        // Verify Confirmed banner and card locked status
        expect(find.text('Attendance Confirmed'), findsOneWidget);
        expect(
          find.text('Locked'),
          findsNWidgets(2),
        ); // 1 in banner, 1 in staff assignment card
        expect(
          find.byKey(const Key('unlock_attendance_button')),
          findsOneWidget,
        );
      },
    );
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
        name: 'Skoda Prime Hub',
        address: '142 Brough Road',
        phone: '9840154321',
        isActive: true,
        activeStaffCountToday: 1,
        createdAt: DateTime(2026, 10, 19),
      ),
    ];
  }

  @override
  Future<DailyStaffResponse> getDailyStaff(
    String showroomId,
    DateTime date,
  ) async {
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Skoda Prime Hub',
      date: date,
      isAttendanceConfirmed: isConfirmed,
      attendanceConfirmedByName: isConfirmed ? 'Admin User' : null,
      attendanceConfirmedAt: isConfirmed
          ? DateTime(2026, 10, 19, 14, 30)
          : null,
      staffAssignments: [
        DailyStaffAssignment(
          id: 'assign-1',
          showroomId: showroomId,
          showroomName: 'Skoda Prime Hub',
          staffId: 'staff-1',
          staffName: 'Arun Kumar',
          staffPhone: '9876543210',
          staffRole: 'Technician',
          date: date,
          startTime: '09:00',
          endTime: '18:00',
          workingHours: 9.0,
          createdAt: DateTime(2026, 10, 19),
        ),
      ],
      totalVehiclesAttended: 0,
    );
  }
}
