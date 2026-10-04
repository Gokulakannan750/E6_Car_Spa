import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_operations_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/edit_vehicle_work_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/log_vehicle_work_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/vehicle_work_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class FakePhase1ShowroomRepository implements ShowroomRepository {
  // Only active types returned by default
  final List<ShowroomVehicleType> activeVehicleTypes = [
    ShowroomVehicleType(
      id: 'vt-sedan',
      code: 'SEDAN',
      name: 'Sedan',
      isActive: true,
      createdAt: DateTime(2026, 1, 1),
    ),
    ShowroomVehicleType(
      id: 'vt-suv',
      code: 'SUV',
      name: 'SUV',
      isActive: true,
      createdAt: DateTime(2026, 1, 1),
    ),
  ];

  final List<ShowroomWorkType> activeWorkTypes = [
    ShowroomWorkType(
      id: 'wt-wash',
      code: 'WASH',
      name: 'Body Wash',
      isActive: true,
      createdAt: DateTime(2026, 1, 1),
    ),
    ShowroomWorkType(
      id: 'wt-other',
      code: 'OTHER',
      name: 'Other',
      isActive: true,
      createdAt: DateTime(2026, 1, 1),
    ),
  ];

  UpdateShowroomVehicleWorkRequest? lastUpdateRequest;
  CreateShowroomVehicleWorkRequest? lastCreateRequest;

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
      totalVehiclesAttended: 0,
      isAttendanceConfirmed: false,
      staffAssignments: [
        DailyStaffAssignment(
          id: 'assign-1',
          showroomId: showroomId,
          showroomName: 'Test Showroom',
          staffId: 'staff-1',
          staffMasterId: 'STF001',
          staffName: 'Ramesh Kumar',
          staffPhone: '9840123456',
          staffRole: 'Showroom Attendant',
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
  }) async => activeVehicleTypes;

  @override
  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async =>
      activeWorkTypes;

  @override
  Future<List<ShowroomVehicleWork>> getShowroomVehicleWorks(
    String showroomId, {
    DateTime? date,
    String? staffId,
    String? vehicleTypeId,
  }) async => [];

  @override
  Future<ShowroomOperationsSummary> getShowroomOperationsSummary(
    String showroomId,
    DateTime date,
  ) async => ShowroomOperationsSummary(
    showroomId: showroomId,
    fromDate: date,
    toDate: date,
  );

  @override
  Future<ShowroomVehicleWork> updateShowroomVehicleWork(
    String showroomId,
    String workId,
    UpdateShowroomVehicleWorkRequest request,
  ) async {
    lastUpdateRequest = request;
    return ShowroomVehicleWork(
      id: workId,
      showroomId: showroomId,
      staffId: request.staffId ?? 'staff-1',
      vehicleTypeId: request.vehicleTypeId ?? 'vt-sedan',
      date: DateTime.now(),
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<ShowroomVehicleWork> createShowroomVehicleWork(
    String showroomId,
    CreateShowroomVehicleWorkRequest request,
  ) async {
    lastCreateRequest = request;
    return ShowroomVehicleWork(
      id: 'work-new',
      showroomId: showroomId,
      staffId: request.staffId,
      vehicleTypeId: request.vehicleTypeId,
      date: request.date,
      createdAt: DateTime.now(),
    );
  }
}

class FakePhase1AuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  final bool isOwner;
  FakePhase1AuthNotifier({this.isOwner = true})
      : super(
          Authenticated(
            AuthUser(
              id: isOwner ? 'owner-1' : 'staff-1',
              username: isOwner ? 'owner' : 'staff',
              fullName: isOwner ? 'Owner User' : 'Staff User',
              role: isOwner ? 'Owner' : 'Staff',
              isOwner: isOwner,
              permissions: isOwner
                  ? [
                      'showroom.view',
                      'showroom.manage',
                      'settings.view',
                      'settings.manage',
                    ]
                  : ['showroom.view'],
            ),
          ),
        );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late FakePhase1ShowroomRepository fakeRepo;

  setUp(() {
    fakeRepo = FakePhase1ShowroomRepository();
  });

  Widget createTestWidget({required Widget child, bool isOwner = true}) {
    return ProviderScope(
      overrides: [
        showroomRepositoryProvider.overrideWithValue(fakeRepo),
        authNotifierProvider.overrideWith(
          (ref) => FakePhase1AuthNotifier(isOwner: isOwner),
        ),
      ],
      child: MaterialApp(
        home: Scaffold(body: child),
      ),
    );
  }

  group('Phase 1 Showroom Vehicle Work - Inactive Types & Other Description', () {
    testWidgets(
      'EditVehicleWorkModalSheet does not crash with inactive vehicle type and displays Inactive label',
      (tester) async {
        // Inactive vehicle type: 'vt-deactivated' (not in activeVehicleTypes)
        // Inactive work type: 'wt-deactivated' (not in activeWorkTypes)
        final workWithInactiveTypes = ShowroomVehicleWork(
          id: 'work-hist-1',
          showroomId: 'sr-1',
          showroomName: 'Test Showroom',
          staffId: 'staff-1',
          staffName: 'Ramesh Kumar',
          vehicleTypeId: 'vt-deactivated',
          vehicleTypeName: 'Vintage Roadster',
          date: DateTime(2026, 10, 1),
          serviceItems: [
            ShowroomVehicleWorkItem(
              id: 'item-1',
              showroomVehicleWorkId: 'work-hist-1',
              workTypeId: 'wt-deactivated',
              workTypeCode: 'HIST_COAT',
              workTypeName: 'Wax Coating',
              quantity: 1,
              createdAt: DateTime(2026, 10, 1),
            ),
          ],
          createdAt: DateTime(2026, 10, 1),
        );

        await tester.pumpWidget(
          createTestWidget(
            child: EditVehicleWorkModalSheet(
              work: workWithInactiveTypes,
              showroomId: 'sr-1',
              showroomName: 'Test Showroom',
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Must not crash
        expect(tester.takeException(), isNull);

        // Inactive vehicle type label must be visible in dropdown
        expect(find.text('Vintage Roadster (Inactive)'), findsOneWidget);

        // Inactive work type chip must be displayed and selected
        expect(find.text('Wax Coating (Inactive)'), findsOneWidget);

        // User can unselect the inactive work type
        await tester.tap(find.byKey(const Key('edit_work_type_chip_wt-deactivated')));
        await tester.pumpAndSettle();

        // Select active work type Body Wash
        await tester.tap(find.byKey(const Key('edit_work_type_chip_wt-wash')));
        await tester.pumpAndSettle();

        // Save
        await tester.tap(find.byKey(const Key('modal_update_vehicle_work_button')));
        await tester.pumpAndSettle();

        expect(fakeRepo.lastUpdateRequest, isNotNull);
        expect(fakeRepo.lastUpdateRequest!.serviceItems!.first.workTypeId, 'wt-wash');
      },
    );

    testWidgets(
      'EditVehicleWorkModalSheet requires description when Other work type is selected',
      (tester) async {
        final work = ShowroomVehicleWork(
          id: 'work-2',
          showroomId: 'sr-1',
          showroomName: 'Test Showroom',
          staffId: 'staff-1',
          staffName: 'Ramesh Kumar',
          vehicleTypeId: 'vt-sedan',
          vehicleTypeName: 'Sedan',
          date: DateTime(2026, 10, 1),
          serviceItems: [
            ShowroomVehicleWorkItem(
              id: 'item-1',
              showroomVehicleWorkId: 'work-2',
              workTypeId: 'wt-wash',
              workTypeCode: 'WASH',
              workTypeName: 'Body Wash',
              quantity: 1,
              createdAt: DateTime(2026, 10, 1),
            ),
          ],
          createdAt: DateTime(2026, 10, 1),
        );

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

        // Select 'Other'
        await tester.tap(find.byKey(const Key('edit_work_type_chip_wt-other')));
        await tester.pumpAndSettle();

        // 'Specify work performed: *' input appears
        expect(find.text('Specify work performed: *'), findsOneWidget);

        // Try submitting without filling Other description
        await tester.tap(find.byKey(const Key('modal_update_vehicle_work_button')));
        await tester.pumpAndSettle();

        // Error message displayed
        expect(find.text('Please specify work performed for "Other".'), findsOneWidget);
        expect(fakeRepo.lastUpdateRequest, isNull);

        // Fill in Other description
        await tester.enterText(
          find.byKey(const Key('edit_other_work_type_wt-other')),
          'Engine bay steam clean',
        );
        await tester.pumpAndSettle();

        // Submit again
        await tester.tap(find.byKey(const Key('modal_update_vehicle_work_button')));
        await tester.pumpAndSettle();

        expect(fakeRepo.lastUpdateRequest, isNotNull);
        final otherItem = fakeRepo.lastUpdateRequest!.serviceItems!
            .firstWhere((i) => i.workTypeId == 'wt-other');
        expect(otherItem.notes, 'Engine bay steam clean');
      },
    );

    testWidgets(
      'LogVehicleWorkModalSheet preserves Showroom Staff and requires Other description',
      (tester) async {
        await tester.pumpWidget(
          createTestWidget(
            child: LogVehicleWorkModalSheet(
              showroomId: 'sr-1',
              showroomName: 'Test Showroom',
              selectedDate: DateTime(2026, 10, 1),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Showroom staff is displayed and selectable
        expect(find.text('Assigned Staff *'), findsOneWidget);
        expect(find.text('Ramesh Kumar (#STF001) • Showroom Attendant'), findsOneWidget);

        // Select 'Other' work type
        await tester.tap(find.byKey(const Key('work_type_chip_0_wt-other')));
        await tester.pumpAndSettle();

        // Specify work performed field appears
        expect(find.text('Specify work performed: *'), findsOneWidget);

        // Submit without filling
        await tester.tap(find.byKey(const Key('modal_save_vehicle_work_button')));
        await tester.pumpAndSettle();

        expect(
          find.text('Please specify work performed for "Other" on Vehicle #1.'),
          findsOneWidget,
        );
        expect(fakeRepo.lastCreateRequest, isNull);

        // Fill description
        await tester.enterText(
          find.byKey(const Key('other_desc_field_0_wt-other')),
          'Ceramic coating touch up',
        );
        await tester.pumpAndSettle();

        // Submit
        await tester.tap(find.byKey(const Key('modal_save_vehicle_work_button')));
        await tester.pumpAndSettle();

        expect(fakeRepo.lastCreateRequest, isNotNull);
        final otherItem = fakeRepo.lastCreateRequest!.serviceItems!
            .firstWhere((i) => i.workTypeId == 'wt-other');
        expect(otherItem.notes, 'Ceramic coating touch up');
      },
    );

    testWidgets(
      'VehicleWorkCard renders service note alongside work type name',
      (tester) async {
        final work = ShowroomVehicleWork(
          id: 'work-3',
          showroomId: 'sr-1',
          staffId: 'staff-1',
          staffName: 'Ramesh Kumar',
          vehicleTypeId: 'vt-sedan',
          vehicleTypeName: 'Sedan',
          vehicleQuantity: 1,
          date: DateTime(2026, 10, 1),
          serviceItems: [
            ShowroomVehicleWorkItem(
              id: 'item-1',
              showroomVehicleWorkId: 'work-3',
              workTypeId: 'wt-other',
              workTypeCode: 'OTHER',
              workTypeName: 'Other',
              notes: 'Hand polish mirrors',
              quantity: 1,
              createdAt: DateTime(2026, 10, 1),
            ),
          ],
          createdAt: DateTime(2026, 10, 1),
        );

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: VehicleWorkCard(work: work),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Other: Hand polish mirrors'), findsOneWidget);
      },
    );
  });
}
