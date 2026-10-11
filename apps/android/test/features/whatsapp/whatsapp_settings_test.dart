import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/whatsapp/data/whatsapp_repository.dart';
import 'package:e6_car_spa/features/whatsapp/models/whatsapp_models.dart';
import 'package:e6_car_spa/features/whatsapp/presentation/pages/whatsapp_settings_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

class StubAdapter implements HttpClientAdapter {
  final String body;
  final int status;
  final List<RequestOptions> requests = [];

  StubAdapter(this.body, {this.status = 200});

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      body,
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

WhatsAppRepository repoOver(StubAdapter adapter) => WhatsAppRepository(
  Dio(BaseOptions(baseUrl: 'http://server/api'))..httpClientAdapter = adapter,
);

WhatsAppConfigInput input({String token = ''}) => WhatsAppConfigInput(
  isEnabled: true,
  phoneNumberId: ' 123 ',
  businessAccountId: '456',
  graphApiVersion: 'v25.0',
  accessToken: token,
  metaAppId: '',
  invoiceNotificationsEnabled: true,
  paymentCompletedNotificationsEnabled: false,
  invoiceTemplateName: 'invoice_v1',
  invoiceTemplateLanguage: 'en',
  paymentCompletedTemplateName: '',
  paymentCompletedTemplateLanguage: '',
);

class FakeWhatsAppRepository extends WhatsAppRepository {
  FakeWhatsAppRepository() : super(Dio());

  WhatsAppConfig config = const WhatsAppConfig(
    isEnabled: true,
    phoneNumberId: '111',
    businessAccountId: '222',
    hasAccessToken: true,
    invoiceTemplateName: 'invoice_v1',
    invoiceTemplateLanguage: 'en',
    healthStatus: 'Healthy',
  );
  ManagedTemplates managed = const ManagedTemplates(
    isSuccess: true,
    message: '',
    canActivate: false,
    templates: [
      ManagedTemplate(
        messageType: 'Invoice',
        purpose: 'Invoice to customer',
        name: 'carspa_invoice',
        language: 'en',
        category: 'UTILITY',
        status: 'PENDING',
      ),
      ManagedTemplate(
        messageType: 'PaymentCompleted',
        purpose: 'Payment receipt',
        name: 'carspa_receipt',
        language: 'en',
        category: 'UTILITY',
        status: 'NOT_CREATED',
      ),
    ],
  );
  List<WhatsAppUsageMonth> usage = const [
    WhatsAppUsageMonth(
      year: 2026,
      month: 10,
      total: 10,
      sent: 7,
      failed: 2,
      skipped: 1,
      pending: 0,
    ),
  ];
  List<WhatsAppLogPage> logPages = [
    WhatsAppLogPage(
      items: [
        WhatsAppLogItem(
          id: 'm1',
          createdAt: DateTime(2026, 10, 10),
          messageType: 'Invoice',
          status: 'Failed',
          customerName: 'Priya Sharma',
          recipientPhone: '919840123456',
          invoiceNumber: 'INV-1',
          reason: 'Number is not on WhatsApp',
        ),
      ],
      totalCount: 1,
      page: 1,
      pageSize: 15,
    ),
  ];
  Object? failWith;

  final List<String> calls = [];
  final List<WhatsAppConfigInput> saved = [];
  final List<({String? status, int? year, int? month, int page})> logAsked = [];

  void _fail() {
    if (failWith != null) throw failWith!;
  }

  @override
  Future<WhatsAppConfig> getConfig() async => config;

  @override
  Future<WhatsAppConfig> saveConfig(WhatsAppConfigInput value) async {
    calls.add('save');
    _fail();
    saved.add(value);
    return config;
  }

  @override
  Future<WhatsAppActionResult> testConnection({
    String? phoneNumberId,
    String? businessAccountId,
    String? graphApiVersion,
    String? accessToken,
  }) async {
    calls.add('check:$phoneNumberId');
    _fail();
    return const WhatsAppActionResult(
      isSuccess: true,
      message: 'Connected to WhatsApp.',
    );
  }

  @override
  Future<WhatsAppActionResult> sendTestMessage({
    required String templateName,
    required String languageCode,
    required String recipientPhoneNumber,
    List<String> parameters = const [],
  }) async {
    calls.add(
      'test:$templateName:$languageCode:$recipientPhoneNumber:${parameters.join('|')}',
    );
    _fail();
    return const WhatsAppActionResult(
      isSuccess: true,
      message: 'Test message sent.',
    );
  }

  @override
  Future<ManagedTemplates> getManagedTemplates() async => managed;

  @override
  Future<WhatsAppActionResult> provisionManagedTemplates() async {
    calls.add('provision');
    _fail();
    return const WhatsAppActionResult(
      isSuccess: true,
      message: 'Templates submitted to Meta.',
    );
  }

  @override
  Future<WhatsAppActionResult> activateManagedTemplates() async {
    calls.add('activate');
    return const WhatsAppActionResult(isSuccess: true, message: 'Switched.');
  }

  @override
  Future<List<WhatsAppUsageMonth>> getUsage({int months = 6}) async => usage;

  @override
  Future<WhatsAppLogPage> getMessages({
    String? status,
    int? year,
    int? month,
    int page = 1,
    int pageSize = 15,
  }) async {
    logAsked.add((status: status, year: year, month: month, page: page));
    _fail();
    return logPages[(page - 1).clamp(0, logPages.length - 1)];
  }
}

class TestAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  TestAuthNotifier(super.initialState);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const owner = AuthUser(
  id: 'o',
  fullName: 'Owner',
  username: 'owner',
  role: 'Owner',
  isOwner: true,
);

const viewer = AuthUser(
  id: 'v',
  fullName: 'Viewer',
  username: 'viewer',
  role: 'Staff',
  isOwner: false,
  permissions: ['settings.view'],
);

const outsider = AuthUser(
  id: 'x',
  fullName: 'Nobody',
  username: 'x',
  role: 'Staff',
  isOwner: false,
  permissions: ['invoices.view'],
);

Future<FakeWhatsAppRepository> pump(
  WidgetTester tester, {
  AuthUser user = owner,
  FakeWhatsAppRepository? repo,
}) async {
  tester.view.physicalSize = const Size(800, 3600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final fake = repo ?? FakeWhatsAppRepository();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authNotifierProvider.overrideWith(
          (ref) => TestAuthNotifier(Authenticated(user)),
        ),
        whatsAppRepositoryProvider.overrideWithValue(fake),
      ],
      child: const MaterialApp(home: WhatsAppSettingsScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return fake;
}

Future<void> openTab(WidgetTester tester, String key) async {
  await tester.tap(find.byKey(Key(key)));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('Models and wire', () {
    test('a saved token is never sent unless one was typed', () {
      expect(input().toJson().containsKey('accessToken'), isFalse);
      expect(input(token: '  abc ').toJson()['accessToken'], 'abc');
      expect(input().toJson()['phoneNumberId'], '123');
    });

    test('numbers are shown with the country code spaced out', () {
      expect(formatWhatsAppPhone('919840123456'), '+91 98401 23456');
      expect(formatWhatsAppPhone('12345'), '12345');
    });

    test('a template status reads as words', () {
      expect(
        const ManagedTemplate(
          messageType: 'Invoice',
          purpose: '',
          name: '',
          language: '',
          category: '',
          status: 'NOT_CREATED',
        ).statusLabel,
        'Not created',
      );
    });

    test('saving puts the form on the settings address', () async {
      final adapter = StubAdapter('{"isEnabled":true,"hasAccessToken":true}');
      final saved = await repoOver(adapter).saveConfig(input(token: 'tok'));

      expect(adapter.requests.single.method, 'PUT');
      expect(adapter.requests.single.path, '/settings/whatsapp');
      expect((adapter.requests.single.data as Map)['accessToken'], 'tok');
      expect(saved.hasAccessToken, isTrue);
    });

    test('the message log asks for the chosen month and status only', () async {
      final adapter = StubAdapter(
        '{"items":[],"totalCount":0,"page":1,"pageSize":15}',
      );
      await repoOver(
        adapter,
      ).getMessages(status: 'failed', year: 2026, month: 10);

      expect(adapter.requests.single.queryParameters, {
        'status': 'failed',
        'year': 2026,
        'month': 10,
        'page': 1,
        'pageSize': 15,
      });

      await repoOver(adapter).getMessages();
      expect(adapter.requests.last.queryParameters, {
        'page': 1,
        'pageSize': 15,
      });
    });

    test('a refusal becomes a readable message', () async {
      final adapter = StubAdapter(
        '{"error":"Viewing who a message was for requires customers.view."}',
        status: 403,
      );
      await expectLater(
        repoOver(adapter).getMessages(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('customers.view'),
          ),
        ),
      );
    });
  });

  group('Access', () {
    testWidgets('without the permission nothing loads', (tester) async {
      final repo = await pump(tester, user: outsider);
      expect(find.byKey(const Key('whatsapp_restricted')), findsOneWidget);
      expect(repo.calls, isEmpty);
    });

    testWidgets('a viewer sees the settings but cannot change them', (
      tester,
    ) async {
      await pump(tester, user: viewer);

      expect(find.byKey(const Key('whatsapp_read_only')), findsOneWidget);
      expect(find.byKey(const Key('whatsapp_save')), findsNothing);
      expect(find.byKey(const Key('whatsapp_check')), findsNothing);
      expect(find.byKey(const Key('whatsapp_test_card')), findsNothing);
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('whatsapp_phone_id')))
            .enabled,
        isFalse,
      );
    });
  });

  group('Connection tab', () {
    testWidgets('shows the saved details and the health status', (
      tester,
    ) async {
      await pump(tester);

      expect(find.text('Healthy'), findsOneWidget);
      expect(find.text('111'), findsOneWidget);
      expect(find.text('invoice_v1'), findsWidgets);
      expect(
        find.text('A token is saved. Leave blank to keep it.'),
        findsOneWidget,
      );
    });

    testWidgets('the access token field hides what is typed', (tester) async {
      await pump(tester);
      final field = tester.widget<TextField>(
        find.byKey(const Key('whatsapp_token')),
      );
      expect(field.obscureText, isTrue);
    });

    testWidgets('saving sends the form and leaves the token alone if blank', (
      tester,
    ) async {
      final repo = await pump(tester);

      await tester.enterText(find.byKey(const Key('whatsapp_phone_id')), '999');
      await tester.tap(find.byKey(const Key('whatsapp_save')));
      await tester.pumpAndSettle();

      expect(repo.saved.single.phoneNumberId, '999');
      expect(repo.saved.single.accessToken, '');
      expect(repo.saved.single.toJson().containsKey('accessToken'), isFalse);
      expect(find.text('WhatsApp settings saved.'), findsOneWidget);
    });

    testWidgets('a refused save shows the reason', (tester) async {
      final repo = FakeWhatsAppRepository()
        ..failWith = ApiException(message: 'Phone number ID is required.');
      await pump(tester, repo: repo);

      await tester.tap(find.byKey(const Key('whatsapp_save')));
      await tester.pumpAndSettle();

      expect(find.text('Phone number ID is required.'), findsOneWidget);
    });

    testWidgets('checking the connection reports the result', (tester) async {
      final repo = await pump(tester);

      await tester.tap(find.byKey(const Key('whatsapp_check')));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('check:111'));
      expect(find.text('Connected to WhatsApp.'), findsOneWidget);
    });

    testWidgets('a test message goes to the typed number with its values', (
      tester,
    ) async {
      final repo = await pump(tester);

      await tester.enterText(
        find.byKey(const Key('whatsapp_test_phone')),
        '919840123456',
      );
      await tester.enterText(
        find.byKey(const Key('whatsapp_test_parameters')),
        'Priya\n\nINV-1\n',
      );
      await tester.tap(find.byKey(const Key('whatsapp_send_test')));
      await tester.pumpAndSettle();

      expect(repo.calls.last, 'test:invoice_v1:en:919840123456:Priya|INV-1');
      expect(find.text('Test message sent.'), findsOneWidget);
    });
  });

  group('Templates tab', () {
    testWidgets('lists each template with its approval status', (tester) async {
      await pump(tester);
      await openTab(tester, 'whatsapp_tab_templates');

      expect(
        find.byKey(const Key('whatsapp_template_Invoice')),
        findsOneWidget,
      );
      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('Not created'), findsOneWidget);
    });

    testWidgets('switching is blocked until every template is approved', (
      tester,
    ) async {
      await pump(tester);
      await openTab(tester, 'whatsapp_tab_templates');

      expect(find.byKey(const Key('whatsapp_activate_hint')), findsOneWidget);
      final button = tester.widget<ElevatedButton>(
        find.descendant(
          of: find.byKey(const Key('whatsapp_activate')),
          matching: find.byType(ElevatedButton),
        ),
      );
      expect(button.onPressed, isNull);
    });

    testWidgets('creating the templates asks Meta and shows the answer', (
      tester,
    ) async {
      final repo = await pump(tester);
      await openTab(tester, 'whatsapp_tab_templates');

      await tester.tap(find.byKey(const Key('whatsapp_provision')));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('provision'));
      expect(find.text('Templates submitted to Meta.'), findsOneWidget);
    });

    testWidgets('a viewer sees the templates but no buttons', (tester) async {
      await pump(tester, user: viewer);
      await openTab(tester, 'whatsapp_tab_templates');

      expect(
        find.byKey(const Key('whatsapp_template_Invoice')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('whatsapp_provision')), findsNothing);
      expect(find.byKey(const Key('whatsapp_activate')), findsNothing);
    });
  });

  group('Usage tab', () {
    testWidgets('shows the month and the messages that were not sent', (
      tester,
    ) async {
      await pump(tester);
      await openTab(tester, 'whatsapp_tab_usage');

      expect(find.text('Oct 2026'), findsOneWidget);
      expect(find.byKey(const Key('whatsapp_log_item_m1')), findsOneWidget);
      expect(find.textContaining('Priya Sharma'), findsOneWidget);
      expect(find.textContaining('+91 98401 23456'), findsOneWidget);
      expect(find.text('Number is not on WhatsApp'), findsOneWidget);
    });

    testWidgets('filtering by status and month asks the server for it', (
      tester,
    ) async {
      final repo = await pump(tester);
      await openTab(tester, 'whatsapp_tab_usage');

      await tester.tap(find.byKey(const Key('whatsapp_log_failed')));
      await tester.pumpAndSettle();
      expect(repo.logAsked.last.status, 'failed');

      await tester.tap(find.byKey(const Key('whatsapp_month_2026_10')));
      await tester.pumpAndSettle();
      expect(repo.logAsked.last.year, 2026);
      expect(repo.logAsked.last.month, 10);
      expect(repo.logAsked.last.status, 'failed');
    });

    testWidgets('someone without customers.view sees the server message', (
      tester,
    ) async {
      final repo = FakeWhatsAppRepository();
      await pump(tester, user: viewer, repo: repo);
      repo.failWith = ApiException(
        message:
            'Viewing who a message was for requires the customers.view permission.',
        statusCode: 403,
      );
      await openTab(tester, 'whatsapp_tab_usage');
      await tester.tap(find.byKey(const Key('whatsapp_log_skipped')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('whatsapp_log_error')), findsOneWidget);
      expect(find.textContaining('customers.view'), findsOneWidget);
    });

    testWidgets('an empty log says everything was sent', (tester) async {
      final repo = FakeWhatsAppRepository()
        ..logPages = [
          const WhatsAppLogPage(
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 15,
          ),
        ];
      await pump(tester, repo: repo);
      await openTab(tester, 'whatsapp_tab_usage');

      expect(find.byKey(const Key('whatsapp_log_empty')), findsOneWidget);
    });
  });
}
