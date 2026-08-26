import 'package:flutter/foundation.dart';

@immutable
class UserModel {
  final String id;
  final String fullName;
  final String username;
  final String? email;
  final String role;
  final bool isActive;
  final DateTime? lastLoginAt;
  final DateTime createdAt;
  final List<String> permissions;

  const UserModel({
    required this.id,
    required this.fullName,
    required this.username,
    this.email,
    required this.role,
    required this.isActive,
    this.lastLoginAt,
    required this.createdAt,
    this.permissions = const [],
  });

  bool get isOwner => role.toLowerCase() == 'owner';
  bool get isManager => role.toLowerCase() == 'manager';
  bool get isStaff => role.toLowerCase() == 'staff';

  bool hasPermission(String code) {
    if (isOwner) return true;
    return permissions.contains(code);
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName'] as String? ?? '',
      username: json['username'] as String? ?? '',
      email: json['email'] as String?,
      role: json['role'] as String? ?? 'Staff',
      isActive: json['isActive'] as bool? ?? true,
      lastLoginAt: json['lastLoginAt'] != null
          ? DateTime.tryParse(json['lastLoginAt'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fullName': fullName,
      'username': username,
      'email': email,
      'role': role,
      'isActive': isActive,
      'lastLoginAt': lastLoginAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'permissions': permissions,
    };
  }

  UserModel copyWith({
    String? id,
    String? fullName,
    String? username,
    String? email,
    String? role,
    bool? isActive,
    DateTime? lastLoginAt,
    DateTime? createdAt,
    List<String>? permissions,
  }) {
    return UserModel(
      id: id ?? this.id,
      fullName: fullName ?? this.fullName,
      username: username ?? this.username,
      email: email ?? this.email,
      role: role ?? this.role,
      isActive: isActive ?? this.isActive,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      createdAt: createdAt ?? this.createdAt,
      permissions: permissions ?? this.permissions,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserModel &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          fullName == other.fullName &&
          username == other.username &&
          email == other.email &&
          role == other.role &&
          isActive == other.isActive &&
          lastLoginAt == other.lastLoginAt &&
          createdAt == other.createdAt &&
          listEquals(permissions, other.permissions);

  @override
  int get hashCode =>
      id.hashCode ^
      fullName.hashCode ^
      username.hashCode ^
      email.hashCode ^
      role.hashCode ^
      isActive.hashCode ^
      lastLoginAt.hashCode ^
      createdAt.hashCode ^
      permissions.length.hashCode;
}
