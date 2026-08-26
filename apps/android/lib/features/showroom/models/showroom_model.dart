import 'package:flutter/foundation.dart';

@immutable
class Showroom {
  final String id;
  final String name;
  final String address;
  final String? phone;
  final bool isActive;
  final int activeStaffCountToday;
  final int totalVehiclesToday;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const Showroom({
    required this.id,
    required this.name,
    required this.address,
    this.phone,
    this.isActive = true,
    this.activeStaffCountToday = 0,
    this.totalVehiclesToday = 0,
    required this.createdAt,
    this.updatedAt,
  });

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'SR';
    if (parts.length == 1) {
      return parts.first.length >= 2
          ? parts.first.substring(0, 2).toUpperCase()
          : parts.first.toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  factory Showroom.fromJson(Map<String, dynamic> json) {
    return Showroom(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      address: json['address'] as String? ?? json['Address'] as String? ?? '',
      phone: json['phone'] as String? ?? json['Phone'] as String?,
      isActive: (json['isActive'] ?? json['IsActive'] ?? true) as bool,
      activeStaffCountToday: (json['activeStaffCountToday'] ?? json['ActiveStaffCountToday'] ?? 0) as int,
      totalVehiclesToday: (json['totalVehiclesToday'] ?? json['TotalVehiclesToday'] ?? 0) as int,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : (json['UpdatedAt'] != null ? DateTime.tryParse(json['UpdatedAt'].toString()) : null),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'address': address,
    'phone': phone,
    'isActive': isActive,
    'activeStaffCountToday': activeStaffCountToday,
    'totalVehiclesToday': totalVehiclesToday,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt?.toIso8601String(),
  };

  Showroom copyWith({
    String? id,
    String? name,
    String? address,
    String? phone,
    bool? isActive,
    int? activeStaffCountToday,
    int? totalVehiclesToday,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Showroom(
      id: id ?? this.id,
      name: name ?? this.name,
      address: address ?? this.address,
      phone: phone ?? this.phone,
      isActive: isActive ?? this.isActive,
      activeStaffCountToday: activeStaffCountToday ?? this.activeStaffCountToday,
      totalVehiclesToday: totalVehiclesToday ?? this.totalVehiclesToday,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

@immutable
class CreateShowroomRequest {
  final String name;
  final String address;
  final String? phone;
  final bool isActive;

  const CreateShowroomRequest({
    required this.name,
    required this.address,
    this.phone,
    this.isActive = true,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'address': address,
    if (phone != null && phone!.isNotEmpty) 'phone': phone,
    'isActive': isActive,
  };
}

@immutable
class UpdateShowroomRequest {
  final String? name;
  final String? address;
  final String? phone;
  final bool? isActive;

  const UpdateShowroomRequest({
    this.name,
    this.address,
    this.phone,
    this.isActive,
  });

  Map<String, dynamic> toJson() => {
    if (name != null) 'name': name,
    if (address != null) 'address': address,
    if (phone != null) 'phone': phone,
    if (isActive != null) 'isActive': isActive,
  };
}
