import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/services/invoice_pdf_generator.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';

void main() {
  group('Task 3 — Android Invoice PDF & Printing Tests', () {
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
      vehicleVariant: 'SX(O)',
      vehicleColor: 'White',
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
      notes: 'Customer opted for premium ceramic treatment.',
      items: const [
        InvoiceItem(
          id: 'item-1',
          description: 'Full Ceramic Coating Package',
          quantity: 1,
          unitPrice: 4000.0,
          discount: 0.0,
          taxableAmount: 4000.0,
          taxAmount: 720.0,
          totalAmount: 4720.0,
        ),
        InvoiceItem(
          id: 'item-2',
          description: 'Interior Sanitization',
          quantity: 1,
          unitPrice: 1000.0,
          discount: 0.0,
          taxableAmount: 1000.0,
          taxAmount: 180.0,
          totalAmount: 1180.0,
        ),
      ],
      createdAt: DateTime(2026, 9, 5, 10, 0),
    );

    const sampleProfile = BusinessProfileModel(
      id: 'prof-1',
      businessName: 'E6 Car Spa',
      addressLine1: '36, Geetha Nagar Main Road',
      addressLine2: 'Behind Sakthi Mahal, Perundurai Road',
      city: 'Erode',
      state: 'Tamil Nadu',
      postalCode: '638011',
      phone: '9578749449',
      email: 'e6carspaerd@gmail.com',
      gstin: '33AAAAA0000A1Z5',
      termsAndConditions: '1. Payment is due upon completion.\n2. Non-refundable.',
    );

    test('InvoicePdfGenerator produces valid non-empty PDF bytes', () async {
      final pdfBytes = await InvoicePdfGenerator.generateInvoicePdf(
        invoice: sampleInvoice,
        businessProfile: sampleProfile,
      );

      expect(pdfBytes, isNotNull);
      expect(pdfBytes.isNotEmpty, isTrue);
      expect(pdfBytes.length, greaterThan(1000));
    });

    test('Invoice PDF generation supports GST-disabled non-tax invoices', () async {
      final nonGstInvoice = Invoice(
        id: 'inv-102',
        invoiceNumber: 'INV-2026-0002',
        jobCardId: 'jc-102',
        jobCardNumber: 'JC-2026-0002',
        customerId: 'cust-2',
        customerName: 'Karthik Raja',
        customerPhone: '9876543211',
        vehicleId: 'veh-2',
        registrationNumber: 'TN33CD5678',
        vehicleMake: 'Tata',
        vehicleModel: 'Nexon',
        invoiceDate: DateTime(2026, 9, 5),
        subtotal: 2000.0,
        discount: 0.0,
        taxableAmount: 2000.0,
        gstAmount: 0.0,
        totalAmount: 2000.0,
        paidAmount: 1000.0,
        balanceAmount: 1000.0,
        status: InvoiceStatus.partiallyPaid,
        isGstEnabled: false,
        items: const [
          InvoiceItem(
            id: 'item-3',
            description: 'Foam Wash',
            quantity: 1,
            unitPrice: 2000.0,
            taxableAmount: 2000.0,
            taxAmount: 0.0,
            totalAmount: 2000.0,
          ),
        ],
        createdAt: DateTime(2026, 9, 5, 11, 0),
      );

      final pdfBytes = await InvoicePdfGenerator.generateInvoicePdf(
        invoice: nonGstInvoice,
        businessProfile: sampleProfile,
      );

      expect(pdfBytes, isNotNull);
      expect(pdfBytes.isNotEmpty, isTrue);
    });
  });
}
