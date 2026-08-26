import 'package:flutter/foundation.dart';

@immutable
class Customer {
  final String id;
  final String name;
  final String phoneNumber;
  final String? email;
  final String? address;
  final DateTime? createdAt;
  final int vehicleCount;
  final int jobCardCount;
  final double totalRevenue;

  const Customer({
    required this.id,
    required this.name,
    required this.phoneNumber,
    this.email,
    this.address,
    this.createdAt,
    this.vehicleCount = 0,
    this.jobCardCount = 0,
    this.totalRevenue = 0.0,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? json['PhoneNumber'] as String? ?? '',
      email: json['email'] as String? ?? json['Email'] as String?,
      address: json['address'] as String? ?? json['Address'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
      vehicleCount: (json['vehicleCount'] ?? json['VehicleCount'] ?? 0) as int,
      jobCardCount: (json['jobCardCount'] ?? json['JobCardCount'] ?? 0) as int,
      totalRevenue: ((json['totalRevenue'] ?? json['TotalRevenue'] ?? 0.0) as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phoneNumber': phoneNumber,
      'email': email,
      'address': address,
      'createdAt': createdAt?.toIso8601String(),
      'vehicleCount': vehicleCount,
      'jobCardCount': jobCardCount,
      'totalRevenue': totalRevenue,
    };
  }

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts[0].isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }
}

@immutable
class CustomerListResponse {
  final List<Customer> items;
  final int totalCount;
  final int page;
  final int pageSize;

  const CustomerListResponse({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
  });

  factory CustomerListResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return CustomerListResponse(
      items: rawItems.map((e) => Customer.fromJson(e as Map<String, dynamic>)).toList(),
      totalCount: (json['totalCount'] ?? json['TotalCount'] ?? 0) as int,
      page: (json['page'] ?? json['Page'] ?? 1) as int,
      pageSize: (json['pageSize'] ?? json['PageSize'] ?? 20) as int,
    );
  }
}

@immutable
class CreateCustomerRequest {
  final String name;
  final String phoneNumber;
  final String? email;
  final String? address;

  const CreateCustomerRequest({
    required this.name,
    required this.phoneNumber,
    this.email,
    this.address,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name.trim(),
      'phoneNumber': phoneNumber.trim(),
      if (email != null && email!.trim().isNotEmpty) 'email': email!.trim(),
      if (address != null && address!.trim().isNotEmpty) 'address': address!.trim(),
    };
  }
}

@immutable
class UpdateCustomerRequest {
  final String name;
  final String phoneNumber;
  final String? email;
  final String? address;

  const UpdateCustomerRequest({
    required this.name,
    required this.phoneNumber,
    this.email,
    this.address,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name.trim(),
      'phoneNumber': phoneNumber.trim(),
      if (email != null && email!.trim().isNotEmpty) 'email': email!.trim(),
      if (address != null && address!.trim().isNotEmpty) 'address': address!.trim(),
    };
  }
}

@immutable
class CustomerJobCardHistoryItem {
  final String jobCardId;
  final String jobCardNumber;
  final DateTime createdAt;
  final String status;
  final String? vehicleNumber;
  final String? vehicleModel;
  final double subtotal;
  final double taxAmount;
  final double discountAmount;
  final double totalAmount;

  const CustomerJobCardHistoryItem({
    required this.jobCardId,
    required this.jobCardNumber,
    required this.createdAt,
    required this.status,
    this.vehicleNumber,
    this.vehicleModel,
    this.subtotal = 0.0,
    this.taxAmount = 0.0,
    this.discountAmount = 0.0,
    this.totalAmount = 0.0,
  });

  factory CustomerJobCardHistoryItem.fromJson(Map<String, dynamic> json) {
    return CustomerJobCardHistoryItem(
      jobCardId: json['jobCardId'] as String? ?? json['JobCardId'] as String? ?? '',
      jobCardNumber: json['jobCardNumber'] as String? ?? json['JobCardNumber'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
      status: json['status'] as String? ?? json['Status'] as String? ?? '',
      vehicleNumber: json['vehicleNumber'] as String? ?? json['VehicleNumber'] as String?,
      vehicleModel: json['vehicleModel'] as String? ?? json['VehicleModel'] as String?,
      subtotal: ((json['subtotal'] ?? json['Subtotal'] ?? 0.0) as num).toDouble(),
      taxAmount: ((json['taxAmount'] ?? json['TaxAmount'] ?? 0.0) as num).toDouble(),
      discountAmount: ((json['discountAmount'] ?? json['DiscountAmount'] ?? 0.0) as num).toDouble(),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
    );
  }
}

@immutable
class CustomerHistoryResponse {
  final String customerId;
  final String customerName;
  final String phoneNumber;
  final int totalJobCards;
  final int totalVehicles;
  final List<CustomerJobCardHistoryItem> jobCards;

  const CustomerHistoryResponse({
    required this.customerId,
    required this.customerName,
    required this.phoneNumber,
    this.totalJobCards = 0,
    this.totalVehicles = 0,
    this.jobCards = const [],
  });

  factory CustomerHistoryResponse.fromJson(Map<String, dynamic> json) {
    final rawJcs = json['jobCards'] as List<dynamic>? ?? json['JobCards'] as List<dynamic>? ?? [];
    return CustomerHistoryResponse(
      customerId: json['customerId'] as String? ?? json['CustomerId'] as String? ?? '',
      customerName: json['customerName'] as String? ?? json['CustomerName'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? json['PhoneNumber'] as String? ?? '',
      totalJobCards: (json['totalJobCards'] ?? json['TotalJobCards'] ?? 0) as int,
      totalVehicles: (json['totalVehicles'] ?? json['TotalVehicles'] ?? 0) as int,
      jobCards: rawJcs.map((e) => CustomerJobCardHistoryItem.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
