import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_request_models.dart';

class FakeInvoiceApi extends InvoiceApi {
  InvoiceListResponse? mockListResponse;
  Invoice? mockInvoice;
  PaymentDto? mockPayment;
  List<PaymentDto>? mockPaymentsList;
  DioException? dioErrorToThrow;

  FakeInvoiceApi() : super(Dio());

  @override
  Future<InvoiceListResponse> getInvoices({
    int page = 1,
    int pageSize = 20,
    String? search,
    InvoiceStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    if (dioErrorToThrow != null) throw dioErrorToThrow!;
    if (mockListResponse != null) return mockListResponse!;
    throw DioException(
      requestOptions: RequestOptions(path: '/invoices'),
      error: 'Not found',
      response: Response(requestOptions: RequestOptions(path: '/invoices'), statusCode: 404),
    );
  }

  @override
  Future<Invoice> getInvoiceById(String id) async {
    if (dioErrorToThrow != null) throw dioErrorToThrow!;
    if (mockInvoice != null) return mockInvoice!;
    throw DioException(
      requestOptions: RequestOptions(path: '/invoices/$id'),
      response: Response(requestOptions: RequestOptions(path: '/invoices/$id'), statusCode: 404),
    );
  }

  @override
  Future<Invoice> createFromJobCard(String jobCardId) async {
    if (dioErrorToThrow != null) throw dioErrorToThrow!;
    if (mockInvoice != null) return mockInvoice!;
    throw DioException(
      requestOptions: RequestOptions(path: '/invoices/from-job-card/$jobCardId'),
      response: Response(requestOptions: RequestOptions(path: '/invoices/from-job-card/$jobCardId'), statusCode: 400),
    );
  }

  @override
  Future<Invoice> updateInvoice(String id, UpdateInvoiceRequest request) async {
    if (dioErrorToThrow != null) throw dioErrorToThrow!;
    if (mockInvoice != null) return mockInvoice!;
    throw DioException(
      requestOptions: RequestOptions(path: '/invoices/$id'),
      response: Response(requestOptions: RequestOptions(path: '/invoices/$id'), statusCode: 400),
    );
  }

  @override
  Future<Invoice> generateInvoice(String id) async {
    if (dioErrorToThrow != null) throw dioErrorToThrow!;
    if (mockInvoice != null) return mockInvoice!;
    throw DioException(
      requestOptions: RequestOptions(path: '/invoices/$id/generate'),
      response: Response(requestOptions: RequestOptions(path: '/invoices/$id/generate'), statusCode: 400),
    );
  }

  @override
  Future<PaymentDto> recordPayment(String invoiceId, RecordPaymentRequest request) async {
    if (dioErrorToThrow != null) throw dioErrorToThrow!;
    if (mockPayment != null) return mockPayment!;
    throw DioException(
      requestOptions: RequestOptions(path: '/invoices/$invoiceId/payments'),
      response: Response(requestOptions: RequestOptions(path: '/invoices/$invoiceId/payments'), statusCode: 400),
    );
  }

  @override
  Future<List<PaymentDto>> getPayments(String invoiceId) async {
    if (dioErrorToThrow != null) throw dioErrorToThrow!;
    if (mockPaymentsList != null) return mockPaymentsList!;
    return [];
  }
}

void main() {
  group('InvoiceRepository Unit Tests', () {
    late FakeInvoiceApi fakeApi;
    late InvoiceRepository repository;

    setUp(() {
      fakeApi = FakeInvoiceApi();
      repository = InvoiceRepository(fakeApi);
    });

    final testInvoice = Invoice(
      id: 'inv-1',
      invoiceNumber: 'INV-2026-000001',
      jobCardId: 'jc-1',
      jobCardNumber: 'JC-2026-000001',
      customerId: 'c-1',
      customerName: 'Priya',
      customerPhone: '9840123456',
      vehicleId: 'v-1',
      registrationNumber: 'TN01AA1111',
      vehicleMake: 'Honda',
      vehicleModel: 'City',
      invoiceDate: DateTime(2026, 8, 25),
      subtotal: 1000.0,
      discount: 0.0,
      taxableAmount: 1000.0,
      gstAmount: 180.0,
      totalAmount: 1180.0,
      paidAmount: 0.0,
      balanceAmount: 1180.0,
      status: InvoiceStatus.generated,
      items: [],
      payments: [],
      createdAt: DateTime(2026, 8, 25),
      updatedAt: null,
    );

    test('getInvoices returns response on success', () async {
      fakeApi.mockListResponse = InvoiceListResponse(
        items: [
          InvoiceListItem(
            id: 'inv-1',
            invoiceNumber: 'INV-2026-000001',
            jobCardNumber: 'JC-2026-000001',
            customerName: 'Priya',
            customerPhone: '9840123456',
            registrationNumber: 'TN01AA1111',
            vehicle: 'Honda City',
            invoiceDate: DateTime(2026, 8, 25),
            totalAmount: 1180.0,
            balanceAmount: 1180.0,
            status: InvoiceStatus.generated,
            createdAt: DateTime(2026, 8, 25),
          ),
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      );

      final res = await repository.getInvoices();

      expect(res.items.length, 1);
      expect(res.items.first.invoiceNumber, 'INV-2026-000001');
      expect(res.totalCount, 1);
    });

    test('getInvoiceById returns invoice on success', () async {
      fakeApi.mockInvoice = testInvoice;

      final res = await repository.getInvoiceById('inv-1');

      expect(res.id, 'inv-1');
      expect(res.invoiceNumber, 'INV-2026-000001');
      expect(res.totalAmount, 1180.0);
    });

    test('createFromJobCard converts job card to draft invoice', () async {
      final draftInvoice = Invoice(
        id: 'inv-draft-1',
        invoiceNumber: null,
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-2026-000001',
        customerId: 'c-1',
        customerName: 'Priya',
        customerPhone: '9840123456',
        vehicleId: 'v-1',
        registrationNumber: 'TN01AA1111',
        vehicleMake: 'Honda',
        vehicleModel: 'City',
        invoiceDate: DateTime(2026, 8, 25),
        subtotal: 1000.0,
        discount: 0.0,
        taxableAmount: 1000.0,
        gstAmount: 180.0,
        totalAmount: 1180.0,
        paidAmount: 0.0,
        balanceAmount: 1180.0,
        status: InvoiceStatus.draft,
        items: [],
        payments: [],
        createdAt: DateTime(2026, 8, 25),
        updatedAt: null,
      );
      fakeApi.mockInvoice = draftInvoice;

      final res = await repository.createFromJobCard('jc-1');

      expect(res.id, 'inv-draft-1');
      expect(res.isDraft, true);
      expect(res.status, InvoiceStatus.draft);
    });

    test('generateInvoice finalizes invoice and returns official invoice number', () async {
      fakeApi.mockInvoice = testInvoice;

      final res = await repository.generateInvoice('inv-draft-1');

      expect(res.invoiceNumber, 'INV-2026-000001');
      expect(res.isFinalized, true);
      expect(res.status, InvoiceStatus.generated);
    });

    test('recordPayment records payment and propagates ApiException on failure', () async {
      fakeApi.mockPayment = PaymentDto(
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: 500.0,
        paymentMethod: 'Cash',
        reference: null,
        paymentDate: DateTime(2026, 8, 25),
        createdAt: DateTime(2026, 8, 25),
      );

      final payment = await repository.recordPayment(
        'inv-1',
        const RecordPaymentRequest(amount: 500.0, paymentMethod: 'Cash'),
      );

      expect(payment.id, 'pay-1');
      expect(payment.amount, 500.0);

      // Verify DioException maps to ApiException
      fakeApi.dioErrorToThrow = DioException(
        requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
        response: Response(
          requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
          statusCode: 400,
          data: {'message': 'Payment amount exceeds current balance'},
        ),
      );

      expect(
        () => repository.recordPayment('inv-1', const RecordPaymentRequest(amount: 50000.0, paymentMethod: 'Cash')),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
