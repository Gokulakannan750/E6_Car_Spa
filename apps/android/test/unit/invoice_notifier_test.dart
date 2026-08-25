import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_request_models.dart';
import 'package:e6_car_spa/features/invoices/providers/invoice_providers.dart';

class FakeInvoiceApiForNotifier extends InvoiceApi {
  InvoiceListResponse? mockListResponse;
  Invoice? mockInvoice;
  PaymentDto? mockPayment;

  FakeInvoiceApiForNotifier() : super(Dio());

  @override
  Future<InvoiceListResponse> getInvoices({
    int page = 1,
    int pageSize = 20,
    String? search,
    InvoiceStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    if (mockListResponse != null) return mockListResponse!;
    return const InvoiceListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);
  }

  @override
  Future<Invoice> getInvoiceById(String id) async {
    if (mockInvoice != null) return mockInvoice!;
    throw Exception('Invoice not found');
  }

  @override
  Future<Invoice> updateInvoice(String id, UpdateInvoiceRequest request) async {
    if (mockInvoice != null) {
      return Invoice(
        id: mockInvoice!.id,
        invoiceNumber: mockInvoice!.invoiceNumber,
        jobCardId: mockInvoice!.jobCardId,
        jobCardNumber: mockInvoice!.jobCardNumber,
        customerId: mockInvoice!.customerId,
        customerName: mockInvoice!.customerName,
        customerPhone: mockInvoice!.customerPhone,
        vehicleId: mockInvoice!.vehicleId,
        registrationNumber: mockInvoice!.registrationNumber,
        vehicleMake: mockInvoice!.vehicleMake,
        vehicleModel: mockInvoice!.vehicleModel,
        invoiceDate: mockInvoice!.invoiceDate,
        subtotal: mockInvoice!.subtotal,
        discount: request.discount ?? mockInvoice!.discount,
        taxableAmount: (mockInvoice!.subtotal - (request.discount ?? mockInvoice!.discount)),
        gstAmount: (request.isGstEnabled ?? mockInvoice!.isGstEnabled) ? 180.0 : 0.0,
        totalAmount: (mockInvoice!.subtotal - (request.discount ?? mockInvoice!.discount)) + ((request.isGstEnabled ?? mockInvoice!.isGstEnabled) ? 180.0 : 0.0),
        paidAmount: mockInvoice!.paidAmount,
        balanceAmount: (mockInvoice!.subtotal - (request.discount ?? mockInvoice!.discount)) + ((request.isGstEnabled ?? mockInvoice!.isGstEnabled) ? 180.0 : 0.0) - mockInvoice!.paidAmount,
        status: mockInvoice!.status,
        notes: request.notes ?? mockInvoice!.notes,
        isGstEnabled: request.isGstEnabled ?? mockInvoice!.isGstEnabled,
        items: mockInvoice!.items,
        payments: mockInvoice!.payments,
        createdAt: mockInvoice!.createdAt,
        updatedAt: DateTime.now(),
      );
    }
    throw Exception('Invoice not found');
  }

  @override
  Future<Invoice> generateInvoice(String id) async {
    if (mockInvoice != null) {
      return Invoice(
        id: mockInvoice!.id,
        invoiceNumber: 'INV-2026-000001',
        jobCardId: mockInvoice!.jobCardId,
        jobCardNumber: mockInvoice!.jobCardNumber,
        customerId: mockInvoice!.customerId,
        customerName: mockInvoice!.customerName,
        customerPhone: mockInvoice!.customerPhone,
        vehicleId: mockInvoice!.vehicleId,
        registrationNumber: mockInvoice!.registrationNumber,
        vehicleMake: mockInvoice!.vehicleMake,
        vehicleModel: mockInvoice!.vehicleModel,
        invoiceDate: mockInvoice!.invoiceDate,
        subtotal: mockInvoice!.subtotal,
        discount: mockInvoice!.discount,
        taxableAmount: mockInvoice!.taxableAmount,
        gstAmount: mockInvoice!.gstAmount,
        totalAmount: mockInvoice!.totalAmount,
        paidAmount: mockInvoice!.paidAmount,
        balanceAmount: mockInvoice!.balanceAmount,
        status: InvoiceStatus.generated,
        items: mockInvoice!.items,
        payments: mockInvoice!.payments,
        createdAt: mockInvoice!.createdAt,
        updatedAt: DateTime.now(),
      );
    }
    throw Exception('Invoice not found');
  }

  @override
  Future<PaymentDto> recordPayment(String invoiceId, RecordPaymentRequest request) async {
    return PaymentDto(
      id: 'pay-1',
      invoiceId: invoiceId,
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      reference: request.reference,
      paymentDate: DateTime.now(),
      createdAt: DateTime.now(),
    );
  }
}

void main() {
  group('Invoice Notifiers Unit Tests', () {
    late FakeInvoiceApiForNotifier fakeApi;
    late ProviderContainer container;

    setUp(() {
      fakeApi = FakeInvoiceApiForNotifier();
      container = ProviderContainer(
        overrides: [
          invoiceApiProvider.overrideWithValue(fakeApi),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    final testDraftInvoice = Invoice(
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

    test('InvoiceListNotifier loads invoices and filters correctly', () async {
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

      final notifier = container.read(invoiceListProvider.notifier);
      await notifier.loadInvoices();

      final state = container.read(invoiceListProvider);
      expect(state.items.length, 1);
      expect(state.totalCount, 1);
      expect(state.isLoading, false);

      notifier.setStatusFilter(InvoiceStatus.generated);
      expect(container.read(invoiceListProvider).selectedStatus, InvoiceStatus.generated);
    });

    test('InvoiceDetailsNotifier updates draft and generates invoice', () async {
      fakeApi.mockInvoice = testDraftInvoice;

      final notifier = container.read(invoiceDetailsProvider('inv-draft-1').notifier);
      await notifier.loadDetails();

      var state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.invoice, isNotNull);
      expect(state.invoice!.isDraft, true);

      final updateSuccess = await notifier.updateDraft(discount: 100.0, notes: 'Discount applied');
      expect(updateSuccess, true);

      state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.invoice!.discount, 100.0);

      final generated = await notifier.generateInvoice();
      expect(generated, isNotNull);
      expect(generated!.invoiceNumber, 'INV-2026-000001');
      expect(generated.status, InvoiceStatus.generated);
    });

    test('InvoiceDetailsNotifier records payment and updates balance', () async {
      fakeApi.mockInvoice = testDraftInvoice;

      final notifier = container.read(invoiceDetailsProvider('inv-draft-1').notifier);
      await notifier.loadDetails();

      final paySuccess = await notifier.recordPayment(
        const RecordPaymentRequest(amount: 500.0, paymentMethod: 'UPI', reference: 'UPI123'),
      );

      expect(paySuccess, true);
    });
  });
}
