import '../models/auth_user.dart';

sealed class AuthState {
  const AuthState();
}

/// Initial state when checking for existing session on app launch
class AuthInitial extends AuthState {
  const AuthInitial();
}

/// System has not been initialized with an Owner account
class SetupRequired extends AuthState {
  final String? message;
  const SetupRequired([this.message]);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SetupRequired &&
          runtimeType == other.runtimeType &&
          message == other.message;

  @override
  int get hashCode => message.hashCode;
}

/// User is not logged in
class Unauthenticated extends AuthState {
  final String? message;
  final bool isSuccess;
  const Unauthenticated([this.message, this.isSuccess = false]);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Unauthenticated &&
          runtimeType == other.runtimeType &&
          message == other.message &&
          isSuccess == other.isSuccess;

  @override
  int get hashCode => Object.hash(message, isSuccess);
}

/// Login request in-flight
class Authenticating extends AuthState {
  const Authenticating();
}

/// User is successfully authenticated
class Authenticated extends AuthState {
  final AuthUser user;
  const Authenticated(this.user);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Authenticated &&
          runtimeType == other.runtimeType &&
          user == other.user;

  @override
  int get hashCode => user.hashCode;
}

/// Login attempt failed
class AuthFailure extends AuthState {
  final String message;
  const AuthFailure(this.message);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthFailure &&
          runtimeType == other.runtimeType &&
          message == other.message;

  @override
  int get hashCode => message.hashCode;
}

/// Account is temporarily locked due to brute-force protection
class AccountLocked extends AuthState {
  final String message;
  final int remainingSeconds;
  const AccountLocked({
    required this.message,
    required this.remainingSeconds,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AccountLocked &&
          runtimeType == other.runtimeType &&
          message == other.message &&
          remainingSeconds == other.remainingSeconds;

  @override
  int get hashCode => Object.hash(message, remainingSeconds);
}
