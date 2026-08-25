import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../models/auth_user.dart';
import '../models/login_request.dart';
import 'auth_api.dart';
import 'auth_token_storage.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final api = ref.watch(authApiProvider);
  final storage = ref.watch(authTokenStorageProvider);
  return AuthRepository(api, storage);
});

class AuthRepository {
  final AuthApi _api;
  final AuthTokenStorage _storage;

  const AuthRepository(this._api, this._storage);

  /// Performs login, stores token and user in secure storage, and returns AuthUser
  Future<AuthUser> login(String username, String password) async {
    final response = await _api.login(
      LoginRequest(
        username: username.trim(),
        password: password,
      ),
    );

    await _storage.saveToken(response.token);
    await _storage.saveUser(response.user);
    return response.user;
  }

  /// Restores session on application startup by validating the existing token with GET /api/auth/me
  Future<AuthUser?> restoreSession() async {
    final token = await _storage.getToken();
    if (token == null || token.isEmpty) {
      await _storage.clearSession();
      return null;
    }

    try {
      final user = await _api.getCurrentUser(customToken: token);
      await _storage.saveUser(user);
      return user;
    } on UnauthorizedException {
      await _storage.clearSession();
      return null;
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        await _storage.clearSession();
        return null;
      }
      // If server or network issue, fallback to cached user if available
      final cachedUser = await _storage.getCachedUser();
      if (cachedUser != null) {
        return cachedUser;
      }
      rethrow;
    } catch (_) {
      await _storage.clearSession();
      return null;
    }
  }

  /// Fetches latest user profile from GET /api/auth/me
  Future<AuthUser> getCurrentUser() async {
    final user = await _api.getCurrentUser();
    await _storage.saveUser(user);
    return user;
  }

  /// Securely clears local credentials and session data
  Future<void> logout() async {
    await _storage.clearSession();
  }
}
