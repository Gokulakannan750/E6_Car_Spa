import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/presentation/pages/invoice_details_screen.dart';

class FakeInvoiceApiForBottomBarTest extends InvoiceApi {
  Invoice? mockInvoice;
  FakeInvoiceApiForBottomBarTest() : super(Dio());

  @override
  Future<Invoice> getInvoiceById(String id) async {
    if (mockInvoice != null) return mockInvoice!;
    throw Exception('Invoice not found');
  }
}

Invoice _createTestInvoice({required double balanceAmount}) {
  return Invoice(
    id: 'inv-test-$balanceAmount',
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
    subtotal: balanceAmount,
    discount: 0.0,
    taxableAmount: balanceAmount,
    gstAmount: 0.0,
    totalAmount: balanceAmount,
    paidAmount: 0.0,
    balanceAmount: balanceAmount,
    status: InvoiceStatus.generated,
    items: const [],
    payments: const [],
    createdAt: DateTime(2026, 8, 25),
    updatedAt: null,
  );
}

void main() {
  group('Invoice Details Bottom Action Bar Overflow & Responsiveness Tests', () {
    final amountsToTest = [
      1000.0,
      19560.80,
      100000.0,
      1050000.0,
    ];

    final screenSizesToTest = [
      const Size(320, 568),  // Small/legacy Android
      const Size(360, 800),  // Standard compact Android
      const Size(390, 844),  // Modern standard Android
      const Size(411.4, 823), // Pixel emulator / standard large
      const Size(480, 854),  // Wide Android
    ];

    for (final size in screenSizesToTest) {
      for (final amount in amountsToTest) {
        testWidgets(
          'No overflow with amount ₹${amount.toStringAsFixed(2)} on screen ${size.width}x${size.height}',
          (tester) async {
            final fakeApi = FakeInvoiceApiForBottomBarTest();
            fakeApi.mockInvoice = _createTestInvoice(balanceAmount: amount);

            tester.view.physicalSize = size;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(() => tester.view.resetPhysicalSize());

            FlutterErrorDetails? captured;
            final prevOnError = FlutterError.onError;
            FlutterError.onError = (details) {
              captured = details;
            };

            await tester.pumpWidget(
              ProviderScope(
                overrides: [
                  invoiceApiProvider.overrideWithValue(fakeApi),
                ],
                child: const MaterialApp(
                  home: InvoiceDetailsScreen(invoiceId: 'inv-test'),
                ),
              ),
            );

            await tester.pumpAndSettle();
            FlutterError.onError = prevOnError;

            expect(captured, isNull);

            // Verify both buttons are present and visible
            expect(find.byKey(const Key('print_invoice_bottom_button')), findsOneWidget);
            expect(find.text('Print'), findsOneWidget);
            expect(find.byIcon(Icons.print_outlined), findsWidgets);

            final expectedLabel = 'Record Payment (₹${amount.toStringAsFixed(2)})';
            expect(find.text(expectedLabel), findsOneWidget);
            expect(find.byIcon(Icons.payments_outlined), findsOneWidget);
          },
        );
      }
    }

    testWidgets('Record Payment button is tappable and opens RecordPaymentBottomSheet', (tester) async {
      final fakeApi = FakeInvoiceApiForBottomBarTest();
      fakeApi.mockInvoice = _createTestInvoice(balanceAmount: 19560.80);

      tester.view.physicalSize = const Size(411.4, 823);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-test'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      final recordPaymentFinder = find.text('Record Payment (₹19560.80)');
      expect(recordPaymentFinder, findsOneWidget);

      await tester.tap(recordPaymentFinder);
      await tester.pumpAndSettle();

      // Verify the Record Payment bottom sheet appears
      expect(find.text('Record Payment'), findsWidgets);
    });

    testWidgets('Print button is tappable and triggers dialog', (tester) async {
      final fakeApi = FakeInvoiceApiForBottomBarTest();
      fakeApi.mockInvoice = _createTestInvoice(balanceAmount: 19560.80);

      tester.view.physicalSize = const Size(411.4, 823);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceApiProvider.overrideWithValue(fakeApi),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-test'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      final printFinder = find.byKey(const Key('print_invoice_bottom_button'));
      expect(printFinder, findsOneWidget);

      await tester.tap(printFinder);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Dialog is shown
      expect(find.byType(Dialog), findsOneWidget);
    });
  });
}
