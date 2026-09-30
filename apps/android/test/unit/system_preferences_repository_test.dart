import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:e6_car_spa/features/settings/data/settings_api.dart';
import 'package:e6_car_spa/features/settings/data/settings_repository.dart';
import 'package:e6_car_spa/features/settings/models/system_preferences_model.dart';

class FakeSettingsApi extends SettingsApi {
  SystemPreferencesModel? remotePreferences;
  bool shouldThrow = false;

  FakeSettingsApi() : super(Dio());

  @override
  Future<SystemPreferencesModel> getSystemPreferences() async {
    if (shouldThrow) {
      throw DioException(
        requestOptions: RequestOptions(path: '/settings/system'),
        type: DioExceptionType.connectionError,
      );
    }
    return remotePreferences ?? SystemPreferencesModel.defaultPreferences;
  }

  @override
  Future<SystemPreferencesModel> updateSystemPreferences(
    SystemPreferencesModel preferences,
  ) async {
    if (shouldThrow) {
      throw DioException(
        requestOptions: RequestOptions(path: '/settings/system'),
        type: DioExceptionType.connectionError,
      );
    }
    remotePreferences = preferences;
    return preferences;
  }
}

class MockSecureStorage extends FlutterSecureStorage {
  final Map<String, String> data = {};

  MockSecureStorage() : super();

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => data[key];

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (value == null) {
      data.remove(key);
    } else {
      data[key] = value;
    }
  }

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    data.remove(key);
  }
}

void main() {
  group('SettingsRepository System Preferences Tests', () {
    late FakeSettingsApi fakeApi;
    late MockSecureStorage fakeStorage;
    late SettingsRepository repository;

    setUp(() {
      fakeApi = FakeSettingsApi();
      fakeStorage = MockSecureStorage();
      repository = SettingsRepository(fakeApi, fakeStorage);
    });

    test('getSystemPreferences loads from API and saves to cache', () async {
      fakeApi.remotePreferences = const SystemPreferencesModel(
        dateFormat: 'YYYY-MM-DD',
        currencySymbol: '₹',
        decimalPrecision: 0,
      );

      final result = await repository.getSystemPreferences();

      expect(result.dateFormat, 'YYYY-MM-DD');
      expect(result.currencySymbol, '₹');
      expect(result.decimalPrecision, 0);

      // Verify cached in secure storage
      final cachedJson = await fakeStorage.read(key: 'e6_system_preferences');
      expect(cachedJson, isNotNull);
      final cachedMap = jsonDecode(cachedJson!) as Map<String, dynamic>;
      expect(cachedMap['currencySymbol'], '₹');
    });

    test(
      'getSystemPreferences falls back to local cache when API throws connection error',
      () async {
        // Seed cache
        const cached = SystemPreferencesModel(
          dateFormat: 'MM/DD/YYYY',
          currencySymbol: '₹',
        );
        await fakeStorage.write(
          key: 'e6_system_preferences',
          value: jsonEncode(cached.toJson()),
        );

        // Simulate network failure
        fakeApi.shouldThrow = true;

        final result = await repository.getSystemPreferences();

        expect(result.dateFormat, 'MM/DD/YYYY');
        expect(result.currencySymbol, '₹');
      },
    );

    test(
      'updateSystemPreferences updates backend and persists to cache',
      () async {
        const newPrefs = SystemPreferencesModel(
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '24h',
          currencySymbol: '€',
          decimalPrecision: 0,
          defaultPrintCopies: 3,
          autoPrintReceipt: false,
          refreshInterval: 60,
        );

        final result = await repository.updateSystemPreferences(newPrefs);

        expect(result, equals(newPrefs));
        expect(fakeApi.remotePreferences, equals(newPrefs));

        final cachedJson = await fakeStorage.read(key: 'e6_system_preferences');
        expect(cachedJson, isNotNull);
        final cachedMap = jsonDecode(cachedJson!) as Map<String, dynamic>;
        expect(cachedMap['refreshInterval'], 60);
      },
    );

    test(
      'resetSystemPreferences resets to canonical defaults on backend and cache',
      () async {
        // Set non-default first
        await repository.updateSystemPreferences(
          const SystemPreferencesModel(
            currencySymbol: '\$',
            refreshInterval: 15,
          ),
        );

        final result = await repository.resetSystemPreferences();

        expect(result.currencySymbol, '₹');
        expect(result.dateFormat, 'DD/MM/YYYY');
        expect(result.decimalPrecision, 2);
        expect(result.refreshInterval, 30);
        expect(
          fakeApi.remotePreferences,
          equals(SystemPreferencesModel.defaultPreferences),
        );
      },
    );
  });
}
