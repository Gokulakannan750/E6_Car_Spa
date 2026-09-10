import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:e6_car_spa/features/auth/data/auth_token_storage.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';

/// Fake in-memory implementation of FlutterSecureStorage for unit testing.
/// Only overrides the three methods actually used by AuthTokenStorage:
/// read, write, and delete. Avoids API signature issues with readAll/deleteAll.
class FakeSecureStorage extends FlutterSecureStorage {
  final Map<String, String> _store = {};

  FakeSecureStorage() : super();

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    return _store[key];
  }

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
      _store.remove(key);
    } else {
      _store[key] = value;
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
    _store.remove(key);
  }

  /// Expose store for assertions.
  Map<String, String> get store => _store;
}



void main() {
  group('AuthTokenStorage - Secure Token Lifecycle', () {
    late FakeSecureStorage fakeStorage;
    late AuthTokenStorage tokenStorage;

    setUp(() {
      fakeStorage = FakeSecureStorage();
      tokenStorage = AuthTokenStorage(fakeStorage);
    });

    test('getToken returns null when no token is stored', () async {
      final token = await tokenStorage.getToken();
      expect(token, isNull);
    });

    test('hasToken returns false when no token is stored', () async {
      final has = await tokenStorage.hasToken();
      expect(has, false);
    });

    test('saveToken stores token and getToken retrieves it', () async {
      const syntheticToken = 'TEST_SECRET_ANDROID_TOKEN_123456';
      await tokenStorage.saveToken(syntheticToken);

      final token = await tokenStorage.getToken();
      expect(token, syntheticToken);
    });

    test('hasToken returns true after saving a token', () async {
      await tokenStorage.saveToken('TEST_SECRET_ANDROID_TOKEN_123456');
      final has = await tokenStorage.hasToken();
      expect(has, true);
    });

    test('clearSession removes token from storage', () async {
      await tokenStorage.saveToken('TEST_SECRET_ANDROID_TOKEN_123456');
      expect(await tokenStorage.hasToken(), true);

      await tokenStorage.clearSession();

      expect(await tokenStorage.getToken(), isNull);
      expect(await tokenStorage.hasToken(), false);
    });

    test('clearSession removes cached user from storage', () async {
      const user = AuthUser(
        id: 'u1',
        username: 'admin',
        fullName: 'Admin User',
        role: 'Admin',
        isOwner: true,
      );

      await tokenStorage.saveToken('TEST_SECRET_ANDROID_TOKEN_123456');
      await tokenStorage.saveUser(user);

      // Verify user is cached
      final cached = await tokenStorage.getCachedUser();
      expect(cached, isNotNull);
      expect(cached!.username, 'admin');

      await tokenStorage.clearSession();

      expect(await tokenStorage.getToken(), isNull);
      expect(await tokenStorage.getCachedUser(), isNull);
    });

    test('getCachedUser returns null when no user is cached', () async {
      final user = await tokenStorage.getCachedUser();
      expect(user, isNull);
    });

    test('saveUser followed by getCachedUser round-trips correctly', () async {
      const user = AuthUser(
        id: 'u2',
        username: 'staff01',
        fullName: 'Staff User',
        role: 'Staff',
        isOwner: false,
      );

      await tokenStorage.saveUser(user);
      final cached = await tokenStorage.getCachedUser();

      expect(cached, isNotNull);
      expect(cached!.id, 'u2');
      expect(cached.username, 'staff01');
      expect(cached.fullName, 'Staff User');
      expect(cached.role, 'Staff');
    });

    test('getCachedUser handles corrupted JSON gracefully', () async {
      // Write malformed JSON directly to the store
      fakeStorage.store['e6_cached_auth_user'] = '{not valid json!!!';

      final user = await tokenStorage.getCachedUser();
      expect(user, isNull); // Should not throw, just return null
    });

    test('getCachedUser handles empty string gracefully', () async {
      fakeStorage.store['e6_cached_auth_user'] = '';

      final user = await tokenStorage.getCachedUser();
      expect(user, isNull);
    });

    test('saveToken overwrites previous token', () async {
      await tokenStorage.saveToken('OLD_TOKEN');
      expect(await tokenStorage.getToken(), 'OLD_TOKEN');

      await tokenStorage.saveToken('NEW_TOKEN');
      expect(await tokenStorage.getToken(), 'NEW_TOKEN');
    });

    test('multiple clearSession calls do not throw', () async {
      await tokenStorage.saveToken('TEST_TOKEN');

      await tokenStorage.clearSession();
      await tokenStorage.clearSession(); // Should not throw

      expect(await tokenStorage.hasToken(), false);
    });
  });
}
