import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/presentation/pages/invoice_details_screen.dart';

/// GST invoice number editing (Android): Owner only, fully paid GST invoices only.
class _FakeInvoiceApi extends InvoiceApi {
  _FakeInvoiceApi(this.invoice) : super(Dio());

  Invoice invoice;
  final List<String> renameCalls = [];
  String? rejectWith;

  @override
  Future<Invoice> getInvoiceById(String id) async => invoice;

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(String invoiceId) async => const [];

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
  Future<Invoice> updateInvoiceNumber(String id, String invoiceNumber) async {
    renameCalls.add('$id|$invoiceNumber');
    if (rejectWith != null) {
      final options = RequestOptions(path: '/invoices/$id/invoice-number');
      throw DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 409, data: {'error': rejectWith}),
        type: DioExceptionType.badResponse,
      );
    }
    invoice = invoice.copyWithNumber(invoiceNumber);
    return invoice;
  }
}

class _FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  _FakeAuthNotifier(super.state);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const _owner = AuthUser(
  id: 'u-owner',
  username: 'owner',
  fullName: 'Owner',
  email: null,
  role: 'Owner',
  isOwner: true,
  permissions: [],
);

const _manager = AuthUser(
  id: 'u-manager',
  username: 'manager',
  fullName: 'Manager',
  email: null,
  role: 'Manager',
  isOwner: false,
  permissions: ['invoices.view', 'invoices.generate', 'invoices.cancel', 'payments.record'],
);

Invoice _invoice({InvoiceStatus status = InvoiceStatus.paid, bool gst = true}) {
  final paid = status == InvoiceStatus.paid ? 1180.0 : 0.0;
  return Invoice(
    id: 'inv-77',
    invoiceNumber: 'INV-2026-000125',
    jobCardId: 'jc-77',
    jobCardNumber: 'JC-2026-000125',
    customerId: 'c-77',
    customerName: 'Priya Sharma',
    customerPhone: '9840123456',
    vehicleId: 'v-77',
    registrationNumber: 'TN01AB1234',
    vehicleMake: 'Honda',
    vehicleModel: 'City',
    vehicleVariant: null,
    invoiceDate: DateTime(2026, 10, 1),
    subtotal: 1000,
    discount: 0,
    taxableAmount: 1000,
    gstAmount: gst ? 180 : 0,
    totalAmount: gst ? 1180 : 1000,
    paidAmount: paid,
    balanceAmount: (gst ? 1180 : 1000) - paid,
    status: status,
    isGstEnabled: gst,
    items: const [],
    payments: const [],
    createdAt: DateTime(2026, 10, 1),
    updatedAt: null,
  );
}

extension on Invoice {
  Invoice copyWithNumber(String number) => Invoice(
        id: id,
        invoiceNumber: number,
        jobCardId: jobCardId,
        jobCardNumber: jobCardNumber,
        customerId: customerId,
        customerName: customerName,
        customerPhone: customerPhone,
        vehicleId: vehicleId,
        registrationNumber: registrationNumber,
        vehicleMake: vehicleMake,
        vehicleModel: vehicleModel,
        vehicleVariant: vehicleVariant,
        invoiceDate: invoiceDate,
        subtotal: subtotal,
        discount: discount,
        taxableAmount: taxableAmount,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        status: status,
        isGstEnabled: isGstEnabled,
        items: items,
        payments: payments,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}

Future<_FakeInvoiceApi> _pump(WidgetTester tester, Invoice invoice, AuthUser user) async {
  final api = _FakeInvoiceApi(invoice);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        invoiceApiProvider.overrideWithValue(api),
        authNotifierProvider.overrideWith((ref) => _FakeAuthNotifier(Authenticated(user))),
      ],
      child: const MaterialApp(home: InvoiceDetailsScreen(invoiceId: 'inv-77')),
    ),
  );
  await tester.pumpAndSettle();
  return api;
}

final _editButton = find.byKey(const Key('edit_invoice_number_button'));
final _field = find.byKey(const Key('edit_invoice_number_field'));
final _saveButton = find.byKey(const Key('save_invoice_number_button'));

void main() {
  testWidgets('1. Owner can change the number of a fully paid GST invoice', (tester) async {
    final api = await _pump(tester, _invoice(), _owner);

    expect(_editButton, findsOneWidget);
    await tester.tap(_editButton);
    await tester.pumpAndSettle();

    await tester.enterText(_field, '  E6/INV/00125 ');
    await tester.pump();
    await tester.tap(_saveButton);
    await tester.pumpAndSettle();

    expect(api.renameCalls, ['inv-77|E6/INV/00125']);
    expect(_field, findsNothing); // dialog closed
    expect(find.text('E6/INV/00125'), findsWidgets); // app bar shows the new number
  });

  testWidgets('2. Manager (even with invoice permissions) does not see the action', (tester) async {
    await _pump(tester, _invoice(), _manager);
    expect(_editButton, findsNothing);
  });

  testWidgets('3. Owner does not see the action on a non-GST invoice', (tester) async {
    await _pump(tester, _invoice(gst: false), _owner);
    expect(_editButton, findsNothing);
  });

  for (final status in [InvoiceStatus.generated, InvoiceStatus.partiallyPaid, InvoiceStatus.cancelled]) {
    testWidgets('4. Owner does not see the action when the GST invoice is ${status.name}', (tester) async {
      await _pump(tester, _invoice(status: status), _owner);
      expect(_editButton, findsNothing);
    });
  }

  testWidgets('5. Invalid format disables saving and explains the rule', (tester) async {
    final api = await _pump(tester, _invoice(), _owner);
    await tester.tap(_editButton);
    await tester.pumpAndSettle();

    await tester.enterText(_field, 'BAD #1');
    await tester.pump();

    expect(find.textContaining('Invalid format'), findsOneWidget);
    expect(tester.widget<ElevatedButton>(_saveButton).onPressed, isNull);
    expect(api.renameCalls, isEmpty);
  });

  testWidgets('6. Server rejection (duplicate) is shown and the old number is kept', (tester) async {
    final api = await _pump(tester, _invoice(), _owner);
    api.rejectWith = "Invoice number 'E6/INV/00001' is already used by another invoice.";

    await tester.tap(_editButton);
    await tester.pumpAndSettle();
    await tester.enterText(_field, 'E6/INV/00001');
    await tester.pump();
    await tester.tap(_saveButton);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('edit_invoice_number_error')), findsOneWidget);
    expect(find.textContaining('already used by another invoice'), findsOneWidget);
    expect(_field, findsOneWidget); // dialog stays open
    expect(api.invoice.invoiceNumber, 'INV-2026-000125');
  });
}
