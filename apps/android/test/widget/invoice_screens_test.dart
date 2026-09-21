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
import 'package:e6_car_spa/shared/widgets/status_badge.dart';
import 'package:e6_car_spa/core/constants/app_colors.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_api.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_repository.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/jobcards/presentation/pages/job_card_details_screen.dart';

class FakeInvoiceApiForWidget extends InvoiceApi {
  InvoiceListResponse? mockList;
  Invoice? mockInvoice;
  String? lastSearch;
  int getInvoicesCallCount = 0;

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
    lastSearch = search;
    getInvoicesCallCount++;
    if (mockList != null) return mockList!;
    return const InvoiceListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);
  }

  @override
  Future<Invoice> getInvoiceById(String id) async {
    if (mockInvoice != null) return mockInvoice!;
    throw Exception('Invoice not found');
  }

  List<InvoiceWhatsAppStatus> mockWhatsAppStatuses = [];

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(String invoiceId) async {
    return mockWhatsAppStatuses;
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
      expect(find.text('Payment Pending'), findsWidgets);
      expect(find.text('Paid'), findsOneWidget);
      expect(find.byType(InvoiceCard), findsOneWidget);
      expect(find.text('INV-2026-000001'), findsOneWidget);
      expect(find.text('Priya Sharma'), findsOneWidget);
    });

    testWidgets('InvoicesScreen searching by Job Card Number passes query to data layer and renders matching invoice with Job Card Number', (tester) async {
      final item = InvoiceListItem(
        id: 'inv-101',
        invoiceNumber: 'INV-2026-000101',
        jobCardNumber: 'JC-2026-000101',
        customerName: 'Anand Sharma',
        customerPhone: '9840123456',
        registrationNumber: 'TN01AB1234',
        vehicle: 'Honda City',
        invoiceDate: DateTime(2026, 8, 25),
        totalAmount: 11800.0,
        balanceAmount: 11800.0,
        status: InvoiceStatus.generated,
        createdAt: DateTime(2026, 8, 25),
      );

      fakeInvoiceApi.mockList = InvoiceListResponse(
        items: [item],
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

      // Enter Job Card Number in search field
      await tester.enterText(find.byType(TextField), 'JC-2026-000101');
      await tester.pumpAndSettle();

      expect(fakeInvoiceApi.lastSearch, 'JC-2026-000101');
      expect(find.byType(InvoiceCard), findsOneWidget);
      expect(find.descendant(of: find.byType(InvoiceCard), matching: find.text('JC-2026-000101')), findsOneWidget);
      expect(find.text('INV-2026-000101'), findsOneWidget);
      expect(find.text('Anand Sharma'), findsOneWidget);
    });

    testWidgets('InvoicesScreen searching by Invoice Number, Customer Name, Vehicle Registration, and empty result behavior', (tester) async {
      final item = InvoiceListItem(
        id: 'inv-102',
        invoiceNumber: 'INV-2026-000102',
        jobCardNumber: 'JC-2026-000102',
        customerName: 'Vikas Rao',
        customerPhone: '9123456789',
        registrationNumber: 'KA05CD5678',
        vehicle: 'Hyundai Creta',
        invoiceDate: DateTime(2026, 8, 25),
        totalAmount: 5000.0,
        balanceAmount: 5000.0,
        status: InvoiceStatus.generated,
        createdAt: DateTime(2026, 8, 25),
      );

      fakeInvoiceApi.mockList = InvoiceListResponse(
        items: [item],
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

      // Search by invoice number
      await tester.enterText(find.byType(TextField), 'INV-2026-000102');
      await tester.pumpAndSettle();
      expect(fakeInvoiceApi.lastSearch, 'INV-2026-000102');

      // Search by customer name
      await tester.enterText(find.byType(TextField), 'Vikas Rao');
      await tester.pumpAndSettle();
      expect(fakeInvoiceApi.lastSearch, 'Vikas Rao');

      // Search by vehicle registration
      await tester.enterText(find.byType(TextField), 'KA05CD5678');
      await tester.pumpAndSettle();
      expect(fakeInvoiceApi.lastSearch, 'KA05CD5678');

      // Clear search restores normal query
      final clearButtonFinder = find.byIcon(Icons.clear);
      if (clearButtonFinder.evaluate().isNotEmpty) {
        await tester.tap(clearButtonFinder);
      } else {
        await tester.enterText(find.byType(TextField), '');
      }
      await tester.pumpAndSettle();
      expect(fakeInvoiceApi.lastSearch, null);

      // Empty results behavior
      fakeInvoiceApi.mockList = const InvoiceListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);
      await tester.enterText(find.byType(TextField), 'NONEXISTENT');
      await tester.pumpAndSettle();
      expect(find.byType(InvoiceCard), findsNothing);
      expect(find.text('No matching invoices'), findsOneWidget);
    });

    testWidgets('InvoicesScreen renders Payment Pending status badge and not Draft for finalized invoice', (tester) async {
      final generatedItem = InvoiceListItem.fromJson({
        'id': 'inv-gen-19',
        'invoiceNumber': 'INV-2026-000019',
        'jobCardNumber': 'JC-2026-000029',
        'customerName': 'Ramesh Babu',
        'customerPhone': '9840123456',
        'registrationNumber': 'TN01AB1234',
        'vehicle': 'Honda City',
        'invoiceDate': '2026-08-25T00:00:00Z',
        'totalAmount': 5000.0,
        'paidAmount': 0.0,
        'balanceAmount': 5000.0,
        'status': 6,
        'createdAt': '2026-08-25T10:00:00Z',
      });

      fakeInvoiceApi.mockList = InvoiceListResponse(
        items: [generatedItem],
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

      final cardFinder = find.byType(InvoiceCard);
      expect(cardFinder, findsOneWidget);
      // Status badge inside card should be "Payment Pending"
      expect(find.descendant(of: cardFinder, matching: find.text('Payment Pending')), findsOneWidget);
      // It should NOT be "Draft" inside the card
      expect(find.descendant(of: cardFinder, matching: find.text('Draft')), findsNothing);
    });

    testWidgets('StatusBadge renders Payment Pending with blue styling matching Desktop and preserves other statuses', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                StatusBadge(label: 'Payment Pending', type: StatusType.generated),
                StatusBadge(label: 'Draft', type: StatusType.draft),
                StatusBadge(label: 'Partially Paid', type: StatusType.paid),
                StatusBadge(label: 'Paid', type: StatusType.paid),
                StatusBadge(label: 'Cancelled', type: StatusType.cancelled),
              ],
            ),
          ),
        ),
      );

      final genBadgeFinder = find.widgetWithText(StatusBadge, 'Payment Pending');
      expect(genBadgeFinder, findsOneWidget);

      // Verify container decoration (blue styling)
      final genContainerFinder = find.descendant(of: genBadgeFinder, matching: find.byType(Container));
      final genContainer = tester.widget<Container>(genContainerFinder);
      final genBoxDec = genContainer.decoration as BoxDecoration;
      expect(genBoxDec.color, AppColors.generatedBg); // Light blue background
      expect((genBoxDec.border as Border).top.color, AppColors.generatedBorder);

      // Verify text color (blue text)
      final genTextFinder = find.descendant(of: genBadgeFinder, matching: find.byType(Text));
      final genText = tester.widget<Text>(genTextFinder);
      expect(genText.style?.color, AppColors.generatedText);

      // Verify icon color and icon data (blue icon)
      final genIconFinder = find.descendant(of: genBadgeFinder, matching: find.byType(Icon));
      final genIcon = tester.widget<Icon>(genIconFinder);
      expect(genIcon.color, AppColors.generatedText);
      expect(genIcon.icon, Icons.verified_outlined);

      // Verify StatusBadge.fromLabel('Payment Pending') assigns StatusType.generated
      final fromLabelBadge = StatusBadge.fromLabel('Payment Pending');
      expect(fromLabelBadge.type, StatusType.generated);

      // Verify other statuses are unchanged
      final draftBadge = StatusBadge.fromLabel('Draft');
      expect(draftBadge.type, StatusType.draft);

      final partBadge = StatusBadge.fromLabel('Partially Paid');
      expect(partBadge.type, StatusType.pending);

      final paidBadge = StatusBadge.fromLabel('Paid');
      expect(paidBadge.type, StatusType.paid);

      final cancelBadge = StatusBadge.fromLabel('Cancelled');
      expect(cancelBadge.type, StatusType.cancelled);
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

    testWidgets('JobCardDetailsScreen renders Mark as Finished button when no invoice exists', (tester) async {
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
      expect(find.text('Mark as Finished'), findsOneWidget);
    });

    testWidgets('JobCardDetailsScreen tapping Mark as Finished shows confirmation dialog', (tester) async {
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

      final finishBtn = find.text('Mark as Finished');
      expect(finishBtn, findsOneWidget);

      await tester.tap(finishBtn);
      await tester.pumpAndSettle();

      expect(find.text('Convert to Draft?'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Convert'), findsOneWidget);

      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(find.text('Convert to Draft?'), findsNothing);
      expect(find.text('Mark as Finished'), findsOneWidget);
    });
  });
}
