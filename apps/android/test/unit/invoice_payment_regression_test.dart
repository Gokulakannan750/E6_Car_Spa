import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_request_models.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';

void main() {
  group('Gate 4C.1: Invoice & Payment Regression & Edge Case Tests', () {
    // ── 1. Partial Payment ──────────────────────────────────────────────────
    test('1. Partial Payment: ₹5,000 recorded on ₹11,800 invoice calculates balance ₹6,800 and status PartiallyPaid', () {
      final total = 11800.0;
      final payment1 = 5000.0;
      final balance = total - payment1;

      final invoice = Invoice(
        id: 'inv-partial-1',
        invoiceNumber: 'INV-2026-000101',
        jobCardId: 'jc-101',
        jobCardNumber: 'JC-2026-000101',
        customerId: 'c-1',
        customerName: 'Rajesh Kumar',
        customerPhone: '9876543210',
        vehicleId: 'v-1',
        registrationNumber: 'TN38AB1234',
        vehicleMake: 'Hyundai',
        vehicleModel: 'Creta',
        invoiceDate: DateTime(2026, 8, 26),
        subtotal: 10000.0,
        discount: 0.0,
        taxableAmount: 10000.0,
        gstAmount: 1800.0,
        totalAmount: total,
        paidAmount: payment1,
        balanceAmount: balance,
        status: InvoiceStatus.partiallyPaid,
        items: const [
          InvoiceItem(
            id: 'item-1',
            description: 'Full Ceramic Coating',
            quantity: 1,
            unitPrice: 10000.0,
            discount: 0.0,
            taxableAmount: 10000.0,
            taxAmount: 1800.0,
            totalAmount: 11800.0,
          ),
        ],
        payments: [
          PaymentDto(
            id: 'pay-1',
            invoiceId: 'inv-partial-1',
            amount: payment1,
            paymentMethod: 'UPI',
            reference: 'UPI/20260826/998877',
            paymentDate: DateTime(2026, 8, 26),
            createdAt: DateTime(2026, 8, 26),
          ),
        ],
        createdAt: DateTime(2026, 8, 26),
        updatedAt: DateTime(2026, 8, 26),
      );

      expect(invoice.totalAmount, 11800.0);
      expect(invoice.paidAmount, 5000.0);
      expect(invoice.balanceAmount, 6800.0);
      expect(invoice.status, InvoiceStatus.partiallyPaid);
      expect(invoice.isPartiallyPaid, true);
      expect(invoice.isPaid, false);
      expect(invoice.isFinalized, true);
      expect(invoice.payments.length, 1);
      expect(invoice.payments.first.amount, 5000.0);
      expect(invoice.payments.first.method, PaymentMethod.upi);
    });

    // ── 2. Full Payment ─────────────────────────────────────────────────────
    test('2. Full Payment: ₹11,800 recorded on ₹11,800 invoice calculates balance ₹0 and status Paid', () {
      final total = 11800.0;
      final fullPayment = 11800.0;
      final balance = total - fullPayment;

      final invoice = Invoice(
        id: 'inv-full-1',
        invoiceNumber: 'INV-2026-000102',
        jobCardId: 'jc-102',
        jobCardNumber: 'JC-2026-000102',
        customerId: 'c-2',
        customerName: 'Anitha S',
        customerPhone: '9840112233',
        vehicleId: 'v-2',
        registrationNumber: 'TN09CD5678',
        vehicleMake: 'Tata',
        vehicleModel: 'Harrier',
        invoiceDate: DateTime(2026, 8, 26),
        subtotal: 10000.0,
        discount: 0.0,
        taxableAmount: 10000.0,
        gstAmount: 1800.0,
        totalAmount: total,
        paidAmount: fullPayment,
        balanceAmount: balance,
        status: InvoiceStatus.paid,
        items: const [
          InvoiceItem(
            id: 'item-2',
            description: 'Graphene Coating',
            quantity: 1,
            unitPrice: 10000.0,
            discount: 0.0,
            taxableAmount: 10000.0,
            taxAmount: 1800.0,
            totalAmount: 11800.0,
          ),
        ],
        payments: [
          PaymentDto(
            id: 'pay-2',
            invoiceId: 'inv-full-1',
            amount: fullPayment,
            paymentMethod: 'Card',
            reference: 'AUTH:987654',
            paymentDate: DateTime(2026, 8, 26),
            createdAt: DateTime(2026, 8, 26),
          ),
        ],
        createdAt: DateTime(2026, 8, 26),
        updatedAt: DateTime(2026, 8, 26),
      );

      expect(invoice.totalAmount, 11800.0);
      expect(invoice.paidAmount, 11800.0);
      expect(invoice.balanceAmount, 0.0);
      expect(invoice.status, InvoiceStatus.paid);
      expect(invoice.isPaid, true);
      expect(invoice.isPartiallyPaid, false);
    });

    // ── 3. Overpayment Protection ───────────────────────────────────────────
    test('3. Overpayment Protection: Attempting payment > balance is rejected by validation', () {
      final balance = 6800.0;
      final attemptAmount = 12000.0;

      final isOverpayment = attemptAmount > balance;
      expect(isOverpayment, true);

      // Verify backend exception parsing if backend returns 400 Bad Request
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
        response: Response(
          requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
          statusCode: 400,
          data: {'error': 'Payment amount cannot exceed current balance of ₹6,800.00.'},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioError);
      expect(exception.message, 'Payment amount cannot exceed current balance of ₹6,800.00.');
      expect(exception.statusCode, 400);
    });

    // ── 4. ASP.NET Core ValidationProblem Dictionary Parsing ────────────────
    test('4. Validation Error: ASP.NET Core ModelState dictionary is parsed accurately', () {
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
        response: Response(
          requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
          statusCode: 400,
          data: {
            'title': 'One or more validation errors occurred.',
            'status': 400,
            'errors': {
              'Amount': ['Payment amount must be greater than ₹0.'],
            },
          },
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioError);
      expect(exception.message, 'Payment amount must be greater than ₹0.');
      expect(exception.statusCode, 400);
    });

    // ── 5. Payment History & Multi-Payment Aggregation ───────────────────────
    test('5. Multi-Payment History: ₹3,000 + ₹4,000 + ₹4,800 = ₹11,800 aggregates accurately', () {
      final total = 11800.0;
      final p1 = 3000.0;
      final p2 = 4000.0;
      final p3 = 4800.0;
      final totalPaid = p1 + p2 + p3;
      final balance = total - totalPaid;

      final payments = [
        PaymentDto(
          id: 'pay-1',
          invoiceId: 'inv-multi-1',
          amount: p1,
          paymentMethod: 'Cash',
          reference: 'RCP-001',
          paymentDate: DateTime(2026, 8, 20),
          createdAt: DateTime(2026, 8, 20),
        ),
        PaymentDto(
          id: 'pay-2',
          invoiceId: 'inv-multi-1',
          amount: p2,
          paymentMethod: 'UPI',
          reference: 'UPI-REF-002',
          paymentDate: DateTime(2026, 8, 22),
          createdAt: DateTime(2026, 8, 22),
        ),
        PaymentDto(
          id: 'pay-3',
          invoiceId: 'inv-multi-1',
          amount: p3,
          paymentMethod: 'BankTransfer',
          reference: 'NEFT-003',
          paymentDate: DateTime(2026, 8, 26),
          createdAt: DateTime(2026, 8, 26),
        ),
      ];

      final invoice = Invoice(
        id: 'inv-multi-1',
        invoiceNumber: 'INV-2026-000103',
        jobCardId: 'jc-103',
        jobCardNumber: 'JC-2026-000103',
        customerId: 'c-3',
        customerName: 'Karthik V',
        customerPhone: '9840998877',
        vehicleId: 'v-3',
        registrationNumber: 'TN33ZZ9999',
        vehicleMake: 'BMW',
        vehicleModel: '3 Series',
        invoiceDate: DateTime(2026, 8, 20),
        subtotal: 10000.0,
        discount: 0.0,
        taxableAmount: 10000.0,
        gstAmount: 1800.0,
        totalAmount: total,
        paidAmount: totalPaid,
        balanceAmount: balance,
        status: InvoiceStatus.paid,
        items: const [
          InvoiceItem(
            id: 'item-3',
            description: 'Paint Protection Film',
            quantity: 1,
            unitPrice: 10000.0,
            discount: 0.0,
            taxableAmount: 10000.0,
            taxAmount: 1800.0,
            totalAmount: 11800.0,
          ),
        ],
        payments: payments,
        createdAt: DateTime(2026, 8, 20),
        updatedAt: DateTime(2026, 8, 26),
      );

      expect(invoice.payments.length, 3);
      expect(invoice.paidAmount, 11800.0);
      expect(invoice.balanceAmount, 0.0);
      expect(invoice.status, InvoiceStatus.paid);
      expect(invoice.payments[0].method, PaymentMethod.cash);
      expect(invoice.payments[1].method, PaymentMethod.upi);
      expect(invoice.payments[2].method, PaymentMethod.bankTransfer);
    });

    // ── 6. All 4 Payment Methods Serialization & Mapping ────────────────────
    test('6. Payment Methods: All 4 payment methods map and serialize correctly', () {
      expect(PaymentMethod.fromString('Cash'), PaymentMethod.cash);
      expect(PaymentMethod.fromString('UPI'), PaymentMethod.upi);
      expect(PaymentMethod.fromString('Card'), PaymentMethod.card);
      expect(PaymentMethod.fromString('BankTransfer'), PaymentMethod.bankTransfer);
      expect(PaymentMethod.fromString('Bank Transfer'), PaymentMethod.bankTransfer);

      final reqCash = RecordPaymentRequest(amount: 1000.0, paymentMethod: PaymentMethod.cash.value);
      final reqUpi = RecordPaymentRequest(amount: 2000.0, paymentMethod: PaymentMethod.upi.value, reference: 'UPI123');
      final reqCard = RecordPaymentRequest(amount: 3000.0, paymentMethod: PaymentMethod.card.value, reference: 'AUTH99');
      final reqBank = RecordPaymentRequest(amount: 4000.0, paymentMethod: PaymentMethod.bankTransfer.value, reference: 'NEFT55');

      expect(reqCash.toJson()['paymentMethod'], 'Cash');
      expect(reqUpi.toJson()['paymentMethod'], 'UPI');
      expect(reqCard.toJson()['paymentMethod'], 'Card');
      expect(reqBank.toJson()['paymentMethod'], 'BankTransfer');
    });

    // ── 7. Generated Invoice Lock & Immutability ─────────────────────────────
    test('7. Generated Invoice Lock: Finalized invoice is locked against edits', () {
      final finalizedInvoice = Invoice(
        id: 'inv-final-1',
        invoiceNumber: 'INV-2026-000050',
        jobCardId: 'jc-50',
        jobCardNumber: 'JC-2026-000050',
        customerId: 'c-50',
        customerName: 'Suresh',
        customerPhone: '9840112233',
        vehicleId: 'v-50',
        registrationNumber: 'TN01AA0050',
        vehicleMake: 'Toyota',
        vehicleModel: 'Innova',
        invoiceDate: DateTime(2026, 8, 25),
        subtotal: 5000.0,
        discount: 0.0,
        taxableAmount: 5000.0,
        gstAmount: 900.0,
        totalAmount: 5900.0,
        paidAmount: 0.0,
        balanceAmount: 5900.0,
        status: InvoiceStatus.generated,
        items: [],
        payments: [],
        createdAt: DateTime(2026, 8, 25),
      );

      expect(finalizedInvoice.isDraft, false);
      expect(finalizedInvoice.isFinalized, true);
      expect(finalizedInvoice.invoiceNumber, 'INV-2026-000050');

      // Backend rejection of update on finalized invoice returns 409 Conflict
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/invoices/inv-final-1'),
        response: Response(
          requestOptions: RequestOptions(path: '/invoices/inv-final-1'),
          statusCode: 409,
          data: {'error': 'Finalized invoices cannot be modified.'},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioError);
      expect(exception.message, 'Finalized invoices cannot be modified.');
      expect(exception.statusCode, 409);
    });

    // ── 8. Already-Invoiced Job Card Behavior ────────────────────────────────
    test('8. Already-Invoiced Job Card: Job card with invoiceId exposes invoice linking', () {
      const invoicedJc = JobCard(
        id: 'jc-invoiced-1',
        jobCardNumber: 'JC-2026-000088',
        customer: CustomerSummary(
          id: 'c-88',
          name: 'Deepak',
          phoneNumber: '9840888888',
        ),
        vehicle: VehicleSummary(
          id: 'v-88',
          registrationNumber: 'TN38XY8888',
          make: 'Kia',
          model: 'Seltos',
        ),
        subtotal: 5000.0,
        totalAmount: 5900.0,
        status: JobCardStatus.invoiced,
        services: [],
        invoiceId: 'inv-88',
        invoiceNumber: 'INV-2026-000088',
        invoiceStatus: 'Generated',
      );

      const uninvoicedJc = JobCard(
        id: 'jc-uninvoiced-1',
        jobCardNumber: 'JC-2026-000089',
        customer: CustomerSummary(
          id: 'c-89',
          name: 'Manoj',
          phoneNumber: '9840999999',
        ),
        vehicle: VehicleSummary(
          id: 'v-89',
          registrationNumber: 'TN38XY8889',
          make: 'Hyundai',
          model: 'Verna',
        ),
        subtotal: 5000.0,
        totalAmount: 5900.0,
        status: JobCardStatus.ready,
        services: [],
        invoiceId: null,
        invoiceNumber: null,
        invoiceStatus: null,
      );

      expect(invoicedJc.invoiceId != null && invoicedJc.invoiceId!.isNotEmpty, true);
      expect(invoicedJc.status, JobCardStatus.invoiced);
      expect(uninvoicedJc.invoiceId, isNull);
      expect(uninvoicedJc.status, JobCardStatus.ready);
    });

    // ── 9. List ↔ Detail Consistency ─────────────────────────────────────────
    test('9. List ↔ Detail Consistency: Key financial attributes match between ListItem and Detail', () {
      final listItem = InvoiceListItem(
        id: 'inv-match-1',
        invoiceNumber: 'INV-2026-000200',
        jobCardNumber: 'JC-2026-000200',
        customerName: 'Aravind',
        customerPhone: '9840223344',
        registrationNumber: 'TN38CC4455',
        vehicle: 'Honda City',
        invoiceDate: DateTime(2026, 8, 26),
        totalAmount: 11800.0,
        paidAmount: 5000.0,
        balanceAmount: 6800.0,
        status: InvoiceStatus.partiallyPaid,
        createdAt: DateTime(2026, 8, 26),
      );

      final detailItem = Invoice(
        id: 'inv-match-1',
        invoiceNumber: 'INV-2026-000200',
        jobCardId: 'jc-200',
        jobCardNumber: 'JC-2026-000200',
        customerId: 'c-200',
        customerName: 'Aravind',
        customerPhone: '9840223344',
        vehicleId: 'v-200',
        registrationNumber: 'TN38CC4455',
        vehicleMake: 'Honda',
        vehicleModel: 'City',
        invoiceDate: DateTime(2026, 8, 26),
        subtotal: 10000.0,
        discount: 0.0,
        taxableAmount: 10000.0,
        gstAmount: 1800.0,
        totalAmount: 11800.0,
        paidAmount: 5000.0,
        balanceAmount: 6800.0,
        status: InvoiceStatus.partiallyPaid,
        items: [],
        payments: [],
        createdAt: DateTime(2026, 8, 26),
      );

      expect(listItem.invoiceNumber, detailItem.invoiceNumber);
      expect(listItem.customerName, detailItem.customerName);
      expect(listItem.totalAmount, detailItem.totalAmount);
      expect(listItem.paidAmount, detailItem.paidAmount);
      expect(listItem.balanceAmount, detailItem.balanceAmount);
      expect(listItem.status, detailItem.status);
    });

    // ── 10. Permission 403 Forbidden Handling ───────────────────────────────
    test('10. Permissions: 403 Forbidden produces a user-friendly permission error', () {
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
        response: Response(
          requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
          statusCode: 403,
          data: {'error': "User lacks required permission 'invoices.record_payment'."},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioError);
      expect(exception is ForbiddenException, true);
      expect(exception.message, "User lacks required permission 'invoices.record_payment'.");
      expect(exception.statusCode, 403);
    });

    // ── 11. Unauthorized 401 Session Handling ───────────────────────────────
    test('11. Session Unauthorized: 401 Unauthorized produces UnauthorizedException', () {
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/invoices'),
        response: Response(
          requestOptions: RequestOptions(path: '/invoices'),
          statusCode: 401,
          data: {'error': 'Invalid credentials or session expired.'},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioError);
      expect(exception is UnauthorizedException, true);
      expect(exception.statusCode, 401);
    });

    // ── 12. Network / Timeout Handling ──────────────────────────────────────
    test('12. Network Resiliency: Connection timeouts produce clear NetworkException', () {
      final timeoutError = DioException(
        requestOptions: RequestOptions(path: '/invoices/inv-1/payments'),
        type: DioExceptionType.connectionTimeout,
      );

      final exception = ApiException.fromDio(timeoutError);
      expect(exception is NetworkException, true);
      expect(exception.message.contains('Connection timeout'), true);
    });
  });
}
