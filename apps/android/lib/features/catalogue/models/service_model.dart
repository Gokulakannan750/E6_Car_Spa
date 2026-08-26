import 'package:flutter/foundation.dart';

@immutable
class Service {
  final String id;
  final String name;
  final String? description;
  final String? category;
  final double price;
  final double taxPercentage;
  final int? durationMinutes;
  final bool isActive;
  final DateTime? createdAt;

  const Service({
    required this.id,
    required this.name,
    this.description,
    this.category,
    required this.price,
    this.taxPercentage = 18.0,
    this.durationMinutes,
    this.isActive = true,
    this.createdAt,
  });

  factory Service.fromJson(Map<String, dynamic> json) {
    return Service(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      description: json['description'] as String? ?? json['Description'] as String?,
      category: json['category'] as String? ?? json['Category'] as String?,
      price: ((json['price'] ?? json['Price'] ?? 0.0) as num).toDouble(),
      taxPercentage: ((json['taxPercentage'] ?? json['TaxPercentage'] ?? 18.0) as num).toDouble(),
      durationMinutes: json['durationMinutes'] as int? ?? json['DurationMinutes'] as int?,
      isActive: (json['isActive'] ?? json['IsActive'] ?? true) as bool,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString())
              : null),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'category': category,
      'price': price,
      'taxPercentage': taxPercentage,
      'durationMinutes': durationMinutes,
      'isActive': isActive,
      'createdAt': createdAt?.toIso8601String(),
    };
  }
}

@immutable
class ServiceListResponse {
  final List<Service> items;
  final int totalCount;
  final int page;
  final int pageSize;

  const ServiceListResponse({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
  });

  factory ServiceListResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return ServiceListResponse(
      items: rawItems.map((e) => Service.fromJson(e as Map<String, dynamic>)).toList(),
      totalCount: (json['totalCount'] ?? json['TotalCount'] ?? 0) as int,
      page: (json['page'] ?? json['Page'] ?? 1) as int,
      pageSize: (json['pageSize'] ?? json['PageSize'] ?? 50) as int,
    );
  }
}

@immutable
class CreateServiceRequest {
  final String name;
  final String? description;
  final String? category;
  final double price;
  final double taxPercentage;
  final int? durationMinutes;
  final bool isActive;

  const CreateServiceRequest({
    required this.name,
    this.description,
    this.category,
    required this.price,
    this.taxPercentage = 18.0,
    this.durationMinutes,
    this.isActive = true,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      if (description != null && description!.trim().isNotEmpty) 'description': description!.trim(),
      if (category != null && category!.trim().isNotEmpty) 'category': category!.trim(),
      'price': price,
      'taxPercentage': taxPercentage,
      if (durationMinutes != null) 'durationMinutes': durationMinutes,
      'isActive': isActive,
    };
  }
}
