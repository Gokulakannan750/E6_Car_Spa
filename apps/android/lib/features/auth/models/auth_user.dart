class AuthUser {
  final String id;
  final String fullName;
  final String username;
  final String? email;
  final String role;
  final bool isOwner;
  final List<String> permissions;

  const AuthUser({
    required this.id,
    required this.fullName,
    required this.username,
    this.email,
    required this.role,
    required this.isOwner,
    this.permissions = const [],
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName'] as String? ?? '',
      username: json['username'] as String? ?? '',
      email: json['email'] as String?,
      role: json['role'] as String? ?? '',
      isOwner: json['isOwner'] as bool? ?? false,
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
      'isOwner': isOwner,
      'permissions': permissions,
    };
  }

  bool hasPermission(String permissionCode) {
    if (isOwner || role.toLowerCase() == 'owner') return true;
    return permissions.contains(permissionCode);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthUser &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          username == other.username &&
          role == other.role &&
          isOwner == other.isOwner;

  @override
  int get hashCode =>
      id.hashCode ^ username.hashCode ^ role.hashCode ^ isOwner.hashCode;
}
