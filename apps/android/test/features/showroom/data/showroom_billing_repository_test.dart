import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_billing_model.dart';

class FakeBillingApi extends ShowroomApi {
  FakeBillingApi() : super(Dio());

  ShowroomDailyBill? returnBill;
  ShowroomSummary? returnSummary;
  List<ShowroomOutstandingOverview> returnOutstanding = [];
  bool throwDioError = false;
  bool deletePaymentCalled = false;
  SetShowroomDailyBillRequest? lastSetBillReq;
  RecordShowroomPaymentRequest? lastRecordPaymentReq;

  @override
  Future<ShowroomDailyBill> getShowroomDailyBill(
    String showroomId,
    DateTime date,
  ) async {
    if (throwDioError) {
      throw DioException(
        requestOptions: RequestOptions(
          path: '/showrooms/$showroomId/daily-bill',
        ),
        response: Response(
          requestOptions: RequestOptions(
            path: '/showrooms/$showroomId/daily-bill',
          ),
          statusCode: 404,
          data: {'message': 'Showroom not found'},
        ),
      );
    }
    return returnBill!;
  }

  @override
  Future<ShowroomDailyBill> setShowroomDailyBill(
    String showroomId,
    DateTime date,
    SetShowroomDailyBillRequest request,
  ) async {
    lastSetBillReq = request;
    return returnBill!;
  }

  @override
  Future<ShowroomDailyBill> recordShowroomPayment(
    String showroomId,
    DateTime date,
    RecordShowroomPaymentRequest request,
  ) async {
    lastRecordPaymentReq = request;
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

  @override
  Future<List<ShowroomOutstandingOverview>> getShowroomsOutstanding({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return returnOutstanding;
  }
}

void main() {
  late FakeBillingApi fakeApi;
  late ShowroomRepository repository;

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
    createdAt: DateTime(2026, 9, 27),
  );

  setUp(() {
    fakeApi = FakeBillingApi();
    repository = ShowroomRepository(fakeApi);
    fakeApi.returnBill = testBill;
  });

  group('ShowroomRepository - Billing & Summary Endpoints', () {
    test('getShowroomDailyBill returns daily bill successfully', () async {
      final result = await repository.getShowroomDailyBill('sr-1', testDate);
      expect(result.id, 'bill-1');
      expect(result.amount, 5000.0);
      expect(result.balanceAmount, 3000.0);
    });

    test(
      'getShowroomDailyBill rethrows ApiException on DioException',
      () async {
        fakeApi.throwDioError = true;

        expect(
          () => repository.getShowroomDailyBill('sr-1', testDate),
          throwsA(isA<ApiException>()),
        );
      },
    );

    test('setShowroomDailyBill sets daily bill successfully', () async {
      const request = SetShowroomDailyBillRequest(
        amount: 6000.0,
        notes: 'Updated rate',
      );
      fakeApi.returnBill = ShowroomDailyBill(
        id: 'bill-1',
        showroomId: 'sr-1',
        showroomName: 'BMW Center',
        date: testDate,
        amount: 6000.0,
        amountReceived: 2000.0,
        balanceAmount: 4000.0,
        status: 'PartiallyPaid',
        notes: 'Updated rate',
        createdAt: DateTime(2026, 9, 27),
      );

      final result = await repository.setShowroomDailyBill(
        'sr-1',
        testDate,
        request,
      );
      expect(result.amount, 6000.0);
      expect(result.notes, 'Updated rate');
      expect(fakeApi.lastSetBillReq?.amount, 6000.0);
    });

    test('recordShowroomPayment records payment against daily bill', () async {
      const request = RecordShowroomPaymentRequest(
        amount: 1500.0,
        paymentMethod: 'UPI',
        reference: 'REF-1234',
      );

      final result = await repository.recordShowroomPayment(
        'sr-1',
        testDate,
        request,
      );
      expect(result.id, 'bill-1');
      expect(fakeApi.lastRecordPaymentReq?.amount, 1500.0);
      expect(fakeApi.lastRecordPaymentReq?.paymentMethod, 'UPI');
    });

    test('deleteShowroomPayment deletes payment transaction', () async {
      await repository.deleteShowroomPayment('pay-1');
      expect(fakeApi.deletePaymentCalled, isTrue);
    });

    test('getShowroomSummary returns financial summary', () async {
      fakeApi.returnSummary = ShowroomSummary(
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
      );

      final result = await repository.getShowroomSummary('sr-1');
      expect(result.totalBilled, 100000.0);
      expect(result.outstandingAmount, 15000.0);
    });

    test('getShowroomsOutstanding returns global receivables list', () async {
      fakeApi.returnOutstanding = [
        const ShowroomOutstandingOverview(
          showroomId: 'sr-1',
          showroomName: 'BMW Center',
          address: 'Main Road',
          phone: '9999999999',
          isActive: true,
          totalBilled: 50000.0,
          totalReceived: 40000.0,
          outstandingAmount: 10000.0,
          unpaidDaysCount: 2,
        ),
      ];

      final result = await repository.getShowroomsOutstanding();
      expect(result.length, 1);
      expect(result.first.showroomName, 'BMW Center');
      expect(result.first.outstandingAmount, 10000.0);
    });
  });
}
