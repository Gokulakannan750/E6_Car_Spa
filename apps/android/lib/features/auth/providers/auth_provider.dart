import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/auth_session_events.dart';
import '../data/auth_repository.dart';
import '../models/auth_user.dart';
import 'auth_state.dart';

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  return AuthNotifier(repository);
});

/// Convenience provider for accessing the current authenticated user (null if unauthenticated)
final currentUserProvider = Provider<AuthUser?>((ref) {
  final authState = ref.watch(authNotifierProvider);
  if (authState is Authenticated) {
    return authState.user;
  }
  return null;
});

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;
  StreamSubscription<void>? _unauthorizedSubscription;

  AuthNotifier(this._repository) : super(const AuthInitial()) {
    _unauthorizedSubscription =
        AuthSessionEvents.onUnauthorized.listen((_) {
      if (state is Authenticated || state is Authenticating) {
        state = const Unauthenticated('Session expired. Please log in again.');
      }
    });

    restoreSession();
  }

  /// Restores session on startup by validating token with GET /api/auth/me
  Future<void> restoreSession() async {
    try {
      final user = await _repository.restoreSession();
      if (user != null) {
        state = Authenticated(user);
      } else {
        state = const Unauthenticated();
      }
    } catch (e) {
      if (e is ApiException) {
        state = Unauthenticated(e.message);
      } else {
        state = const Unauthenticated('Failed to restore session.');
      }
    }
  }

  /// Attempts login against POST /api/auth/login
  Future<bool> login(String username, String password) async {
    if (username.trim().isEmpty || password.isEmpty) {
      state = const AuthFailure('Username and password are required.');
      return false;
    }

    state = const Authenticating();
    try {
      final user = await _repository.login(username, password);
      state = Authenticated(user);
      return true;
    } on ApiException catch (e) {
      state = AuthFailure(e.message);
      return false;
    } catch (e) {
      state = const AuthFailure('An unexpected error occurred during login.');
      return false;
    }
  }

  /// Clears local session and navigates user to Unauthenticated state
  Future<void> logout() async {
    try {
      await _repository.logout();
    } finally {
      state = const Unauthenticated();
    }
  }

  /// Clears error message from failure state
  void clearError() {
    if (state is AuthFailure) {
      state = const Unauthenticated();
    }
  }

  @override
  void dispose() {
    _unauthorizedSubscription?.cancel();
    super.dispose();
  }
}
