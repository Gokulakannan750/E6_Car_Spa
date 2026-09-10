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

// ── Stub Repository for Notifier Tests ───────────────────────────────────────

class _StubInvoiceRepo extends InvoiceRepository {
  Invoice invoiceToReturn;
  Invoice? generateResult;
  bool shouldThrowConflictOnGenerate = false;
  bool shouldThrowServerOnGenerate = false;
  bool shouldThrowUnauthorizedOnGenerate = false;
  int generateCallCount = 0;
  List<InvoiceWhatsAppStatus> whatsAppStatuses = [];
  Completer<Invoice>? generateCompleter;

  _StubInvoiceRepo(this.invoiceToReturn) : super(InvoiceApi(Dio()));

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
  Future<Invoice> generateInvoice(String id) async {
    generateCallCount++;
    if (generateCompleter != null) return generateCompleter!.future;
    if (shouldThrowConflictOnGenerate) {
      throw const ConflictException(
        message: 'Invoice has already been generated for this job card.',
        endpoint: '/invoices/generate',
      );
    }
    if (shouldThrowServerOnGenerate) {
      throw const ServerException(
        message: 'Database connection failed.',
        endpoint: '/invoices/generate',
      );
    }
    if (shouldThrowUnauthorizedOnGenerate) {
      throw const UnauthorizedException(
        message: 'Session expired. Please log in again.',
        endpoint: '/invoices/generate',
      );
    }
    return generateResult ?? invoiceToReturn;
  }

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(String invoiceId) async {
    return whatsAppStatuses;
  }

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
}

// ── Fake API for Repository-Level Tests ──────────────────────────────────────

class _FakeInvoiceApiForConflict extends InvoiceApi {
  DioException? dioErrorToThrow;
  Invoice? mockInvoice;

  _FakeInvoiceApiForConflict() : super(Dio());

  @override
  Future<Invoice> createFromJobCard(String jobCardId) async {
    if (dioErrorToThrow != null) throw dioErrorToThrow!;
    if (mockInvoice != null) return mockInvoice!;
    throw Exception('No mock configured');
  }

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
}

// ── Test Data ────────────────────────────────────────────────────────────────

final _draftInvoice = Invoice(
  id: 'inv-draft-1',
  invoiceNumber: null,
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
  status: InvoiceStatus.draft,
  items: const [],
  createdAt: DateTime(2026, 9, 8),
);

final _generatedInvoice = Invoice(
  id: 'inv-draft-1',
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

void main() {
  group('Invoice Generation — Conflict & Error Handling', () {
    test('generateInvoice handles HTTP 409 conflict: sets errorMessage, resets isGenerating, preserves invoice', () async {
      final repo = _StubInvoiceRepo(_draftInvoice)..shouldThrowConflictOnGenerate = true;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-draft-1').notifier);
      await notifier.loadDetails();

      // Verify draft state loaded
      var state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.invoice!.isDraft, true);

      final result = await notifier.generateInvoice();

      expect(result, isNull);
      state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.isGenerating, false);
      expect(state.errorMessage, 'Invoice has already been generated for this job card.');
      // Original invoice preserved as draft
      expect(state.invoice!.isDraft, true);
      expect(state.invoice!.invoiceNumber, isNull);
    });

    test('generateInvoice handles HTTP 500 server error: sets errorMessage, invoice state unchanged', () async {
      final repo = _StubInvoiceRepo(_draftInvoice)..shouldThrowServerOnGenerate = true;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-draft-1').notifier);
      await notifier.loadDetails();

      final result = await notifier.generateInvoice();

      expect(result, isNull);
      final state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.isGenerating, false);
      expect(state.errorMessage, 'Database connection failed.');
      expect(state.invoice!.isDraft, true);
    });

    test('generateInvoice handles HTTP 401 unauthorized: propagates auth error, resets isGenerating', () async {
      final repo = _StubInvoiceRepo(_draftInvoice)..shouldThrowUnauthorizedOnGenerate = true;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-draft-1').notifier);
      await notifier.loadDetails();

      final result = await notifier.generateInvoice();

      expect(result, isNull);
      final state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.isGenerating, false);
      expect(state.errorMessage, 'Session expired. Please log in again.');
      // No false finalized state
      expect(state.invoice!.isFinalized, false);
    });

    test('isGenerating flag enables UI to block concurrent taps during generation', () async {
      final completer = Completer<Invoice>();
      final repo = _StubInvoiceRepo(_draftInvoice)..generateCompleter = completer;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-draft-1').notifier);
      await notifier.loadDetails();

      // Start generation without awaiting (async function runs to first await, then yields)
      final future = notifier.generateInvoice();

      // While in-flight, isGenerating should be true
      var state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.isGenerating, true);

      // UI checks this flag → disables button → prevents concurrent taps
      // Complete the operation
      completer.complete(_generatedInvoice);
      await future;

      state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.isGenerating, false);
      expect(repo.generateCallCount, 1);
    });

    test('createFromJobCard HTTP 409 on already-invoiced job card throws ConflictException', () async {
      final fakeApi = _FakeInvoiceApiForConflict();
      fakeApi.dioErrorToThrow = DioException(
        requestOptions: RequestOptions(path: '/invoices/from-job-card/jc-1'),
        response: Response(
          requestOptions: RequestOptions(path: '/invoices/from-job-card/jc-1'),
          statusCode: 409,
          data: {'error': 'An invoice already exists for this job card.'},
        ),
      );

      final repository = InvoiceRepository(fakeApi);

      expect(
        () => repository.createFromJobCard('jc-1'),
        throwsA(isA<ConflictException>()),
      );
    });

    test('createFromJobCard HTTP 500 server failure throws ServerException', () async {
      final fakeApi = _FakeInvoiceApiForConflict();
      fakeApi.dioErrorToThrow = DioException(
        requestOptions: RequestOptions(path: '/invoices/from-job-card/jc-1'),
        response: Response(
          requestOptions: RequestOptions(path: '/invoices/from-job-card/jc-1'),
          statusCode: 500,
          data: {'error': 'Internal Server Error'},
        ),
      );

      final repository = InvoiceRepository(fakeApi);

      expect(
        () => repository.createFromJobCard('jc-1'),
        throwsA(isA<ServerException>()),
      );
    });

    test('successful generateInvoice updates state to finalized and starts WhatsApp polling', () async {
      final repo = _StubInvoiceRepo(_draftInvoice)
        ..generateResult = _generatedInvoice
        ..whatsAppStatuses = [
          const InvoiceWhatsAppStatus(messageType: 'InvoiceFinalized', status: 'Pending'),
        ];
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-draft-1').notifier);
      await notifier.loadDetails();

      final result = await notifier.generateInvoice();

      expect(result, isNotNull);
      expect(result!.invoiceNumber, 'INV-2026-000001');
      expect(result.status, InvoiceStatus.generated);

      final state = container.read(invoiceDetailsProvider('inv-draft-1'));
      expect(state.isGenerating, false);
      expect(state.invoice!.isFinalized, true);
      expect(state.actionSuccessMessage, contains('INV-2026-000001'));
      expect(state.actionSuccessMessage, contains('generated successfully'));

      // WhatsApp polling should be active for InvoiceFinalized
      expect(notifier.isPolling, true);

      // Clean up timer
      notifier.stopPolling();
    });
  });
}
