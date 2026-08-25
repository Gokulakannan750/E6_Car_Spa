import '../models/auth_user.dart';

sealed class AuthState {
  const AuthState();
}

/// Initial state when checking for existing session on app launch
class AuthInitial extends AuthState {
  const AuthInitial();
}

/// User is not logged in
class Unauthenticated extends AuthState {
  final String? message;
  const Unauthenticated([this.message]);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Unauthenticated &&
          runtimeType == other.runtimeType &&
          message == other.message;

  @override
  int get hashCode => message.hashCode;
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
