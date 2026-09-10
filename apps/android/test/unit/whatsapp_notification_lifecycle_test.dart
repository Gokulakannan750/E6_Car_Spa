import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fake_async/fake_async.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_request_models.dart';
import 'package:e6_car_spa/features/invoices/providers/invoice_providers.dart';

// ── Stub Repository for WhatsApp Lifecycle Tests ─────────────────────────────

class _StubInvoiceRepoForWhatsApp extends InvoiceRepository {
  Invoice invoiceToReturn;
  List<InvoiceWhatsAppStatus> whatsAppStatuses;
  bool shouldThrowOnWhatsApp = false;
  int whatsAppFetchCount = 0;

  _StubInvoiceRepoForWhatsApp(this.invoiceToReturn, {this.whatsAppStatuses = const []})
      : super(InvoiceApi(Dio()));

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
  Future<Invoice> getInvoiceById(String id) async => invoiceToReturn;

  @override
  Future<Invoice> generateInvoice(String id) async => invoiceToReturn;

  @override
  Future<PaymentDto> recordPayment(String invoiceId, RecordPaymentRequest request) async {
    return PaymentDto(
      id: 'pay-stub',
      invoiceId: invoiceId,
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      paymentDate: DateTime.now(),
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(String invoiceId) async {
    whatsAppFetchCount++;
    if (shouldThrowOnWhatsApp) {
      throw Exception('WhatsApp API temporarily unavailable');
    }
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
  customerName: 'Aravind Kumar',
  customerPhone: '9876543210',
  vehicleId: 'v-1',
  registrationNumber: 'TN01AB1234',
  vehicleMake: 'Hyundai',
  vehicleModel: 'Creta',
  invoiceDate: DateTime(2026, 9, 8),
  subtotal: 1000.0,
  taxableAmount: 1000.0,
  gstAmount: 180.0,
  totalAmount: 1180.0,
  balanceAmount: 1180.0,
  status: InvoiceStatus.generated,
  items: const [],
  createdAt: DateTime(2026, 9, 8),
);

final _paidInvoice = Invoice(
  id: 'inv-fin-1',
  invoiceNumber: 'INV-2026-000001',
  jobCardId: 'jc-1',
  jobCardNumber: 'JC-2026-000001',
  customerId: 'c-1',
  customerName: 'Aravind Kumar',
  customerPhone: '9876543210',
  vehicleId: 'v-1',
  registrationNumber: 'TN01AB1234',
  vehicleMake: 'Hyundai',
  vehicleModel: 'Creta',
  invoiceDate: DateTime(2026, 9, 8),
  subtotal: 1000.0,
  taxableAmount: 1000.0,
  gstAmount: 180.0,
  totalAmount: 1180.0,
  paidAmount: 1180.0,
  balanceAmount: 0.0,
  status: InvoiceStatus.paid,
  items: const [],
  payments: [
    PaymentDto(
      id: 'pay-1',
      invoiceId: 'inv-fin-1',
      amount: 1180.0,
      paymentMethod: 'UPI',
      paymentDate: DateTime(2026, 9, 8),
      createdAt: DateTime(2026, 9, 8),
    ),
  ],
  createdAt: DateTime(2026, 9, 8),
);

void main() {
  group('WhatsApp Notification Lifecycle — Polling & State Transitions', () {
    test('Invoice WhatsApp Pending → Skipped stops polling', () async {
      final repo = _StubInvoiceRepoForWhatsApp(_finalizedInvoice, whatsAppStatuses: [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Pending'),
      ]);
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      var state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.whatsAppStatuses.first.isPending, true);
      expect(notifier.isPolling, true);

      // Backend reports Skipped
      repo.whatsAppStatuses = [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Skipped'),
      ];

      await notifier.refreshWhatsAppStatus(silent: true);

      state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.whatsAppStatuses.first.isSkipped, true);
      expect(state.whatsAppStatuses.first.isTerminal, true);
      expect(notifier.isPolling, false);
    });

    test('Payment WhatsApp Pending → Sent stops polling', () async {
      final repo = _StubInvoiceRepoForWhatsApp(_finalizedInvoice, whatsAppStatuses: [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        const InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Pending'),
      ]);
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      // Polling started because PaymentCompleted is non-terminal
      expect(notifier.isPolling, true);

      // Backend reports PaymentCompleted Sent
      repo.whatsAppStatuses = [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        const InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Sent'),
      ];

      await notifier.refreshWhatsAppStatus(silent: true);

      final state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.whatsAppStatuses.every((s) => s.isTerminal), true);
      expect(notifier.isPolling, false);
    });

    test('Payment WhatsApp Pending → Failed stops polling', () async {
      final repo = _StubInvoiceRepoForWhatsApp(_finalizedInvoice, whatsAppStatuses: [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        const InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Processing'),
      ]);
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      expect(notifier.isPolling, true);

      // Backend reports PaymentCompleted Failed
      repo.whatsAppStatuses = [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        const InvoiceWhatsAppStatus(
          messageType: 'PaymentCompleted',
          status: 'Failed',
          errorMessage: 'Meta API rate limit exceeded',
        ),
      ];

      await notifier.refreshWhatsAppStatus(silent: true);

      final state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.whatsAppStatuses.last.isFailed, true);
      expect(state.whatsAppStatuses.last.errorMessage, 'Meta API rate limit exceeded');
      expect(state.whatsAppStatuses.every((s) => s.isTerminal), true);
      expect(notifier.isPolling, false);
    });

    test('Payment WhatsApp Pending → Skipped stops polling', () async {
      final repo = _StubInvoiceRepoForWhatsApp(_finalizedInvoice, whatsAppStatuses: [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        const InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Pending'),
      ]);
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      expect(notifier.isPolling, true);

      // Backend reports PaymentCompleted Skipped
      repo.whatsAppStatuses = [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        const InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Skipped'),
      ];

      await notifier.refreshWhatsAppStatus(silent: true);

      final state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.whatsAppStatuses.last.isSkipped, true);
      expect(notifier.isPolling, false);
    });

    test('WhatsApp status API failure during polling does not crash or clear state', () async {
      final repo = _StubInvoiceRepoForWhatsApp(_finalizedInvoice, whatsAppStatuses: [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Pending'),
      ]);
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      var state = container.read(invoiceDetailsProvider('inv-fin-1'));
      expect(state.whatsAppStatuses.length, 1);
      expect(state.whatsAppStatuses.first.isPending, true);

      // API starts failing
      repo.shouldThrowOnWhatsApp = true;

      // Silent polling error should not crash or clear existing statuses
      await notifier.refreshWhatsAppStatus(silent: true);

      state = container.read(invoiceDetailsProvider('inv-fin-1'));
      // Existing statuses preserved (not cleared)
      expect(state.whatsAppStatuses.length, 1);
      expect(state.whatsAppStatuses.first.isPending, true);
      // Invoice state intact
      expect(state.invoice!.isFinalized, true);
      expect(state.errorMessage, isNull);

      notifier.stopPolling();
    });

    test('polling stops after maximum attempts (15)', () {
      fakeAsync((async) {
        final repo = _StubInvoiceRepoForWhatsApp(_finalizedInvoice, whatsAppStatuses: [
          const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Pending'),
        ]);
        final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);

        final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);

        // Flush microtasks to complete loadDetails (async constructor call)
        async.flushMicrotasks();

        expect(notifier.isPolling, true);
        final fetchCountBeforePolling = repo.whatsAppFetchCount;

        // Advance past all 15 polling attempts (15 × 2s = 30s)
        // Status stays Pending, so polling won't stop early
        async.elapse(const Duration(seconds: 31));

        expect(notifier.isPolling, false);
        // Should have made polling fetch attempts (loadDetails initial + periodic ticks)
        expect(repo.whatsAppFetchCount, greaterThan(fetchCountBeforePolling));

        container.dispose();
      });
    });

    test('InvoiceWhatsAppStatus model: isTerminal, displayType, displayStatus cover all states', () {
      const pending = InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Pending');
      expect(pending.isPending, true);
      expect(pending.isTerminal, false);
      expect(pending.displayType, 'Invoice');
      expect(pending.displayStatus, 'Pending');

      const sent = InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent');
      expect(sent.isSent, true);
      expect(sent.isTerminal, true);
      expect(sent.displayType, 'Invoice');

      const failed = InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Failed');
      expect(failed.isFailed, true);
      expect(failed.isTerminal, true);
      expect(failed.displayType, 'Receipt');

      const skipped = InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Skipped');
      expect(skipped.isSkipped, true);
      expect(skipped.isTerminal, true);
      expect(skipped.displayType, 'Receipt');
      expect(skipped.displayStatus, 'Skipped');

      const processing = InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Processing');
      expect(processing.isProcessing, true);
      expect(processing.isTerminal, false);

      // Unknown messageType falls through to raw value
      const unknown = InvoiceWhatsAppStatus(messageType: 'SomethingNew', status: 'Pending');
      expect(unknown.displayType, 'SomethingNew');
    });

    test('WhatsApp failure does NOT corrupt successful financial state', () async {
      // Start with a successfully paid invoice
      final repo = _StubInvoiceRepoForWhatsApp(_paidInvoice, whatsAppStatuses: [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        const InvoiceWhatsAppStatus(messageType: 'PaymentCompleted', status: 'Pending'),
      ]);
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-fin-1').notifier);
      await notifier.loadDetails();

      var state = container.read(invoiceDetailsProvider('inv-fin-1'));
      // Financial state is correct
      expect(state.invoice!.isPaid, true);
      expect(state.invoice!.paidAmount, 1180.0);
      expect(state.invoice!.balanceAmount, 0.0);
      expect(state.invoice!.isFinalized, true);

      // WhatsApp payment notification fails
      repo.whatsAppStatuses = [
        const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Sent'),
        const InvoiceWhatsAppStatus(
          messageType: 'PaymentCompleted',
          status: 'Failed',
          errorMessage: 'Template not found',
        ),
      ];

      await notifier.refreshWhatsAppStatus(silent: true);

      state = container.read(invoiceDetailsProvider('inv-fin-1'));
      // CRITICAL: Financial state must NOT be corrupted by WhatsApp failure
      expect(state.invoice!.isPaid, true);
      expect(state.invoice!.paidAmount, 1180.0);
      expect(state.invoice!.balanceAmount, 0.0);
      expect(state.invoice!.isFinalized, true);
      expect(state.invoice!.totalAmount, 1180.0);

      // WhatsApp failure is represented independently
      final paymentStatus = state.whatsAppStatuses
          .firstWhere((s) => s.messageType == 'PaymentCompleted');
      expect(paymentStatus.isFailed, true);
      expect(paymentStatus.errorMessage, 'Template not found');

      // Invoice notification still shows Sent
      final invoiceStatus = state.whatsAppStatuses
          .firstWhere((s) => s.messageType == 'InvoiceFinalized');
      expect(invoiceStatus.isSent, true);
    });
  });
}
