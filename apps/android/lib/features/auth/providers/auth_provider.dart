import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/auth_session_events.dart';
import '../data/auth_repository.dart';
import '../models/auth_user.dart';
import '../models/bootstrap_owner_request.dart';
import 'auth_state.dart';

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((
  ref,
) {
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
  Future<void>? _inFlightRevalidation;
  DateTime? _lastRevalidationTime;

  AuthNotifier(this._repository) : super(const AuthInitial()) {
    _unauthorizedSubscription = AuthSessionEvents.onUnauthorized.listen((
      _,
    ) async {
      try {
        final isInitialized = await _repository.checkInitialization();
        if (!isInitialized) {
          state = const SetupRequired();
        } else {
          state = const Unauthenticated(
            'Session expired. Please log in again.',
          );
        }
      } catch (_) {
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
        state = const Unauthenticated(
          'Unable to connect to server. Please verify your connection.',
        );
      }
    }
  }

  /// Revalidates authentication and backend initialization state across application lifecycle events
  /// (e.g. app returning to foreground/resumed state).
  ///
  /// Serializes and debounces duplicate in-flight requests to eliminate race conditions.
  Future<void> revalidateAuthState({
    bool onResume = false,
    bool force = false,
  }) async {
    if (_inFlightRevalidation != null) {
      return _inFlightRevalidation!;
    }

    if (!force &&
        _lastRevalidationTime != null &&
        DateTime.now().difference(_lastRevalidationTime!).inMilliseconds <
            1500) {
      return;
    }

    final completer = Completer<void>();
    _inFlightRevalidation = completer.future;

    try {
      _lastRevalidationTime = DateTime.now();
      final currentState = state;

      if (currentState is SetupRequired) {
        // Case A: Android is showing First-Time Setup.
        // Another client creates the first Owner.
        // Android resumes -> detect initialized=true and move to Login (Unauthenticated).
        try {
          final isInitialized = await _repository.checkInitialization();
          if (isInitialized && state is SetupRequired) {
            state = const Unauthenticated();
          }
        } catch (_) {
          // Transient network failure during setup check -> retain existing SetupRequired
        }
      } else if (currentState is Unauthenticated ||
          currentState is AuthFailure ||
          currentState is AccountLocked ||
          currentState is AuthInitial) {
        // Case B: Android is showing Login.
        // The last user is deleted from PostgreSQL.
        // Android resumes -> detect initialized=false and show First-Time Setup.
        try {
          final isInitialized = await _repository.checkInitialization();
          if (!isInitialized) {
            state = const SetupRequired();
          } else if (currentState is AuthInitial) {
            state = const Unauthenticated();
          }
        } catch (_) {
          // Transient network failure -> retain existing unauthenticated state
        }
      } else if (currentState is Authenticated) {
        // Case C: Authenticated user session.
        // Transient network failure occurs -> do NOT destroy session!
        try {
          final isInitialized = await _repository.checkInitialization();
          if (!isInitialized) {
            // Zero users exist in DB -> clear local session and transition to First-Time Setup
            await _repository.logout();
            state = const SetupRequired();
            return;
          }

          // Backend is initialized. If resuming, revalidate active token.
          if (onResume) {
            try {
              final user = await _repository.getCurrentUser();
              if (state is Authenticated) {
                state = Authenticated(user);
              }
            } on UnauthorizedException {
              await _repository.logout();
              state = const Unauthenticated(
                'Session expired. Please log in again.',
              );
            } catch (_) {
              // Transient network failure: DO NOT destroy session! Retain Authenticated state (Case C / Test 7)
            }
          }
        } catch (_) {
          // Network failure checking status -> retain Authenticated session
        }
      }
    } finally {
      _inFlightRevalidation = null;
      if (!completer.isCompleted) {
        completer.complete();
      }
    }
  }

  /// Periodically polls backend setup status while SetupRequired is active.
  /// If initialized -> transitions to Unauthenticated (Sign In).
  /// If uninitialized -> remains SetupRequired.
  /// If status check fails -> retains existing SetupRequired state without disrupting the screen.
  Future<void> pollSetupStatus() async {
    if (state is! SetupRequired) return;
    await revalidateAuthState(force: true);
  }

  /// Bootstraps initial Owner account against POST /api/auth/bootstrap
  Future<bool> bootstrapOwner(BootstrapOwnerRequest request) async {
    state = const Authenticating();
    try {
      final companyCode = await _repository.bootstrapOwner(request);
      state = Unauthenticated(
        companyCode.isEmpty
            ? 'Owner account created successfully. Please sign in.'
            : 'Owner account created. Your company code is $companyCode. Please sign in.',
        true,
      );
      return true;
    } on ApiException catch (e) {
      state = SetupRequired(e.message);
      return false;
    } catch (e) {
      state = const SetupRequired(
        'Failed to create Owner account. Please try again.',
      );
      return false;
    }
  }

  /// Attempts login against POST /api/auth/login
  Future<bool> login(
    String username,
    String password, {
    String? companyCode,
  }) async {
    if (username.trim().isEmpty || password.isEmpty) {
      state = const AuthFailure('Username and password are required.');
      return false;
    }

    state = const Authenticating();
    try {
      final user = await _repository.login(
        username,
        password,
        companyCode: companyCode,
      );
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
    } else if (state is SetupRequired &&
        (state as SetupRequired).message != null) {
      state = const SetupRequired();
    }
  }

  @override
  void dispose() {
    _unauthorizedSubscription?.cancel();
    super.dispose();
  }
}
