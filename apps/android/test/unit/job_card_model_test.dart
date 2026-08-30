import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';

void main() {
  group('JobCard isLocked logic tests', () {
    const customer = CustomerSummary(id: 'c1', name: 'John', phoneNumber: '9876543210');
    const vehicle = VehicleSummary(id: 'v1', registrationNumber: 'KA01AB1234', make: 'Hyundai', model: 'Creta');

    test('JobCard without invoice is not locked', () {
      const jc = JobCard(
        id: 'jc-1',
        jobCardNumber: 'JC-2026-0001',
        customer: customer,
        vehicle: vehicle,
        status: JobCardStatus.draft,
        services: [],
        subtotal: 500,
        totalAmount: 590,
      );

      expect(jc.isLocked, isFalse);
    });

    test('JobCard with Draft invoice and no invoice number is not locked', () {
      const jc = JobCard(
        id: 'jc-2',
        jobCardNumber: 'JC-2026-0002',
        customer: customer,
        vehicle: vehicle,
        status: JobCardStatus.draft,
        services: [],
        subtotal: 500,
        totalAmount: 590,
        invoiceId: 'inv-1',
        invoiceNumber: null,
        invoiceStatus: 'Draft',
      );

      expect(jc.isLocked, isFalse);
    });

    test('JobCard with generated invoice is locked', () {
      const jc = JobCard(
        id: 'jc-3',
        jobCardNumber: 'JC-2026-0003',
        customer: customer,
        vehicle: vehicle,
        status: JobCardStatus.invoiced,
        services: [],
        subtotal: 500,
        totalAmount: 590,
        invoiceId: 'inv-2',
        invoiceNumber: 'INV-2026-0001',
        invoiceStatus: 'Generated',
      );

      expect(jc.isLocked, isTrue);
    });

    test('JobCard with paid status is locked', () {
      const jc = JobCard(
        id: 'jc-4',
        jobCardNumber: 'JC-2026-0004',
        customer: customer,
        vehicle: vehicle,
        status: JobCardStatus.paid,
        services: [],
        subtotal: 500,
        totalAmount: 590,
        invoiceId: 'inv-3',
        invoiceNumber: 'INV-2026-0002',
        invoiceStatus: 'Paid',
      );

      expect(jc.isLocked, isTrue);
    });

    test('JobCard with cancelled invoice that had an issued invoice number remains locked', () {
      const jc = JobCard(
        id: 'jc-5',
        jobCardNumber: 'JC-2026-0005',
        customer: customer,
        vehicle: vehicle,
        status: JobCardStatus.invoiced,
        services: [],
        subtotal: 500,
        totalAmount: 590,
        invoiceId: 'inv-4',
        invoiceNumber: 'INV-2026-0003',
        invoiceStatus: 'Cancelled',
      );

      expect(jc.isLocked, isTrue);
    });
  });

  group('JobCardListItem isLocked logic tests', () {
    test('JobCardListItem with generated invoice is locked', () {
      const item = JobCardListItem(
        id: 'jc-1',
        jobCardNumber: 'JC-2026-0001',
        customerName: 'John',
        customerPhone: '9876543210',
        registrationNumber: 'KA01AB1234',
        status: JobCardStatus.invoiced,
        totalAmount: 590,
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-2026-0001',
        invoiceStatus: 'Generated',
      );

      expect(item.isLocked, isTrue);
    });

    test('JobCardListItem without invoice is not locked', () {
      const item = JobCardListItem(
        id: 'jc-2',
        jobCardNumber: 'JC-2026-0002',
        customerName: 'John',
        customerPhone: '9876543210',
        registrationNumber: 'KA01AB1234',
        status: JobCardStatus.inProgress,
        totalAmount: 590,
      );

      expect(item.isLocked, isFalse);
    });
  });
}
