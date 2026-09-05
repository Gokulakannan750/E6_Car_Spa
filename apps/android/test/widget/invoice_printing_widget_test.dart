import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/presentation/pages/invoice_details_screen.dart';
import 'package:e6_car_spa/features/invoices/presentation/widgets/invoice_print_preview_dialog.dart';
import 'package:e6_car_spa/features/invoices/providers/invoice_providers.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_api.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_repository.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/jobcards/presentation/pages/job_card_details_screen.dart';
import 'package:e6_car_spa/features/jobcards/providers/job_card_providers.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';

class _FakeInvoiceRepo extends InvoiceRepository {
  final Invoice? invoice;
  _FakeInvoiceRepo({this.invoice}) : super(InvoiceApi(Dio()));

  @override
  Future<Invoice> getInvoiceById(String id) async {
    if (invoice != null) return invoice!;
    throw Exception('Invoice not found');
  }
}

class _FakeJobCardRepo extends JobCardRepository {
  final JobCard? jobCard;
  _FakeJobCardRepo({this.jobCard}) : super(JobCardApi(Dio()));

  @override
  Future<JobCard> getJobCardById(String id) async {
    if (jobCard != null) return jobCard!;
    throw Exception('Job card not found');
  }
}

void main() {
  final sampleInvoice = Invoice(
    id: 'inv-101',
    invoiceNumber: 'INV-2026-0001',
    jobCardId: 'jc-101',
    jobCardNumber: 'JC-2026-0001',
    customerId: 'cust-1',
    customerName: 'Suresh Raina',
    customerPhone: '9876543210',
    vehicleId: 'veh-1',
    registrationNumber: 'TN33AB1234',
    vehicleMake: 'Hyundai',
    vehicleModel: 'Creta',
    invoiceDate: DateTime(2026, 9, 5),
    subtotal: 5000.0,
    discount: 500.0,
    taxableAmount: 4500.0,
    gstAmount: 810.0,
    totalAmount: 5310.0,
    paidAmount: 5310.0,
    balanceAmount: 0.0,
    status: InvoiceStatus.paid,
    isGstEnabled: true,
    items: const [
      InvoiceItem(
        id: 'item-1',
        description: 'Full Ceramic Coating Package',
        quantity: 1,
        unitPrice: 4000.0,
        taxableAmount: 4000.0,
        taxAmount: 720.0,
        totalAmount: 4720.0,
      ),
    ],
    createdAt: DateTime(2026, 9, 5, 10, 0),
  );

  final sampleJobCard = JobCard(
    id: 'jc-101',
    jobCardNumber: 'JC-2026-0001',
    customer: const CustomerSummary(
      id: 'cust-1',
      name: 'Suresh Raina',
      phoneNumber: '9876543210',
    ),
    vehicle: const VehicleSummary(
      id: 'veh-1',
      registrationNumber: 'TN33AB1234',
      make: 'Hyundai',
      model: 'Creta',
    ),
    status: JobCardStatus.inProgress,
    services: const [],
    subtotal: 5000.0,
    discountAmount: 0.0,
    taxAmount: 900.0,
    totalAmount: 5900.0,
    createdAt: DateTime(2026, 9, 5, 10, 0),
  );

  group('Invoice Printing Actions & Job Card Verification', () {
    testWidgets('InvoiceDetailsScreen displays Print action in AppBar and bottom bar for paid invoice', (tester) async {
      final fakeRepo = _FakeInvoiceRepo(invoice: sampleInvoice);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            invoiceRepositoryProvider.overrideWithValue(fakeRepo),
            invoiceDetailsProvider('inv-101').overrideWith(
              (ref) => InvoiceDetailsNotifier(fakeRepo, 'inv-101', ref),
            ),
          ],
          child: const MaterialApp(
            home: InvoiceDetailsScreen(invoiceId: 'inv-101'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify AppBar print button exists
      expect(find.byKey(const Key('print_invoice_appbar_button')), findsOneWidget);

      // Verify Bottom bar print button exists for paid invoice
      expect(find.byKey(const Key('print_paid_invoice_button')), findsOneWidget);
    });

    testWidgets('JobCardDetailsScreen does NOT display a Print button (Task 3C requirement)', (tester) async {
      final fakeRepo = _FakeJobCardRepo(jobCard: sampleJobCard);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            jobCardRepositoryProvider.overrideWithValue(fakeRepo),
            jobCardDetailsProvider('jc-101').overrideWith(
              (ref) => JobCardDetailsNotifier('jc-101', fakeRepo),
            ),
          ],
          child: const MaterialApp(
            home: JobCardDetailsScreen(jobCardId: 'jc-101'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Job card details MUST NOT have a print action button
      expect(find.byKey(const Key('job_card_preview_button')), findsNothing);
      expect(find.byIcon(Icons.print_outlined), findsNothing);
    });

    testWidgets('InvoicePrintPreviewDialog renders preview header and close button', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => ElevatedButton(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (_) => InvoicePrintPreviewDialog(
                        invoice: sampleInvoice,
                        businessProfile: const BusinessProfileModel(
                          id: 'prof-1',
                          businessName: 'E6 Car Spa',
                          addressLine1: '36, Geetha Nagar Main Road',
                          city: 'Erode',
                          state: 'Tamil Nadu',
                          postalCode: '638011',
                          phone: '9578749449',
                          email: 'e6carspaerd@gmail.com',
                        ),
                      ),
                    );
                  },
                  child: const Text('Open Preview'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Preview'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Invoice Preview (INV-2026-0001)'), findsOneWidget);
      expect(find.byTooltip('Close Preview'), findsOneWidget);
      expect(find.byTooltip('Print Invoice'), findsOneWidget);

      // Close dialog
      await tester.tap(find.byTooltip('Close Preview'));
      await tester.pumpAndSettle();

      expect(find.text('Invoice Preview (INV-2026-0001)'), findsNothing);
    });
  });
}
