import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/auth_session_events.dart';
import '../data/auth_repository.dart';
import '../models/auth_user.dart';
import '../models/bootstrap_owner_request.dart';
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
      if (state is Authenticated) {
        state = const Unauthenticated('Session expired. Please log in again.');
      }
    });

    restoreSession();
  }

  /// Restores session on startup by validating token with GET /api/auth/me,
  /// or checking database initialization status via GET /api/auth/status if no session exists.
  Future<void> restoreSession() async {
    try {
      final user = await _repository.restoreSession();
      if (user != null) {
        state = Authenticated(user);
        return;
      }
    } catch (_) {
      // Session restoration failed, continue to check backend setup status
    }

    await checkSetupStatus();
  }

  /// Checks backend initialization status against GET /api/auth/status.
  /// If uninitialized -> SetupRequired
  /// If initialized -> Unauthenticated
  /// If status check fails -> Unauthenticated with error (never assume database is fresh)
  Future<void> checkSetupStatus() async {
    try {
      final isInitialized = await _repository.checkInitialization();
      if (!isInitialized) {
        state = const SetupRequired();
      } else {
        state = const Unauthenticated();
      }
    } catch (e) {
      if (e is ApiException) {
        state = Unauthenticated(e.message);
      } else {
        state = const Unauthenticated('Unable to connect to server. Please verify your connection.');
      }
    }
  }

  /// Periodically polls backend setup status while SetupRequired is active.
  /// If initialized -> transitions to Unauthenticated (Sign In).
  /// If uninitialized -> remains SetupRequired.
  /// If status check fails -> retains existing SetupRequired state without disrupting the screen.
  Future<void> pollSetupStatus() async {
    if (state is! SetupRequired) return;

    try {
      final isInitialized = await _repository.checkInitialization();
      if (isInitialized && state is SetupRequired) {
        state = const Unauthenticated();
      }
    } catch (_) {
      // Backend offline or periodic check failure:
      // Do NOT assume initialized = false.
      // Do NOT change the state away from SetupRequired.
      // Retain entered form data and retry on next interval.
    }
  }

  /// Bootstraps initial Owner account against POST /api/auth/bootstrap
  Future<bool> bootstrapOwner(BootstrapOwnerRequest request) async {
    state = const Authenticating();
    try {
      await _repository.bootstrapOwner(request);
      state = const Unauthenticated(
        'Owner account created successfully. Please sign in.',
        true,
      );
      return true;
    } on ApiException catch (e) {
      state = SetupRequired(e.message);
      return false;
    } catch (e) {
      state = const SetupRequired('Failed to create Owner account. Please try again.');
      return false;
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
    } on AccountLockedException catch (e) {
      state = AccountLocked(
        message: e.message,
        remainingSeconds: e.remainingLockoutSeconds,
      );
      return false;
    } on UnauthorizedException catch (e) {
      state = AuthFailure(e.message);
      return false;
    } on RateLimitedException catch (e) {
      state = AuthFailure(e.message);
      return false;
    } on NetworkException catch (e) {
      state = AuthFailure(e.message);
      return false;
    } on ApiException catch (e) {
      state = AuthFailure(e.message);
      return false;
    } catch (_) {
      state = const AuthFailure('An unexpected error occurred during login.');
      return false;
    }
  }

  /// Clears local session and navigates user to Unauthenticated state
  Future<void> logout() async {
    try {
      await _repository.logout();
    } finally {
      await checkSetupStatus();
    }
  }

  /// Clears error message from failure state
  void clearError() {
    if (state is AuthFailure || state is AccountLocked) {
      state = const Unauthenticated();
    } else if (state is SetupRequired && (state as SetupRequired).message != null) {
      state = const SetupRequired();
    }
  }

  @override
  void dispose() {
    _unauthorizedSubscription?.cancel();
    super.dispose();
  }
}
