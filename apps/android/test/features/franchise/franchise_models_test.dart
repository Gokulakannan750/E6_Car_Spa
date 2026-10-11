import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/franchise/data/franchise_api.dart';
import 'package:e6_car_spa/features/franchise/data/franchise_repository.dart';
import 'package:e6_car_spa/features/franchise/models/franchise_models.dart';
import 'package:flutter_test/flutter_test.dart';

/// Answers every request with the given status and body, and remembers what was asked.
class _StubAdapter implements HttpClientAdapter {
  final int status;
  final Map<String, dynamic> body;
  final List<RequestOptions> requests = [];

  _StubAdapter(this.status, this.body);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      _encode(body),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  static String _encode(Map<String, dynamic> map) {
    String value(Object? v) => v is String
        ? '"${v.replaceAll('"', r'\"')}"'
        : v is List
        ? '[${v.map(value).join(',')}]'
        : v is Map<String, dynamic>
        ? '{${v.entries.map((e) => '"${e.key}":${value(e.value)}').join(',')}}'
        : '$v';
    return value(map);
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('Franchise models', () {
    test('a link and its items are read from the server answer', () {
      final parsed = FranchiseLink.fromJson({
        'id': 'abc',
        'role': 'Franchisee',
        'partnerCodeHint': '0••1',
        'partnerName': 'Alpha Car Spa',
        'status': 'Active',
        'invitedAt': '2026-10-08T10:00:00Z',
        'expiresAt': '2026-10-15T10:00:00Z',
        'respondedAt': null,
        'endedAt': null,
        'scopes': [
          {'scope': 'financial_totals', 'label': 'Totals', 'status': 'Granted'},
          {'scope': 'staff', 'label': 'Staff', 'status': 'Requested'},
          {'scope': 'customers', 'label': 'Customers', 'status': 'Denied'},
        ],
      });

      expect(parsed.isActive, isTrue);
      expect(parsed.isPending, isFalse);
      expect(parsed.partnerCodeHint, '0••1');
      expect(parsed.hasOpenRequest, isTrue);
      expect(parsed.scopes.map((s) => s.isGranted), [true, false, false]);
      expect(parsed.scopes.map((s) => s.isRequested), [false, true, false]);
      expect(parsed.scopes.map((s) => s.isDenied), [false, false, true]);
      expect(parsed.expiresAt, isNotNull);
      expect(parsed.respondedAt, isNull);
    });

    test('the network keeps the two directions apart', () {
      final parsed = FranchiseNetwork.fromJson({
        'franchiseEnabled': true,
        'franchisees': [
          {'id': '1', 'role': 'Franchisor', 'status': 'Pending'},
        ],
        'franchisors': [
          {'id': '2', 'role': 'Franchisee', 'status': 'Active'},
        ],
        'pendingInvitations': 0,
      });

      expect(parsed.franchisees.single.id, '1');
      expect(parsed.franchisors.single.id, '2');
      expect(parsed.pendingInvitations, 0);
    });

    test(
      'what a company can do defaults to nothing when the answer is empty',
      () {
        final parsed = FranchiseAccess.fromJson({});
        expect(parsed.canActAsFranchisor, isFalse);
        expect(parsed.isFranchisee, isFalse);
        expect(FranchiseAccess.none.canActAsFranchisor, isFalse);
      },
    );

    test(
      'a new link comes with the address to pass on and when it stops working',
      () {
        final parsed = FranchiseLinkAccess.fromJson({
          'link': {'id': 'l', 'status': 'Pending'},
          'accessLink': 'http://x/franchise-invite/abc',
          'accessLinkExpiresAt': '2026-10-15T10:00:00Z',
        });
        expect(parsed.accessLink, 'http://x/franchise-invite/abc');
        expect(parsed.accessLinkExpiresAt, isNotNull);

        final none = FranchiseLinkAccess.fromJson({
          'link': {'id': 'l', 'status': 'Active'},
        });
        expect(none.accessLink, isNull);
      },
    );

    test(
      'the dashboard separates companies that share from those that do not',
      () {
        final parsed = FranchiseDashboard.fromJson({
          'from': '2026-10-01',
          'to': '2026-10-07',
          'network': {
            'invoiceCount': 3,
            'invoicedAmount': 1300,
            'collectedAmount': 700.5,
            'outstandingAmount': 600,
            'jobCardCount': 5,
            'daily': [
              {'date': '2026-10-01', 'invoiced': 600, 'collected': 300},
            ],
          },
          'franchisees': [
            {
              'linkId': 'a',
              'partnerCodeHint': '0••2',
              'partnerName': 'Beta',
              'financialTotalsAllowed': true,
              'allowedItems': ['financial_totals'],
              'totals': {'invoiceCount': 1, 'invoicedAmount': 10},
            },
            {
              'linkId': 'b',
              'partnerCodeHint': '0••3',
              'partnerName': 'Gamma',
              'financialTotalsAllowed': false,
              'allowedItems': <String>[],
              'totals': null,
            },
          ],
        });

        expect(parsed.network.collectedAmount, 700.5);
        expect(parsed.network.daily.single.invoiced, 600);
        expect(parsed.sharing.map((f) => f.partnerName), ['Beta']);
        expect(parsed.notSharing.map((f) => f.partnerName), ['Gamma']);
        expect(parsed.notSharing.single.totals, isNull);
      },
    );
  });

  group('Pasted invitation links', () {
    const token =
        '3f5797ee312909e790561620504c906301b8f010ef35380687c0f58c92db1482';

    test('the secret is found in a whole link, with spaces around it', () {
      expect(
        FranchiseRepository.tokenFromPastedText(
          '  http://localhost:5173/franchise-invite/$token  ',
        ),
        token,
      );
    });

    test('it is found with a trailing slash or query, and on its own', () {
      expect(
        FranchiseRepository.tokenFromPastedText(
          'https://x.example.com/franchise-invite/$token/',
        ),
        token,
      );
      expect(
        FranchiseRepository.tokenFromPastedText('https://x/y/$token?utm=1'),
        token,
      );
      expect(FranchiseRepository.tokenFromPastedText(token), token);
      expect(
        FranchiseRepository.tokenFromPastedText(token.toUpperCase()),
        token,
      );
    });

    test('anything else is refused', () {
      expect(FranchiseRepository.tokenFromPastedText(''), isNull);
      expect(FranchiseRepository.tokenFromPastedText('   '), isNull);
      expect(FranchiseRepository.tokenFromPastedText('hello world'), isNull);
      expect(
        FranchiseRepository.tokenFromPastedText(
          'http://x/franchise-invite/abc',
        ),
        isNull,
      );
      expect(
        FranchiseRepository.tokenFromPastedText('${token}00'),
        isNull,
        reason: 'too long to be a real link',
      );
    });
  });

  group('FranchiseRepository', () {
    FranchiseRepository repoWith(_StubAdapter adapter) {
      final dio = Dio(BaseOptions(baseUrl: 'http://server/api'))
        ..httpClientAdapter = adapter;
      return FranchiseRepository(FranchiseApi(dio));
    }

    test(
      'sending an invitation posts the trimmed code and the items asked for',
      () async {
        final adapter = _StubAdapter(200, {
          'message': 'ok',
          'inviteLink': 'http://x/y',
        });
        final result = await repoWith(
          adapter,
        ).sendInvite('  0002 ', ['financial_totals', 'staff']);

        expect(result.inviteLink, 'http://x/y');
        final request = adapter.requests.single;
        expect(request.method, 'POST');
        expect(request.path, '/franchise/invites');
        expect(request.data, {
          'franchiseeCode': '0002',
          'scopes': ['financial_totals', 'staff'],
        });
      },
    );

    test('the dashboard asks for exactly the chosen period', () async {
      final adapter = _StubAdapter(200, {
        'from': '2026-10-01',
        'to': '2026-10-07',
        'network': <String, dynamic>{},
        'franchisees': <dynamic>[],
      });
      await repoWith(adapter).getDashboard('2026-10-01', '2026-10-07');

      expect(adapter.requests.single.path, '/franchise/dashboard');
      expect(adapter.requests.single.queryParameters, {
        'from': '2026-10-01',
        'to': '2026-10-07',
      });
    });

    test(
      'answering a link posts what was allowed, to the link itself',
      () async {
        final adapter = _StubAdapter(200, {'id': 'l', 'status': 'Active'});
        await repoWith(adapter).respondToInvite('abc123', true, ['staff']);

        final request = adapter.requests.single;
        expect(request.path, '/franchise/invites/abc123/respond');
        expect(request.data, {
          'accept': true,
          'grantedScopes': ['staff'],
        });
      },
    );

    test('a refusal from the server becomes a readable message', () async {
      final adapter = _StubAdapter(409, {
        'error': 'This invitation has already been answered.',
      });

      await expectLater(
        repoWith(adapter).respondToInvite('abc', true, ['staff']),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('already been answered'),
          ),
        ),
      );
    });
  });
}
