import 'dart:convert';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/jobcards/services/job_card_pdf_generator.dart';
import 'package:flutter_test/flutter_test.dart';

JobCard _jobCard({String? notes, List<JobCardServiceItem>? services}) =>
    JobCard(
      id: 'jc-1',
      jobCardNumber: 'JC-2026-000001',
      customer: const CustomerSummary(
        id: 'c-1',
        name: 'Priya Sharma',
        phoneNumber: '9840123456',
      ),
      vehicle: const VehicleSummary(
        id: 'v-1',
        registrationNumber: 'TN01AB1234',
        make: 'Honda',
        model: 'City',
        variant: 'ZX',
        color: 'White',
      ),
      status: JobCardStatus.inProgress,
      notes: notes,
      services:
          services ??
          const [
            JobCardServiceItem(
              id: 's-1',
              serviceId: 'svc-1',
              serviceName: 'Ceramic coating',
              unitPrice: 5000,
              quantity: 1,
              taxPercentage: 18,
              discountAmount: 0,
              lineTotal: 5900,
            ),
            JobCardServiceItem(
              id: 's-2',
              serviceId: 'svc-2',
              serviceName: 'Interior detailing',
              unitPrice: 1500,
              quantity: 2,
              taxPercentage: 18,
              discountAmount: 0,
              lineTotal: 3540,
            ),
          ],
      subtotal: 8000,
      taxAmount: 1440,
      discountAmount: 0,
      totalAmount: 9440,
      createdAt: DateTime(2026, 10, 1),
    );

void main() {
  test('a job card becomes a real PDF document', () async {
    final bytes = await JobCardPdfGenerator.generate(jobCard: _jobCard());

    expect(bytes.length, greaterThan(1000));
    expect(ascii.decode(bytes.sublist(0, 5)), '%PDF-');
  });

  test('notes and no services do not break it', () async {
    final withNotes = await JobCardPdfGenerator.generate(
      jobCard: _jobCard(notes: 'Customer wants the boot cleaned first.'),
    );
    final noServices = await JobCardPdfGenerator.generate(
      jobCard: _jobCard(services: const []),
    );

    expect(ascii.decode(withNotes.sublist(0, 5)), '%PDF-');
    expect(ascii.decode(noServices.sublist(0, 5)), '%PDF-');
  });
}
