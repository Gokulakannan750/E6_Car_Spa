import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_billing_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/providers/showroom_billing_provider.dart';

class FakeBillingApi extends ShowroomApi {
  FakeBillingApi() : super(Dio());

  ShowroomDailyBill? returnBill;
  ShowroomSummary? returnSummary;
  bool throwOnPayment = false;
  bool deletePaymentCalled = false;

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async => [];

  @override
  Future<ShowroomDailyBill> getShowroomDailyBill(String showroomId, DateTime date) async {
    return returnBill!;
  }

  @override
  Future<ShowroomDailyBill> setShowroomDailyBill(
    String showroomId,
    DateTime date,
    SetShowroomDailyBillRequest request,
  ) async {
    return returnBill!;
  }

  @override
  Future<ShowroomDailyBill> recordShowroomPayment(
    String showroomId,
    DateTime date,
    RecordShowroomPaymentRequest request,
  ) async {
    if (throwOnPayment) {
      throw const ApiException(message: 'Payment amount exceeds balance', statusCode: 400);
    }
    return returnBill!;
  }

  @override
  Future<void> deleteShowroomPayment(String paymentId) async {
    deletePaymentCalled = true;
  }

  @override
  Future<ShowroomSummary> getShowroomSummary(
    String showroomId, {
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return returnSummary!;
  }
}

void main() {
  late FakeBillingApi fakeApi;
  late ProviderContainer container;
  late ProviderSubscription subscription;

  final testDate = DateTime(2026, 9, 27);
  final testBill = ShowroomDailyBill(
    id: 'bill-1',
    showroomId: 'sr-1',
    showroomName: 'BMW Center',
    date: testDate,
    amount: 5000.0,
    amountReceived: 2000.0,
    balanceAmount: 3000.0,
    status: 'PartiallyPaid',
    payments: [
      ShowroomPayment(
        id: 'pay-1',
        showroomDailyBillId: 'bill-1',
        amount: 2000.0,
        paymentMethod: 'UPI',
        paymentDate: DateTime(2026, 9, 27),
        createdAt: DateTime(2026, 9, 27),
      ),
    ],
    createdAt: DateTime(2026, 9, 27),
  );

  final testSummary = ShowroomSummary(
    showroomId: 'sr-1',
    showroomName: 'BMW Center',
    fromDate: DateTime(2026, 9, 1),
    toDate: DateTime(2026, 9, 30),
    totalDaysWithActivity: 20,
    totalStaffAssignments: 80,
    totalVehiclesAttended: 300,
    averageVehiclesPerDay: 15.0,
    totalBilled: 100000.0,
    totalReceived: 85000.0,
    outstandingAmount: 15000.0,
    paidDaysCount: 16,
    partiallyPaidDaysCount: 2,
    unpaidDaysCount: 2,
    dailyHistory: [
      ShowroomDailyHistoryRow(
        date: DateTime(2026, 9, 27),
        staffCount: 3,
        totalVehicles: 12,
        billedAmount: 5000.0,
        receivedAmount: 2000.0,
        balanceAmount: 3000.0,
        status: 'PartiallyPaid',
        hasBill: true,
      ),
    ],
  );

  setUp(() {
    fakeApi = FakeBillingApi();
    fakeApi.returnBill = testBill;
    fakeApi.returnSummary = testSummary;

    container = ProviderContainer(
      overrides: [
        showroomApiProvider.overrideWithValue(fakeApi),
      ],
    );
    subscription =
        container.listen(showroomBillingProvider('sr-1'), (prev, next) {});
  });

  tearDown(() {
    subscription.close();
    container.dispose();
  });

  group('ShowroomBillingNotifier & State Tests', () {
    test('initializes and loads daily bill', () async {
      container.read(showroomBillingProvider('sr-1').notifier);
      await Future.delayed(const Duration(milliseconds: 50));

      final state = container.read(showroomBillingProvider('sr-1'));
      expect(state.showroomId, 'sr-1');
      expect(state.dailyBill?.amount, 5000.0);
      expect(state.billedAmount, 5000.0);
      expect(state.receivedAmount, 2000.0);
      expect(state.balanceAmount, 3000.0);
      expect(state.status, 'PartiallyPaid');
      expect(state.payments.length, 1);
    });

    test('setDate and shiftDate update selectedDate and reload bill', () async {
      final notifier = container.read(showroomBillingProvider('sr-1').notifier);
      final newDate = DateTime(2026, 9, 28);

      notifier.setDate(newDate);
      await Future.delayed(const Duration(milliseconds: 50));

      final state = container.read(showroomBillingProvider('sr-1'));
      expect(state.selectedDate.year, 2026);
      expect(state.selectedDate.month, 9);
      expect(state.selectedDate.day, 28);
    });

    test('setTab switches sub-tabs and loads summary on history tab', () async {
      final notifier = container.read(showroomBillingProvider('sr-1').notifier);

      notifier.setTab(ShowroomBillingTabMode.history);
      await Future.delayed(const Duration(milliseconds: 50));

      final state = container.read(showroomBillingProvider('sr-1'));
      expect(state.activeTab, ShowroomBillingTabMode.history);
      expect(state.summary, isNotNull);
      expect(state.summary?.totalBilled, 100000.0);
      expect(state.summary?.dailyHistory.length, 1);
    });

    test('setHistoryPreset updates preset and reloads summary', () async {
      final notifier = container.read(showroomBillingProvider('sr-1').notifier);
      notifier.setTab(ShowroomBillingTabMode.history);
      await Future.delayed(const Duration(milliseconds: 50));

      notifier.setHistoryPreset(BillingHistoryPreset.thisWeek);
      await Future.delayed(const Duration(milliseconds: 50));

      final state = container.read(showroomBillingProvider('sr-1'));
      expect(state.historyPreset, BillingHistoryPreset.thisWeek);
    });

    test('setDailyBill updates daily bill on success', () async {
      const request = SetShowroomDailyBillRequest(amount: 7000.0, notes: 'Full wash combo');
      fakeApi.returnBill = ShowroomDailyBill(
        id: 'bill-1',
        showroomId: 'sr-1',
        showroomName: 'BMW Center',
        date: testDate,
        amount: 7000.0,
        amountReceived: 2000.0,
        balanceAmount: 5000.0,
        status: 'PartiallyPaid',
        notes: 'Full wash combo',
        createdAt: DateTime(2026, 9, 27),
      );

      final notifier = container.read(showroomBillingProvider('sr-1').notifier);
      final success = await notifier.setDailyBill(request);

      expect(success, isTrue);
      final state = container.read(showroomBillingProvider('sr-1'));
      expect(state.billedAmount, 7000.0);
      expect(state.balanceAmount, 5000.0);
    });

    test('recordPayment records payment on success', () async {
      const request = RecordShowroomPaymentRequest(
        amount: 3000.0,
        paymentMethod: 'Cash',
      );
      fakeApi.returnBill = ShowroomDailyBill(
        id: 'bill-1',
        showroomId: 'sr-1',
        showroomName: 'BMW Center',
        date: testDate,
        amount: 5000.0,
        amountReceived: 5000.0,
        balanceAmount: 0.0,
        status: 'Paid',
        createdAt: DateTime(2026, 9, 27),
      );

      final notifier = container.read(showroomBillingProvider('sr-1').notifier);
      final success = await notifier.recordPayment(request);

      expect(success, isTrue);
      final state = container.read(showroomBillingProvider('sr-1'));
      expect(state.receivedAmount, 5000.0);
      expect(state.balanceAmount, 0.0);
      expect(state.status, 'Paid');
    });

    test('recordPayment returns false on ApiException', () async {
      fakeApi.throwOnPayment = true;

      final notifier = container.read(showroomBillingProvider('sr-1').notifier);
      final success = await notifier.recordPayment(
        const RecordShowroomPaymentRequest(amount: 10000.0),
      );

      expect(success, isFalse);
      final state = container.read(showroomBillingProvider('sr-1'));
      expect(state.errorMessage, contains('Payment amount exceeds balance'));
    });

    test('deletePayment voids payment and refreshes bill', () async {
      final notifier = container.read(showroomBillingProvider('sr-1').notifier);
      final success = await notifier.deletePayment('pay-1');

      expect(success, isTrue);
      expect(fakeApi.deletePaymentCalled, isTrue);
    });
  });
}
