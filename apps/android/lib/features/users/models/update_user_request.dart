import 'package:flutter/foundation.dart';

@immutable
class UpdateUserRequest {
  final String fullName;
  final String? email;
  final String? password;
  final String? confirmPassword;
  final String? role;
  final List<String>? permissionCodes;

  const UpdateUserRequest({
    required this.fullName,
    this.email,
    this.password,
    this.confirmPassword,
    this.role,
    this.permissionCodes,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'fullName': fullName.trim(),
      'email': (email != null && email!.trim().isNotEmpty)
          ? email!.trim().toLowerCase()
          : null,
    };

    if (password != null && password!.isNotEmpty) {
      map['password'] = password;
      map['confirmPassword'] = confirmPassword ?? password;
    }

    if (role != null) {
      map['role'] = role;
    }

    if (permissionCodes != null) {
      map['permissionCodes'] = permissionCodes;
    }

    return map;
  }
}
