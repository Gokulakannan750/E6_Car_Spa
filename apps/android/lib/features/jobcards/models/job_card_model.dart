import 'package:flutter/foundation.dart';

enum JobCardStatus {
  draft(0, 'Draft'),
  inProgress(1, 'In Progress'),
  qualityCheck(2, 'Quality Check'),
  ready(3, 'Ready'),
  invoiced(4, 'Invoiced'),
  paid(5, 'Paid'),
  delivered(6, 'Delivered'),
  cancelled(7, 'Cancelled');

  final int value;
  final String label;

  const JobCardStatus(this.value, this.label);

  static JobCardStatus fromValue(int value) {
    return JobCardStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => JobCardStatus.draft,
    );
  }

  static JobCardStatus fromInt(int value) => fromValue(value);

  static JobCardStatus fromString(String name) {
    final clean = name.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
    for (final s in JobCardStatus.values) {
      final sClean = s.name.toLowerCase();
      if (sClean == clean || s.label.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '') == clean) {
        return s;
      }
    }
    return JobCardStatus.draft;
  }
}

@immutable
class CustomerSummary {
  final String id;
  final String name;
  final String phoneNumber;

  const CustomerSummary({
    required this.id,
    required this.name,
    required this.phoneNumber,
  });

  factory CustomerSummary.fromJson(Map<String, dynamic> json) {
    return CustomerSummary(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? json['PhoneNumber'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'phoneNumber': phoneNumber,
  };
}

@immutable
class VehicleSummary {
  final String id;
  final String registrationNumber;
  final String make;
  final String model;
  final String? variant;
  final String? color;

  const VehicleSummary({
    required this.id,
    required this.registrationNumber,
    required this.make,
    required this.model,
    this.variant,
    this.color,
  });

  factory VehicleSummary.fromJson(Map<String, dynamic> json) {
    return VehicleSummary(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String? ?? json['RegistrationNumber'] as String? ?? '',
      make: json['make'] as String? ?? json['Make'] as String? ?? '',
      model: json['model'] as String? ?? json['Model'] as String? ?? '',
      variant: json['variant'] as String? ?? json['Variant'] as String?,
      color: json['color'] as String? ?? json['Color'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'registrationNumber': registrationNumber,
    'make': make,
    'model': model,
    'variant': variant,
    'color': color,
  };

  String get displayName {
    final buffer = StringBuffer('$make $model');
    if (variant != null && variant!.trim().isNotEmpty) {
      buffer.write(' ($variant)');
    }
    return buffer.toString();
  }
}

@immutable
class JobCardServiceItem {
  final String id;
  final String serviceId;
  final String serviceName;
  final double unitPrice;
  final int quantity;
  final double taxPercentage;
  final double discountAmount;
  final double lineTotal;

  const JobCardServiceItem({
    required this.id,
    required this.serviceId,
    required this.serviceName,
    required this.unitPrice,
    required this.quantity,
    required this.taxPercentage,
    this.discountAmount = 0.0,
    required this.lineTotal,
  });

  factory JobCardServiceItem.fromJson(Map<String, dynamic> json) {
    return JobCardServiceItem(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      serviceId: json['serviceId'] as String? ?? json['ServiceId'] as String? ?? '',
      serviceName: json['serviceName'] as String? ?? json['ServiceName'] as String? ?? '',
      unitPrice: ((json['unitPrice'] ?? json['UnitPrice'] ?? 0.0) as num).toDouble(),
      quantity: (json['quantity'] ?? json['Quantity'] ?? 1) as int,
      taxPercentage: ((json['taxPercentage'] ?? json['TaxPercentage'] ?? 0.0) as num).toDouble(),
      discountAmount: ((json['discountAmount'] ?? json['DiscountAmount'] ?? 0.0) as num).toDouble(),
      lineTotal: ((json['lineTotal'] ?? json['LineTotal'] ?? 0.0) as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'serviceId': serviceId,
    'serviceName': serviceName,
    'unitPrice': unitPrice,
    'quantity': quantity,
    'taxPercentage': taxPercentage,
    'discountAmount': discountAmount,
    'lineTotal': lineTotal,
  };
}

@immutable
class JobCard {
  final String id;
  final String jobCardNumber;
  final CustomerSummary customer;
  final VehicleSummary vehicle;
  final JobCardStatus status;
  final String? notes;
  final List<JobCardServiceItem> services;
  final double subtotal;
  final double taxAmount;
  final double discountAmount;
  final double totalAmount;
  final String? invoiceId;
  final String? invoiceNumber;
  final String? invoiceStatus;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const JobCard({
    required this.id,
    required this.jobCardNumber,
    required this.customer,
    required this.vehicle,
    required this.status,
    this.notes,
    required this.services,
    required this.subtotal,
    this.taxAmount = 0.0,
    this.discountAmount = 0.0,
    required this.totalAmount,
    this.invoiceId,
    this.invoiceNumber,
    this.invoiceStatus,
    this.createdAt,
    this.updatedAt,
  });

  factory JobCard.fromJson(Map<String, dynamic> json) {
    final rawServices = json['services'] as List<dynamic>? ?? json['Services'] as List<dynamic>? ?? [];
    final statusRaw = json['status'] ?? json['Status'] ?? 0;
    final statusInt = statusRaw is int ? statusRaw : (int.tryParse(statusRaw.toString()) ?? 0);

    return JobCard(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      jobCardNumber: json['jobCardNumber'] as String? ?? json['JobCardNumber'] as String? ?? '',
      customer: CustomerSummary.fromJson((json['customer'] ?? json['Customer'] ?? {}) as Map<String, dynamic>),
      vehicle: VehicleSummary.fromJson((json['vehicle'] ?? json['Vehicle'] ?? {}) as Map<String, dynamic>),
      status: JobCardStatus.fromValue(statusInt),
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      services: rawServices.map((e) => JobCardServiceItem.fromJson(e as Map<String, dynamic>)).toList(),
      subtotal: ((json['subtotal'] ?? json['Subtotal'] ?? 0.0) as num).toDouble(),
      taxAmount: ((json['taxAmount'] ?? json['TaxAmount'] ?? 0.0) as num).toDouble(),
      discountAmount: ((json['discountAmount'] ?? json['DiscountAmount'] ?? 0.0) as num).toDouble(),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
      invoiceId: json['invoiceId'] as String? ?? json['InvoiceId'] as String?,
      invoiceNumber: json['invoiceNumber'] as String? ?? json['InvoiceNumber'] as String?,
      invoiceStatus: json['invoiceStatus'] as String? ?? json['InvoiceStatus'] as String?,
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
}

@immutable
class JobCardListItem {
  final String id;
  final String jobCardNumber;
  final String customerName;
  final String customerPhone;
  final String registrationNumber;
  final String make;
  final String model;
  final String? _vehicleDisplayName;
  final JobCardStatus status;
  final double totalAmount;
  final String? invoiceId;
  final String? invoiceNumber;
  final String? invoiceStatus;
  final DateTime? createdAt;

  const JobCardListItem({
    required this.id,
    required this.jobCardNumber,
    required this.customerName,
    required this.customerPhone,
    required this.registrationNumber,
    this.make = '',
    this.model = '',
    String? vehicleDisplayName,
    required this.status,
    required this.totalAmount,
    this.invoiceId,
    this.invoiceNumber,
    this.invoiceStatus,
    this.createdAt,
  }) : _vehicleDisplayName = vehicleDisplayName;

  String get vehicleDisplayName =>
      _vehicleDisplayName ??
      ('$make $model'.trim().isNotEmpty ? '$make $model'.trim() : 'Vehicle');

  factory JobCardListItem.fromJson(Map<String, dynamic> json) {
    final statusRaw = json['status'] ?? json['Status'] ?? 0;
    final statusInt = statusRaw is int ? statusRaw : (int.tryParse(statusRaw.toString()) ?? 0);

    return JobCardListItem(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      jobCardNumber: json['jobCardNumber'] as String? ?? json['JobCardNumber'] as String? ?? '',
      customerName: json['customerName'] as String? ?? json['CustomerName'] as String? ?? '',
      customerPhone: json['customerPhone'] as String? ?? json['CustomerPhone'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String? ?? json['RegistrationNumber'] as String? ?? '',
      make: json['make'] as String? ?? json['Make'] as String? ?? '',
      model: json['model'] as String? ?? json['Model'] as String? ?? '',
      vehicleDisplayName: json['vehicleDisplayName'] as String? ?? json['VehicleDisplayName'] as String?,
      status: JobCardStatus.fromValue(statusInt),
      totalAmount: ((json['totalAmount'] ?? json['TotalAmount'] ?? 0.0) as num).toDouble(),
      invoiceId: json['invoiceId'] as String? ?? json['InvoiceId'] as String?,
      invoiceNumber: json['invoiceNumber'] as String? ?? json['InvoiceNumber'] as String?,
      invoiceStatus: json['invoiceStatus'] as String? ?? json['InvoiceStatus'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : (json['CreatedAt'] != null
              ? DateTime.tryParse(json['CreatedAt'].toString()) ?? DateTime.now()
              : DateTime.now()),
    );
  }
}

@immutable
class JobCardListResponse {
  final List<JobCardListItem> items;
  final int totalCount;
  final int page;
  final int pageSize;

  const JobCardListResponse({
    required this.items,
    required this.totalCount,
    required this.page,
    required this.pageSize,
  });

  factory JobCardListResponse.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? json['Items'] as List<dynamic>? ?? [];
    return JobCardListResponse(
      items: rawItems.map((e) => JobCardListItem.fromJson(e as Map<String, dynamic>)).toList(),
      totalCount: (json['totalCount'] ?? json['TotalCount'] ?? 0) as int,
      page: (json['page'] ?? json['Page'] ?? 1) as int,
      pageSize: (json['pageSize'] ?? json['PageSize'] ?? 20) as int,
    );
  }
}

@immutable
class JobCardServiceItemRequest {
  final String serviceId;
  final int quantity;
  final double discountAmount;

  const JobCardServiceItemRequest({
    required this.serviceId,
    this.quantity = 1,
    this.discountAmount = 0.0,
  });

  Map<String, dynamic> toJson() => {
    'serviceId': serviceId,
    'quantity': quantity,
    'discountAmount': discountAmount,
  };
}

@immutable
class CreateJobCardRequest {
  final String customerId;
  final String vehicleId;
  final String? notes;
  final List<JobCardServiceItemRequest> services;
  final bool isGstEnabled;

  const CreateJobCardRequest({
    required this.customerId,
    required this.vehicleId,
    this.notes,
    required this.services,
    this.isGstEnabled = true,
  });

  Map<String, dynamic> toJson() => {
    'customerId': customerId,
    'vehicleId': vehicleId,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
    'services': services.map((s) => s.toJson()).toList(),
    'isGstEnabled': isGstEnabled,
  };
}

@immutable
class UpdateJobCardServicesRequest {
  final List<JobCardServiceItemRequest> services;
  final String? notes;

  const UpdateJobCardServicesRequest({
    required this.services,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
    'services': services.map((s) => s.toJson()).toList(),
    if (notes != null) 'notes': notes!.trim(),
  };
}
