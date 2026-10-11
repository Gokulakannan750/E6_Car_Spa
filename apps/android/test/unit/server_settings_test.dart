import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/network/dio_client.dart';
import 'package:e6_car_spa/core/utils/app_environment.dart';
import 'package:e6_car_spa/core/utils/server_address.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/presentation/widgets/server_settings_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

class _NoStorage extends AuthTokenStorage {
  @override
  Future<String?> getToken() async => null;

  @override
  Future<void> clearSession() async {}

  @override
  Future<AuthUser?> getCachedUser() async => null;

  @override
  Future<void> saveUser(AuthUser user) async {}
}

class _CapturingAdapter implements HttpClientAdapter {
  final List<Uri> uris = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    uris.add(options.uri);
    return ResponseBody.fromString(
      '{}',
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  tearDown(() => AppEnvironment.serverOverride = null);

  group('ServerAddress', () {
    String? url(String raw, {bool http = false}) =>
        ServerAddress.parse(raw, allowHttp: http).url;
    String? error(String raw, {bool http = false}) =>
        ServerAddress.parse(raw, allowHttp: http).error;

    test('a bare host gets https and the api path', () {
      expect(url('myspa.example.com'), 'https://myspa.example.com/api');
      expect(url('  myspa.example.com  '), 'https://myspa.example.com/api');
    });

    test('a port, a path and a trailing slash are kept sensibly', () {
      expect(
        url('https://myspa.example.com:5298/'),
        'https://myspa.example.com:5298/api',
      );
      expect(
        url('https://myspa.example.com/api'),
        'https://myspa.example.com/api',
      );
      expect(
        url('https://myspa.example.com/api/'),
        'https://myspa.example.com/api',
      );
      expect(url('https://example.com/spa'), 'https://example.com/spa/api');
    });

    test('plain http is refused unless this is a development build', () {
      expect(error('http://192.168.1.7:5298'), contains('HTTPS'));
      expect(
        url('http://192.168.1.7:5298', http: true),
        'http://192.168.1.7:5298/api',
      );
    });

    test('empty, spaced and odd input is explained', () {
      expect(error(''), 'Enter the server address.');
      expect(error('my spa.com'), contains('spaces'));
      expect(error('ftp://example.com'), contains('https://'));
      expect(error('https://'), contains('server address'));
    });
  });

  group('Chosen server', () {
    test('the built-in address is used until one is chosen', () {
      expect(AppEnvironment.apiBaseUrl, AppEnvironment.builtInApiBaseUrl);

      AppEnvironment.serverOverride = 'https://myspa.example.com/api';
      expect(AppEnvironment.apiBaseUrl, 'https://myspa.example.com/api');

      AppEnvironment.serverOverride = '   ';
      expect(AppEnvironment.apiBaseUrl, AppEnvironment.builtInApiBaseUrl);
    });

    test(
      'requests follow a change at once, without rebuilding the client',
      () async {
        final container = ProviderContainer(
          overrides: [authTokenStorageProvider.overrideWithValue(_NoStorage())],
        );
        addTearDown(container.dispose);
        final dio = container.read(dioProvider);
        final adapter = _CapturingAdapter();
        dio.httpClientAdapter = adapter;

        AppEnvironment.serverOverride = 'https://one.example.com/api';
        await dio.get('/health');
        AppEnvironment.serverOverride = 'https://two.example.com/api';
        await dio.get('/health');

        expect(adapter.uris.map((u) => u.toString()), [
          'https://one.example.com/api/health',
          'https://two.example.com/api/health',
        ]);
      },
    );
  });

  group('Server settings dialog', () {
    Future<List<String>> pump(WidgetTester tester, {String? problem}) async {
      FlutterSecureStorage.setMockInitialValues({});
      final asked = <String>[];
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serverHealthCheckProvider.overrideWithValue((url) async {
              asked.add(url);
              return problem;
            }),
          ],
          child: MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: TextButton(
                  key: const Key('open'),
                  onPressed: () => ServerSettingsDialog.show(context),
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.byKey(const Key('open')));
      await tester.pumpAndSettle();
      return asked;
    }

    testWidgets('testing shows the result and changes nothing', (tester) async {
      final asked = await pump(tester);

      await tester.enterText(
        find.byKey(const Key('server_address_field')),
        'myspa.example.com',
      );
      await tester.tap(find.byKey(const Key('server_test')));
      await tester.pumpAndSettle();

      expect(asked, ['https://myspa.example.com/api']);
      expect(find.byKey(const Key('server_ok')), findsOneWidget);
      expect(AppEnvironment.serverOverride, isNull);
    });

    testWidgets('a bad address is explained before anything is sent', (
      tester,
    ) async {
      final asked = await pump(tester);

      await tester.enterText(
        find.byKey(const Key('server_address_field')),
        'my spa.com',
      );
      await tester.tap(find.byKey(const Key('server_save')));
      await tester.pumpAndSettle();

      expect(asked, isEmpty);
      expect(find.byKey(const Key('server_error')), findsOneWidget);
    });

    testWidgets('saving a working server switches this device to it', (
      tester,
    ) async {
      await pump(tester);

      await tester.enterText(
        find.byKey(const Key('server_address_field')),
        'https://myspa.example.com',
      );
      await tester.tap(find.byKey(const Key('server_save')));
      await tester.pumpAndSettle();

      expect(AppEnvironment.serverOverride, 'https://myspa.example.com/api');
      expect(AppEnvironment.apiBaseUrl, 'https://myspa.example.com/api');
      expect(find.byType(ServerSettingsDialog), findsNothing);
    });

    testWidgets('a server that does not answer is not saved', (tester) async {
      await pump(tester, problem: 'Could not reach the server.');

      await tester.enterText(
        find.byKey(const Key('server_address_field')),
        'myspa.example.com',
      );
      await tester.tap(find.byKey(const Key('server_save')));
      await tester.pumpAndSettle();

      expect(AppEnvironment.serverOverride, isNull);
      expect(find.textContaining('Nothing was changed'), findsOneWidget);
      expect(find.byType(ServerSettingsDialog), findsOneWidget);
    });

    testWidgets('built-in goes back to the server the app was made for', (
      tester,
    ) async {
      AppEnvironment.serverOverride = 'https://myspa.example.com/api';
      await pump(tester);

      await tester.tap(find.byKey(const Key('server_reset')));
      await tester.pumpAndSettle();

      expect(AppEnvironment.serverOverride, isNull);
      expect(AppEnvironment.apiBaseUrl, AppEnvironment.builtInApiBaseUrl);
    });
  });
}
