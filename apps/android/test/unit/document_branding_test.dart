import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/services/invoice_pdf_generator.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/models/public_business_profile_model.dart';

void main() {
  group('Document branding — nothing is E6-specific', () {
    final invoice = Invoice(
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      jobCardId: 'jc-1',
      jobCardNumber: 'JC-2026-0001',
      customerId: 'cust-1',
      customerName: 'Test Customer',
      customerPhone: '9000000000',
      vehicleId: 'veh-1',
      registrationNumber: 'TN01AB1234',
      vehicleMake: 'Hyundai',
      vehicleModel: 'Creta',
      invoiceDate: DateTime(2026, 10, 8),
      subtotal: 1000,
      discount: 0,
      taxableAmount: 1000,
      gstAmount: 0,
      totalAmount: 1000,
      paidAmount: 0,
      balanceAmount: 1000,
      status: InvoiceStatus.generated,
      isGstEnabled: false,
      items: const [
        InvoiceItem(
          id: 'item-1',
          description: 'Wash',
          quantity: 1,
          unitPrice: 1000,
          discount: 0,
          taxableAmount: 1000,
          taxAmount: 0,
          totalAmount: 1000,
        ),
      ],
      createdAt: DateTime(2026, 10, 8),
    );

    test('accent colour is the company colour, or a neutral default', () {
      expect(resolveAccentColor('#0f766e'), '#0F766E');
      expect(resolveAccentColor(null), defaultDocumentAccent);
      expect(resolveAccentColor(''), defaultDocumentAccent);
      expect(resolveAccentColor('red'), defaultDocumentAccent);
      expect(resolveAccentColor('#123'), defaultDocumentAccent);
    });

    test('profile model has no company name or colours until they are set', () {
      final empty = BusinessProfileModel.fromJson(const {});
      expect(empty.businessName, '');
      expect(empty.tagline, isNull);
      expect(empty.brandColor, isNull);

      final filled = BusinessProfileModel.fromJson(const {
        'businessName': 'Sunrise Detailing',
        'tagline': 'Shine every day',
        'brandColor': '#0F766E',
      });
      expect(filled.tagline, 'Shine every day');
      expect(filled.brandColor, '#0F766E');
      expect(filled.toJson()['tagline'], 'Shine every day');
      expect(filled.copyWith(brandColor: '#111111').brandColor, '#111111');

      expect(PublicBusinessProfileModel.fromJson(const {}).businessName, '');
    });

    test('invoice PDF builds for a company with only a name', () async {
      final bytes = await InvoicePdfGenerator.generateInvoicePdf(
        invoice: invoice,
        businessProfile: BusinessProfileModel.fromJson(const {
          'businessName': 'Only A Name',
        }),
      );
      expect(bytes.length, greaterThan(1000));
    });

    test('invoice PDF builds with no company profile at all', () async {
      final bytes = await InvoicePdfGenerator.generateInvoicePdf(
        invoice: invoice,
      );
      expect(bytes.length, greaterThan(1000));
    });

    test('invoice PDF builds with tagline, terms and brand colour', () async {
      final bytes = await InvoicePdfGenerator.generateInvoicePdf(
        invoice: invoice,
        businessProfile: BusinessProfileModel.fromJson(const {
          'businessName': 'Sunrise Detailing',
          'tagline': 'Shine every day',
          'brandColor': '#0F766E',
          'termsAndConditions': 'Pay within 7 days.\nNo refunds.',
        }),
      );
      expect(bytes.length, greaterThan(1000));
    });
  });
}
