import 'dart:async';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_detail_screen.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_list_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeShowroomAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  final AuthUser currentUser;
  _FakeShowroomAuthNotifier(this.currentUser) : super(Authenticated(currentUser));

  @override
  void clearError() {}

  @override
  Future<void> restoreSession() async {}

  @override
  Future<bool> login(String username, String password) async => true;

  @override
  Future<void> logout() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockShowroomRepository extends ShowroomRepository {
  MockShowroomRepository() : super(ShowroomApi(Dio()));

  List<Showroom> showroomsToReturn = [];
  DailyStaffResponse? dailyStaffToReturn;
  bool shouldThrowOnGetShowrooms = false;
  bool shouldThrowOnConfirm = false;
  bool shouldThrowOnUnlock = false;
  Completer<List<Showroom>>? getShowroomsCompleter;

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    if (getShowroomsCompleter != null) {
      return getShowroomsCompleter!.future;
    }
    if (shouldThrowOnGetShowrooms) {
      throw const ApiException(message: 'Network error 503: Service Unavailable');
    }
    return showroomsToReturn;
  }

  @override
  Future<DailyStaffResponse> getDailyStaff(String showroomId, DateTime date) async {
    return dailyStaffToReturn!;
  }

  @override
  Future<DailyStaffResponse> confirmDailyStaffAttendance(String showroomId, DateTime date) async {
    if (shouldThrowOnConfirm) {
      throw const ConflictException(message: 'Attendance already locked for this date.');
    }
    final updated = DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Anna Nagar Hub',
      date: date,
      totalVehiclesAttended: dailyStaffToReturn!.totalVehiclesAttended,
      isAttendanceConfirmed: true,
      attendanceConfirmedAt: DateTime.now(),
      attendanceConfirmedByName: 'Owner User',
      staffAssignments: dailyStaffToReturn!.staffAssignments,
    );
    dailyStaffToReturn = updated;
    return updated;
  }

  @override
  Future<DailyStaffResponse> unlockDailyStaffAttendance(String showroomId, DateTime date) async {
    if (shouldThrowOnUnlock) {
      throw const ForbiddenException(message: 'Only Owners can unlock attendance.');
    }
    final updated = DailyStaffResponse(
      showroomId: showroomId,
      showroomName: 'Anna Nagar Hub',
      date: date,
      totalVehiclesAttended: dailyStaffToReturn!.totalVehiclesAttended,
      isAttendanceConfirmed: false,
      staffAssignments: dailyStaffToReturn!.staffAssignments,
    );
    dailyStaffToReturn = updated;
    return updated;
  }
}

void main() {
  const ownerUser = AuthUser(
    id: 'user-owner',
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
  );

  final sampleShowroom = Showroom(
    id: 'sr-100',
    name: 'Anna Nagar Hub',
    address: 'Plot 10, 2nd Avenue, Anna Nagar',
    phone: '9840123456',
    isActive: true,
    activeStaffCountToday: 2,
    totalVehiclesToday: 7,
    createdAt: DateTime(2026, 8, 1),
  );

  final sampleAssignments = [
    DailyStaffAssignment(
      id: 'asg-1',
      showroomId: 'sr-100',
      showroomName: 'Anna Nagar Hub',
      staffId: 'stf-1',
      staffName: 'Ramesh Kumar',
      staffPhone: '9840111111',
      staffRole: 'Detailer',
      date: DateTime(2026, 9, 9),
      vehiclesAttended: 4,
      createdAt: DateTime(2026, 9, 9),
    ),
    DailyStaffAssignment(
      id: 'asg-2',
      showroomId: 'sr-100',
      showroomName: 'Anna Nagar Hub',
      staffId: 'stf-2',
      staffName: 'Suresh Raina',
      staffPhone: '9840222222',
      staffRole: 'Detailer',
      date: DateTime(2026, 9, 9),
      vehiclesAttended: 3,
      createdAt: DateTime(2026, 9, 9),
    ),
  ];

  group('ShowroomListScreen Operations', () {
    testWidgets('Renders loading indicator while showrooms are loading', (tester) async {
      final completer = Completer<List<Showroom>>();
      final mockRepo = MockShowroomRepository()..getShowroomsCompleter = completer;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => _FakeShowroomAuthNotifier(ownerUser)),
            showroomRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: const MaterialApp(home: ShowroomListScreen()),
        ),
      );

      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      completer.complete([]);
      await tester.pumpAndSettle();
    });

    testWidgets('Renders error UI when showroom loading fails and handles retry', (tester) async {
      final mockRepo = MockShowroomRepository()..shouldThrowOnGetShowrooms = true;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => _FakeShowroomAuthNotifier(ownerUser)),
            showroomRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: const MaterialApp(home: ShowroomListScreen()),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.textContaining('Network error 503'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);

      // Fix repo and retry
      mockRepo.shouldThrowOnGetShowrooms = false;
      mockRepo.showroomsToReturn = [sampleShowroom];

      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Network error 503'), findsNothing);
      expect(find.text('Anna Nagar Hub'), findsOneWidget);
    });
  });

  group('ShowroomDetailScreen Operations & Attendance Locking', () {
    testWidgets('Renders staff assignments list and vehicle counts', (tester) async {
      final mockRepo = MockShowroomRepository()
        ..dailyStaffToReturn = DailyStaffResponse(
          showroomId: 'sr-100',
          showroomName: 'Anna Nagar Hub',
          date: DateTime.now(),
          totalVehiclesAttended: 7,
          isAttendanceConfirmed: false,
          staffAssignments: sampleAssignments,
        );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => _FakeShowroomAuthNotifier(ownerUser)),
            showroomRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: MaterialApp(
            home: ShowroomDetailScreen(showroom: sampleShowroom),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.widgetWithText(AppBar, 'Anna Nagar Hub'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Suresh Raina'), findsOneWidget);
      expect(find.text('7'), findsWidgets);
    });

    testWidgets('Confirm attendance flow prompts dialog and confirms successfully', (tester) async {
      final mockRepo = MockShowroomRepository()
        ..dailyStaffToReturn = DailyStaffResponse(
          showroomId: 'sr-100',
          showroomName: 'Anna Nagar Hub',
          date: DateTime.now(),
          totalVehiclesAttended: 7,
          isAttendanceConfirmed: false,
          staffAssignments: sampleAssignments,
        );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => _FakeShowroomAuthNotifier(ownerUser)),
            showroomRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: MaterialApp(
            home: ShowroomDetailScreen(showroom: sampleShowroom),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap confirm attendance button
      final confirmBtn = find.text('Confirm Attendance');
      expect(confirmBtn, findsOneWidget);
      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      // Verify AlertDialog is shown
      expect(find.text('Confirm Attendance?'), findsOneWidget);
      final dialogConfirmBtn = find.byKey(const Key('confirm_dialog_confirm_button'));
      expect(dialogConfirmBtn, findsOneWidget);
      await tester.tap(dialogConfirmBtn);
      await tester.pumpAndSettle();

      // Verify success snackbar
      expect(find.text('Attendance confirmed successfully!'), findsOneWidget);
      expect(mockRepo.dailyStaffToReturn!.isAttendanceConfirmed, isTrue);
    });

    testWidgets('Confirm attendance failure displays error snackbar and error state', (tester) async {
      final mockRepo = MockShowroomRepository()
        ..shouldThrowOnConfirm = true
        ..dailyStaffToReturn = DailyStaffResponse(
          showroomId: 'sr-100',
          showroomName: 'Anna Nagar Hub',
          date: DateTime.now(),
          totalVehiclesAttended: 7,
          isAttendanceConfirmed: false,
          staffAssignments: sampleAssignments,
        );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => _FakeShowroomAuthNotifier(ownerUser)),
            showroomRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: MaterialApp(
            home: ShowroomDetailScreen(showroom: sampleShowroom),
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.text('Confirm Attendance'));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('confirm_dialog_confirm_button')));
      await tester.pumpAndSettle();

      // Verify error snackbar is displayed
      expect(find.byType(SnackBar), findsOneWidget);
      // Verify exact error message rendered in screen state
      expect(find.text('Attendance already locked for this date.'), findsOneWidget);
    });

    testWidgets('Owner can unlock confirmed attendance with confirmation dialog', (tester) async {
      final mockRepo = MockShowroomRepository()
        ..dailyStaffToReturn = DailyStaffResponse(
          showroomId: 'sr-100',
          showroomName: 'Anna Nagar Hub',
          date: DateTime.now(),
          totalVehiclesAttended: 7,
          isAttendanceConfirmed: true,
          attendanceConfirmedAt: DateTime.now(),
          attendanceConfirmedByName: 'Owner User',
          staffAssignments: sampleAssignments,
        );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => _FakeShowroomAuthNotifier(ownerUser)),
            showroomRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: MaterialApp(
            home: ShowroomDetailScreen(showroom: sampleShowroom),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap 'Correct' (unlock) button
      final unlockBtn = find.byKey(const Key('unlock_attendance_button'));
      expect(unlockBtn, findsOneWidget);
      await tester.tap(unlockBtn);
      await tester.pumpAndSettle();

      // Verify unlock confirmation dialog
      expect(find.text('Unlock Attendance for Correction?'), findsOneWidget);
      final confirmUnlockBtn = find.byKey(const Key('unlock_dialog_confirm_button'));
      expect(confirmUnlockBtn, findsOneWidget);
      await tester.tap(confirmUnlockBtn);
      await tester.pumpAndSettle();

      // Verify success snackbar
      expect(find.text('Attendance unlocked for correction.'), findsOneWidget);
      expect(mockRepo.dailyStaffToReturn!.isAttendanceConfirmed, isFalse);
    });
  });
}
