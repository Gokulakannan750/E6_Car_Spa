import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/daily_staff_assignment_card.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/swap_details_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/swap_staff_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/showroom_swap_history_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/showroom_attendance_tab.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/providers/showroom_provider.dart';

class MockShowroomRepository extends Fake implements ShowroomRepository {
  final ShowroomStaffSwap mockSwap;
  final List<ShowroomStaffSwap> mockHistory;

  MockShowroomRepository({required this.mockSwap, required this.mockHistory});

  @override
  Future<ShowroomStaffSwap> getSwapById(String swapId) async {
    return mockSwap;
  }

  @override
  Future<List<ShowroomStaffSwap>> getShowroomSwapHistory(
    String showroomId, {
    DateTime? date,
  }) async {
    return mockHistory;
  }

  @override
  Future<ShowroomStaffSwap> swapStaff(CreateStaffSwapRequest request) async {
    return mockSwap;
  }

  @override
  Future<ShowroomStaffSwap> reverseSwap(
    String swapId,
    ReverseStaffSwapRequest request,
  ) async {
    return mockSwap;
  }

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    return [
      Showroom(
        id: 'sr-1',
        name: 'Popular Hyundai Showroom',
        address: '123 Test St',
        phone: '1234567890',
        isActive: true,
        createdAt: DateTime.now(),
      ),
      Showroom(
        id: 'sr-2',
        name: 'KUN BMW Showroom',
        address: '456 Test Ave',
        phone: '0987654321',
        isActive: true,
        createdAt: DateTime.now(),
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
      showroomName: 'Target Showroom',
      date: date,
      totalVehiclesAttended: 0,
      isAttendanceConfirmed: false,
      staffAssignments: [
        DailyStaffAssignment(
          id: 'assign-target-1',
          showroomId: showroomId,
          showroomName: 'Target Showroom',
          staffId: 'st-b',
          staffMasterId: 'SU102B',
          staffName: 'Suresh Babu',
          staffPhone: '9876543211',
          date: date,
          createdAt: DateTime.now(),
        ),
      ],
    );
  }
}

class MockShowroomsNotifier extends ShowroomsNotifier {
  MockShowroomsNotifier(super.repository) {
    state = ShowroomsState(
      showrooms: [
        Showroom(
          id: 'sr-1',
          name: 'Popular Hyundai Showroom',
          address: '123 Test St',
          phone: '1234567890',
          isActive: true,
          createdAt: DateTime.now(),
        ),
        Showroom(
          id: 'sr-2',
          name: 'KUN BMW Showroom',
          address: '456 Test Ave',
          phone: '0987654321',
          isActive: true,
          createdAt: DateTime.now(),
        ),
      ],
    );
  }
}

void main() {
  final testDate = DateTime(2026, 9, 27);

  final mockSwap = ShowroomStaffSwap(
    id: 'swap-uuid-1',
    swapId: 'SWP-20260927-0001',
    date: testDate,
    staffAId: 'st-a',
    staffAMasterId: 'RA101H',
    staffAName: 'Ramesh Kumar',
    staffARole: 'Detailer',
    showroomAId: 'sr-1',
    showroomAMasterId: 'PO10001',
    showroomAName: 'Popular Hyundai Showroom',
    staffBId: 'st-b',
    staffBMasterId: 'SU102B',
    staffBName: 'Suresh Babu',
    staffBRole: 'Technician',
    showroomBId: 'sr-2',
    showroomBMasterId: 'KU10001',
    showroomBName: 'KUN BMW Showroom',
    coverageStartTime: '14:00',
    coverageEndTime: '18:00',
    coverageDurationHours: 4.0,
    coverageDurationFormatted: '4 hours',
    performedByUserId: 'usr-1',
    performedByName: 'Gokula Kannan',
    reason: 'Emergency cross-showroom swap',
    notes: 'Approved by manager',
    status: 'Completed',
    createdAt: DateTime(2026, 9, 27, 9, 30),
  );

  final swappedAssignment = DailyStaffAssignment(
    id: 'assign-1',
    showroomId: 'sr-1',
    showroomName: 'Popular Hyundai Showroom',
    staffId: 'st-a',
    staffMasterId: 'RA101H',
    staffName: 'Ramesh Kumar',
    staffPhone: '9876543210',
    staffRole: 'Detailer',
    date: testDate,
    startTime: '09:00',
    endTime: '18:00',
    workingHours: 9.0,
    workingHoursFormatted: '9h',
    status: 'Present',
    assignmentType: 'Regular',
    homeShowroomId: 'sr-1',
    homeShowroomName: 'Popular Hyundai Showroom',
    swapId: 'SWP-20260927-0001',
    swappedWithStaffId: 'st-b',
    swappedWithStaffName: 'Suresh Babu',
    originalShowroomId: 'sr-2',
    originalShowroomName: 'KUN BMW Showroom',
    createdAt: DateTime.now(),
  );

  testWidgets(
    '1. DailyStaffAssignmentCard displays purple Swapped badge with Swap ID',
    (tester) async {
      bool viewSwapCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DailyStaffAssignmentCard(
              assignment: swappedAssignment,
              onViewSwap: () => viewSwapCalled = true,
            ),
          ),
        ),
      );

      expect(
        find.text('Swapped with Suresh Babu (#SWP-20260927-0001)'),
        findsOneWidget,
      );
      expect(find.text('Swapped'), findsOneWidget);
      expect(
        find.text('Orig: KUN BMW Showroom → Now: Popular Hyundai Showroom'),
        findsOneWidget,
      );

      // Tap the swap badge
      await tester.tap(
        find.text('Swapped with Suresh Babu (#SWP-20260927-0001)'),
      );
      await tester.pumpAndSettle();

      expect(viewSwapCalled, isTrue);
    },
  );

  testWidgets(
    '2. SwapDetailsModalSheet renders complete bidirectional swap traceability and coverage period',
    (tester) async {
      final mockRepo = MockShowroomRepository(
        mockSwap: mockSwap,
        mockHistory: [mockSwap],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [showroomRepositoryProvider.overrideWithValue(mockRepo)],
          child: const MaterialApp(
            home: Scaffold(
              body: SwapDetailsModalSheet(
                showroomId: 'sr-1',
                swapId: 'SWP-20260927-0001',
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Swap ID and status
      expect(find.text('Swap ID: #SWP-20260927-0001'), findsOneWidget);
      expect(find.text('COMPLETED'), findsOneWidget);

      // Verify Coverage Period banner
      expect(find.text('SWAP COVERAGE PERIOD'), findsOneWidget);
      expect(find.text('14:00 – 18:00 (4 hours)'), findsOneWidget);

      // Verify Staff A details
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('#RA101H'), findsOneWidget);
      expect(find.text('From: Popular Hyundai Showroom'), findsOneWidget);
      expect(find.text('To: KUN BMW Showroom'), findsOneWidget);

      // Verify Staff B details
      expect(find.text('Suresh Babu'), findsOneWidget);
      expect(find.text('#SU102B'), findsOneWidget);
      expect(find.text('From: KUN BMW Showroom'), findsOneWidget);
      expect(find.text('To: Popular Hyundai Showroom'), findsOneWidget);

      // Verify Audit Metadata
      expect(find.text('Gokula Kannan'), findsOneWidget);
      expect(find.text('Emergency cross-showroom swap'), findsOneWidget);
      expect(find.text('Approved by manager'), findsOneWidget);
    },
  );

  testWidgets(
    '3. ShowroomSwapHistoryModalSheet displays historical transactions with coverage period',
    (tester) async {
      final mockRepo = MockShowroomRepository(
        mockSwap: mockSwap,
        mockHistory: [mockSwap],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [showroomRepositoryProvider.overrideWithValue(mockRepo)],
          child: const MaterialApp(
            home: Scaffold(
              body: ShowroomSwapHistoryModalSheet(
                showroomId: 'sr-1',
                showroomName: 'Popular Hyundai Showroom',
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Swap History'), findsOneWidget);
      expect(find.text('#SWP-20260927-0001'), findsOneWidget);
      expect(find.text('Ramesh Kumar ⇄ Suresh Babu'), findsOneWidget);
      expect(
        find.text('Popular Hyundai Showroom ⇄ KUN BMW Showroom'),
        findsOneWidget,
      );
      expect(find.text('Coverage: 14:00 – 18:00 (4 hours)'), findsOneWidget);
    },
  );

  testWidgets(
    '4. SwapDetailsModalSheet displays locked notice when canReverse is false',
    (tester) async {
      final mockRepo = MockShowroomRepository(
        mockSwap: mockSwap,
        mockHistory: [mockSwap],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [showroomRepositoryProvider.overrideWithValue(mockRepo)],
          child: const MaterialApp(
            home: Scaffold(
              body: SwapDetailsModalSheet(
                showroomId: 'sr-1',
                swapId: 'SWP-20260927-0001',
                canReverse: false,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Reverse Staff Swap button is NOT present
      expect(find.text('Reverse Staff Swap'), findsNothing);

      // Verify locked notice is present
      expect(
        find.text(
          'Locked after attendance confirmation. Unlock for Correction before reversing this swap.',
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    '5. SwapStaffModalSheet renders Coverage Period section with live Duration calculation',
    (tester) async {
      final mockRepo = MockShowroomRepository(
        mockSwap: mockSwap,
        mockHistory: [mockSwap],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            showroomRepositoryProvider.overrideWithValue(mockRepo),
            showroomsProvider.overrideWith(
              (ref) => MockShowroomsNotifier(mockRepo),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SwapStaffModalSheet(
                showroomId: 'sr-1',
                showroomName: 'Popular Hyundai Showroom',
                selectedDate: testDate,
                currentShowroomStaff: [swappedAssignment],
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Coverage Period section title & live duration
      expect(find.text('SWAP COVERAGE PERIOD'), findsOneWidget);
      expect(
        find.text('Duration: 9 hours'),
        findsOneWidget,
      ); // Default 09:00 - 18:00
      expect(find.text('Start Time'), findsOneWidget);
      expect(find.text('End Time'), findsOneWidget);

      // Tap "Afternoon (14:00-18:00)" preset
      await tester.tap(find.text('Afternoon (14:00-18:00)'));
      await tester.pumpAndSettle();

      expect(find.text('Duration: 4 hours'), findsOneWidget);
    },
  );

  testWidgets(
    '6. ShowroomAttendanceTab renders Swap History, Swap Staff action buttons and row swap icon',
    (tester) async {
      bool swapStaffOpened = false;
      bool swapHistoryOpened = false;

      final mockRepo = MockShowroomRepository(
        mockSwap: mockSwap,
        mockHistory: [mockSwap],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            showroomRepositoryProvider.overrideWithValue(mockRepo),
            showroomsProvider.overrideWith(
              (ref) => MockShowroomsNotifier(mockRepo),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: ShowroomAttendanceTab(
                showroomId: 'sr-1',
                canAssignStaff: true,
                canConfirmAttendance: true,
                isOwner: true,
                onOpenAssignStaffSheet: () {},
                onOpenEditStaffSessionSheet: (_) {},
                onRemoveAssignment: (_) {},
                onOpenSwapStaffSheet: (_) => swapStaffOpened = true,
                onOpenSwapHistorySheet: () => swapHistoryOpened = true,
                onOpenSwapDetailsSheet: (_) {},
                onConfirmSubmitAttendance: () {},
                onConfirmUnlockAttendance: () {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify header action buttons exist
      expect(find.byKey(const Key('swap_history_button')), findsOneWidget);
      expect(find.byKey(const Key('swap_staff_button')), findsOneWidget);

      // Tap Swap History
      await tester.tap(find.byKey(const Key('swap_history_button')));
      expect(swapHistoryOpened, isTrue);

      // Tap Swap Staff
      await tester.tap(find.byKey(const Key('swap_staff_button')));
      expect(swapStaffOpened, isTrue);
    },
  );
}
