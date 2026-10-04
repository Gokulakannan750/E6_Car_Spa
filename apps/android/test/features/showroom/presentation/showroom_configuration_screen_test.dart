import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/settings/presentation/pages/showroom_configuration_screen.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_operations_model.dart';
import 'package:e6_car_spa/features/showroom/providers/showroom_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeConfigShowroomRepository implements ShowroomRepository {
  final List<ShowroomVehicleType> vehicleTypes = [
    ShowroomVehicleType(
      id: 'vt-1',
      code: 'SEDAN',
      name: 'Sedan',
      displayOrder: 1,
      isActive: true,
      createdAt: DateTime(2026, 1, 1),
    ),
    ShowroomVehicleType(
      id: 'vt-2',
      code: 'BIKE',
      name: 'Bike',
      displayOrder: 2,
      isActive: false,
      createdAt: DateTime(2026, 1, 1),
    ),
  ];

  final List<ShowroomWorkType> workTypes = [
    ShowroomWorkType(
      id: 'wt-1',
      code: 'WASH',
      name: 'Body Wash',
      displayOrder: 1,
      isActive: true,
      createdAt: DateTime(2026, 1, 1),
    ),
    ShowroomWorkType(
      id: 'wt-2',
      code: 'OTHER',
      name: 'Other',
      displayOrder: 2,
      isActive: true,
      createdAt: DateTime(2026, 1, 1),
    ),
  ];

  bool toggleVehicleTypeCalled = false;
  bool toggleWorkTypeCalled = false;
  String? createdVehicleTypeName;
  String? createdWorkTypeName;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<List<ShowroomVehicleType>> getShowroomVehicleTypes({
    bool? isActive,
  }) async {
    if (isActive != null) {
      return vehicleTypes.where((v) => v.isActive == isActive).toList();
    }
    return vehicleTypes;
  }

  @override
  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async {
    if (isActive != null) {
      return workTypes.where((w) => w.isActive == isActive).toList();
    }
    return workTypes;
  }

  @override
  Future<List<ShowroomVehicleWork>> getShowroomVehicleWorks(
    String showroomId, {
    DateTime? date,
    String? staffId,
    String? vehicleTypeId,
  }) async => [];

  @override
  Future<ShowroomVehicleType> toggleVehicleTypeActive(String id) async {
    toggleVehicleTypeCalled = true;
    final idx = vehicleTypes.indexWhere((v) => v.id == id);
    if (idx != -1) {
      final current = vehicleTypes[idx];
      final updated = ShowroomVehicleType(
        id: current.id,
        code: current.code,
        name: current.name,
        displayOrder: current.displayOrder,
        isActive: !current.isActive,
        createdAt: current.createdAt,
      );
      vehicleTypes[idx] = updated;
      return updated;
    }
    throw Exception('Vehicle type not found');
  }

  @override
  Future<ShowroomWorkType> toggleWorkTypeActive(String id) async {
    toggleWorkTypeCalled = true;
    final idx = workTypes.indexWhere((w) => w.id == id);
    if (idx != -1) {
      final current = workTypes[idx];
      final updated = ShowroomWorkType(
        id: current.id,
        code: current.code,
        name: current.name,
        displayOrder: current.displayOrder,
        isActive: !current.isActive,
        createdAt: current.createdAt,
      );
      workTypes[idx] = updated;
      return updated;
    }
    throw Exception('Work type not found');
  }

  @override
  Future<ShowroomVehicleType> createShowroomVehicleType({
    required String name,
    int displayOrder = 0,
    String? code,
  }) async {
    createdVehicleTypeName = name;
    final newType = ShowroomVehicleType(
      id: 'vt-new',
      code: code ?? 'NEW',
      name: name,
      displayOrder: displayOrder,
      isActive: true,
      createdAt: DateTime.now(),
    );
    vehicleTypes.add(newType);
    return newType;
  }

  @override
  Future<ShowroomWorkType> createShowroomWorkType({
    required String name,
    String? description,
    int displayOrder = 0,
    String? code,
  }) async {
    createdWorkTypeName = name;
    final newType = ShowroomWorkType(
      id: 'wt-new',
      code: code ?? 'NEW',
      name: name,
      displayOrder: displayOrder,
      isActive: true,
      createdAt: DateTime.now(),
    );
    workTypes.add(newType);
    return newType;
  }
}

class FakeConfigAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  final bool isOwner;
  FakeConfigAuthNotifier({this.isOwner = true})
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
  late FakeConfigShowroomRepository fakeRepo;

  setUp(() {
    fakeRepo = FakeConfigShowroomRepository();
  });

  Widget createTestWidget({bool isOwner = true}) {
    return ProviderScope(
      overrides: [
        showroomRepositoryProvider.overrideWithValue(fakeRepo),
        authNotifierProvider.overrideWith(
          (ref) => FakeConfigAuthNotifier(isOwner: isOwner),
        ),
      ],
      child: const MaterialApp(
        home: ShowroomConfigurationScreen(),
      ),
    );
  }

  group('ShowroomConfigurationScreen Widget Tests', () {
    testWidgets('Owner can view vehicle types and add new vehicle type', (tester) async {
      await tester.pumpWidget(createTestWidget(isOwner: true));
      await tester.pumpAndSettle();

      expect(find.text('Showroom Configuration'), findsOneWidget);
      expect(find.text('Vehicle Types'), findsOneWidget);
      expect(find.text('Work Types'), findsOneWidget);

      // Verify list items
      expect(find.text('Sedan'), findsOneWidget);
      expect(find.text('Bike'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);
      expect(find.text('Inactive'), findsOneWidget);

      // Tap Add Vehicle Type button
      await tester.tap(find.byKey(const Key('add_showroom_config_fab')));
      await tester.pumpAndSettle();

      expect(find.text('Add Vehicle Type'), findsWidgets);

      // Enter name
      await tester.enterText(find.byKey(const Key('vt_name_field')), 'Electric SUV');
      await tester.pumpAndSettle();

      // Submit
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(fakeRepo.createdVehicleTypeName, 'Electric SUV');
    });

    testWidgets('Non-owner sees read-only banner and Add buttons are disabled/hidden', (tester) async {
      await tester.pumpWidget(createTestWidget(isOwner: false));
      await tester.pumpAndSettle();

      // Should display read-only banner
      expect(
        find.text(
          'Owner-Only Management: You are viewing in read-only mode.',
        ),
        findsOneWidget,
      );

      // Add FAB should not be present for non-owner
      expect(find.byKey(const Key('add_showroom_config_fab')), findsNothing);
    });

    testWidgets('Owner can toggle vehicle type active state', (tester) async {
      await tester.pumpWidget(createTestWidget(isOwner: true));
      await tester.pumpAndSettle();

      // Tap toggle switch for first vehicle type
      await tester.tap(find.byKey(const Key('toggle_vt_vt-1')));
      await tester.pumpAndSettle();

      expect(fakeRepo.toggleVehicleTypeCalled, true);
    });

    testWidgets('Owner can switch to Work Types tab and view list', (tester) async {
      await tester.pumpWidget(createTestWidget(isOwner: true));
      await tester.pumpAndSettle();

      // Switch to Work Types tab
      await tester.tap(find.text('Work Types'));
      await tester.pumpAndSettle();

      expect(find.text('Body Wash'), findsOneWidget);
      expect(find.text('Other'), findsOneWidget);
      expect(find.byKey(const Key('add_showroom_config_fab')), findsOneWidget);
    });
  });
}
