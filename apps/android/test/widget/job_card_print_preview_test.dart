import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/jobcards/presentation/widgets/job_card_print_preview_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final sampleJobCard = JobCard(
    id: 'jc-101',
    jobCardNumber: 'JC-2026-0001',
    customer: const CustomerSummary(
      id: 'cust-1',
      name: 'John Doe',
      phoneNumber: '+91 9876543210',
    ),
    vehicle: const VehicleSummary(
      id: 'veh-1',
      registrationNumber: 'TN09AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      color: 'Polar White',
    ),
    status: JobCardStatus.inProgress,
    services: const [
      JobCardServiceItem(
        id: 'item-1',
        serviceId: 'svc-1',
        serviceName: 'Full Body Foam Wash',
        quantity: 1,
        unitPrice: 1200.0,
        taxPercentage: 18.0,
        lineTotal: 1200.0,
      ),
      JobCardServiceItem(
        id: 'item-2',
        serviceId: 'svc-2',
        serviceName: 'Interior Deep Cleaning',
        quantity: 1,
        unitPrice: 2500.0,
        taxPercentage: 18.0,
        lineTotal: 2500.0,
      ),
    ],
    subtotal: 3700.0,
    discountAmount: 200.0,
    taxAmount: 630.0,
    totalAmount: 4130.0,
    notes: 'Please clean undercarriage thoroughly.',
    createdAt: DateTime(2026, 8, 26, 10, 30),
  );

  testWidgets('JobCardPrintPreviewDialog renders customer phone and workshop work order details', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () => JobCardPrintPreviewDialog.show(context, sampleJobCard),
              child: const Text('Open Preview'),
            ),
          ),
        ),
      ),
    );

    // Tap button to open dialog
    await tester.tap(find.text('Open Preview'));
    await tester.pumpAndSettle();

    // Verify Title and Document Header
    expect(find.text('Job Card Print Preview'), findsOneWidget);
    expect(find.text('JOB CARD'), findsOneWidget);
    expect(find.text('Workshop work order'), findsOneWidget);
    expect(find.text('JC-2026-0001'), findsOneWidget);

    // Verify Customer and Vehicle Info
    expect(find.text('Customer'), findsOneWidget);
    expect(find.text('John Doe'), findsOneWidget);
    expect(find.text('Phone'), findsOneWidget);
    expect(find.text('+91 9876543210'), findsOneWidget);
    expect(find.text('Vehicle No'), findsOneWidget);
    expect(find.text('TN09AB1234'), findsOneWidget);

    // Verify Services Table
    expect(find.text('Jobs to be done'), findsOneWidget);
    expect(find.text('Full Body Foam Wash'), findsOneWidget);
    expect(find.text('Interior Deep Cleaning'), findsOneWidget);

    // Verify Totals and Signatures
    expect(find.text('Customer Signature'), findsOneWidget);
    expect(find.text('Technician Signature'), findsOneWidget);
    expect(find.text('Notes: Please clean undercarriage thoroughly.'), findsOneWidget);

    // Verify Close button dismisses the dialog
    expect(find.byKey(const Key('modal_close_button')), findsOneWidget);
    await tester.tap(find.byKey(const Key('modal_close_button')));
    await tester.pumpAndSettle();

    expect(find.text('Job Card Print Preview'), findsNothing);
  });
}
