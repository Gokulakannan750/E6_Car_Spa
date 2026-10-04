import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/utils/gst_display.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/presentation/widgets/edit_draft_bottom_sheet.dart';
import 'package:e6_car_spa/features/invoices/providers/invoice_providers.dart';

/// Phase 1: the app shows the server's GST calculation and never applies a flat 18% itself.

// ₹10,000 @ 18% + ₹10,000 @ 5% + ₹5,000 @ 0% exactly as the API returns it.
Map<String, dynamic> _mixedJson({double discount = 0}) {
  final withDiscount = discount > 0;
  return {
    'id': 'inv-1',
    'invoiceNumber': null,
    'jobCardId': 'jc-1',
    'jobCardNumber': 'JC-1',
    'customerId': 'c-1',
    'customerName': 'Test',
    'customerPhone': '9000000000',
    'vehicleId': 'v-1',
    'registrationNumber': 'TN01AB1234',
    'vehicleMake': 'Tata',
    'vehicleModel': 'Nexon',
    'invoiceDate': '2026-10-04',
    'subtotal': 25000,
    'discount': discount,
    'taxableAmount': withDiscount ? 24000 : 25000,
    'gstAmount': withDiscount ? 2208 : 2300,
    'totalAmount': withDiscount ? 26208 : 27300,
    'paidAmount': 0,
    'balanceAmount': withDiscount ? 26208 : 27300,
    'status': 0,
    'isGstEnabled': true,
    'items': [
      {'id': 'a', 'description': 'Ceramic', 'quantity': 1, 'unitPrice': 10000, 'discount': 0, 'taxableAmount': 10000, 'taxAmount': 1800, 'totalAmount': 11800, 'taxRatePercent': 18},
      {'id': 'b', 'description': 'Wax', 'quantity': 1, 'unitPrice': 10000, 'discount': 0, 'taxableAmount': 10000, 'taxAmount': 500, 'totalAmount': 10500, 'taxRatePercent': 5},
      {'id': 'c', 'description': 'Exempt', 'quantity': 1, 'unitPrice': 5000, 'discount': 0, 'taxableAmount': 5000, 'taxAmount': 0, 'totalAmount': 5000, 'taxRatePercent': 0},
    ],
    'payments': [],
    'createdAt': '2026-10-04T00:00:00Z',
    'taxBreakdown': withDiscount
        ? [
            {'ratePercent': 18, 'taxableAmount': 9600, 'cgstAmount': 864, 'sgstAmount': 864, 'taxAmount': 1728},
            {'ratePercent': 5, 'taxableAmount': 9600, 'cgstAmount': 240, 'sgstAmount': 240, 'taxAmount': 480},
            {'ratePercent': 0, 'taxableAmount': 4800, 'cgstAmount': 0, 'sgstAmount': 0, 'taxAmount': 0},
          ]
        : [
            {'ratePercent': 18, 'taxableAmount': 10000, 'cgstAmount': 900, 'sgstAmount': 900, 'taxAmount': 1800},
            {'ratePercent': 5, 'taxableAmount': 10000, 'cgstAmount': 250, 'sgstAmount': 250, 'taxAmount': 500},
            {'ratePercent': 0, 'taxableAmount': 5000, 'cgstAmount': 0, 'sgstAmount': 0, 'taxAmount': 0},
          ],
  };
}

class _RecordingRepo extends InvoiceRepository {
  _RecordingRepo(this.invoice) : super(InvoiceApi(Dio()));

  Invoice invoice;
  double? generatedWithTotal;

  @override
  Future<Invoice> getInvoiceById(String id) async => invoice;

  @override
  Future<Invoice> generateInvoice(String id, {double? expectedTotalAmount}) async {
    generatedWithTotal = expectedTotalAmount;
    return invoice;
  }

  @override
  Future<InvoiceListResponse> getInvoices({
    int page = 1,
    int pageSize = 20,
    String? search,
    InvoiceStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
  }) async =>
      const InvoiceListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(String invoiceId) async => const [];
}

void main() {
  group('GST display uses the server breakdown', () {
    final invoice = Invoice.fromJson(_mixedJson());

    test('model parses per-line rates and the rate-wise breakdown', () {
      expect(invoice.items.map((i) => i.taxRatePercent), [18, 5, 0]);
      expect(invoice.taxBreakdown.map((b) => b.ratePercent), [18, 5, 0]);
      expect(invoice.taxBreakdown.fold<double>(0, (s, b) => s + b.taxAmount), invoice.gstAmount);
    });

    test('rows name each rate actually charged, never a flat 9%', () {
      final rows = gstRows(invoice.taxBreakdown);
      expect(rows.map((r) => r.label), ['CGST @ 9%', 'SGST @ 9%', 'CGST @ 2.5%', 'SGST @ 2.5%', 'GST @ 0%']);
      expect(rows.map((r) => r.amount), [900, 900, 250, 250, 0]);
      expect(rows.every((r) => r.taxableAmount != null), isTrue);
      expect(gstRatesSummary(invoice.taxBreakdown), 'GST 18% + 5% + 0%');
    });

    test('single-rate invoice shows plain rows; legacy unknown rate shows CGST/SGST', () {
      expect(
        gstRows(const [TaxBreakdown(ratePercent: 18, taxableAmount: 1000, cgstAmount: 90, sgstAmount: 90, taxAmount: 180)])
            .map((r) => '${r.label}|${r.taxableAmount}'),
        ['CGST @ 9%|null', 'SGST @ 9%|null'],
      );
      expect(
        gstRows(const [TaxBreakdown(taxableAmount: 1000, cgstAmount: 90, sgstAmount: 90, taxAmount: 180)]).map((r) => r.label),
        ['CGST', 'SGST'],
      );
    });

    test('line amount is qty x rate minus line discount', () {
      const item = InvoiceItem(id: 'x', description: 'x', quantity: 3, unitPrice: 333.33, discount: 10, taxableAmount: 0, taxAmount: 0, totalAmount: 0);
      expect(invoiceLineAmount(item), closeTo(989.99, 0.001));
    });
  });

  testWidgets('draft sheet shows the server preview for an unsaved discount, not a flat 18%', (tester) async {
    final draft = Invoice.fromJson(_mixedJson());
    final previews = <({double discount, bool gst})>[];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: EditDraftBottomSheet(
            invoice: draft,
            onSave: ({discount, notes, isGstEnabled}) async => null,
            onPreview: ({required discount, required isGstEnabled}) async {
              previews.add((discount: discount, gst: isGstEnabled));
              return Invoice.fromJson(_mixedJson(discount: discount));
            },
          ),
        ),
      ),
    );

    expect(find.text('₹27300.00'), findsOneWidget);
    expect(find.textContaining('(9%)'), findsNothing);
    expect(find.textContaining('18%'), findsNothing);

    await tester.enterText(find.byType(TextField).first, '1000');
    await tester.pump();
    expect(find.text('Calculating…'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();

    expect(previews.single, (discount: 1000.0, gst: true));
    // Flat 18% on ₹24,000 would show ₹28,320; the server's per-line result is ₹26,208.
    expect(find.text('₹26208.00'), findsOneWidget);
    expect(find.textContaining('28320'), findsNothing);
    expect(find.textContaining('CGST @ 2.5%'), findsOneWidget);
  });

  test('generate sends the stored (confirmed) total so the server cannot issue a different amount', () async {
    final repo = _RecordingRepo(Invoice.fromJson(_mixedJson()));
    final container = ProviderContainer(overrides: [invoiceRepositoryProvider.overrideWithValue(repo)]);
    addTearDown(container.dispose);
    final notifier = container.read(invoiceDetailsProvider('inv-1').notifier);
    await notifier.loadDetails();

    await notifier.generateInvoice();

    expect(repo.generatedWithTotal, 27300);
  });
}
