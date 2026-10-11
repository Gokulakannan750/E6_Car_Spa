import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/audit/data/audit_repository.dart';
import 'package:e6_car_spa/features/audit/models/audit_log_model.dart';
import 'package:e6_car_spa/features/audit/presentation/pages/audit_log_screen.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

AuditLogEntry entry(
  String id, {
  String action = 'InvoiceCreated',
  String module = 'Invoices',
  String outcome = 'Success',
  String description = 'Invoice INV-1 created',
  String? oldValues,
  String? newValues,
}) => AuditLogEntry(
  id: id,
  timestamp: DateTime(2026, 10, 11, 10, 30),
  userName: 'Priya',
  userRole: 'Manager',
  action: action,
  module: module,
  description: description,
  outcome: outcome,
  entityType: 'Invoice',
  entityReference: 'INV-1',
  oldValues: oldValues,
  newValues: newValues,
);

/// Answers from a script and remembers which filters and pages it was asked for.
class FakeAuditRepository extends AuditRepository {
  FakeAuditRepository() : super(Dio());

  List<List<AuditLogEntry>> pages = [
    [entry('1')],
  ];
  Object? failWith;
  final List<({AuditFilters filters, int page})> asked = [];

  @override
  Future<AuditLogPage> getLogs(
    AuditFilters filters, {
    int page = 1,
    int pageSize = 25,
  }) async {
    asked.add((filters: filters, page: page));
    if (failWith != null) throw failWith!;
    final items = pages[(page - 1).clamp(0, pages.length - 1)];
    return AuditLogPage(
      items: items,
      totalCount: pages.fold<int>(0, (n, p) => n + p.length),
      page: page,
      totalPages: pages.length,
    );
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

const noAudit = AuthUser(
  id: 's',
  fullName: 'Staff',
  username: 'staff',
  role: 'Staff',
  isOwner: false,
  permissions: ['invoices.view'],
);

class _StubAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      '{"items":[{"id":"a","timestampUtc":"2026-10-11T05:00:00Z","action":"Login","module":"Authentication","description":"Signed in","outcome":"Failure"}],"totalCount":1,"page":2,"pageSize":25,"totalPages":3}',
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Future<FakeAuditRepository> pump(
  WidgetTester tester, {
  AuthUser user = owner,
  FakeAuditRepository? repo,
}) async {
  tester.view.physicalSize = const Size(800, 3200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final fake = repo ?? FakeAuditRepository();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authNotifierProvider.overrideWith(
          (ref) => TestAuthNotifier(Authenticated(user)),
        ),
        auditRepositoryProvider.overrideWithValue(fake),
      ],
      child: const MaterialApp(home: AuditLogScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return fake;
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('Model', () {
    test('an entry is read from the server answer', () {
      final parsed = AuditLogEntry.fromJson({
        'id': 'x',
        'timestampUtc': '2026-10-11T05:00:00Z',
        'userName': 'Priya',
        'action': 'Login',
        'module': 'Authentication',
        'description': 'Signed in',
        'outcome': 'Failure',
        'oldValues': null,
      });
      expect(parsed.isFailure, isTrue);
      expect(parsed.userName, 'Priya');
      expect(parsed.oldValues, isNull);
    });

    test('stored JSON is laid out for reading, anything else is kept', () {
      expect(AuditLogEntry.prettyValues('{"a":1}'), '{\n  "a": 1\n}');
      expect(AuditLogEntry.prettyValues('not json'), 'not json');
      expect(AuditLogEntry.prettyValues(null), '');
    });

    test('no filters means filters are empty', () {
      expect(const AuditFilters().isEmpty, isTrue);
      expect(const AuditFilters(module: 'Users').isEmpty, isFalse);
    });
  });

  group('Repository', () {
    test('asks for exactly the chosen filters and page', () async {
      final adapter = _StubAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://server/api'))
        ..httpClientAdapter = adapter;
      final page = await AuditRepository(dio).getLogs(
        AuditFilters(
          search: ' refund ',
          module: 'Invoices',
          outcome: 'Failure',
          from: DateTime(2026, 10, 1),
          to: DateTime(2026, 10, 7),
        ),
        page: 2,
      );

      final request = adapter.requests.single;
      expect(request.path, '/audit-logs');
      expect(request.queryParameters, {
        'page': 2,
        'pageSize': 25,
        'search': 'refund',
        'module': 'Invoices',
        'outcome': 'Failure',
        'fromDate': '2026-10-01',
        'toDate': '2026-10-07',
      });
      expect(page.totalPages, 3);
      expect(page.items.single.action, 'Login');
    });

    test('empty filters send only the paging', () async {
      final adapter = _StubAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://server/api'))
        ..httpClientAdapter = adapter;
      await AuditRepository(dio).getLogs(const AuditFilters());

      expect(adapter.requests.single.queryParameters, {
        'page': 1,
        'pageSize': 25,
      });
    });
  });

  group('Screen', () {
    testWidgets('someone without the permission is turned away', (
      tester,
    ) async {
      final repo = await pump(tester, user: noAudit);

      expect(find.byKey(const Key('audit_restricted')), findsOneWidget);
      expect(repo.asked, isEmpty, reason: 'nothing is fetched');
    });

    testWidgets('lists the entries with who, what and the count', (
      tester,
    ) async {
      await pump(tester);

      expect(find.byKey(const Key('audit_entry_1')), findsOneWidget);
      expect(find.text('Invoice INV-1 created'), findsOneWidget);
      expect(find.text('InvoiceCreated'), findsOneWidget);
      expect(find.text('1 record'), findsOneWidget);
    });

    testWidgets('shows a clear message when nothing matches', (tester) async {
      final repo = FakeAuditRepository()..pages = [[]];
      await pump(tester, repo: repo);

      expect(find.byKey(const Key('audit_empty')), findsOneWidget);
    });

    testWidgets('shows the server message when loading fails', (tester) async {
      final repo = FakeAuditRepository()..failWith = Exception('boom');
      await pump(tester, repo: repo);

      expect(find.text('Could not load the audit trail.'), findsOneWidget);
    });

    testWidgets('searching asks the server with the typed text', (
      tester,
    ) async {
      final repo = await pump(tester);

      await tester.enterText(find.byKey(const Key('audit_search')), 'refund');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      expect(repo.asked.last.filters.search, 'refund');
      expect(repo.asked.last.page, 1);
      expect(find.byKey(const Key('audit_clear_filters')), findsOneWidget);
    });

    testWidgets('choosing an outcome filters and clearing resets it', (
      tester,
    ) async {
      final repo = await pump(tester);

      await tester.tap(find.byKey(const Key('audit_outcome_filter')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Failure').last);
      await tester.pumpAndSettle();
      expect(repo.asked.last.filters.outcome, 'Failure');

      await tester.tap(find.byKey(const Key('audit_clear_filters')));
      await tester.pumpAndSettle();
      expect(repo.asked.last.filters.isEmpty, isTrue);
    });

    testWidgets('more pages are fetched on request and added below', (
      tester,
    ) async {
      final repo = FakeAuditRepository()
        ..pages = [
          [entry('1')],
          [entry('2', description: 'Second page entry')],
        ];
      await pump(tester, repo: repo);

      expect(find.byKey(const Key('audit_entry_2')), findsNothing);
      await tester.tap(find.byKey(const Key('audit_load_more')));
      await tester.pumpAndSettle();

      expect(repo.asked.last.page, 2);
      expect(find.byKey(const Key('audit_entry_1')), findsOneWidget);
      expect(find.byKey(const Key('audit_entry_2')), findsOneWidget);
      expect(find.byKey(const Key('audit_load_more')), findsNothing);
    });

    testWidgets('opening an entry shows the values before and after', (
      tester,
    ) async {
      final repo = FakeAuditRepository()
        ..pages = [
          [
            entry(
              '1',
              action: 'InvoiceDiscountChanged',
              oldValues: '{"discount":0}',
              newValues: '{"discount":100}',
            ),
          ],
        ];
      await pump(tester, repo: repo);

      await tester.tap(find.byKey(const Key('audit_entry_1')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('audit_detail_before')), findsOneWidget);
      expect(find.textContaining('"discount": 100'), findsOneWidget);
      expect(find.textContaining('"discount": 0'), findsOneWidget);
    });
  });
}
