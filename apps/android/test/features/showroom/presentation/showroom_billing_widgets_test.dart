import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_billing_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_receivables_screen.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/payment_transaction_card.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/record_payment_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/set_daily_bill_modal_sheet.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/showroom_billing_tab.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';

class FakeBillingShowroomRepository implements ShowroomRepository {
  ShowroomDailyBill? currentBill;
  ShowroomSummary? currentSummary;
  List<ShowroomOutstandingOverview> outstandingList = [];
  List<Showroom> showrooms = [];
  bool deletePaymentCalled = false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async =>
      showrooms;

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
      staffAssignments: const [],
    );
  }

  @override
  Future<ShowroomDailyBill> getShowroomDailyBill(
    String showroomId,
    DateTime date,
  ) async {
    return currentBill!;
  }

  @override
  Future<ShowroomDailyBill> setShowroomDailyBill(
    String showroomId,
    DateTime date,
    SetShowroomDailyBillRequest request,
  ) async {
    currentBill = ShowroomDailyBill(
      id: currentBill?.id ?? 'bill-new',
      showroomId: showroomId,
      showroomName: currentBill?.showroomName ?? 'Test Showroom',
      date: date,
      amount: request.amount,
      amountReceived: currentBill?.amountReceived ?? 0.0,
      balanceAmount: request.amount - (currentBill?.amountReceived ?? 0.0),
      status: request.amount <= (currentBill?.amountReceived ?? 0.0)
          ? 'Paid'
          : ((currentBill?.amountReceived ?? 0.0) > 0
                ? 'PartiallyPaid'
                : 'Unpaid'),
      notes: request.notes,
      payments: currentBill?.payments ?? const [],
      createdAt: DateTime.now(),
    );
    return currentBill!;
  }

  @override
  Future<ShowroomDailyBill> recordShowroomPayment(
    String showroomId,
    DateTime date,
    RecordShowroomPaymentRequest request,
  ) async {
    final newPayments = [
      ShowroomPayment(
        id: 'pay-${(currentBill?.payments.length ?? 0) + 1}',
        showroomDailyBillId: currentBill?.id ?? 'bill-1',
        amount: request.amount,
        paymentMethod: request.paymentMethod,
        reference: request.reference,
        notes: request.notes,
        paymentDate: request.paymentDate ?? DateTime.now(),
        createdAt: DateTime.now(),
      ),
      ...?currentBill?.payments,
    ];
    final newReceived = (currentBill?.amountReceived ?? 0.0) + request.amount;
    final totalAmount = currentBill?.amount ?? 0.0;
    final newBalance = totalAmount - newReceived;

    currentBill = ShowroomDailyBill(
      id: currentBill?.id ?? 'bill-1',
      showroomId: showroomId,
      showroomName: currentBill?.showroomName ?? 'Test Showroom',
      date: date,
      amount: totalAmount,
      amountReceived: newReceived,
      balanceAmount: newBalance > 0 ? newBalance : 0.0,
      status: newBalance <= 0.001
          ? 'Paid'
          : (newReceived > 0 ? 'PartiallyPaid' : 'Unpaid'),
      notes: currentBill?.notes,
      payments: newPayments,
      createdAt: DateTime.now(),
    );
    return currentBill!;
  }

  @override
  Future<void> deleteShowroomPayment(String paymentId) async {
    deletePaymentCalled = true;
    final remainingPayments = (currentBill?.payments ?? [])
        .where((p) => p.id != paymentId)
        .toList();
    final newReceived = remainingPayments.fold<double>(
      0,
      (sum, p) => sum + p.amount,
    );
    final totalAmount = currentBill?.amount ?? 0.0;
    final newBalance = totalAmount - newReceived;

    currentBill = ShowroomDailyBill(
      id: currentBill?.id ?? 'bill-1',
      showroomId: currentBill?.showroomId ?? 'sr-1',
      showroomName: currentBill?.showroomName ?? 'Test Showroom',
      date: currentBill?.date ?? DateTime.now(),
      amount: totalAmount,
      amountReceived: newReceived,
      balanceAmount: newBalance > 0 ? newBalance : 0.0,
      status: newBalance <= 0.001
          ? 'Paid'
          : (newReceived > 0 ? 'PartiallyPaid' : 'Unpaid'),
      notes: currentBill?.notes,
      payments: remainingPayments,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<ShowroomSummary> getShowroomSummary(
    String showroomId, {
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return currentSummary!;
  }

  @override
  Future<List<ShowroomOutstandingOverview>> getShowroomsOutstanding({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return outstandingList;
  }
}

class FakeBillingAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  final List<String> permissions;
  final bool isOwner;
  FakeBillingAuthNotifier({
    this.permissions = const [
      'showroom.manage',
      'showroom.manage_billing',
      'showroom.record_payment',
      'showroom.delete_payment',
      'showroom.view_history',
      'showroom.view',
    ],
    this.isOwner = true,
  }) : super(
         Authenticated(
           AuthUser(
             id: 'owner-1',
             username: 'admin',
             fullName: 'Admin User',
             email: 'admin@e6carspa.com',
             role: isOwner ? 'Owner' : 'Staff',
             isOwner: isOwner,
             permissions: permissions,
           ),
         ),
       );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late FakeBillingShowroomRepository fakeRepo;

  final testDate = DateTime(2026, 9, 27);
  final testShowroom = Showroom(
    id: 'sr-1',
    name: 'BMW Experience Center',
    address: 'Anna Salai, Chennai',
    phone: '9876543210',
    gstin: '33AABCT1234F1Z0',
    isActive: true,
    createdAt: DateTime(2026, 9, 1),
  );

  final testPayment = ShowroomPayment(
    id: 'pay-1',
    showroomDailyBillId: 'bill-1',
    amount: 2500.0,
    paymentMethod: 'UPI',
    reference: 'UPI-998877',
    notes: 'Partial settlement',
    paymentDate: testDate,
    createdAt: testDate,
  );

  final testBill = ShowroomDailyBill(
    id: 'bill-1',
    showroomId: 'sr-1',
    showroomName: 'BMW Experience Center',
    date: testDate,
    amount: 6000.0,
    amountReceived: 2500.0,
    balanceAmount: 3500.0,
    status: 'PartiallyPaid',
    notes: 'Saturday showroom operations',
    payments: [testPayment],
    createdAt: testDate,
  );

  final testSummary = ShowroomSummary(
    showroomId: 'sr-1',
    showroomName: 'BMW Experience Center',
    fromDate: DateTime(2026, 9, 1),
    toDate: DateTime(2026, 9, 30),
    totalDaysWithActivity: 15,
    totalStaffAssignments: 60,
    totalVehiclesAttended: 240,
    averageVehiclesPerDay: 16.0,
    totalBilled: 90000.0,
    totalReceived: 75000.0,
    outstandingAmount: 15000.0,
    paidDaysCount: 12,
    partiallyPaidDaysCount: 2,
    unpaidDaysCount: 1,
    dailyHistory: [
      ShowroomDailyHistoryRow(
        date: testDate,
        staffCount: 4,
        totalVehicles: 16,
        billedAmount: 6000.0,
        receivedAmount: 2500.0,
        balanceAmount: 3500.0,
        status: 'PartiallyPaid',
        hasBill: true,
      ),
    ],
  );

  final testOutstandingList = [
    const ShowroomOutstandingOverview(
      showroomId: 'sr-1',
      showroomName: 'BMW Experience Center',
      address: 'Anna Salai, Chennai',
      phone: '9876543210',
      isActive: true,
      totalBilled: 90000.0,
      totalReceived: 75000.0,
      outstandingAmount: 15000.0,
      unpaidDaysCount: 1,
    ),
  ];

  setUp(() {
    fakeRepo = FakeBillingShowroomRepository();
    fakeRepo.currentBill = testBill;
    fakeRepo.currentSummary = testSummary;
    fakeRepo.outstandingList = testOutstandingList;
    fakeRepo.showrooms = [testShowroom];
  });

  Widget buildTestableWidget(
    Widget child, {
    List<String> permissions = const [
      'showroom.manage',
      'showroom.manage_billing',
      'showroom.record_payment',
      'showroom.delete_payment',
      'showroom.view_history',
      'showroom.view',
    ],
    bool isOwner = true,
  }) {
    final user = AuthUser(
      id: 'user-1',
      username: 'admin',
      fullName: 'Admin User',
      email: 'admin@e6carspa.com',
      role: isOwner ? 'Owner' : 'Staff',
      isOwner: isOwner,
      permissions: permissions,
    );
    return ProviderScope(
      overrides: [
        showroomRepositoryProvider.overrideWithValue(fakeRepo),
        currentUserProvider.overrideWithValue(user),
        authNotifierProvider.overrideWith(
          (ref) => FakeBillingAuthNotifier(
            permissions: permissions,
            isOwner: isOwner,
          ),
        ),
      ],
      child: MaterialApp(home: Scaffold(body: child)),
    );
  }

  group('PaymentTransactionCard Widget Tests', () {
    testWidgets('renders payment details, method badge, and notes', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildTestableWidget(
          PaymentTransactionCard(
            payment: testPayment,
            canDelete: true,
            onDelete: () {},
          ),
        ),
      );

      expect(find.textContaining('2,500.00'), findsOneWidget);
      expect(find.text('UPI'), findsOneWidget);
      expect(find.text('Ref: UPI-998877'), findsOneWidget);
      expect(find.text('Partial settlement'), findsOneWidget);
      expect(find.byIcon(Icons.delete_outline_rounded), findsOneWidget);
    });

    testWidgets('tapping delete opens confirmation dialog', (tester) async {
      bool deleted = false;
      await tester.pumpWidget(
        buildTestableWidget(
          PaymentTransactionCard(
            payment: testPayment,
            canDelete: true,
            onDelete: () => deleted = true,
          ),
        ),
      );

      await tester.tap(find.byIcon(Icons.delete_outline_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Void Payment Transaction'), findsOneWidget);
      expect(find.text('Void Payment'), findsOneWidget);

      await tester.tap(find.text('Void Payment'));
      await tester.pumpAndSettle();

      expect(deleted, isTrue);
    });
  });

  group('SetDailyBillModalSheet Widget Tests', () {
    testWidgets('renders initial amount and notes, and submits valid amount', (
      tester,
    ) async {
      SetShowroomDailyBillRequest? savedReq;
      await tester.pumpWidget(
        buildTestableWidget(
          SetDailyBillModalSheet(
            currentBill: testBill,
            onSave: (SetShowroomDailyBillRequest req) async {
              savedReq = req;
              return true;
            },
          ),
        ),
      );

      expect(find.text('Update Daily Bill'), findsOneWidget);
      expect(find.text('6000'), findsOneWidget);
      expect(find.text('Saturday showroom operations'), findsOneWidget);

      // Enter new amount
      await tester.enterText(find.byType(TextFormField).first, '7500');
      await tester.tap(find.text('Update Bill'));
      await tester.pumpAndSettle();

      expect(savedReq?.amount, 7500.0);
    });

    testWidgets('validation error when amount is empty or invalid', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildTestableWidget(
          SetDailyBillModalSheet(
            currentBill: null,
            onSave: (SetShowroomDailyBillRequest req) async => true,
          ),
        ),
      );

      await tester.tap(find.text('Save Daily Bill'));
      await tester.pumpAndSettle();

      expect(find.text('Bill amount is required'), findsOneWidget);
    });
  });

  group('RecordPaymentModalSheet Widget Tests', () {
    testWidgets('pre-fills remaining balance and validates amount <= balance', (
      tester,
    ) async {
      RecordShowroomPaymentRequest? savedReq;
      await tester.pumpWidget(
        buildTestableWidget(
          RecordPaymentModalSheet(
            remainingBalance: 3500.0,
            onSave: (RecordShowroomPaymentRequest req) async {
              savedReq = req;
              return true;
            },
          ),
        ),
      );

      expect(find.widgetWithText(AppButton, 'Record Payment'), findsOneWidget);
      expect(find.text('3500'), findsOneWidget);
      expect(
        find.textContaining('Remaining Balance: ₹3,500.00'),
        findsOneWidget,
      );

      // Enter an amount exceeding remaining balance
      await tester.enterText(find.byType(TextFormField).first, '5000');
      await tester.tap(find.widgetWithText(AppButton, 'Record Payment'));
      await tester.pumpAndSettle();

      // Error message
      expect(
        find.textContaining(
          'Payment amount cannot exceed remaining balance of ₹3,500.00',
        ),
        findsOneWidget,
      );
      expect(savedReq, isNull);

      // Fix amount to 2000 and select UPI
      await tester.enterText(find.byType(TextFormField).first, '2000');
      await tester.tap(find.text('UPI'));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Record Payment'));
      await tester.pumpAndSettle();

      expect(savedReq?.amount, 2000.0);
      expect(savedReq?.paymentMethod, 'UPI');
    });
  });

  group('ShowroomBillingTab Widget Tests', () {
    testWidgets(
      'renders daily bill KPIs, balance, status badge, and payment cards',
      (tester) async {
        await tester.pumpWidget(
          buildTestableWidget(
            ShowroomBillingTab(showroom: testShowroom, selectedDate: testDate),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Daily Bill Summary'), findsOneWidget);
        expect(find.text('Daily Billed'), findsOneWidget);
        expect(find.text('Received'), findsOneWidget);
        expect(find.text('Balance Due'), findsOneWidget);
        expect(find.text('Partially Paid'), findsWidgets);
        expect(find.text('Payment Ledger'), findsOneWidget);
        expect(find.text('Ref: UPI-998877'), findsOneWidget);
      },
    );

    testWidgets(
      'switches to Billing History sub-tab and renders period overview & rows',
      (tester) async {
        DateTime? navigatedDate;
        await tester.pumpWidget(
          buildTestableWidget(
            ShowroomBillingTab(
              showroom: testShowroom,
              selectedDate: testDate,
              onSelectDate: (d) => navigatedDate = d,
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Switch to Billing History
        await tester.tap(find.text('Billing History'));
        await tester.pumpAndSettle();

        expect(find.text('Period Overview'), findsOneWidget);
        expect(find.text('Total Billed'), findsOneWidget);
        expect(find.text('Outstanding'), findsOneWidget);
        expect(find.text('Daily History Breakdown'), findsOneWidget);
        expect(find.text('16 Vehicles • 4 Staff'), findsOneWidget);

        // Tap the daily history row
        await tester.tap(find.text('16 Vehicles • 4 Staff'));
        await tester.pumpAndSettle();

        expect(navigatedDate, isNotNull);
        expect(navigatedDate?.day, 27);
      },
    );

    testWidgets(
      '2E-04: showroom.manage alone does NOT render Edit Daily Bill',
      (tester) async {
        await tester.pumpWidget(
          buildTestableWidget(
            ShowroomBillingTab(showroom: testShowroom, selectedDate: testDate),
            permissions: ['showroom.view', 'showroom.manage'],
            isOwner: false,
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Edit Bill'), findsNothing);
      },
    );

    testWidgets('2E-04: showroom.manage_billing renders Edit Daily Bill', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildTestableWidget(
          ShowroomBillingTab(showroom: testShowroom, selectedDate: testDate),
          permissions: ['showroom.view', 'showroom.manage_billing'],
          isOwner: false,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Edit Bill'), findsOneWidget);
    });

    testWidgets('2E-04: showroom.manage alone does NOT render Record Payment', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildTestableWidget(
          ShowroomBillingTab(showroom: testShowroom, selectedDate: testDate),
          permissions: ['showroom.view', 'showroom.manage'],
          isOwner: false,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Record Payment'), findsNothing);
    });

    testWidgets('2E-04: showroom.record_payment renders Record Payment', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildTestableWidget(
          ShowroomBillingTab(showroom: testShowroom, selectedDate: testDate),
          permissions: ['showroom.view', 'showroom.record_payment'],
          isOwner: false,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Record Payment'), findsOneWidget);
    });
  });

  group('ShowroomReceivablesScreen Widget Tests', () {
    testWidgets(
      'renders global overview banner, search, filter chips, and showroom cards',
      (tester) async {
        await tester.pumpWidget(
          buildTestableWidget(const ShowroomReceivablesScreen()),
        );
        await tester.pumpAndSettle();

        expect(find.text('Showroom Receivables'), findsOneWidget);
        expect(find.text('All Showrooms Summary'), findsOneWidget);
        expect(find.text('BMW Experience Center'), findsOneWidget);
        expect(find.text('Anna Salai, Chennai'), findsOneWidget);
        expect(find.text('Due'), findsOneWidget);
      },
    );
  });

  group('Responsive Layout Viewport Tests', () {
    testWidgets(
      'ShowroomBillingTab renders on narrow 320px screen without RenderFlex overflow',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await tester.pumpWidget(
          buildTestableWidget(
            ShowroomBillingTab(showroom: testShowroom, selectedDate: testDate),
          ),
        );
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Daily Bill Summary'), findsOneWidget);
      },
    );
  });
}
