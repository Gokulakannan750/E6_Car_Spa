import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/reports/data/reports_api.dart';
import 'package:e6_car_spa/features/reports/data/reports_repository.dart';
import 'package:e6_car_spa/features/reports/models/outstanding_invoice_model.dart';
import 'package:e6_car_spa/features/reports/models/payment_report_model.dart';
import 'package:e6_car_spa/features/reports/models/report_dashboard_model.dart';
import 'package:e6_car_spa/features/reports/models/sales_report_model.dart';
import 'package:flutter_test/flutter_test.dart';

class MockReportsApi extends ReportsApi {
  MockReportsApi() : super(Dio());

  DashboardSummaryModel? dashboardSummaryToReturn;
  SalesReportResponseModel? salesReportToReturn;
  PaymentReportResponseModel? paymentReportToReturn;
  OutstandingInvoiceReportResponseModel? outstandingReportToReturn;
  DioException? dioExceptionToThrow;

  @override
  Future<DashboardSummaryModel> getDashboardSummary({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return dashboardSummaryToReturn!;
  }

  @override
  Future<SalesReportResponseModel> getSalesReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? customerId,
    int page = 1,
    int pageSize = 20,
  }) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return salesReportToReturn!;
  }

  @override
  Future<PaymentReportResponseModel> getPaymentCollectionReport({
    DateTime? fromDate,
    DateTime? toDate,
    int? paymentMethod,
    String? invoiceId,
    bool includeVoided = false,
    int page = 1,
    int pageSize = 20,
  }) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return paymentReportToReturn!;
  }

  @override
  Future<OutstandingInvoiceReportResponseModel> getOutstandingInvoicesReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? customerId,
    int page = 1,
    int pageSize = 20,
  }) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return outstandingReportToReturn!;
  }
}

void main() {
  late MockReportsApi mockApi;
  late ReportsRepository repository;

  final sampleDashboard = DashboardSummaryModel(
    dateRange: DateRangeModel(
      fromDate: DateTime(2026, 9, 1),
      toDate: DateTime(2026, 9, 9),
    ),
    sales: const DashboardSalesModel(
      grossSubtotal: 50000.0,
      totalDiscount: 1000.0,
      gstAmount: 8820.0,
      netSales: 57820.0,
      paymentCollection: 45000.0,
      outstanding: 12820.0,
    ),
    paymentCollection: const DashboardPaymentCollectionModel(
      totalReceived: 45000.0,
      transactionCount: 15,
      breakdownByMethod: [],
    ),
    jobCardKpis: const JobCardKpisModel(
      totalJobCards: 20,
      newJobCards: 3,
      inProgressJobCards: 5,
      completedJobCards: 12,
      cancelledJobCards: 0,
      invoicedJobCards: 10,
    ),
    vehicleActivity: const VehicleActivityModel(
      vehiclesServiced: 18,
      totalServicesCompleted: 35,
      uniqueVehiclesServiced: 15,
    ),
    invoiceKpis: const InvoiceKpisModel(
      draftCount: 1,
      generatedCount: 10,
      partiallyPaidCount: 2,
      paidCount: 8,
      cancelledCount: 0,
      totalInvoicedAmount: 57820.0,
      totalPaidAmount: 45000.0,
      totalOutstandingAmount: 12820.0,
    ),
    showroom: const DashboardShowroomModel(
      activeShowroomsCount: 2,
      staffAssignmentsCount: 4,
      vehiclesAttended: 10,
      totalBilled: 20000.0,
      totalReceived: 15000.0,
      totalOutstanding: 5000.0,
      paidDaysCount: 5,
      partiallyPaidDaysCount: 1,
      unpaidDaysCount: 1,
    ),
    staffAdvances: const DashboardStaffAdvanceModel(
      outstandingCount: 2,
      outstandingAmount: 6000.0,
      settledCount: 5,
      settledAmount: 15000.0,
      obsoleteCount: 0,
    ),
    outstanding: const DashboardOutstandingModel(
      invoiceOutstanding: 12820.0,
      showroomOutstanding: 5000.0,
      staffAdvanceOutstanding: 6000.0,
      totalOutstandingCombined: 23820.0,
    ),
    recentActivity: const [],
  );

  setUp(() {
    mockApi = MockReportsApi();
    repository = ReportsRepository(mockApi);
  });

  group('ReportsRepository Tests', () {
    test('getDashboardSummary returns DashboardSummaryModel on 200 success', () async {
      mockApi.dashboardSummaryToReturn = sampleDashboard;

      final result = await repository.getDashboardSummary(
        fromDate: DateTime(2026, 9, 1),
        toDate: DateTime(2026, 9, 9),
      );

      expect(result.sales.grossSubtotal, 50000.0);
      expect(result.jobCardKpis.totalJobCards, 20);
      expect(result.vehicleActivity.uniqueVehiclesServiced, 15);
      expect(result.outstanding.totalOutstandingCombined, 23820.0);
    });

    test('getDashboardSummary maps 400 Bad Request to ValidationException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/reports/dashboard'),
        response: Response(
          requestOptions: RequestOptions(path: '/reports/dashboard'),
          statusCode: 400,
          data: {'error': 'From date cannot be after to date.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getDashboardSummary(),
        throwsA(isA<ValidationException>().having(
          (e) => e.message,
          'message',
          contains('From date cannot be after to date.'),
        )),
      );
    });

    test('getDashboardSummary maps 401 to UnauthorizedException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/reports/dashboard'),
        response: Response(
          requestOptions: RequestOptions(path: '/reports/dashboard'),
          statusCode: 401,
          data: {'message': 'Unauthorized'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getDashboardSummary(),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('getDashboardSummary maps 403 to ForbiddenException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/reports/dashboard'),
        response: Response(
          requestOptions: RequestOptions(path: '/reports/dashboard'),
          statusCode: 403,
          data: {'error': 'User does not have permission to view reports.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getDashboardSummary(),
        throwsA(isA<ForbiddenException>().having(
          (e) => e.message,
          'message',
          contains('User does not have permission to view reports.'),
        )),
      );
    });

    test('getDashboardSummary maps 404 to NotFoundException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/reports/dashboard'),
        response: Response(
          requestOptions: RequestOptions(path: '/reports/dashboard'),
          statusCode: 404,
          data: {'error': 'Report data not found.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getDashboardSummary(),
        throwsA(isA<NotFoundException>()),
      );
    });

    test('getDashboardSummary maps 500 to ServerException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/reports/dashboard'),
        response: Response(
          requestOptions: RequestOptions(path: '/reports/dashboard'),
          statusCode: 500,
          data: {'error': 'Internal server error occurred.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getDashboardSummary(),
        throwsA(isA<ServerException>()),
      );
    });

    test('getDashboardSummary maps connection timeout to NetworkException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/reports/dashboard'),
        type: DioExceptionType.connectionTimeout,
      );

      expect(
        () => repository.getDashboardSummary(),
        throwsA(isA<NetworkException>().having(
          (e) => e.message,
          'message',
          contains('Connection timeout'),
        )),
      );
    });

    test('getSalesReport returns SalesReportResponseModel on success', () async {
      mockApi.salesReportToReturn = const SalesReportResponseModel(
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        summary: SalesReportSummaryModel(
          totalSubtotal: 0.0,
          totalDiscount: 0.0,
          totalGst: 0.0,
          totalAmount: 0.0,
          totalPaid: 0.0,
          totalBalance: 0.0,
          invoiceCount: 0,
        ),
      );

      final result = await repository.getSalesReport();
      expect(result.totalCount, 0);
      expect(result.summary.totalAmount, 0.0);
    });

    test('getSalesReport maps network connection failure to NetworkException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/reports/sales'),
        type: DioExceptionType.connectionError,
      );

      expect(
        () => repository.getSalesReport(),
        throwsA(isA<NetworkException>()),
      );
    });

    test('getPaymentCollectionReport returns PaymentReportResponseModel on success', () async {
      mockApi.paymentReportToReturn = const PaymentReportResponseModel(
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        summary: PaymentReportSummaryModel(
          totalCollected: 0.0,
          transactionCount: 0,
          cashAmount: 0.0,
          upiAmount: 0.0,
          cardAmount: 0.0,
          bankTransferAmount: 0.0,
          voidedTransactionCount: 0,
          voidedAmount: 0.0,
        ),
      );

      final result = await repository.getPaymentCollectionReport();
      expect(result.totalCount, 0);
      expect(result.summary.totalCollected, 0.0);
    });

    test('getOutstandingInvoicesReport returns OutstandingInvoiceReportResponseModel on success', () async {
      mockApi.outstandingReportToReturn = const OutstandingInvoiceReportResponseModel(
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        summary: OutstandingInvoiceSummaryModel(
          totalOutstandingAmount: 0.0,
          totalInvoiceAmount: 0.0,
          totalPaidAmount: 0.0,
          invoiceCount: 0,
        ),
      );

      final result = await repository.getOutstandingInvoicesReport();
      expect(result.totalCount, 0);
      expect(result.summary.totalOutstandingAmount, 0.0);
    });
  });
}
