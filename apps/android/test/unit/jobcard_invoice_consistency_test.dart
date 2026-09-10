import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_request_models.dart';
import 'package:e6_car_spa/features/invoices/providers/invoice_providers.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';

// ── Stub Repository for Consistency Tests ────────────────────────────────────

class _StubInvoiceRepoForConsistency extends InvoiceRepository {
  Invoice invoiceToReturn;
  bool shouldThrowOnGenerate = false;
  List<InvoiceWhatsAppStatus> whatsAppStatuses = [];

  _StubInvoiceRepoForConsistency(this.invoiceToReturn) : super(InvoiceApi(Dio()));

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
    if (shouldThrowOnGenerate) {
      throw const ServerException(
        message: 'Invoice generation failed due to template error.',
        endpoint: '/invoices/generate',
      );
    }
    return invoiceToReturn;
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

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(String invoiceId) async {
    return whatsAppStatuses;
  }
}

// ── Fake API for Repository-Level createFromJobCard Tests ────────────────────

class _FakeInvoiceApiForJobCard extends InvoiceApi {
  Invoice? mockInvoice;
  DioException? dioErrorToThrow;

  _FakeInvoiceApiForJobCard() : super(Dio());

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

void main() {
  group('Job Card ↔ Invoice State Consistency', () {
    test('createFromJobCard returns draft invoice with correct customer and vehicle associations', () async {
      final expectedInvoice = Invoice(
        id: 'inv-new-1',
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
        vehicleVariant: 'SX(O)',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 2500.0,
        taxableAmount: 2500.0,
        gstAmount: 450.0,
        totalAmount: 2950.0,
        balanceAmount: 2950.0,
        status: InvoiceStatus.draft,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );

      final fakeApi = _FakeInvoiceApiForJobCard()..mockInvoice = expectedInvoice;
      final repository = InvoiceRepository(fakeApi);

      final invoice = await repository.createFromJobCard('jc-1');

      expect(invoice.isDraft, true);
      expect(invoice.isFinalized, false);
      expect(invoice.jobCardId, 'jc-1');
      expect(invoice.jobCardNumber, 'JC-2026-000001');
      expect(invoice.customerId, 'c-1');
      expect(invoice.customerName, 'Aravind Kumar');
      expect(invoice.vehicleId, 'v-1');
      expect(invoice.registrationNumber, 'TN01AB1234');
      expect(invoice.vehicleMake, 'Hyundai');
      expect(invoice.vehicleModel, 'Creta');
      expect(invoice.vehicleVariant, 'SX(O)');
      expect(invoice.invoiceNumber, isNull);
    });

    test('JobCard with invoiceNumber is locked, consistent with finalized invoice', () {
      // A finalized invoice produces a JobCard that is locked
      const lockedJobCard = JobCard(
        id: 'jc-1',
        jobCardNumber: 'JC-2026-000001',
        customer: CustomerSummary(id: 'c-1', name: 'Aravind', phoneNumber: '9876543210'),
        vehicle: VehicleSummary(id: 'v-1', registrationNumber: 'TN01AB1234', make: 'Hyundai', model: 'Creta'),
        status: JobCardStatus.invoiced,
        services: [],
        subtotal: 2500.0,
        totalAmount: 2950.0,
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-2026-000001',
      );

      // JobCard with invoice is locked
      expect(lockedJobCard.isLocked, true);

      // The corresponding invoice is finalized
      final correspondingInvoice = Invoice(
        id: 'inv-1',
        invoiceNumber: 'INV-2026-000001',
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-2026-000001',
        customerId: 'c-1',
        customerName: 'Aravind',
        customerPhone: '9876543210',
        vehicleId: 'v-1',
        registrationNumber: 'TN01AB1234',
        vehicleMake: 'Hyundai',
        vehicleModel: 'Creta',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 2500.0,
        taxableAmount: 2500.0,
        gstAmount: 450.0,
        totalAmount: 2950.0,
        balanceAmount: 2950.0,
        status: InvoiceStatus.generated,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );

      expect(correspondingInvoice.isFinalized, true);
      expect(correspondingInvoice.isDraft, false);

      // Consistency: both agree on the locked/finalized state
      expect(lockedJobCard.isLocked, correspondingInvoice.isFinalized);
    });

    test('failed generateInvoice does NOT report invoice as finalized', () async {
      final draftInvoice = Invoice(
        id: 'inv-draft-1',
        invoiceNumber: null,
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-2026-000001',
        customerId: 'c-1',
        customerName: 'Aravind',
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

      final repo = _StubInvoiceRepoForConsistency(draftInvoice)..shouldThrowOnGenerate = true;
      final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(container.dispose);

      final notifier = container.read(invoiceDetailsProvider('inv-draft-1').notifier);
      await notifier.loadDetails();

      // Attempt generation — it will fail
      final result = await notifier.generateInvoice();
      expect(result, isNull);

      final state = container.read(invoiceDetailsProvider('inv-draft-1'));
      // CRITICAL: invoice must NOT be incorrectly marked as finalized
      expect(state.invoice!.isDraft, true);
      expect(state.invoice!.isFinalized, false);
      expect(state.invoice!.invoiceNumber, isNull);
      expect(state.isGenerating, false);
      expect(state.errorMessage, 'Invoice generation failed due to template error.');
    });

    test('payment updates balance but JobCard remains locked', () {
      // Before payment: invoiced JobCard is locked
      const jobCard = JobCard(
        id: 'jc-1',
        jobCardNumber: 'JC-2026-000001',
        customer: CustomerSummary(id: 'c-1', name: 'Aravind', phoneNumber: '9876543210'),
        vehicle: VehicleSummary(id: 'v-1', registrationNumber: 'TN01AB1234', make: 'Hyundai', model: 'Creta'),
        status: JobCardStatus.paid,
        services: [],
        subtotal: 2500.0,
        totalAmount: 2950.0,
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-2026-000001',
      );

      expect(jobCard.isLocked, true);

      // After payment: invoice balance updated
      final paidInvoice = Invoice(
        id: 'inv-1',
        invoiceNumber: 'INV-2026-000001',
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-2026-000001',
        customerId: 'c-1',
        customerName: 'Aravind',
        customerPhone: '9876543210',
        vehicleId: 'v-1',
        registrationNumber: 'TN01AB1234',
        vehicleMake: 'Hyundai',
        vehicleModel: 'Creta',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 2500.0,
        taxableAmount: 2500.0,
        gstAmount: 450.0,
        totalAmount: 2950.0,
        paidAmount: 2950.0,
        balanceAmount: 0.0,
        status: InvoiceStatus.paid,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );

      expect(paidInvoice.isPaid, true);
      expect(paidInvoice.balanceAmount, 0.0);

      // JobCard remains locked even after full payment — payment does NOT unlock it
      expect(jobCard.isLocked, true);
    });

    test('Invoice status predicates: edge combinations not covered elsewhere', () {
      // Edge 1: status is partiallyPaid but paidAmount >= totalAmount (inconsistent backend data)
      final edgePartial = Invoice(
        id: 'inv-edge-1',
        invoiceNumber: 'INV-EDGE-001',
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-001',
        customerId: 'c-1',
        customerName: 'Test',
        customerPhone: '1234567890',
        vehicleId: 'v-1',
        registrationNumber: 'TN01XX1111',
        vehicleMake: 'Maruti',
        vehicleModel: 'Swift',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 500.0,
        taxableAmount: 500.0,
        gstAmount: 90.0,
        totalAmount: 590.0,
        paidAmount: 590.0,
        balanceAmount: 0.0,
        status: InvoiceStatus.partiallyPaid,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );
      // isPaid checks amount OR status — amount-based check should match
      expect(edgePartial.isPaid, true);
      // isPartiallyPaid checks status OR amount — status matches but amount says fully paid
      expect(edgePartial.isPartiallyPaid, true);
      // isFinalized: has invoiceNumber and not draft/cancelled
      expect(edgePartial.isFinalized, true);

      // Edge 2: zero totalAmount with zero paidAmount
      final zeroTotal = Invoice(
        id: 'inv-zero',
        invoiceNumber: 'INV-ZERO-001',
        jobCardId: 'jc-2',
        jobCardNumber: 'JC-002',
        customerId: 'c-1',
        customerName: 'Test',
        customerPhone: '1234567890',
        vehicleId: 'v-1',
        registrationNumber: 'TN01XX2222',
        vehicleMake: 'Maruti',
        vehicleModel: 'Alto',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 0.0,
        taxableAmount: 0.0,
        gstAmount: 0.0,
        totalAmount: 0.0,
        paidAmount: 0.0,
        balanceAmount: 0.0,
        status: InvoiceStatus.generated,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );
      // isPaid requires totalAmount > 0 for the amount-based check
      expect(zeroTotal.isPaid, false);
      expect(zeroTotal.isFinalized, true);
      expect(zeroTotal.isDraft, false);

      // Edge 3: cancelled invoice — not draft, not finalized
      final cancelled = Invoice(
        id: 'inv-cancel',
        invoiceNumber: 'INV-CANCEL-001',
        jobCardId: 'jc-3',
        jobCardNumber: 'JC-003',
        customerId: 'c-1',
        customerName: 'Test',
        customerPhone: '1234567890',
        vehicleId: 'v-1',
        registrationNumber: 'TN01XX3333',
        vehicleMake: 'Tata',
        vehicleModel: 'Nexon',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 1000.0,
        taxableAmount: 1000.0,
        gstAmount: 180.0,
        totalAmount: 1180.0,
        balanceAmount: 1180.0,
        status: InvoiceStatus.cancelled,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );
      expect(cancelled.isCancelled, true);
      expect(cancelled.isFinalized, false); // !isDraft && !isCancelled → false
      expect(cancelled.isDraft, false); // has invoiceNumber and status != draft

      // Edge 4: overdue invoice is finalized
      final overdue = Invoice(
        id: 'inv-overdue',
        invoiceNumber: 'INV-OVERDUE-001',
        jobCardId: 'jc-4',
        jobCardNumber: 'JC-004',
        customerId: 'c-1',
        customerName: 'Test',
        customerPhone: '1234567890',
        vehicleId: 'v-1',
        registrationNumber: 'TN01XX4444',
        vehicleMake: 'Honda',
        vehicleModel: 'Amaze',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 1000.0,
        taxableAmount: 1000.0,
        gstAmount: 180.0,
        totalAmount: 1180.0,
        balanceAmount: 1180.0,
        status: InvoiceStatus.overdue,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );
      expect(overdue.isFinalized, true);
      expect(overdue.isDraft, false);
      expect(overdue.isPaid, false);
    });

    test('Invoice.vehicleDisplayName formats with and without variant correctly', () {
      // Without variant
      final noVariant = Invoice(
        id: 'inv-v1',
        jobCardId: 'jc-1',
        jobCardNumber: 'JC-001',
        customerId: 'c-1',
        customerName: 'Test',
        customerPhone: '1234567890',
        vehicleId: 'v-1',
        registrationNumber: 'TN01AB1234',
        vehicleMake: 'Hyundai',
        vehicleModel: 'Creta',
        vehicleVariant: null,
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 0.0,
        taxableAmount: 0.0,
        gstAmount: 0.0,
        totalAmount: 0.0,
        balanceAmount: 0.0,
        status: InvoiceStatus.draft,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );
      expect(noVariant.vehicleDisplayName, 'Hyundai Creta');

      // With variant
      final withVariant = Invoice(
        id: 'inv-v2',
        jobCardId: 'jc-2',
        jobCardNumber: 'JC-002',
        customerId: 'c-1',
        customerName: 'Test',
        customerPhone: '1234567890',
        vehicleId: 'v-2',
        registrationNumber: 'TN01CD5678',
        vehicleMake: 'Honda',
        vehicleModel: 'City',
        vehicleVariant: 'ZX CVT',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 0.0,
        taxableAmount: 0.0,
        gstAmount: 0.0,
        totalAmount: 0.0,
        balanceAmount: 0.0,
        status: InvoiceStatus.draft,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );
      expect(withVariant.vehicleDisplayName, 'Honda City (ZX CVT)');

      // Empty variant (whitespace only) — should not show parentheses
      final emptyVariant = Invoice(
        id: 'inv-v3',
        jobCardId: 'jc-3',
        jobCardNumber: 'JC-003',
        customerId: 'c-1',
        customerName: 'Test',
        customerPhone: '1234567890',
        vehicleId: 'v-3',
        registrationNumber: 'TN01EF9012',
        vehicleMake: 'Tata',
        vehicleModel: 'Nexon',
        vehicleVariant: '   ',
        invoiceDate: DateTime(2026, 9, 8),
        subtotal: 0.0,
        taxableAmount: 0.0,
        gstAmount: 0.0,
        totalAmount: 0.0,
        balanceAmount: 0.0,
        status: InvoiceStatus.draft,
        items: const [],
        createdAt: DateTime(2026, 9, 8),
      );
      expect(emptyVariant.vehicleDisplayName, 'Tata Nexon');
      expect(emptyVariant.vehicleDisplayName.contains('('), false);
    });
  });
}
