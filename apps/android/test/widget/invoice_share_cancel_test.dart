import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_api.dart';
import 'package:e6_car_spa/features/invoices/data/invoice_repository.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_public_link.dart';
import 'package:e6_car_spa/features/invoices/presentation/pages/invoice_details_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// Cancelling an invoice and sharing it with the customer (Android), matching Windows.
class _FakeInvoiceApi extends InvoiceApi {
  _FakeInvoiceApi(this.invoice) : super(Dio());

  Invoice invoice;
  bool hasLink = false;
  int accessCount = 0;
  String? cancelRejection;
  final List<String> calls = [];

  DioException _refusal(String message) {
    final options = RequestOptions(path: '/x');
    return DioException(
      requestOptions: options,
      response: Response(
        requestOptions: options,
        statusCode: 409,
        data: {'error': message},
      ),
      type: DioExceptionType.badResponse,
    );
  }

  @override
  Future<Invoice> getInvoiceById(String id) async => invoice;

  @override
  Future<List<InvoiceWhatsAppStatus>> getInvoiceWhatsAppStatus(
    String invoiceId,
  ) async => const [];

  @override
  Future<InvoiceListResponse> getInvoices({
    int page = 1,
    int pageSize = 20,
    String? search,
    InvoiceStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
  }) async => const InvoiceListResponse(
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
  );

  @override
  Future<Invoice> cancelInvoice(String id, {String? reason}) async {
    calls.add('cancel:$id:$reason');
    if (cancelRejection != null) throw _refusal(cancelRejection!);
    invoice = _invoice(status: InvoiceStatus.cancelled);
    return invoice;
  }

  @override
  Future<InvoicePublicLinkStatus> getPublicLinkStatus(String id) async =>
      InvoicePublicLinkStatus(
        hasActiveLink: hasLink,
        createdAt: DateTime(2026, 10, 1),
        accessCount: accessCount,
      );

  @override
  Future<InvoicePublicLink> createPublicLink(String id) async {
    calls.add('create');
    hasLink = true;
    return InvoicePublicLink(
      url: 'http://localhost:5173/i/firsttoken',
      createdAt: DateTime(2026, 10, 1),
    );
  }

  @override
  Future<InvoicePublicLink> rotatePublicLink(String id) async {
    calls.add('rotate');
    return InvoicePublicLink(
      url: 'http://localhost:5173/i/secondtoken',
      createdAt: DateTime(2026, 10, 2),
    );
  }

  @override
  Future<void> revokePublicLink(String id) async {
    calls.add('revoke');
    hasLink = false;
  }
}

class _FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
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

AuthUser _staff(List<String> permissions) => AuthUser(
  id: 'u-staff',
  username: 'staff',
  fullName: 'Staff',
  email: null,
  role: 'Staff',
  isOwner: false,
  permissions: permissions,
);

Invoice _invoice({InvoiceStatus status = InvoiceStatus.generated}) => Invoice(
  id: 'inv-9',
  invoiceNumber: status == InvoiceStatus.draft ? null : 'INV-2026-000009',
  jobCardId: 'jc-9',
  jobCardNumber: 'JC-2026-000009',
  customerId: 'c-9',
  customerName: 'Priya Sharma',
  customerPhone: '9840123456',
  vehicleId: 'v-9',
  registrationNumber: 'TN01AB1234',
  vehicleMake: 'Honda',
  vehicleModel: 'City',
  vehicleVariant: null,
  invoiceDate: DateTime(2026, 10, 1),
  subtotal: 1000,
  discount: 0,
  taxableAmount: 1000,
  gstAmount: 0,
  totalAmount: 1000,
  paidAmount: 0,
  balanceAmount: 1000,
  status: status,
  isGstEnabled: false,
  items: const [],
  payments: const [],
  createdAt: DateTime(2026, 10, 1),
  updatedAt: null,
);

Future<_FakeInvoiceApi> _pump(
  WidgetTester tester, {
  Invoice? invoice,
  AuthUser user = _owner,
}) async {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final api = _FakeInvoiceApi(invoice ?? _invoice());
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        invoiceApiProvider.overrideWithValue(api),
        authNotifierProvider.overrideWith(
          (ref) => _FakeAuthNotifier(Authenticated(user)),
        ),
      ],
      child: const MaterialApp(home: InvoiceDetailsScreen(invoiceId: 'inv-9')),
    ),
  );
  await tester.pumpAndSettle();
  return api;
}

Future<void> _openMenu(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('invoice_more_menu')));
  await tester.pumpAndSettle();
}

void main() {
  group('Menu', () {
    testWidgets('an Owner sees both actions on a finalized invoice', (
      tester,
    ) async {
      await _pump(tester);
      await _openMenu(tester);

      expect(find.byKey(const Key('invoice_share_item')), findsOneWidget);
      expect(find.byKey(const Key('invoice_cancel_item')), findsOneWidget);
    });

    testWidgets('each action follows its own permission', (tester) async {
      await _pump(tester, user: _staff(['invoices.view', 'invoices.generate']));
      await _openMenu(tester);

      expect(find.byKey(const Key('invoice_share_item')), findsOneWidget);
      expect(find.byKey(const Key('invoice_cancel_item')), findsNothing);
    });

    testWidgets('someone with neither permission has no menu at all', (
      tester,
    ) async {
      await _pump(tester, user: _staff(['invoices.view']));
      expect(find.byKey(const Key('invoice_more_menu')), findsNothing);
    });

    testWidgets('a draft invoice cannot be shared or cancelled', (
      tester,
    ) async {
      await _pump(tester, invoice: _invoice(status: InvoiceStatus.draft));
      expect(find.byKey(const Key('invoice_more_menu')), findsNothing);
    });

    testWidgets('an already cancelled invoice has no actions either', (
      tester,
    ) async {
      await _pump(tester, invoice: _invoice(status: InvoiceStatus.cancelled));
      expect(find.byKey(const Key('invoice_more_menu')), findsNothing);
    });
  });

  group('Cancel invoice', () {
    testWidgets('asks first, then cancels and shows the new status', (
      tester,
    ) async {
      final api = await _pump(tester);
      await _openMenu(tester);
      await tester.tap(find.byKey(const Key('invoice_cancel_item')));
      await tester.pumpAndSettle();

      expect(find.text('Cancel this invoice?'), findsOneWidget);
      expect(api.calls, isEmpty, reason: 'nothing happens before confirming');

      await tester.tap(find.text('Cancel invoice').last);
      await tester.pumpAndSettle();

      expect(api.calls.single, startsWith('cancel:inv-9'));
      expect(find.text('Cancelled'), findsWidgets);
      expect(find.byKey(const Key('invoice_more_menu')), findsNothing);
    });

    testWidgets('keeping the invoice does nothing', (tester) async {
      final api = await _pump(tester);
      await _openMenu(tester);
      await tester.tap(find.byKey(const Key('invoice_cancel_item')));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Keep invoice'));
      await tester.pumpAndSettle();

      expect(api.calls, isEmpty);
      expect(find.byKey(const Key('invoice_more_menu')), findsOneWidget);
    });

    testWidgets('a refusal from the server is shown and the invoice stays', (
      tester,
    ) async {
      final api = await _pump(tester);
      api.cancelRejection =
          'This invoice has payments and cannot be cancelled.';
      await _openMenu(tester);
      await tester.tap(find.byKey(const Key('invoice_cancel_item')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel invoice').last);
      await tester.pumpAndSettle();

      expect(find.textContaining('has payments'), findsOneWidget);
      expect(find.byKey(const Key('invoice_more_menu')), findsOneWidget);
    });
  });

  group('Share invoice', () {
    Future<_FakeInvoiceApi> openShare(
      WidgetTester tester, {
      bool existingLink = false,
    }) async {
      final api = await _pump(tester);
      api.hasLink = existingLink;
      api.accessCount = 3;
      await _openMenu(tester);
      await tester.tap(find.byKey(const Key('invoice_share_item')));
      await tester.pumpAndSettle();
      return api;
    }

    testWidgets('the first time, a link is made and shown with a QR code', (
      tester,
    ) async {
      final api = await openShare(tester);

      expect(api.calls, ['create']);
      expect(find.byKey(const Key('share_invoice_url')), findsOneWidget);
      expect(find.textContaining('firsttoken'), findsOneWidget);
      expect(find.byType(QrImageView), findsOneWidget);
    });

    testWidgets('when a link already exists it is not made again or shown', (
      tester,
    ) async {
      final api = await openShare(tester, existingLink: true);

      expect(api.calls, isEmpty);
      expect(find.byKey(const Key('share_invoice_url')), findsNothing);
      expect(find.byType(QrImageView), findsNothing);
      expect(find.textContaining('already active'), findsOneWidget);
      expect(find.text('Opened 3 times'), findsOneWidget);
    });

    testWidgets('a new link replaces the old one after confirming', (
      tester,
    ) async {
      final api = await openShare(tester, existingLink: true);

      await tester.tap(find.byKey(const Key('share_invoice_new_link')));
      await tester.pumpAndSettle();
      expect(api.calls, isEmpty, reason: 'asks first');

      await tester.tap(find.text('Make new link'));
      await tester.pumpAndSettle();

      expect(api.calls, ['rotate']);
      expect(find.textContaining('secondtoken'), findsOneWidget);
      expect(find.byType(QrImageView), findsOneWidget);
    });

    testWidgets('stopping sharing revokes the link and says so', (
      tester,
    ) async {
      final api = await openShare(tester);

      await tester.tap(find.byKey(const Key('share_invoice_revoke')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Stop sharing').last);
      await tester.pumpAndSettle();

      expect(api.calls, ['create', 'revoke']);
      expect(find.byKey(const Key('share_invoice_not_shared')), findsOneWidget);
      expect(find.byType(QrImageView), findsNothing);
    });

    testWidgets('copying puts the link on the clipboard and says so', (
      tester,
    ) async {
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copied = (call.arguments as Map)['text'] as String?;
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );

      await openShare(tester);
      await tester.tap(find.byKey(const Key('share_invoice_copy')));
      await tester.pumpAndSettle();

      expect(copied, 'http://localhost:5173/i/firsttoken');
      expect(find.text('Copied'), findsOneWidget);
    });
  });
}
