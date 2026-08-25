import 'package:flutter/foundation.dart';

@immutable
class Vehicle {
  final String id;
  final String registrationNumber;
  final String make;
  final String model;
  final String? variant;
  final String? color;
  final String customerId;
  final String? customerName;
  final DateTime? createdAt;

  const Vehicle({
    required this.id,
    required this.registrationNumber,
    required this.make,
    required this.model,
    this.variant,
    this.color,
    required this.customerId,
    this.customerName,
    this.createdAt,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String? ?? json['RegistrationNumber'] as String? ?? '',
      make: json['make'] as String? ?? json['Make'] as String? ?? '',
      model: json['model'] as String? ?? json['Model'] as String? ?? '',
      variant: json['variant'] as String? ?? json['Variant'] as String?,
      color: json['color'] as String? ?? json['Color'] as String?,
      customerId: json['customerId'] as String? ?? json['CustomerId'] as String? ?? '',
      customerName: json['customerName'] as String? ?? json['CustomerName'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'registrationNumber': registrationNumber,
      'make': make,
      'model': model,
      'variant': variant,
      'color': color,
      'customerId': customerId,
      'customerName': customerName,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  String get displayName {
    final buffer = StringBuffer('$make $model');
    if (variant != null && variant!.trim().isNotEmpty) {
      buffer.write(' ($variant)');
    }
    return buffer.toString();
  }
}

@immutable
class CreateVehicleRequest {
  final String registrationNumber;
  final String make;
  final String model;
  final String? variant;
  final String? color;
  final String customerId;

  const CreateVehicleRequest({
    required this.registrationNumber,
    required this.make,
    required this.model,
    this.variant,
    this.color,
    required this.customerId,
  });

  Map<String, dynamic> toJson() {
    return {
      'registrationNumber': registrationNumber.trim().toUpperCase(),
      'make': make.trim(),
      'model': model.trim(),
      if (variant != null && variant!.trim().isNotEmpty) 'variant': variant!.trim(),
      if (color != null && color!.trim().isNotEmpty) 'color': color!.trim(),
      'customerId': customerId,
    };
  }
}

@immutable
class UpdateVehicleRequest {
  final String registrationNumber;
  final String make;
  final String model;
  final String? variant;
  final String? color;

  const UpdateVehicleRequest({
    required this.registrationNumber,
    required this.make,
    required this.model,
    this.variant,
    this.color,
  });

  Map<String, dynamic> toJson() {
    return {
      'registrationNumber': registrationNumber.trim().toUpperCase(),
      'make': make.trim(),
      'model': model.trim(),
      if (variant != null && variant!.trim().isNotEmpty) 'variant': variant!.trim(),
      if (color != null && color!.trim().isNotEmpty) 'color': color!.trim(),
    };
  }
}

@immutable
class VehicleListResponse {
  final List<Vehicle> items;
  final int totalCount;
  final int page;
  final int pageSize;

  const VehicleListResponse({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
  });

  factory VehicleListResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return VehicleListResponse(
      items: rawItems.map((e) => Vehicle.fromJson(e as Map<String, dynamic>)).toList(),
      totalCount: (json['totalCount'] ?? json['TotalCount'] ?? 0) as int,
      page: (json['page'] ?? json['Page'] ?? 1) as int,
      pageSize: (json['pageSize'] ?? json['PageSize'] ?? 20) as int,
    );
  }
}
