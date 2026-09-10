import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_request_models.dart';
import 'package:e6_car_spa/features/invoices/providers/invoice_providers.dart';
import 'package:e6_car_spa/features/invoices/presentation/pages/invoice_details_screen.dart';

class FakeInvoiceApiForStatusTest extends InvoiceApi {
  Invoice? mockInvoice;
  List<InvoiceWhatsAppStatus> mockStatuses = [];
  int fetchStatusCallCount = 0;

  FakeInvoiceApiForStatusTest() : super(Dio());

  @override
  Future<Invoice> getInvoiceById(String id) async {
    if (mockInvoice != null) return mockInvoice!;
    throw Exception('Invoice not found');
  }

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(String invoiceId) async {
    fetchStatusCallCount++;
    return List.from(mockStatuses);
  }

  @override
  Future<PaymentDto> recordPayment(String invoiceId, RecordPaymentRequest request) async {
    if (mockInvoice != null) {
      final newPaid = mockInvoice!.paidAmount + request.amount;
      mockInvoice = _createFinalizedInvoice(
        id: mockInvoice!.id,
        total: mockInvoice!.totalAmount,
        paid: newPaid,
      );
    }
    return PaymentDto(
      id: 'pay-new',
      invoiceId: invoiceId,
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      reference: request.reference,
      paymentDate: DateTime.now(),
      createdAt: DateTime.now(),
    );
  }
}

Invoice _createFinalizedInvoice({
  String id = 'inv-test-1',
  double total = 1000.0,
  double paid = 0.0,
}) {
  return Invoice(
    id: id,
    invoiceNumber: 'INV-2026-000001',
    jobCardId: 'jc-1',
    jobCardNumber: 'JC-2026-000001',
    customerId: 'c-1',
    customerName: 'Gokul Kannan',
    customerPhone: '9840123456',
    vehicleId: 'v-1',
    registrationNumber: 'TN01AB1234',
    vehicleMake: 'BMW',
    vehicleModel: 'M3',
    invoiceDate: DateTime(2026, 9, 1),
    subtotal: total,
    discount: 0.0,
    taxableAmount: total,
    gstAmount: 0.0,
    totalAmount: total,
    paidAmount: paid,
    balanceAmount: total - paid,
    status: InvoiceStatus.generated,
    items: const [],
    payments: const [],
    createdAt: DateTime(2026, 9, 1),
  );
}

void main() {
  group('Invoice Details WhatsApp Notification Status Tests', () {
    late FakeInvoiceApiForStatusTest fakeApi;

    setUp(() {
      fakeApi = FakeInvoiceApiForStatusTest();
    });

    testWidgets('1. Displays WhatsApp Pending status while processing and polls', (tester) async {
      fakeApi.mockInvoice = _createFinalizedInvoice();
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Pending',
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-test-1'),
          ),
        ),
      );

      // Initial load
      await tester.pump();
      await tester.pump();

      expect(find.text('WhatsApp Invoice: Pending'), findsOneWidget);
      expect(fakeApi.fetchStatusCallCount, greaterThanOrEqualTo(1));

      // Clean up to prevent timer leak
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('2. Automatically updates to "WhatsApp Invoice: Sent" on screen without navigating', (tester) async {
      fakeApi.mockInvoice = _createFinalizedInvoice();
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Pending',
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-test-1'),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      expect(find.text('WhatsApp Invoice: Pending'), findsOneWidget);

      // Backend updates to Sent
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Sent',
        ),
      ];

      // Advance timer by 2 seconds (polling interval)
      await tester.pump(const Duration(seconds: 2));
      await tester.pump();

      // Screen must now show Sent WITHOUT navigation or leaving the screen
      expect(find.text('WhatsApp Invoice: Sent'), findsOneWidget);
      expect(find.text('WhatsApp Invoice: Pending'), findsNothing);

      // Polling should have stopped now that Sent is terminal.
      final callCountAfterSent = fakeApi.fetchStatusCallCount;
      await tester.pump(const Duration(seconds: 4));
      expect(fakeApi.fetchStatusCallCount, equals(callCountAfterSent));

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('3. Automatically updates to "WhatsApp Invoice: Failed" and stops polling', (tester) async {
      fakeApi.mockInvoice = _createFinalizedInvoice();
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Processing',
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-test-1'),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      expect(find.text('WhatsApp Invoice: Processing'), findsOneWidget);

      // Backend transitions to Failed
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Failed',
          errorMessage: 'Meta template error',
        ),
      ];

      await tester.pump(const Duration(seconds: 2));
      await tester.pump();

      expect(find.text('WhatsApp Invoice: Failed'), findsOneWidget);

      // Polling stopped
      final callCountAfterFailed = fakeApi.fetchStatusCallCount;
      await tester.pump(const Duration(seconds: 4));
      expect(fakeApi.fetchStatusCallCount, equals(callCountAfterFailed));

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('4. Automatically updates to "WhatsApp Payment: Sent" after recording payment', (tester) async {
      fakeApi.mockInvoice = _createFinalizedInvoice(total: 1000.0, paid: 0.0);
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Sent',
        ),
      ];

      late BuildContext savedContext;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeApi),
          ],
          child: MaterialApp(
            home: Builder(
              builder: (ctx) {
                savedContext = ctx;
                return const InvoiceDetailsScreen(invoiceId: 'inv-test-1');
              },
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      // Initially shows Invoice: Sent
      expect(find.text('WhatsApp Invoice: Sent'), findsOneWidget);
      expect(find.text('WhatsApp Payment: Sent'), findsNothing);

      // Trigger payment via notifier
      final container = ProviderScope.containerOf(savedContext);
      final notifier = container.read(invoiceDetailsProvider('inv-test-1').notifier);

      // Backend will report Payment Sent on subsequent poll
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Sent',
        ),
        const InvoiceWhatsAppStatus(
          messageType: 'PaymentCompleted',
          status: 'Pending',
        ),
      ];

      await notifier.recordPayment(
        const RecordPaymentRequest(amount: 1000.0, paymentMethod: 'UPI'),
      );

      await tester.pump();
      expect(find.text('WhatsApp Receipt: Pending'), findsOneWidget);

      // Backend now marks Payment as Sent
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Sent',
        ),
        const InvoiceWhatsAppStatus(
          messageType: 'PaymentCompleted',
          status: 'Sent',
        ),
      ];

      await tester.pump(const Duration(seconds: 2));
      await tester.pump();

      // Both statuses are visible on the currently mounted screen!
      expect(find.text('WhatsApp Invoice: Sent'), findsOneWidget);
      expect(find.text('WhatsApp Receipt: Sent'), findsOneWidget);

      // Polling stops since both are terminal
      final callCount = fakeApi.fetchStatusCallCount;
      await tester.pump(const Duration(seconds: 4));
      expect(fakeApi.fetchStatusCallCount, equals(callCount));

      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('5. Unmounting screen cancels active polling timer without errors', (tester) async {
      fakeApi.mockInvoice = _createFinalizedInvoice();
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Pending',
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-test-1'),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      expect(find.text('WhatsApp Invoice: Pending'), findsOneWidget);

      // Navigate away / unmount
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: Text('Different Screen')),
        ),
      );

      final callCountAtUnmount = fakeApi.fetchStatusCallCount;

      // Advance time by 4 seconds - no more calls should be made
      await tester.pump(const Duration(seconds: 4));
      expect(fakeApi.fetchStatusCallCount, equals(callCountAtUnmount));
    });

    testWidgets('6. Polling stops after maximum attempts (cutoff) to avoid polling forever', (tester) async {
      fakeApi.mockInvoice = _createFinalizedInvoice();
      fakeApi.mockStatuses = [
        const InvoiceWhatsAppStatus(
          messageType: 'InvoiceFinalized',
          status: 'Pending',
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-test-1'),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      // Advance past 15 attempts (15 * 2s = 30s)
      for (int i = 0; i < 20; i++) {
        await tester.pump(const Duration(seconds: 2));
      }

      final callsAfterMax = fakeApi.fetchStatusCallCount;
      // Advance more time - should not increase calls any further
      await tester.pump(const Duration(seconds: 10));
      expect(fakeApi.fetchStatusCallCount, equals(callsAfterMax));

      await tester.pumpWidget(const SizedBox());
    });
  });
}
