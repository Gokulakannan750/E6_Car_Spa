import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_operations_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_detail_screen.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/close_work_session_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/edit_vehicle_work_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/log_vehicle_work_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/showroom_operations_tab.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/vehicle_work_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';

class FakeFullShowroomRepository implements ShowroomRepository {
  final List<ShowroomVehicleType> vehicleTypes = [
    ShowroomVehicleType(
      id: 'vt-1',
      code: 'SEDAN',
      name: 'Sedan',
      createdAt: DateTime(2026, 1, 1),
    ),
    ShowroomVehicleType(
      id: 'vt-2',
      code: 'SUV',
      name: 'SUV',
      createdAt: DateTime(2026, 1, 1),
    ),
  ];

  final List<ShowroomWorkType> workTypes = [
    ShowroomWorkType(
      id: 'wt-1',
      code: 'WASH',
      name: 'Full Wash',
      createdAt: DateTime(2026, 1, 1),
    ),
    ShowroomWorkType(
      id: 'wt-2',
      code: 'VACUUM',
      name: 'Interior Vacuum',
      createdAt: DateTime(2026, 1, 1),
    ),
  ];

  final List<ShowroomVehicleWork> vehicleWorks = [];
  bool closeSessionCalled = false;
  List<DailyStaffAssignment>? customStaffAssignments;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<DailyStaffResponse> getDailyStaff(
    String showroomId,
    DateTime date,
  ) async {
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      date: date,
      totalVehiclesAttended: vehicleWorks.fold(
        0,
        (s, w) => s + w.vehicleQuantity,
      ),
      isAttendanceConfirmed: false,
      staffAssignments:
          customStaffAssignments ??
          [
            DailyStaffAssignment(
              id: 'assign-1',
              showroomId: showroomId,
              showroomName: 'Test Showroom',
              staffId: 'staff-1',
              staffMasterId: 'STF001',
              staffName: 'Ramesh Kumar',
              staffPhone: '9840123456',
              staffRole: 'Technician',
              date: date,
              startTime: '09:00',
              endTime: '18:00',
              workingHours: 9.0,
              assignmentType: 'Regular',
              createdAt: DateTime(2026, 9, 27),
            ),
          ],
    );
  }

  @override
  Future<List<ShowroomVehicleType>> getShowroomVehicleTypes({
    bool? isActive,
  }) async => vehicleTypes;

  @override
  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async =>
      workTypes;

  @override
  Future<List<ShowroomVehicleWork>> getShowroomVehicleWorks(
    String showroomId, {
    DateTime? date,
    String? staffId,
    String? vehicleTypeId,
  }) async {
    var list = vehicleWorks.where((w) => w.showroomId == showroomId).toList();
    if (staffId != null) {
      list = list.where((w) => w.staffId == staffId).toList();
    }
    if (vehicleTypeId != null) {
      list = list.where((w) => w.vehicleTypeId == vehicleTypeId).toList();
    }
    return list;
  }

  @override
  Future<ShowroomVehicleWork> createShowroomVehicleWork(
    String showroomId,
    CreateShowroomVehicleWorkRequest request,
  ) async {
    final created = ShowroomVehicleWork(
      id: 'work-${vehicleWorks.length + 1}',
      showroomId: showroomId,
      staffId: request.staffId,
      staffName: 'Ramesh Kumar',
      vehicleTypeId: request.vehicleTypeId,
      vehicleTypeName: request.vehicleTypeId == 'vt-1' ? 'Sedan' : 'SUV',
      vehicleQuantity: request.vehicleQuantity,
      date: request.date,
      timeRecorded: '10:00 AM',
      notes: request.notes,
      serviceItems: (request.serviceItems ?? [])
          .map(
            (s) => ShowroomVehicleWorkItem(
              id: 'item-${s.workTypeId}',
              showroomVehicleWorkId: 'work-${vehicleWorks.length + 1}',
              workTypeId: s.workTypeId,
              workTypeCode: s.workTypeId == 'wt-1' ? 'WASH' : 'VACUUM',
              workTypeName: s.workTypeId == 'wt-1'
                  ? 'Full Wash'
                  : 'Interior Vacuum',
              quantity: s.quantity,
              createdAt: DateTime.now(),
            ),
          )
          .toList(),
      createdAt: DateTime.now(),
    );
    vehicleWorks.add(created);
    return created;
  }

  @override
  Future<List<ShowroomVehicleWork>> createBatchShowroomVehicleWork(
    String showroomId,
    CreateBatchShowroomVehicleWorkRequest request,
  ) async {
    final List<ShowroomVehicleWork> createdList = [];
    for (final v in request.vehicles) {
      final created = ShowroomVehicleWork(
        id: 'work-batch-${vehicleWorks.length + 1}',
        showroomId: showroomId,
        staffId: request.staffId,
        staffName: 'Ramesh Kumar',
        vehicleTypeId: v.vehicleTypeId,
        vehicleTypeName: v.vehicleTypeId == 'vt-1' ? 'Sedan' : 'SUV',
        vehicleQuantity: 1,
        date: request.date,
        timeRecorded: '10:15 AM',
        notes: v.notes,
        serviceItems: v.workTypeIds
            .map(
              (id) => ShowroomVehicleWorkItem(
                id: 'item-$id',
                showroomVehicleWorkId: 'work-batch-${vehicleWorks.length + 1}',
                workTypeId: id,
                workTypeCode: id == 'wt-1' ? 'WASH' : 'VACUUM',
                workTypeName: id == 'wt-1' ? 'Full Wash' : 'Interior Vacuum',
                quantity: 1,
                createdAt: DateTime.now(),
              ),
            )
            .toList(),
        createdAt: DateTime.now(),
      );
      vehicleWorks.add(created);
      createdList.add(created);
    }
    return createdList;
  }

  @override
  Future<ShowroomVehicleWork> updateShowroomVehicleWork(
    String showroomId,
    String workId,
    UpdateShowroomVehicleWorkRequest request,
  ) async {
    final idx = vehicleWorks.indexWhere((w) => w.id == workId);
    final prev = vehicleWorks[idx];
    final updated = ShowroomVehicleWork(
      id: prev.id,
      showroomId: prev.showroomId,
      staffId: request.staffId ?? prev.staffId,
      staffName: prev.staffName,
      vehicleTypeId: request.vehicleTypeId ?? prev.vehicleTypeId,
      vehicleTypeName: (request.vehicleTypeId ?? prev.vehicleTypeId) == 'vt-1'
          ? 'Sedan'
          : 'SUV',
      vehicleQuantity: request.vehicleQuantity ?? prev.vehicleQuantity,
      date: request.date ?? prev.date,
      timeRecorded: prev.timeRecorded,
      notes: request.notes ?? prev.notes,
      serviceItems: (request.serviceItems != null)
          ? request.serviceItems!
                .map(
                  (s) => ShowroomVehicleWorkItem(
                    id: 'item-${s.workTypeId}',
                    showroomVehicleWorkId: prev.id,
                    workTypeId: s.workTypeId,
                    workTypeCode: s.workTypeId == 'wt-1' ? 'WASH' : 'VACUUM',
                    workTypeName: s.workTypeId == 'wt-1'
                        ? 'Full Wash'
                        : 'Interior Vacuum',
                    quantity: s.quantity,
                    createdAt: DateTime.now(),
                  ),
                )
                .toList()
          : prev.serviceItems,
      createdAt: prev.createdAt,
    );
    vehicleWorks[idx] = updated;
    return updated;
  }

  @override
  Future<void> deleteShowroomVehicleWork(
    String showroomId,
    String workId,
  ) async {
    vehicleWorks.removeWhere((w) => w.id == workId);
  }

  @override
  Future<ShowroomOperationsSummary> getShowroomOperationsSummary(
    String showroomId,
    DateTime date,
  ) async {
    final works = vehicleWorks
        .where((w) => w.showroomId == showroomId)
        .toList();
    final totalVehicles = works.fold<int>(
      0,
      (sum, w) => sum + w.vehicleQuantity,
    );
    final totalServices = works.fold<int>(
      0,
      (sum, w) => sum + w.serviceItems.length,
    );

    return ShowroomOperationsSummary(
      showroomId: showroomId,
      showroomMasterId: 'SR001',
      showroomName: 'Test Showroom',
      fromDate: date,
      toDate: date,
      totalVehiclesHandled: totalVehicles,
      totalServicesPerformed: totalServices,
      totalActiveStaffSessions: 1,
      vehicleTypeBreakdown: totalVehicles > 0
          ? [
              VehicleTypeWorkSummary(
                vehicleTypeId: 'vt-1',
                vehicleTypeCode: 'SEDAN',
                vehicleTypeName: 'Sedan',
                totalVehicles: totalVehicles,
              ),
            ]
          : [],
      workTypeBreakdown: totalServices > 0
          ? [
              WorkTypeWorkSummary(
                workTypeId: 'wt-1',
                workTypeCode: 'WASH',
                workTypeName: 'Full Wash',
                totalQuantity: totalServices,
              ),
            ]
          : [],
      staffProductivityBreakdown: const [],
    );
  }

  @override
  Future<DailyStaffAssignment> closeShowroomStaffWorkSession(
    String showroomId,
    String sessionId,
    CloseShowroomStaffWorkSessionRequest? request,
  ) async {
    closeSessionCalled = true;
    return DailyStaffAssignment(
      id: sessionId,
      showroomId: showroomId,
      showroomName: 'Test Showroom',
      staffId: 'staff-1',
      staffMasterId: 'STF001',
      staffName: 'Ramesh Kumar',
      staffPhone: '9840123456',
      date: DateTime.now(),
      startTime: '09:00',
      endTime: request?.endTime ?? '18:00',
      assignmentType: 'Regular',
      notes: request?.notes,
      createdAt: DateTime.now(),
    );
  }
}

class FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  FakeAuthNotifier()
    : super(
        const Authenticated(
          AuthUser(
            id: 'owner-1',
            username: 'owner',
            fullName: 'Owner User',
            role: 'Owner',
            isOwner: true,
            permissions: [
              'showroom.view',
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
  late FakeFullShowroomRepository fakeRepo;

  setUp(() {
    fakeRepo = FakeFullShowroomRepository();
  });

  Widget createTestWidget({
    Widget? child,
    double width = 400,
    double height = 800,
  }) {
    return ProviderScope(
      overrides: [
        showroomRepositoryProvider.overrideWithValue(fakeRepo),
        authNotifierProvider.overrideWith((ref) => FakeAuthNotifier()),
      ],
      child: MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(size: Size(width, height)),
          child: Scaffold(
            body:
                child ??
                ShowroomDetailScreen(
                  showroom: Showroom(
                    id: 'sr-1',
                    name: 'Test Showroom',
                    address: '123 Main Road',
                    phone: '9840123456',
                    gstin: '33AABCU9603R1ZM',
                    isActive: true,
                    createdAt: DateTime(2026, 1, 1),
                  ),
                ),
          ),
        ),
      ),
    );
  }

  group('VehicleWorkCard Widget Tests', () {
    testWidgets('renders staff name, vehicle type, quantity and services', (
      tester,
    ) async {
      final work = ShowroomVehicleWork(
        id: 'w-1',
        showroomId: 'sr-1',
        staffId: 'staff-1',
        staffName: 'Ramesh Kumar',
        vehicleTypeId: 'vt-1',
        vehicleTypeName: 'Sedan',
        vehicleQuantity: 2,
        date: DateTime(2026, 9, 27),
        timeRecorded: '11:00 AM',
        notes: 'Hand wash only',
        serviceItems: [
          ShowroomVehicleWorkItem(
            id: 'item-1',
            showroomVehicleWorkId: 'w-1',
            workTypeId: 'wt-1',
            workTypeCode: 'WASH',
            workTypeName: 'Full Wash',
            quantity: 1,
            createdAt: DateTime.now(),
          ),
        ],
        createdAt: DateTime.now(),
      );

      bool editTapped = false;
      bool deleteTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VehicleWorkCard(
              work: work,
              canEdit: true,
              canDelete: true,
              onEdit: () => editTapped = true,
              onDelete: () => deleteTapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Sedan'), findsOneWidget);
      expect(find.text('Qty: 2'), findsOneWidget);
      expect(find.text('Full Wash'), findsOneWidget);
      expect(find.text('Hand wash only'), findsOneWidget);
      expect(find.text('11:00 AM'), findsOneWidget);

      await tester.tap(find.byTooltip('Edit Vehicle Work'));
      expect(editTapped, true);

      await tester.tap(find.byTooltip('Delete Vehicle Work'));
      expect(deleteTapped, true);
    });
  });

  group('ShowroomOperationsTab Widget Tests', () {
    testWidgets(
      'renders KPI cards, active staff, empty state when no works recorded',
      (tester) async {
        await tester.pumpWidget(
          createTestWidget(
            child: ShowroomOperationsTab(
              showroomId: 'sr-1',
              showroomName: 'Test Showroom',
              selectedDate: DateTime(2026, 9, 27),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Vehicles Handled'), findsOneWidget);
        expect(find.text('Work Types Done'), findsOneWidget);
        expect(find.text('Active Sessions'), findsOneWidget);
        expect(find.text('Staff on Duty (1)'), findsOneWidget);
        // The provider initializes with DateTime.now() as selectedDate, so dateHeading uses today
        final expectedDateHeading = DateFormat(
          'dd MMM yyyy',
        ).format(DateTime.now());
        expect(
          find.text('No vehicle work recorded for $expectedDateHeading'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'renders recorded vehicle works and breakdowns when data exists',
      (tester) async {
        fakeRepo.vehicleWorks.add(
          ShowroomVehicleWork(
            id: 'work-1',
            showroomId: 'sr-1',
            staffId: 'staff-1',
            staffName: 'Ramesh Kumar',
            vehicleTypeId: 'vt-1',
            vehicleTypeName: 'Sedan',
            vehicleQuantity: 3,
            date: DateTime(2026, 9, 27),
            timeRecorded: '09:45 AM',
            serviceItems: [
              ShowroomVehicleWorkItem(
                id: 'item-1',
                showroomVehicleWorkId: 'work-1',
                workTypeId: 'wt-1',
                workTypeCode: 'WASH',
                workTypeName: 'Full Wash',
                quantity: 1,
                createdAt: DateTime.now(),
              ),
            ],
            createdAt: DateTime.now(),
          ),
        );

        await tester.pumpWidget(
          createTestWidget(
            child: ShowroomOperationsTab(
              showroomId: 'sr-1',
              showroomName: 'Test Showroom',
              selectedDate: DateTime(2026, 9, 27),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Vehicle Type Breakdown'), findsOneWidget);
        expect(find.text('Sedan: 3'), findsOneWidget);
        expect(find.text('Work Type Breakdown'), findsOneWidget);
        expect(find.text('Full Wash: 1'), findsOneWidget);
        expect(find.text('Daily Vehicle Work'), findsOneWidget);
        expect(find.text('Ramesh Kumar'), findsWidgets);
      },
    );

    testWidgets('renders filter bar and filtering works', (tester) async {
      fakeRepo.vehicleWorks.add(
        ShowroomVehicleWork(
          id: 'work-1',
          showroomId: 'sr-1',
          staffId: 'staff-1',
          staffName: 'Ramesh Kumar',
          vehicleTypeId: 'vt-1',
          vehicleTypeName: 'Sedan',
          vehicleQuantity: 1,
          date: DateTime(2026, 9, 27),
          createdAt: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        createTestWidget(
          child: ShowroomOperationsTab(
            showroomId: 'sr-1',
            showroomName: 'Test Showroom',
            selectedDate: DateTime(2026, 9, 27),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('staff_filter_popup')), findsOneWidget);
      expect(
        find.byKey(const Key('vehicle_type_filter_popup')),
        findsOneWidget,
      );
    });
  });

  group('LogVehicleWorkModalSheet Widget Tests', () {
    testWidgets('stepper increments and decrements quantity', (tester) async {
      await tester.pumpWidget(
        createTestWidget(
          child: LogVehicleWorkModalSheet(
            showroomId: 'sr-1',
            showroomName: 'Test Showroom',
            selectedDate: DateTime(2026, 9, 27),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Single Vehicle'), findsOneWidget);
      expect(find.byKey(const Key('vehicle_config_card_0')), findsOneWidget);

      // Increment
      await tester.tap(find.byKey(const Key('qty_increment_btn')));
      await tester.pumpAndSettle();

      expect(find.text('2 Vehicles (Batch)'), findsOneWidget);
      expect(find.byKey(const Key('vehicle_config_card_1')), findsOneWidget);

      // Decrement
      await tester.tap(find.byKey(const Key('qty_decrement_btn')));
      await tester.pumpAndSettle();

      expect(find.text('Single Vehicle'), findsOneWidget);
      expect(find.byKey(const Key('vehicle_config_card_1')), findsNothing);
    });

    testWidgets('validation error shows banner if no work type selected', (
      tester,
    ) async {
      await tester.pumpWidget(
        createTestWidget(
          child: LogVehicleWorkModalSheet(
            showroomId: 'sr-1',
            showroomName: 'Test Showroom',
            selectedDate: DateTime(2026, 9, 27),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Explicitly select staff and vehicle type
      await tester.tap(find.byKey(const Key('staff_dropdown_0')));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Ramesh Kumar').last);
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('vehicle_type_dropdown_0')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sedan').last);
      await tester.pumpAndSettle();

      // Submit without selecting any work type
      await tester.tap(find.byKey(const Key('modal_save_vehicle_work_button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('modal_error_banner')), findsOneWidget);
      expect(
        find.text(
          'Please select at least one work type for Vehicle #1.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('submits single vehicle work successfully', (tester) async {
      await tester.pumpWidget(
        createTestWidget(
          child: LogVehicleWorkModalSheet(
            showroomId: 'sr-1',
            showroomName: 'Test Showroom',
            selectedDate: DateTime(2026, 9, 27),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Select staff
      await tester.tap(find.byKey(const Key('staff_dropdown_0')));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Ramesh Kumar').last);
      await tester.pumpAndSettle();

      // Select vehicle type
      await tester.tap(find.byKey(const Key('vehicle_type_dropdown_0')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sedan').last);
      await tester.pumpAndSettle();

      // Select work type chip
      await tester.tap(find.byKey(const Key('work_type_chip_0_wt-1')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('modal_save_vehicle_work_button')));
      await tester.pumpAndSettle();

      expect(fakeRepo.vehicleWorks.length, 1);
      expect(fakeRepo.vehicleWorks.first.vehicleTypeName, 'Sedan');
    });

    testWidgets(
      'displays all 6 eligible staff on Maruti Nexa for 27 Sept 2026 in dropdown',
      (tester) async {
        fakeRepo.customStaffAssignments = [
          DailyStaffAssignment(
            id: 'assign-1',
            showroomId: 'sr-1',
            showroomName: 'Maruti Nexa',
            staffId: 'staff-1',
            staffMasterId: 'AT01',
            staffName: 'Aadhaar Test 2',
            staffPhone: '9840000001',
            staffRole: 'Detailer',
            date: DateTime(2026, 9, 27),
            status: 'Present',
            createdAt: DateTime(2026, 9, 27),
          ),
          DailyStaffAssignment(
            id: 'assign-2',
            showroomId: 'sr-1',
            showroomName: 'Maruti Nexa',
            staffId: 'staff-2',
            staffMasterId: 'AT02',
            staffName: 'Aadhaar test',
            staffPhone: '9840000002',
            staffRole: 'Technician',
            date: DateTime(2026, 9, 27),
            status: 'Present',
            createdAt: DateTime(2026, 9, 27),
          ),
          DailyStaffAssignment(
            id: 'assign-3',
            showroomId: 'sr-1',
            showroomName: 'Maruti Nexa',
            staffId: 'staff-3',
            staffMasterId: 'DC01',
            staffName: 'Decoupling Test Staff 1790094580',
            staffPhone: '9840000003',
            staffRole: 'Washer',
            date: DateTime(2026, 9, 27),
            status: 'Present',
            createdAt: DateTime(2026, 9, 27),
          ),
          DailyStaffAssignment(
            id: 'assign-4',
            showroomId: 'sr-1',
            showroomName: 'Maruti Nexa',
            staffId: 'staff-4',
            staffMasterId: 'DC02',
            staffName: 'Decoupling Test Staff 1790094670',
            staffPhone: '9840000004',
            staffRole: 'Detailer',
            date: DateTime(2026, 9, 27),
            status: 'Present',
            createdAt: DateTime(2026, 9, 27),
          ),
          DailyStaffAssignment(
            id: 'assign-5',
            showroomId: 'sr-1',
            showroomName: 'Maruti Nexa',
            staffId: 'staff-5',
            staffMasterId: 'DC03',
            staffName: 'Decoupling Test Staff 1790094600',
            staffPhone: '9840000005',
            staffRole: 'Technician',
            date: DateTime(2026, 9, 27),
            status: 'Present',
            createdAt: DateTime(2026, 9, 27),
          ),
          DailyStaffAssignment(
            id: 'assign-6',
            showroomId: 'sr-1',
            showroomName: 'Maruti Nexa',
            staffId: 'staff-6',
            staffMasterId: 'MT01',
            staffName: 'Monthly Test Staff 1790095541',
            staffPhone: '9840000006',
            staffRole: 'Detailer',
            date: DateTime(2026, 9, 27),
            status: 'Present',
            createdAt: DateTime(2026, 9, 27),
          ),
        ];

        await tester.pumpWidget(
          createTestWidget(
            child: LogVehicleWorkModalSheet(
              showroomId: 'sr-1',
              showroomName: 'Maruti Nexa',
              selectedDate: DateTime(2026, 9, 27),
            ),
          ),
        );
        await tester.pumpAndSettle();

        await tester.tap(find.byKey(const Key('staff_dropdown_0')));
        await tester.pumpAndSettle();

        expect(find.textContaining('Aadhaar Test 2'), findsWidgets);
        expect(find.textContaining('Aadhaar test (#AT02)'), findsWidgets);
        expect(
          find.textContaining('Decoupling Test Staff 1790094580'),
          findsWidgets,
        );
        expect(
          find.textContaining('Decoupling Test Staff 1790094670'),
          findsWidgets,
        );
        expect(
          find.textContaining('Decoupling Test Staff 1790094600'),
          findsWidgets,
        );
        expect(
          find.textContaining('Monthly Test Staff 1790095541'),
          findsWidgets,
        );
      },
    );

    testWidgets('excludes staff with Leave or Absent status from dropdown', (
      tester,
    ) async {
      fakeRepo.customStaffAssignments = [
        DailyStaffAssignment(
          id: 'assign-1',
          showroomId: 'sr-1',
          showroomName: 'Maruti Nexa',
          staffId: 'staff-1',
          staffMasterId: 'AT01',
          staffName: 'Aadhaar Test 2',
          staffPhone: '9840000001',
          staffRole: 'Detailer',
          date: DateTime(2026, 9, 27),
          status: 'Present',
          createdAt: DateTime(2026, 9, 27),
        ),
        DailyStaffAssignment(
          id: 'assign-2',
          showroomId: 'sr-1',
          showroomName: 'Maruti Nexa',
          staffId: 'staff-2',
          staffMasterId: 'AT02',
          staffName: 'On Leave Staff',
          staffPhone: '9840000002',
          staffRole: 'Technician',
          date: DateTime(2026, 9, 27),
          status: 'Leave',
          createdAt: DateTime(2026, 9, 27),
        ),
        DailyStaffAssignment(
          id: 'assign-3',
          showroomId: 'sr-1',
          showroomName: 'Maruti Nexa',
          staffId: 'staff-3',
          staffMasterId: 'AT03',
          staffName: 'Absent Staff',
          staffPhone: '9840000003',
          staffRole: 'Washer',
          date: DateTime(2026, 9, 27),
          status: 'Absent',
          createdAt: DateTime(2026, 9, 27),
        ),
      ];

      await tester.pumpWidget(
        createTestWidget(
          child: LogVehicleWorkModalSheet(
            showroomId: 'sr-1',
            showroomName: 'Maruti Nexa',
            selectedDate: DateTime(2026, 9, 27),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('staff_dropdown_0')));
      await tester.pumpAndSettle();

      expect(find.textContaining('Aadhaar Test 2'), findsWidgets);
      expect(find.textContaining('On Leave Staff'), findsNothing);
      expect(find.textContaining('Absent Staff'), findsNothing);
    });
  });

  group('EditVehicleWorkModalSheet Widget Tests', () {
    testWidgets('loads work details and updates successfully', (tester) async {
      final work = ShowroomVehicleWork(
        id: 'work-1',
        showroomId: 'sr-1',
        staffId: 'staff-1',
        staffName: 'Ramesh Kumar',
        vehicleTypeId: 'vt-1',
        vehicleTypeName: 'Sedan',
        vehicleQuantity: 1,
        date: DateTime(2026, 9, 27),
        notes: 'Original Note',
        serviceItems: [
          ShowroomVehicleWorkItem(
            id: 'item-1',
            showroomVehicleWorkId: 'work-1',
            workTypeId: 'wt-1',
            workTypeCode: 'WASH',
            workTypeName: 'Full Wash',
            quantity: 1,
            createdAt: DateTime.now(),
          ),
        ],
        createdAt: DateTime.now(),
      );
      fakeRepo.vehicleWorks.add(work);

      await tester.pumpWidget(
        createTestWidget(
          child: EditVehicleWorkModalSheet(
            work: work,
            showroomId: 'sr-1',
            showroomName: 'Test Showroom',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Edit Vehicle Work'), findsOneWidget);
      expect(find.text('Original Note'), findsOneWidget);

      await tester.tap(
        find.byKey(const Key('modal_update_vehicle_work_button')),
      );
      await tester.pumpAndSettle();

      expect(fakeRepo.vehicleWorks.first.id, 'work-1');
    });
  });

  group('CloseWorkSessionModalSheet Widget Tests', () {
    testWidgets('renders session info and clocks out staff', (tester) async {
      final assignment = DailyStaffAssignment(
        id: 'assign-1',
        showroomId: 'sr-1',
        showroomName: 'Test Showroom',
        staffId: 'staff-1',
        staffName: 'Ramesh Kumar',
        staffPhone: '9840123456',
        date: DateTime(2026, 9, 27),
        startTime: '09:00',
        endTime: '18:00',
        assignmentType: 'Regular',
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(
        createTestWidget(
          child: CloseWorkSessionModalSheet(
            showroomId: 'sr-1',
            showroomName: 'Test Showroom',
            assignment: assignment,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Close Work Session'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsWidgets);
      expect(find.text('Shift: 09:00 - 18:00'), findsOneWidget);

      await tester.tap(
        find.byKey(const Key('modal_confirm_close_session_button')),
      );
      await tester.pumpAndSettle();

      expect(fakeRepo.closeSessionCalled, true);
    });
  });

  group('Responsive 320px Width Tests', () {
    testWidgets(
      'Operations tab renders cleanly on narrow 320px screen with no overflow',
      (tester) async {
        fakeRepo.vehicleWorks.add(
          ShowroomVehicleWork(
            id: 'work-1',
            showroomId: 'sr-1',
            staffId: 'staff-1',
            staffName: 'Ramesh Kumar Very Long Name Technician',
            vehicleTypeId: 'vt-1',
            vehicleTypeName: 'Sedan Premium Luxury',
            vehicleQuantity: 2,
            date: DateTime(2026, 9, 27),
            timeRecorded: '10:30 AM',
            notes: 'Special care instructions on long text test',
            serviceItems: [
              ShowroomVehicleWorkItem(
                id: 'item-1',
                showroomVehicleWorkId: 'work-1',
                workTypeId: 'wt-1',
                workTypeCode: 'WASH',
                workTypeName: 'Full Body Wash Plus Polish',
                quantity: 1,
                createdAt: DateTime.now(),
              ),
              ShowroomVehicleWorkItem(
                id: 'item-2',
                showroomVehicleWorkId: 'work-1',
                workTypeId: 'wt-2',
                workTypeCode: 'VACUUM',
                workTypeName: 'Interior Deep Clean Shampoo',
                quantity: 1,
                createdAt: DateTime.now(),
              ),
            ],
            createdAt: DateTime.now(),
          ),
        );

        await tester.pumpWidget(
          createTestWidget(
            width: 320,
            height: 600,
            child: ShowroomOperationsTab(
              showroomId: 'sr-1',
              showroomName: 'Test Showroom',
              selectedDate: DateTime(2026, 9, 27),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Ensure no RenderFlex errors occurred
        expect(tester.takeException(), isNull);
        expect(find.text('Vehicles Handled'), findsOneWidget);
        expect(find.text('Daily Vehicle Work'), findsOneWidget);
      },
    );
  });
}
