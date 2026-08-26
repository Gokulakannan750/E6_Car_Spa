import 'package:flutter/foundation.dart';

@immutable
class CreateUserRequest {
  final String fullName;
  final String username;
  final String? email;
  final String password;
  final String confirmPassword;
  final String role;
  final List<String> permissionCodes;

  const CreateUserRequest({
    required this.fullName,
    required this.username,
    this.email,
    required this.password,
    required this.confirmPassword,
    required this.role,
    this.permissionCodes = const [],
  });

  Map<String, dynamic> toJson() {
    return {
      'fullName': fullName.trim(),
      'username': username.trim().toLowerCase(),
      'email': (email != null && email!.trim().isNotEmpty)
          ? email!.trim().toLowerCase()
          : null,
      'password': password,
      'confirmPassword': confirmPassword,
      'role': role,
      'permissionCodes': permissionCodes,
    };
  }
}
