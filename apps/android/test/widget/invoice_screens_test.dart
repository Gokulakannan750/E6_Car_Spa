import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/presentation/pages/invoices_screen.dart';
import 'package:e6_car_spa/features/invoices/presentation/pages/invoice_details_screen.dart';
import 'package:e6_car_spa/features/invoices/presentation/widgets/invoice_card.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_api.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_repository.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/jobcards/presentation/pages/job_card_details_screen.dart';

class FakeInvoiceApiForWidget extends InvoiceApi {
  InvoiceListResponse? mockList;
  Invoice? mockInvoice;

  FakeInvoiceApiForWidget() : super(Dio());

  @override
  Future<InvoiceListResponse> getInvoices({
    int page = 1,
    int pageSize = 20,
    String? search,
    InvoiceStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    if (mockList != null) return mockList!;
    return const InvoiceListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);
  }

  @override
  Future<Invoice> getInvoiceById(String id) async {
    if (mockInvoice != null) return mockInvoice!;
    throw Exception('Invoice not found');
  }
}

class FakeJobCardApiForWidget extends JobCardApi {
  JobCard? mockJobCard;

  FakeJobCardApiForWidget() : super(Dio());

  @override
  Future<JobCard> getJobCardById(String id) async {
    if (mockJobCard != null) return mockJobCard!;
    throw Exception('Job card not found');
  }
}

void main() {
  group('Invoice Screens Widget Tests', () {
    late FakeInvoiceApiForWidget fakeInvoiceApi;
    late FakeJobCardApiForWidget fakeJobCardApi;

    setUp(() {
      fakeInvoiceApi = FakeInvoiceApiForWidget();
      fakeJobCardApi = FakeJobCardApiForWidget();
    });

    final testDraftInvoice = Invoice(
      id: 'inv-draft-1',
      invoiceNumber: null,
      jobCardId: 'jc-1',
      jobCardNumber: 'JC-2026-000096',
      customerId: 'c-1',
      customerName: 'Priya Sharma',
      customerPhone: '9840123456',
      vehicleId: 'v-1',
      registrationNumber: 'TN01AB1234',
      vehicleMake: 'Honda',
      vehicleModel: 'City',
      vehicleVariant: 'ZX CVT',
      invoiceDate: DateTime(2026, 8, 25),
      subtotal: 10000.0,
      discount: 0.0,
      taxableAmount: 10000.0,
      gstAmount: 1800.0,
      totalAmount: 11800.0,
      paidAmount: 0.0,
      balanceAmount: 11800.0,
      status: InvoiceStatus.draft,
      items: [
        const InvoiceItem(
          id: 'item-1',
          description: 'Ceramic Coating',
          quantity: 1,
          unitPrice: 10000.0,
          discount: 0.0,
          taxableAmount: 10000.0,
          taxAmount: 1800.0,
          totalAmount: 11800.0,
        ),
      ],
      payments: [],
      createdAt: DateTime(2026, 8, 25),
      updatedAt: null,
    );

    final testFinalizedInvoice = Invoice(
      id: 'inv-final-1',
      invoiceNumber: 'INV-2026-000096',
      jobCardId: 'jc-1',
      jobCardNumber: 'JC-2026-000096',
      customerId: 'c-1',
      customerName: 'Priya Sharma',
      customerPhone: '9840123456',
      vehicleId: 'v-1',
      registrationNumber: 'TN01AB1234',
      vehicleMake: 'Honda',
      vehicleModel: 'City',
      vehicleVariant: 'ZX CVT',
      invoiceDate: DateTime(2026, 8, 25),
      subtotal: 10000.0,
      discount: 0.0,
      taxableAmount: 10000.0,
      gstAmount: 1800.0,
      totalAmount: 11800.0,
      paidAmount: 5000.0,
      balanceAmount: 6800.0,
      status: InvoiceStatus.partiallyPaid,
      items: [
        const InvoiceItem(
          id: 'item-1',
          description: 'Ceramic Coating',
          quantity: 1,
          unitPrice: 10000.0,
          discount: 0.0,
          taxableAmount: 10000.0,
          taxAmount: 1800.0,
          totalAmount: 11800.0,
        ),
      ],
      payments: [
        PaymentDto(
          id: 'pay-1',
          invoiceId: 'inv-final-1',
          amount: 5000.0,
          paymentMethod: 'UPI',
          reference: 'UPI123456',
          paymentDate: DateTime(2026, 8, 25),
          createdAt: DateTime(2026, 8, 25),
        ),
      ],
      createdAt: DateTime(2026, 8, 25),
      updatedAt: null,
    );

    testWidgets('InvoicesScreen renders search, filter chips, and invoice items', (tester) async {
      fakeInvoiceApi.mockList = InvoiceListResponse(
        items: [
          InvoiceListItem(
            id: 'inv-1',
            invoiceNumber: 'INV-2026-000001',
            jobCardNumber: 'JC-2026-000096',
            customerName: 'Priya Sharma',
            customerPhone: '9840123456',
            registrationNumber: 'TN01AB1234',
            vehicle: 'Honda City',
            invoiceDate: DateTime(2026, 8, 25),
            totalAmount: 11800.0,
            balanceAmount: 11800.0,
            status: InvoiceStatus.generated,
            createdAt: DateTime(2026, 8, 25),
          ),
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeInvoiceApi),
          ],
          child: const MaterialApp(
            home: InvoicesScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('All Invoices'), findsOneWidget);
      expect(find.text('Draft'), findsOneWidget);
      expect(find.text('Generated'), findsWidgets);
      expect(find.text('Paid'), findsOneWidget);
      expect(find.byType(InvoiceCard), findsOneWidget);
      expect(find.text('INV-2026-000001'), findsOneWidget);
      expect(find.text('Priya Sharma'), findsOneWidget);
    });

    testWidgets('InvoiceDetailsScreen renders Draft mode with Edit Draft and Generate buttons', (tester) async {
      fakeInvoiceApi.mockInvoice = testDraftInvoice;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeInvoiceApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-draft-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Priya Sharma'), findsOneWidget);
      expect(find.text('Ceramic Coating'), findsOneWidget);
      expect(find.text('₹11800.00'), findsWidgets);
      expect(find.text('Edit Draft'), findsOneWidget);
      expect(find.text('Generate'), findsOneWidget);
    });

    testWidgets('InvoiceDetailsScreen renders Finalized mode with Record Payment button & payment history', (tester) async {
      fakeInvoiceApi.mockInvoice = testFinalizedInvoice;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeInvoiceApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-final-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('INV-2026-000096'), findsWidgets);
      expect(find.text('Payment History (1)'), findsOneWidget);
      expect(find.text('UPI / QR'), findsOneWidget);
      expect(find.text('Ref: UPI123456'), findsOneWidget);
      expect(find.text('Record Payment (₹6800.00)'), findsOneWidget);
    });

    testWidgets('JobCardDetailsScreen renders Convert to Invoice button when no invoice exists', (tester) async {
      final jobCard = JobCard(
        id: 'jc-test-1',
        jobCardNumber: 'JC-2026-000099',
        customer: const CustomerSummary(id: 'c-1', name: 'Ramesh', phoneNumber: '9876543210'),
        vehicle: const VehicleSummary(id: 'v-1', registrationNumber: 'TN02CD1234', make: 'Hyundai', model: 'i20'),
        status: JobCardStatus.ready,
        services: [
          const JobCardServiceItem(
            id: 's-1',
            serviceId: 'svc-1',
            serviceName: 'Foam Wash',
            unitPrice: 500.0,
            quantity: 1,
            taxPercentage: 18.0,
            lineTotal: 590.0,
          ),
        ],
        subtotal: 500.0,
        taxAmount: 90.0,
        discountAmount: 0.0,
        totalAmount: 590.0,
        invoiceId: null,
      );

      fakeJobCardApi.mockJobCard = jobCard;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            jobCardApiProvider.overrideWithValue(fakeJobCardApi),
            invoiceApiProvider.overrideWithValue(fakeInvoiceApi),
          ],
          child: const MaterialApp(
            home: JobCardDetailsScreen(jobCardId: 'jc-test-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('JC-2026-000099'), findsOneWidget);
      expect(find.text('Convert to Invoice'), findsOneWidget);
    });
  });
}
