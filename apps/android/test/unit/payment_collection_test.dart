import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_request_models.dart';
import 'package:e6_car_spa/features/invoices/providers/invoice_providers.dart';

// ── Stub Repository for Payment Notifier Tests ───────────────────────────────

class _StubInvoiceRepoForPayment extends InvoiceRepository {
  Invoice currentInvoice;
  Invoice? postPaymentInvoice;
  bool shouldThrowConflictOnPayment = false;
  bool shouldThrowServerOnPayment = false;
  bool shouldThrowGenericOnPayment = false;
  bool shouldThrowConflictOnUpdate = false;
  int recordPaymentCallCount = 0;
  RecordPaymentRequest? lastPaymentRequest;
  Completer<PaymentDto>? paymentCompleter;
  List<InvoiceWhatsAppStatus> whatsAppStatuses = [];

  _StubInvoiceRepoForPayment(this.currentInvoice) : super(InvoiceApi(Dio()));

  @override
  Future<InvoiceListResponse> getInvoices({
    int page = 1,
    int pageSize = 20,
    String? search,
    InvoiceStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return const InvoiceListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);
  }

  @override
  Future<Invoice> getInvoiceById(String id) async {
    return postPaymentInvoice ?? currentInvoice;
  }

  @override
  Future<Invoice> generateInvoice(String id) async => currentInvoice;

  @override
  Future<Invoice> updateInvoice(String id, UpdateInvoiceRequest request) async {
    if (shouldThrowConflictOnUpdate) {
      throw const ConflictException(
        message: 'Invoice was modified by another user.',
        endpoint: '/invoices/update',
      );
    }
    return currentInvoice;
  }

  @override
  Future<PaymentDto> recordPayment(String invoiceId, RecordPaymentRequest request) async {
    recordPaymentCallCount++;
    lastPaymentRequest = request;
    if (paymentCompleter != null) return paymentCompleter!.future;
    if (shouldThrowConflictOnPayment) {
      throw const ConflictException(
        message: 'A payment was already recorded for this transaction.',
        endpoint: '/invoices/payments',
      );
    }
    if (shouldThrowServerOnPayment) {
      throw const ServerException(
        message: 'Payment gateway temporarily unavailable.',
        endpoint: '/invoices/payments',
      );
    }
    if (shouldThrowGenericOnPayment) {
      throw Exception('Unexpected socket timeout');
    }
    return PaymentDto(
      id: 'pay-new-1',
      invoiceId: invoiceId,
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      reference: request.reference,
      paymentDate: DateTime.now(),
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(String invoiceId) async {
    return whatsAppStatuses;
  }
}

// ── Test Data ────────────────────────────────────────────────────────────────

final _finalizedInvoice = Invoice(
  id: 'inv-fin-1',
  invoiceNumber: 'INV-2026-000001',
  jobCardId: 'jc-1',
  jobCardNumber: 'JC-2026-000001',
  customerId: 'c-1',
  customerName: 'Priya Sharma',
  customerPhone: '9876543210',
  vehicleId: 'v-1',
  registrationNumber: 'TN01AB1234',
  vehicleMake: 'Honda',
  vehicleModel: 'City',
  invoiceDate: DateTime(2026, 9, 8),
  subtotal: 1000.0,
  taxableAmount: 1000.0,
  gstAmount: 180.0,
  totalAmount: 1180.0,
  balanceAmount: 1180.0,
  status: InvoiceStatus.generated,
  items: const [
    InvoiceItem(
      id: 'item-1',
      description: 'Foam Wash',
      quantity: 1,
      unitPrice: 1000.0,
      taxableAmount: 1000.0,
      taxAmount: 180.0,
      totalAmount: 1180.0,
    ),
  ],
  createdAt: DateTime(2026, 9, 8),
);

final _paidInvoice = Invoice(
  id: 'inv-fin-1',
  invoiceNumber: 'INV-2026-000001',
  jobCardId: 'jc-1',
  jobCardNumber: 'JC-2026-000001',
  customerId: 'c-1',
  customerName: 'Priya Sharma',
  customerPhone: '9876543210',
  vehicleId: 'v-1',
  registrationNumber: 'TN01AB1234',
  vehicleMake: 'Honda',
  vehicleModel: 'City',
  invoiceDate: DateTime(2026, 9, 8),
  subtotal: 1000.0,
  taxableAmount: 1000.0,
  gstAmount: 180.0,
  totalAmount: 1180.0,
  paidAmount: 1180.0,
  balanceAmount: 0.0,
  status: InvoiceStatus.paid,
  items: const [
    InvoiceItem(
      id: 'item-1',
      description: 'Foam Wash',
      quantity: 1,
      unitPrice: 1000.0,
      taxableAmount: 1000.0,
      taxAmount: 180.0,
      totalAmount: 1180.0,
    ),
  ],
  payments: [
    PaymentDto(
      id: 'pay-1',
      invoiceId: 'inv-fin-1',
      amount: 1180.0,
      paymentMethod: 'UPI',
      reference: 'UPI/20260908/112233',
      paymentDate: DateTime(2026, 9, 8),
      createdAt: DateTime(2026, 9, 8),
    ),
  ],
  createdAt: DateTime(2026, 9, 8),
);

final _partiallyPaidInvoice = Invoice(
  id: 'inv-fin-1',
  invoiceNumber: 'INV-2026-000001',
  jobCardId: 'jc-1',
  jobCardNumber: 'JC-2026-000001',
  customerId: 'c-1',
  customerName: 'Priya Sharma',
  customerPhone: '9876543210',
  vehicleId: 'v-1',
  registrationNumber: 'TN01AB1234',
  vehicleMake: 'Honda',
  vehicleModel: 'City',
  invoiceDate: DateTime(2026, 9, 8),
  subtotal: 1000.0,
  taxableAmount: 1000.0,
  gstAmount: 180.0,
  totalAmount: 1180.0,
  paidAmount: 500.0,
  balanceAmount: 680.0,
  status: InvoiceStatus.partiallyPaid,
  items: const [
    InvoiceItem(
      id: 'item-1',
      description: 'Foam Wash',
      quantity: 1,
      unitPrice: 1000.0,
      taxableAmount: 1000.0,
      taxAmount: 180.0,
      totalAmount: 1180.0,
    ),
  ],
  payments: [
    PaymentDto(
      id: 'pay-1',
      invoiceId: 'inv-fin-1',
      amount: 500.0,
      paymentMethod: 'Cash',
      paymentDate: DateTime(2026, 9, 8),
      createdAt: DateTime(2026, 9, 8),
    ),
  ],
  createdAt: DateTime(2026, 9, 8),
);

void main() {
  group('Payment Collection — Edge Cases & Error Handling', () {
    test('recordPayment success: returns true, updates invoice, sets success message', () async {
      final repo = _StubInvoiceRepoForPayment(_finalizedInvoice)
        ..postPaymentInvoice = _partiallyPaidInvoice
        ..whatsAppStatuses = [
          const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        ];
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      final success = await notifier.recordPayment(
        const RecordPaymentRequest(amount: 500.0, paymentMethod: 'Cash'),
      );

      expect(success, true);
      final state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.isRecordingPayment, false);
      expect(state.invoice!.paidAmount, 500.0);
      expect(state.invoice!.balanceAmount, 680.0);
      expect(state.actionSuccessMessage, contains('500.00'));
      expect(state.actionSuccessMessage, contains('recorded successfully'));
      expect(state.errorMessage, isNull);

      notifier.stopPolling();
    });

    test('recordPayment HTTP 409 duplicate: returns false, sets error, invoice unchanged', () async {
      final repo = _StubInvoiceRepoForPayment(_finalizedInvoice)
        ..shouldThrowConflictOnPayment = true;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      final success = await notifier.recordPayment(
        const RecordPaymentRequest(amount: 500.0, paymentMethod: 'UPI'),
      );

      expect(success, false);
      final state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.isRecordingPayment, false);
      expect(state.errorMessage, 'A payment was already recorded for this transaction.');
      // Invoice unchanged — still shows original balance
      expect(state.invoice!.balanceAmount, 1180.0);
      expect(state.invoice!.paidAmount, 0.0);
    });

    test('recordPayment HTTP 500 server error: returns false, sets error, invoice preserved', () async {
      final repo = _StubInvoiceRepoForPayment(_finalizedInvoice)
        ..shouldThrowServerOnPayment = true;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      final success = await notifier.recordPayment(
        const RecordPaymentRequest(amount: 500.0, paymentMethod: 'Cash'),
      );

      expect(success, false);
      final state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.isRecordingPayment, false);
      expect(state.errorMessage, 'Payment gateway temporarily unavailable.');
      expect(state.invoice!.totalAmount, 1180.0);
    });

    test('isRecordingPayment flag enables UI to block concurrent payment submissions', () async {
      final completer = Completer<PaymentDto>();
      final repo = _StubInvoiceRepoForPayment(_finalizedInvoice)..paymentCompleter = completer;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      // Start payment without awaiting
      final future = notifier.recordPayment(
        const RecordPaymentRequest(amount: 500.0, paymentMethod: 'Cash'),
      );

      // While in-flight, isRecordingPayment should be true
      var state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.isRecordingPayment, true);

      // Complete the operation
      completer.complete(PaymentDto(
        id: 'pay-1',
        invoiceId: 'inv-fin-1',
        amount: 500.0,
        paymentMethod: 'Cash',
        paymentDate: DateTime.now(),
        createdAt: DateTime.now(),
      ));
      await future;

      state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.isRecordingPayment, false);
      expect(repo.recordPaymentCallCount, 1);
    });

    test('updateDraft handles ApiException: returns false, sets errorMessage', () async {
      final repo = _StubInvoiceRepoForPayment(Invoice(
        id: 'inv-d1',
        invoiceNumber: null,
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-001',
        customerId: 'c-1',
        customerName: 'Test',
        customerPhone: '1234567890',
        vehicleId: 'v-1',
        registrationNumber: 'TN01AB1234',
        vehicleMake: 'Maruti',
        vehicleModel: 'Swift',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 1000.0,
        taxableAmount: 1000.0,
        gstAmount: 180.0,
        totalAmount: 1180.0,
        balanceAmount: 1180.0,
        status: InvoiceStatus.draft,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      ))..shouldThrowConflictOnUpdate = true;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-d1').notifier);
      await notifier.loadDetails();

      final success = await notifier.updateDraft(discount: 200.0, notes: 'VIP');

      expect(success, false);
      final state = container.read(invoiceDetailsProvider('inv-d1'));
      expect(state.isSaving, false);
      expect(state.errorMessage, 'Invoice was modified by another user.');
    });

    test('recordPayment generic non-ApiException: returns false, sets fallback error message', () async {
      final repo = _StubInvoiceRepoForPayment(_finalizedInvoice)
        ..shouldThrowGenericOnPayment = true;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      final success = await notifier.recordPayment(
        const RecordPaymentRequest(amount: 500.0, paymentMethod: 'Cash'),
      );

      expect(success, false);
      final state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.isRecordingPayment, false);
      // Generic fallback message from the notifier's catch-all
      expect(state.errorMessage, 'Failed to record payment.');
    });

    test('successful payment starts PaymentCompleted WhatsApp polling', () async {
      final repo = _StubInvoiceRepoForPayment(_finalizedInvoice)
        ..postPaymentInvoice = _paidInvoice
        ..whatsAppStatuses = [
          const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
          const InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Pending'),
        ];
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      final success = await notifier.recordPayment(
        const RecordPaymentRequest(amount: 1180.0, paymentMethod: 'UPI', reference: 'UPI/20260908/112233'),
      );

      expect(success, true);
      final state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.invoice!.isPaid, true);
      // Polling should be active for PaymentCompleted
      expect(notifier.isPolling, true);

      notifier.stopPolling();
    });

    test('RecordPaymentRequest serialization: null reference and paymentDate are omitted from JSON', () {
      // With all fields
      final full = RecordPaymentRequest(
        amount: 750.0,
        paymentMethod: 'Card',
        reference: 'CARD/20260908/445566',
        paymentDate: DateTime(2026, 9, 8, 14, 30),
      );
      final fullJson = full.toJson();
      expect(fullJson['amount'], 750.0);
      expect(fullJson['paymentMethod'], 'Card');
      expect(fullJson['reference'], 'CARD/20260908/445566');
      expect(fullJson.containsKey('paymentDate'), true);

      // With null optional fields — keys should be absent
      const minimal = RecordPaymentRequest(
        amount: 500.0,
        paymentMethod: 'Cash',
      );
      final minJson = minimal.toJson();
      expect(minJson['amount'], 500.0);
      expect(minJson['paymentMethod'], 'Cash');
      expect(minJson.containsKey('reference'), false);
      expect(minJson.containsKey('paymentDate'), false);

      // Empty string reference is also omitted (trimmed to empty)
      const emptyRef = RecordPaymentRequest(
        amount: 300.0,
        paymentMethod: 'UPI',
        reference: '   ',
      );
      final emptyRefJson = emptyRef.toJson();
      expect(emptyRefJson.containsKey('reference'), false);
    });
  });
}
