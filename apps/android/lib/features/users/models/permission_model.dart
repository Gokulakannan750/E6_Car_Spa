import 'package:flutter/foundation.dart';

@immutable
class PermissionModel {
  final String id;
  final String code;
  final String name;
  final String module;
  final String? description;

  const PermissionModel({
    required this.id,
    required this.code,
    required this.name,
    required this.module,
    this.description,
  });

  factory PermissionModel.fromJson(Map<String, dynamic> json) {
    return PermissionModel(
      id: json['id']?.toString() ?? '',
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      module: json['module'] as String? ?? '',
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'code': code,
      'name': name,
      'module': module,
      'description': description,
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PermissionModel &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          code == other.code &&
          name == other.name &&
          module == other.module;

  @override
  int get hashCode =>
      id.hashCode ^ code.hashCode ^ name.hashCode ^ module.hashCode;
}

@immutable
class PermissionGroupModel {
  final String module;
  final List<PermissionModel> permissions;

  const PermissionGroupModel({
    required this.module,
    required this.permissions,
  });

  factory PermissionGroupModel.fromJson(Map<String, dynamic> json) {
    return PermissionGroupModel(
      module: json['module'] as String? ?? '',
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) =>
                  PermissionModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'module': module,
      'permissions': permissions.map((e) => e.toJson()).toList(),
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PermissionGroupModel &&
          runtimeType == other.runtimeType &&
          module == other.module &&
          listEquals(permissions, other.permissions);

  @override
  int get hashCode => module.hashCode ^ permissions.length.hashCode;
}
