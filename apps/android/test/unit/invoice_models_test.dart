import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_request_models.dart';

void main() {
  group('Invoice Models Unit Tests', () {
    test('InvoiceStatus enum maps values, labels, and strings correctly', () {
      expect(InvoiceStatus.fromInt(0), InvoiceStatus.draft);
      expect(InvoiceStatus.fromInt(1), InvoiceStatus.sent);
      expect(InvoiceStatus.fromInt(2), InvoiceStatus.paid);
      expect(InvoiceStatus.fromInt(3), InvoiceStatus.partiallyPaid);
      expect(InvoiceStatus.fromInt(4), InvoiceStatus.cancelled);
      expect(InvoiceStatus.fromInt(5), InvoiceStatus.overdue);
      expect(InvoiceStatus.fromInt(6), InvoiceStatus.generated);

      expect(InvoiceStatus.fromString('Draft'), InvoiceStatus.draft);
      expect(InvoiceStatus.fromString('Generated'), InvoiceStatus.generated);
      expect(InvoiceStatus.fromString('PartiallyPaid'), InvoiceStatus.partiallyPaid);
      expect(InvoiceStatus.fromString('Paid'), InvoiceStatus.paid);
      expect(InvoiceStatus.fromString('Cancelled'), InvoiceStatus.cancelled);
      expect(InvoiceStatus.fromString('Unknown'), InvoiceStatus.draft);
    });

    test('PaymentMethod enum parses strings correctly', () {
      expect(PaymentMethod.fromString('Cash'), PaymentMethod.cash);
      expect(PaymentMethod.fromString('UPI'), PaymentMethod.upi);
      expect(PaymentMethod.fromString('Card'), PaymentMethod.card);
      expect(PaymentMethod.fromString('BankTransfer'), PaymentMethod.bankTransfer);
      expect(PaymentMethod.fromString('Unknown'), PaymentMethod.cash);
    });

    test('Invoice parses full backend detail contract correctly', () {
      final json = {
        'id': 'inv-100',
        'invoiceNumber': 'INV-2026-000001',
        'jobCardId': 'jc-100',
        'jobCardNumber': 'JC-2026-000096',
        'customerId': 'cust-1',
        'customerName': 'Priya Sharma',
        'customerPhone': '9840123456',
        'vehicleId': 'veh-1',
        'registrationNumber': 'TN01AB1234',
        'vehicleMake': 'Honda',
        'vehicleModel': 'City',
        'vehicleVariant': 'ZX CVT',
        'vehicleColor': 'Pearl White',
        'invoiceDate': '2026-08-25T00:00:00Z',
        'subtotal': 10000.0,
        'discount': 500.0,
        'taxableAmount': 9500.0,
        'gstAmount': 1710.0,
        'totalAmount': 11210.0,
        'paidAmount': 5000.0,
        'balanceAmount': 6210.0,
        'status': 3,
        'notes': 'Thank you for choosing E6 Car Spa',
        'isGstEnabled': true,
        'items': [
          {
            'id': 'item-1',
            'serviceId': 'svc-1',
            'description': 'Ceramic Coating',
            'quantity': 1,
            'unitPrice': 10000.0,
            'discount': 500.0,
            'taxableAmount': 9500.0,
            'taxAmount': 1710.0,
            'totalAmount': 11210.0,
          }
        ],
        'payments': [
          {
            'id': 'pay-1',
            'invoiceId': 'inv-100',
            'amount': 5000.0,
            'paymentMethod': 'UPI',
            'reference': 'UPI/1234567890',
            'paymentDate': '2026-08-25T12:00:00Z',
            'createdAt': '2026-08-25T12:00:00Z',
          }
        ],
        'createdAt': '2026-08-25T10:00:00Z',
        'updatedAt': '2026-08-25T12:00:00Z',
      };

      final invoice = Invoice.fromJson(json);

      expect(invoice.id, 'inv-100');
      expect(invoice.invoiceNumber, 'INV-2026-000001');
      expect(invoice.jobCardId, 'jc-100');
      expect(invoice.jobCardNumber, 'JC-2026-000096');
      expect(invoice.customerName, 'Priya Sharma');
      expect(invoice.customerPhone, '9840123456');
      expect(invoice.registrationNumber, 'TN01AB1234');
      expect(invoice.vehicleDisplayName, 'Honda City (ZX CVT)');
      expect(invoice.subtotal, 10000.0);
      expect(invoice.discount, 500.0);
      expect(invoice.taxableAmount, 9500.0);
      expect(invoice.gstAmount, 1710.0);
      expect(invoice.totalAmount, 11210.0);
      expect(invoice.paidAmount, 5000.0);
      expect(invoice.balanceAmount, 6210.0);
      expect(invoice.status, InvoiceStatus.partiallyPaid);
      expect(invoice.isFinalized, true);
      expect(invoice.isDraft, false);
      expect(invoice.isPartiallyPaid, true);
      expect(invoice.items.length, 1);
      expect(invoice.items.first.description, 'Ceramic Coating');
      expect(invoice.payments.length, 1);
      expect(invoice.payments.first.paymentMethod, 'UPI');
      expect(invoice.payments.first.method, PaymentMethod.upi);
      expect(invoice.payments.first.amount, 5000.0);
    });

    test('Invoice draft detection works correctly when invoiceNumber is null', () {
      final json = {
        'id': 'inv-draft',
        'invoiceNumber': null,
        'jobCardId': 'jc-1',
        'jobCardNumber': 'JC-001',
        'customerId': 'c-1',
        'customerName': 'Test',
        'customerPhone': '123',
        'vehicleId': 'v-1',
        'registrationNumber': 'TN01',
        'vehicleMake': 'Maruti',
        'vehicleModel': 'Swift',
        'invoiceDate': '2026-08-25T00:00:00Z',
        'subtotal': 1000.0,
        'discount': 0.0,
        'taxableAmount': 1000.0,
        'gstAmount': 180.0,
        'totalAmount': 1180.0,
        'paidAmount': 0.0,
        'balanceAmount': 1180.0,
        'status': 0,
        'isGstEnabled': true,
        'items': [],
        'payments': [],
        'createdAt': '2026-08-25T00:00:00Z',
      };

      final invoice = Invoice.fromJson(json);

      expect(invoice.isDraft, true);
      expect(invoice.isFinalized, false);
      expect(invoice.status, InvoiceStatus.draft);
    });

    test('InvoiceListItem parses list response item', () {
      final json = {
        'id': 'inv-item-1',
        'invoiceNumber': 'INV-2026-000002',
        'jobCardNumber': 'JC-2026-000097',
        'customerName': 'Gokul',
        'customerPhone': '9578749449',
        'registrationNumber': 'TN33AA1111',
        'vehicle': 'Tata Nexon',
        'invoiceDate': '2026-08-25T00:00:00Z',
        'totalAmount': 2500.0,
        'paidAmount': 2500.0,
        'balanceAmount': 0.0,
        'status': 2,
        'createdAt': '2026-08-25T10:00:00Z',
      };

      final item = InvoiceListItem.fromJson(json);

      expect(item.id, 'inv-item-1');
      expect(item.invoiceNumber, 'INV-2026-000002');
      expect(item.jobCardNumber, 'JC-2026-000097');
      expect(item.customerName, 'Gokul');
      expect(item.vehicle, 'Tata Nexon');
      expect(item.totalAmount, 2500.0);
      expect(item.paidAmount, 2500.0);
      expect(item.balanceAmount, 0.0);
      expect(item.status, InvoiceStatus.paid);
      expect(item.isDraft, false);
    });

    test('UpdateInvoiceRequest and RecordPaymentRequest serialize correctly', () {
      const updateReq = UpdateInvoiceRequest(
        discount: 250.0,
        notes: 'VIP customer discount',
        isGstEnabled: true,
      );
      final updateJson = updateReq.toJson();
      expect(updateJson['discount'], 250.0);
      expect(updateJson['notes'], 'VIP customer discount');
      expect(updateJson['isGstEnabled'], true);

      final payReq = RecordPaymentRequest(
        amount: 1500.0,
        paymentMethod: 'UPI',
        reference: 'UPI/9876543210',
        paymentDate: DateTime(2026, 8, 25, 12, 0, 0),
      );
      final payJson = payReq.toJson();
      expect(payJson['amount'], 1500.0);
      expect(payJson['paymentMethod'], 'UPI');
      expect(payJson['reference'], 'UPI/9876543210');
      expect(payJson['paymentDate'], isNotNull);
    });
  });
}
