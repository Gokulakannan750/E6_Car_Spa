import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/core/navigation/app_router.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/auth/data/auth_api.dart';
import 'package:e6_car_spa/features/auth/data/auth_repository.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_status_response.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/models/register_company_request.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/login_screen.dart';
import 'package:e6_car_spa/features/auth/presentation/pages/register_company_screen.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

class FakeRegistrationApi extends AuthApi {
  FakeRegistrationApi() : super(Dio());

  RegisterCompanyRequest? lastRequest;
  ApiException? errorToThrow;
  bool companyRegistration = true;

  @override
  Future<AuthStatusResponse> getAuthStatus() async => AuthStatusResponse(
    initialized: true,
    companyRegistration: companyRegistration,
  );

  @override
  Future<String> registerCompany(RegisterCompanyRequest request) async {
    lastRequest = request;
    if (errorToThrow != null) throw errorToThrow!;
    return request.companyCode;
  }
}

class FakeStorage extends AuthTokenStorage {
  String companyCode = '';

  @override
  Future<void> saveCompanyCode(String code) async => companyCode = code;

  @override
  Future<String> getCompanyCode() async => companyCode;

  @override
  Future<String?> getToken() async => null;

  @override
  Future<bool> hasToken() async => false;

  @override
  Future<AuthUser?> getCachedUser() async => null;

  @override
  Future<void> clearSession() async {}
}

class TestAuthNotifier extends AuthNotifier {
  TestAuthNotifier(super.repo) {
    state = const Unauthenticated();
  }

  @override
  Future<void> restoreSession() async {}
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('Registration models', () {
    test('the server says whether companies register with Trovo codes', () {
      expect(
        AuthStatusResponse.fromJson({
          'initialized': true,
          'companyRegistration': true,
        }).companyRegistration,
        isTrue,
      );
      expect(
        AuthStatusResponse.fromJson({'initialized': true}).companyRegistration,
        isFalse,
      );
    });

    test('the request carries both codes and the Owner account', () {
      const request = RegisterCompanyRequest(
        companyCode: '0002',
        registrationCode: 'K7QM-4RTX-9PWD',
        fullName: 'Sunrise Owner',
        username: 'owner',
        password: 'Sunrise#2026',
        confirmPassword: 'Sunrise#2026',
      );
      expect(request.toJson(), {
        'companyCode': '0002',
        'registrationCode': 'K7QM-4RTX-9PWD',
        'fullName': 'Sunrise Owner',
        'username': 'owner',
        'password': 'Sunrise#2026',
        'confirmPassword': 'Sunrise#2026',
      });
    });

    test('a successful registration remembers the company code', () async {
      final storage = FakeStorage();
      final repository = AuthRepository(FakeRegistrationApi(), storage);
      final code = await repository.registerCompany(
        const RegisterCompanyRequest(
          companyCode: '0003',
          registrationCode: 'X',
          fullName: 'A',
          username: 'a',
          password: 'p',
          confirmPassword: 'p',
        ),
      );
      expect(code, '0003');
      expect(storage.companyCode, '0003');
    });
  });

  group('Registration screens', () {
    late FakeRegistrationApi api;
    late FakeStorage storage;
    late AuthRepository repository;
    late TestAuthNotifier notifier;

    setUp(() {
      api = FakeRegistrationApi();
      storage = FakeStorage();
      repository = AuthRepository(api, storage);
      notifier = TestAuthNotifier(repository);
    });

    Future<void> pumpApp(WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.reset);
      // The app checks the server status at start-up; that check tells it
      // whether companies register with Trovo's codes.
      await repository.checkInitialization();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => notifier),
            authRepositoryProvider.overrideWithValue(repository),
          ],
          child: Consumer(
            builder: (context, ref, _) => MaterialApp.router(
              theme: AppTheme.light,
              routerConfig: ref.watch(routerProvider),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> openRegistration(WidgetTester tester) async {
      await tester.tap(find.byKey(const Key('register_company_link')));
      await tester.pumpAndSettle();
      expect(find.byType(RegisterCompanyScreen), findsOneWidget);
    }

    Future<void> fillForm(WidgetTester tester) async {
      Future<void> enter(String key, String text) => tester.enterText(
        find.descendant(
          of: find.byKey(Key(key)),
          matching: find.byType(EditableText),
        ),
        text,
      );
      await enter('register_company_code', '0002');
      await enter('register_registration_code', 'k7qm-4rtx-9pwd');
      await enter('register_full_name', 'Sunrise Owner');
      await enter('register_username', 'Owner');
      await enter('register_password', 'Sunrise#2026');
      await enter('register_confirm_password', 'Sunrise#2026');
    }

    Future<void> submit(WidgetTester tester) async {
      await tester.ensureVisible(find.byKey(const Key('register_submit')));
      await tester.tap(find.byKey(const Key('register_submit')));
      await tester.pumpAndSettle();
    }

    testWidgets('sign-in offers registration on Trovo\'s platform', (
      tester,
    ) async {
      await pumpApp(tester);
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byKey(const Key('register_company_link')), findsOneWidget);
    });

    testWidgets('a single-company server does not offer registration', (
      tester,
    ) async {
      api.companyRegistration = false;
      await pumpApp(tester);
      expect(find.byKey(const Key('register_company_link')), findsNothing);
    });

    testWidgets(
      'registering sends both codes and returns to sign-in with the code remembered',
      (tester) async {
        await pumpApp(tester);
        await openRegistration(tester);
        await fillForm(tester);
        await submit(tester);

        expect(api.lastRequest?.companyCode, '0002');
        expect(api.lastRequest?.registrationCode, 'K7QM-4RTX-9PWD');
        expect(api.lastRequest?.username, 'owner');
        expect(storage.companyCode, '0002');
        expect(find.byType(LoginScreen), findsOneWidget);
        expect(
          find.textContaining('Company 0002 is registered'),
          findsOneWidget,
        );
      },
    );

    testWidgets('a wrong code shows the server message and stays on the form', (
      tester,
    ) async {
      api.errorToThrow = const ApiException(
        message: 'Invalid company code or registration code.',
      );
      await pumpApp(tester);
      await openRegistration(tester);
      await fillForm(tester);
      await submit(tester);

      expect(find.byType(RegisterCompanyScreen), findsOneWidget);
      expect(
        find.text('Invalid company code or registration code.'),
        findsOneWidget,
      );
      expect(storage.companyCode, '');
    });

    testWidgets('nothing is sent until both codes are filled in', (
      tester,
    ) async {
      await pumpApp(tester);
      await openRegistration(tester);
      await fillForm(tester);
      await tester.enterText(
        find.descendant(
          of: find.byKey(const Key('register_registration_code')),
          matching: find.byType(EditableText),
        ),
        '',
      );
      await submit(tester);

      expect(find.text('Registration code is required.'), findsOneWidget);
      expect(api.lastRequest, isNull);
    });
  });
}
