import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/settings/data/settings_api.dart';
import 'package:e6_car_spa/features/settings/data/settings_repository.dart';
import 'package:e6_car_spa/features/settings/models/invoice_series_model.dart';
import 'package:e6_car_spa/features/settings/presentation/widgets/invoice_series_card.dart';

/// Invoice Configuration — GST / non-GST series (Android): same coverage as the desktop section.
class _FakeSettingsApi extends SettingsApi {
  _FakeSettingsApi() : super(Dio());

  InvoiceSeriesSettingsModel current = _series('GST/', 'BILL/');
  final List<String> updates = [];
  String? rejectWith;
  bool failLoad = false;

  @override
  Future<InvoiceSeriesSettingsModel> getInvoiceSeries() async {
    if (failLoad) throw Exception('network');
    return current;
  }

  @override
  Future<InvoiceSeriesSettingsModel> updateInvoiceSeries({
    required String gstPrefix,
    required String nonGstPrefix,
  }) async {
    updates.add('$gstPrefix|$nonGstPrefix');
    if (rejectWith != null) {
      final options = RequestOptions(path: '/settings/invoice-series');
      throw DioException(
        requestOptions: options,
        response: Response(
          requestOptions: options,
          statusCode: 403,
          data: {'error': rejectWith},
        ),
        type: DioExceptionType.badResponse,
      );
    }
    current = _series(gstPrefix, nonGstPrefix);
    return current;
  }
}

InvoiceSeriesSettingsModel _series(String gst, String bill) =>
    InvoiceSeriesSettingsModel(
      gst: InvoiceSeriesModel(
        seriesKind: 'Gst',
        prefix: gst,
        minDigits: 4,
        nextNumber: 8,
        nextNumberDisplay: '0008',
        nextInvoiceNumber: '${gst}0008',
      ),
      nonGst: InvoiceSeriesModel(
        seriesKind: 'NonGst',
        prefix: bill,
        minDigits: 4,
        nextNumber: 9,
        nextNumberDisplay: '0009',
        nextInvoiceNumber: '${bill}0009',
      ),
    );

Future<_FakeSettingsApi> _pump(
  WidgetTester tester, {
  required bool isOwner,
  _FakeSettingsApi? api,
}) async {
  final fake = api ?? _FakeSettingsApi();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [settingsApiProvider.overrideWithValue(fake)],
      child: MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: InvoiceSeriesCard(isOwner: isOwner),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return fake;
}

Finder _prefixField(String keyPrefix) => find.descendant(
  of: find.byKey(Key('${keyPrefix}_prefix_field')),
  matching: find.byType(EditableText),
);

Text _text(WidgetTester tester, String key) =>
    tester.widget<Text>(find.byKey(Key(key)));

ElevatedButton _saveButton(WidgetTester tester) =>
    tester.widget<ElevatedButton>(
      find.byKey(const Key('save_invoice_series_button')),
    );

void main() {
  testWidgets(
    '1. shows both series with prefix, read-only next number and example',
    (tester) async {
      await _pump(tester, isOwner: true);

      expect(find.text('GST Invoice Series'), findsOneWidget);
      expect(find.text('Non-GST Invoice Series'), findsOneWidget);
      expect(_text(tester, 'gst_next_number').data, '0008');
      expect(_text(tester, 'non_gst_next_number').data, '0009');
      expect(_text(tester, 'gst_example').data, 'GST/0008');
      expect(_text(tester, 'non_gst_example').data, 'BILL/0009');
      expect(
        find.text(
          'GST and non-GST documents use separate numbering sequences.',
        ),
        findsOneWidget,
      );
      expect(
        find.text(
          'Invoice numbers are automatically assigned when an invoice is finalized.',
        ),
        findsOneWidget,
      );
      expect(
        find.text(
          'GST invoice numbers can be changed by the Owner after the invoice is fully paid.',
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    '2. next number is display-only (only the two prefixes are editable)',
    (tester) async {
      await _pump(tester, isOwner: true);
      expect(find.byType(EditableText), findsNWidgets(2));
    },
  );

  testWidgets('3. Owner edits a prefix, sees the live example and saves', (
    tester,
  ) async {
    final api = await _pump(tester, isOwner: true);

    await tester.enterText(_prefixField('gst'), 'tax/');
    await tester.pump();
    expect(_text(tester, 'gst_example').data, 'TAX/0008');

    await tester.tap(find.byKey(const Key('save_invoice_series_button')));
    await tester.pumpAndSettle();

    expect(api.updates, ['TAX/|BILL/']);
    expect(find.text('Invoice number prefixes saved.'), findsOneWidget);
  });

  testWidgets('4. non-Owner sees the values but cannot edit or save', (
    tester,
  ) async {
    await _pump(tester, isOwner: false);

    for (final key in ['gst', 'non_gst']) {
      expect(
        tester
            .widget<TextField>(
              find.descendant(
                of: find.byKey(Key('${key}_prefix_field')),
                matching: find.byType(TextField),
              ),
            )
            .enabled,
        isFalse,
      );
    }
    expect(find.byKey(const Key('save_invoice_series_button')), findsNothing);
    expect(find.text('Only the Owner can change prefixes.'), findsOneWidget);
  });

  testWidgets(
    '5. invalid or identical prefixes show errors and disable saving',
    (tester) async {
      final api = await _pump(tester, isOwner: true);

      await tester.enterText(_prefixField('gst'), 'GS T#');
      await tester.pump();
      expect(find.textContaining('Invalid prefix'), findsOneWidget);
      expect(_saveButton(tester).onPressed, isNull);

      await tester.enterText(_prefixField('gst'), 'BILL/');
      await tester.pump();
      expect(
        find.text('GST and non-GST prefixes must be different.'),
        findsOneWidget,
      );
      expect(_saveButton(tester).onPressed, isNull);
      expect(api.updates, isEmpty);
    },
  );

  testWidgets('6. API errors are shown and the saved values are kept', (
    tester,
  ) async {
    final api = _FakeSettingsApi()
      ..rejectWith = 'Only the Owner can change invoice number prefixes.';
    await _pump(tester, isOwner: true, api: api);

    await tester.enterText(_prefixField('non_gst'), 'INV-');
    await tester.pump();
    await tester.tap(find.byKey(const Key('save_invoice_series_button')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('invoice_series_save_error')), findsOneWidget);
    expect(
      find.textContaining('Only the Owner can change invoice number prefixes.'),
      findsOneWidget,
    );
    expect(api.current.nonGst.prefix, 'BILL/');
  });

  testWidgets('7. load failure is reported', (tester) async {
    await _pump(
      tester,
      isOwner: true,
      api: _FakeSettingsApi()..failLoad = true,
    );
    expect(find.byKey(const Key('invoice_series_load_error')), findsOneWidget);
  });
}
