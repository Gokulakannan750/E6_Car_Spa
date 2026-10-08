import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/settings/models/system_preferences_model.dart';
import 'package:e6_car_spa/features/settings/providers/system_preferences_provider.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_billing_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_operations_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_detail_screen.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_list_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _AutoRefreshMockShowroomRepository extends ShowroomRepository {
  _AutoRefreshMockShowroomRepository() : super(ShowroomApi(Dio()));

  List<Showroom> showrooms = [
    Showroom(
      id: 'sr-1',
      name: 'Honda Center',
      address: '123 Main Road',
      phone: '9876543210',
      isActive: true,
      activeStaffCountToday: 3,
      totalVehiclesToday: 5,
      createdAt: DateTime.now(),
    ),
  ];

  int getShowroomsCalls = 0;
  bool shouldThrowOnGet = false;

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    getShowroomsCalls++;
    if (shouldThrowOnGet) {
      throw const ApiException(message: 'Network connection failed');
    }
    var list = showrooms;
    if (isActive != null) {
      list = list.where((s) => s.isActive == isActive).toList();
    }
    if (search != null && search.isNotEmpty) {
      list = list
          .where(
            (s) =>
                s.name.toLowerCase().contains(search.toLowerCase()) ||
                s.address.toLowerCase().contains(search.toLowerCase()),
          )
          .toList();
    }
    return list;
  }

  @override
  Future<Showroom> getShowroomById(String id) async {
    return showrooms.firstWhere((s) => s.id == id);
  }

  @override
  Future<Showroom> createShowroom(CreateShowroomRequest request) async {
    final created = Showroom(
      id: 'sr-${DateTime.now().millisecondsSinceEpoch}',
      name: request.name,
      address: request.address,
      phone: request.phone,
      gstin: request.gstin,
      isActive: request.isActive,
      createdAt: DateTime.now(),
    );
    showrooms.add(created);
    return created;
  }

  @override
  Future<Showroom> updateShowroom(
    String id,
    UpdateShowroomRequest request,
  ) async {
    final idx = showrooms.indexWhere((s) => s.id == id);
    if (idx == -1) throw const ApiException(message: 'Not found');
    final existing = showrooms[idx];
    final updated = existing.copyWith(
      name: request.name ?? existing.name,
      address: request.address ?? existing.address,
      phone: request.phone ?? existing.phone,
      gstin: request.gstin ?? existing.gstin,
      isActive: request.isActive ?? existing.isActive,
    );
    showrooms[idx] = updated;
    return updated;
  }

  @override
  Future<void> toggleShowroomActive(String id) async {
    final idx = showrooms.indexWhere((s) => s.id == id);
    if (idx != -1) {
      showrooms[idx] = showrooms[idx].copyWith(
        isActive: !showrooms[idx].isActive,
      );
    }
  }

  @override
  Future<DailyStaffResponse> getDailyStaff(
    String showroomId,
    DateTime date,
  ) async {
    return DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Honda Center',
      date: date,
      totalVehiclesAttended: 0,
      isAttendanceConfirmed: false,
      staffAssignments: [],
    );
  }

  @override
  Future<List<ShowroomVehicleType>> getShowroomVehicleTypes({
    bool? isActive,
  }) async => [];

  @override
  Future<List<ShowroomWorkType>> getShowroomWorkTypes({bool? isActive}) async =>
      [];

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
  ) async {
    return ShowroomOperationsSummary(
      showroomId: showroomId,
      fromDate: date,
      toDate: date,
      totalVehiclesHandled: 0,
      totalServicesPerformed: 0,
      totalActiveStaffSessions: 0,
    );
  }

  @override
  Future<ShowroomDailyBill> getShowroomDailyBill(
    String showroomId,
    DateTime date,
  ) async {
    return ShowroomDailyBill(
      id: 'bill-1',
      showroomId: showroomId,
      showroomName: 'Honda Center',
      date: date,
      amount: 0,
      amountReceived: 0,
      balanceAmount: 0,
      status: 'Unpaid',
      payments: [],
      createdAt: DateTime.now(),
    );
  }
}

class _TestAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  _TestAuthNotifier(super.initialState);

  @override
  Future<bool> login(
    String username,
    String password, {
    String? companyCode,
  }) async => true;
  @override
  Future<void> logout() async => state = const Unauthenticated();
  @override
  Future<void> restoreSession() async {}
  @override
  void clearError() {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const adminUser = AuthUser(
    id: 'u-1',
    username: 'admin',
    fullName: 'Admin User',
    role: 'Admin',
    isOwner: true,
    permissions: [
      'showroom.view',
      'showroom.manage',
      'showroom.assign_staff',
      'showroom.confirm_attendance',
    ],
  );

  Widget createTestWidget(ShowroomRepository repo, {int refreshInterval = 30}) {
    return ProviderScope(
      overrides: [
        showroomRepositoryProvider.overrideWithValue(repo),
        authNotifierProvider.overrideWith(
          (ref) => _TestAuthNotifier(const Authenticated(adminUser)),
        ),
        systemPreferencesProvider.overrideWithValue(
          SystemPreferencesModel(refreshInterval: refreshInterval),
        ),
      ],
      child: const MaterialApp(home: ShowroomListScreen()),
    );
  }

  group('Showroom Cross-Platform Auto-Sync Tests', () {
    testWidgets(
      '1. Windows adds a showroom -> Android ShowroomList sitting open auto-refreshes after interval without navigation',
      (tester) async {
        final repo = _AutoRefreshMockShowroomRepository();

        await tester.pumpWidget(createTestWidget(repo, refreshInterval: 15));
        await tester.pumpAndSettle();

        // Initial state: 1 showroom
        expect(find.text('Honda Center'), findsOneWidget);
        expect(find.text('Toyota North'), findsNothing);
        expect(repo.getShowroomsCalls, 1);

        // Simulate external creation from Windows/Web
        repo.showrooms.add(
          Showroom(
            id: 'sr-2',
            name: 'Toyota North',
            address: '456 Northern Ave',
            phone: '9123456780',
            isActive: true,
            createdAt: DateTime.now(),
          ),
        );

        // Advance clock before interval: Toyota North not yet visible
        await tester.pump(const Duration(seconds: 10));
        expect(find.text('Toyota North'), findsNothing);

        // Advance clock past 15s refresh interval
        await tester.pump(const Duration(seconds: 6));
        await tester.pumpAndSettle();

        // New showroom automatically appears on Android without manual action
        expect(find.text('Toyota North'), findsOneWidget);
        expect(find.text('Honda Center'), findsOneWidget);
        expect(repo.getShowroomsCalls, greaterThanOrEqualTo(2));
      },
    );

    testWidgets(
      '2. Windows edits a showroom -> Android sitting open automatically updates showroom details',
      (tester) async {
        final repo = _AutoRefreshMockShowroomRepository();

        await tester.pumpWidget(createTestWidget(repo, refreshInterval: 30));
        await tester.pumpAndSettle();

        expect(find.text('Honda Center'), findsOneWidget);

        // Simulate Windows modifying showroom name and address
        repo.showrooms[0] = repo.showrooms[0].copyWith(
          name: 'Honda Premium Spa',
          address: '789 Elite Blvd',
        );

        // Advance time past 30s interval
        await tester.pump(const Duration(seconds: 31));
        await tester.pumpAndSettle();

        expect(find.text('Honda Premium Spa'), findsOneWidget);
        expect(find.text('Honda Center'), findsNothing);
      },
    );

    testWidgets(
      '3. Windows deactivates a showroom -> Android sitting open reflects inactive status',
      (tester) async {
        final repo = _AutoRefreshMockShowroomRepository();

        await tester.pumpWidget(createTestWidget(repo, refreshInterval: 15));
        await tester.pumpAndSettle();

        expect(find.text('Active'), findsWidgets);

        // Simulate Windows deactivating showroom
        repo.showrooms[0] = repo.showrooms[0].copyWith(isActive: false);

        await tester.pump(const Duration(seconds: 16));
        await tester.pumpAndSettle();

        expect(find.text('Inactive'), findsWidgets);
      },
    );

    testWidgets(
      '4. Manual / Off (interval = 0) disables automatic polling completely',
      (tester) async {
        final repo = _AutoRefreshMockShowroomRepository();

        await tester.pumpWidget(createTestWidget(repo, refreshInterval: 0));
        await tester.pumpAndSettle();

        final initialCalls = repo.getShowroomsCalls;

        // Add showroom externally
        repo.showrooms.add(
          Showroom(
            id: 'sr-99',
            name: 'Manual Only Spa',
            address: '99 Off Road',
            isActive: true,
            createdAt: DateTime.now(),
          ),
        );

        // Advance 120 seconds
        await tester.pump(const Duration(seconds: 120));
        await tester.pumpAndSettle();

        // No new polling calls should have occurred
        expect(repo.getShowroomsCalls, initialCalls);
        expect(find.text('Manual Only Spa'), findsNothing);
      },
    );

    testWidgets(
      '5. Transient network failure during auto-refresh does not crash or spam UI errors',
      (tester) async {
        final repo = _AutoRefreshMockShowroomRepository();

        await tester.pumpWidget(createTestWidget(repo, refreshInterval: 15));
        await tester.pumpAndSettle();

        expect(find.text('Honda Center'), findsOneWidget);

        // Simulate network drop
        repo.shouldThrowOnGet = true;

        // Advance past refresh interval
        await tester.pump(const Duration(seconds: 16));
        await tester.pumpAndSettle();

        // Screen remains completely functional and shows existing data
        expect(find.text('Honda Center'), findsOneWidget);

        // Restore network
        repo.shouldThrowOnGet = false;
        repo.showrooms.add(
          Showroom(
            id: 'sr-3',
            name: 'Recovered Spa',
            address: '333 Recover Ave',
            isActive: true,
            createdAt: DateTime.now(),
          ),
        );

        // Next poll recovers automatically
        await tester.pump(const Duration(seconds: 16));
        await tester.pumpAndSettle();

        expect(find.text('Recovered Spa'), findsOneWidget);
      },
    );

    testWidgets(
      '6. ShowroomDetailScreen updates showroom details in real time on auto-refresh',
      (tester) async {
        final repo = _AutoRefreshMockShowroomRepository();

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              showroomRepositoryProvider.overrideWithValue(repo),
              authNotifierProvider.overrideWith(
                (ref) => _TestAuthNotifier(const Authenticated(adminUser)),
              ),
              systemPreferencesProvider.overrideWithValue(
                const SystemPreferencesModel(refreshInterval: 15),
              ),
            ],
            child: MaterialApp(
              home: ShowroomDetailScreen(showroom: repo.showrooms[0]),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Honda Center'), findsWidgets);

        // Simulate Windows update
        repo.showrooms[0] = repo.showrooms[0].copyWith(
          name: 'Honda Flagship Hub',
        );

        await tester.pump(const Duration(seconds: 16));
        await tester.pumpAndSettle();

        expect(find.text('Honda Flagship Hub'), findsWidgets);
        expect(find.text('Honda Center'), findsNothing);
      },
    );
  });
}
