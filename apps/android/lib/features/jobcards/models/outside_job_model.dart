import 'package:flutter/foundation.dart';

/// Outside Job status enum matching the backend OutsideJobStatus.
enum OutsideJobStatus {
  none(0, 'None'),
  outside(1, 'Outside'),
  returned(2, 'Returned'),
  cancelled(3, 'Cancelled');

  final int value;
  final String label;

  const OutsideJobStatus(this.value, this.label);

  static OutsideJobStatus fromValue(int value) {
    return OutsideJobStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => OutsideJobStatus.none,
    );
  }
}

@immutable
class OutsideJob {
  final String id;
  final String jobCardId;
  final String jobCardNumber;
  final String vehicleId;
  final String vehicleRegistrationNumber;
  final String vehicleMake;
  final String vehicleModel;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String vendorId;
  final String vendorName;
  final String? vendorPhone;
  final String? serviceId;
  final String serviceName;
  final OutsideJobStatus status;
  final String statusName;
  final DateTime sentAt;
  final DateTime expectedReturnAt;
  final DateTime? returnedAt;
  final bool isOverdue;
  final String? sentByUserId;
  final String? sentByUserName;
  final String? returnedByUserId;
  final String? returnedByUserName;
  final double? vendorCost;
  final String? notes;
  final String? returnNotes;
  final String? cancellationReason;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const OutsideJob({
    required this.id,
    required this.jobCardId,
    required this.jobCardNumber,
    required this.vehicleId,
    required this.vehicleRegistrationNumber,
    required this.vehicleMake,
    required this.vehicleModel,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.vendorId,
    required this.vendorName,
    this.vendorPhone,
    this.serviceId,
    required this.serviceName,
    required this.status,
    required this.statusName,
    required this.sentAt,
    required this.expectedReturnAt,
    this.returnedAt,
    required this.isOverdue,
    this.sentByUserId,
    this.sentByUserName,
    this.returnedByUserId,
    this.returnedByUserName,
    this.vendorCost,
    this.notes,
    this.returnNotes,
    this.cancellationReason,
    required this.createdAt,
    this.updatedAt,
  });

  factory OutsideJob.fromJson(Map<String, dynamic> json) {
    final statusRaw = json['status'] ?? json['Status'] ?? 0;
    final statusInt = statusRaw is int ? statusRaw : (int.tryParse(statusRaw.toString()) ?? 0);

    return OutsideJob(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      jobCardId: json['jobCardId'] as String? ?? json['JobCardId'] as String? ?? '',
      jobCardNumber: json['jobCardNumber'] as String? ?? json['JobCardNumber'] as String? ?? '',
      vehicleId: json['vehicleId'] as String? ?? json['VehicleId'] as String? ?? '',
      vehicleRegistrationNumber: json['vehicleRegistrationNumber'] as String? ?? json['VehicleRegistrationNumber'] as String? ?? '',
      vehicleMake: json['vehicleMake'] as String? ?? json['VehicleMake'] as String? ?? '',
      vehicleModel: json['vehicleModel'] as String? ?? json['VehicleModel'] as String? ?? '',
      customerId: json['customerId'] as String? ?? json['CustomerId'] as String? ?? '',
      customerName: json['customerName'] as String? ?? json['CustomerName'] as String? ?? '',
      customerPhone: json['customerPhone'] as String? ?? json['CustomerPhone'] as String? ?? '',
      vendorId: json['vendorId'] as String? ?? json['VendorId'] as String? ?? '',
      vendorName: json['vendorName'] as String? ?? json['VendorName'] as String? ?? '',
      vendorPhone: json['vendorPhone'] as String? ?? json['VendorPhone'] as String?,
      serviceId: json['serviceId'] as String? ?? json['ServiceId'] as String?,
      serviceName: json['serviceName'] as String? ?? json['ServiceName'] as String? ?? '',
      status: OutsideJobStatus.fromValue(statusInt),
      statusName: json['statusName'] as String? ?? json['StatusName'] as String? ?? '',
      sentAt: DateTime.tryParse((json['sentAt'] ?? json['SentAt'] ?? '').toString()) ?? DateTime.now(),
      expectedReturnAt: DateTime.tryParse((json['expectedReturnAt'] ?? json['ExpectedReturnAt'] ?? '').toString()) ?? DateTime.now(),
      returnedAt: json['returnedAt'] != null
          ? DateTime.tryParse(json['returnedAt'].toString())
          : (json['ReturnedAt'] != null ? DateTime.tryParse(json['ReturnedAt'].toString()) : null),
      isOverdue: json['isOverdue'] as bool? ?? json['IsOverdue'] as bool? ?? false,
      sentByUserId: json['sentByUserId'] as String? ?? json['SentByUserId'] as String?,
      sentByUserName: json['sentByUserName'] as String? ?? json['SentByUserName'] as String?,
      returnedByUserId: json['returnedByUserId'] as String? ?? json['ReturnedByUserId'] as String?,
      returnedByUserName: json['returnedByUserName'] as String? ?? json['ReturnedByUserName'] as String?,
      vendorCost: json['vendorCost'] != null
          ? ((json['vendorCost'] as num).toDouble())
          : (json['VendorCost'] != null ? ((json['VendorCost'] as num).toDouble()) : null),
      notes: json['notes'] as String? ?? json['Notes'] as String?,
      returnNotes: json['returnNotes'] as String? ?? json['ReturnNotes'] as String?,
      cancellationReason: json['cancellationReason'] as String? ?? json['CancellationReason'] as String?,
      createdAt: DateTime.tryParse((json['createdAt'] ?? json['CreatedAt'] ?? '').toString()) ?? DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : (json['UpdatedAt'] != null ? DateTime.tryParse(json['UpdatedAt'].toString()) : null),
    );
  }
}

@immutable
class VehicleLocation {
  final String location;
  final bool isOutside;
  final String? activeOutsideJobId;
  final String? vendorId;
  final String? vendorName;
  final String? serviceName;
  final DateTime? sentAt;
  final DateTime? expectedReturnAt;
  final bool isOverdue;

  const VehicleLocation({
    required this.location,
    required this.isOutside,
    this.activeOutsideJobId,
    this.vendorId,
    this.vendorName,
    this.serviceName,
    this.sentAt,
    this.expectedReturnAt,
    required this.isOverdue,
  });

  factory VehicleLocation.fromJson(Map<String, dynamic> json) {
    return VehicleLocation(
      location: json['location'] as String? ?? json['Location'] as String? ?? 'Showroom',
      isOutside: json['isOutside'] as bool? ?? json['IsOutside'] as bool? ?? false,
      activeOutsideJobId: json['activeOutsideJobId'] as String? ?? json['ActiveOutsideJobId'] as String?,
      vendorId: json['vendorId'] as String? ?? json['VendorId'] as String?,
      vendorName: json['vendorName'] as String? ?? json['VendorName'] as String?,
      serviceName: json['serviceName'] as String? ?? json['ServiceName'] as String?,
      sentAt: json['sentAt'] != null
          ? DateTime.tryParse(json['sentAt'].toString())
          : (json['SentAt'] != null ? DateTime.tryParse(json['SentAt'].toString()) : null),
      expectedReturnAt: json['expectedReturnAt'] != null
          ? DateTime.tryParse(json['expectedReturnAt'].toString())
          : (json['ExpectedReturnAt'] != null ? DateTime.tryParse(json['ExpectedReturnAt'].toString()) : null),
      isOverdue: json['isOverdue'] as bool? ?? json['IsOverdue'] as bool? ?? false,
    );
  }
}

@immutable
class Vendor {
  final String id;
  final String name;
  final String? phone;
  final String? contactPerson;
  final String? address;
  final String? serviceSpecialty;
  final bool isActive;

  const Vendor({
    required this.id,
    required this.name,
    this.phone,
    this.contactPerson,
    this.address,
    this.serviceSpecialty,
    this.isActive = true,
  });

  factory Vendor.fromJson(Map<String, dynamic> json) {
    return Vendor(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      phone: json['phone'] as String? ?? json['Phone'] as String?,
      contactPerson: json['contactPerson'] as String? ?? json['ContactPerson'] as String?,
      address: json['address'] as String? ?? json['Address'] as String?,
      serviceSpecialty: json['serviceSpecialty'] as String? ?? json['ServiceSpecialty'] as String?,
      isActive: json['isActive'] as bool? ?? json['IsActive'] as bool? ?? true,
    );
  }
}

// ── Request DTOs ────────────────────────────────────────────────────────────

@immutable
class CreateOutsideJobRequest {
  final String vendorId;
  final String serviceName;
  final String? serviceId;
  final DateTime? sentAt;
  final DateTime? expectedReturnAt;
  final String? sentByType;
  final String? sentByStaffId;
  final String? sentByStaffName;
  final double? vendorCost;
  final String? notes;

  const CreateOutsideJobRequest({
    required this.vendorId,
    required this.serviceName,
    this.serviceId,
    this.sentAt,
    this.expectedReturnAt,
    this.sentByType,
    this.sentByStaffId,
    this.sentByStaffName,
    this.vendorCost,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
    'vendorId': vendorId,
    'serviceName': serviceName,
    if (serviceId != null) 'serviceId': serviceId,
    if (sentAt != null) 'sentAt': sentAt!.toUtc().toIso8601String(),
    if (expectedReturnAt != null) 'expectedReturnAt': expectedReturnAt!.toUtc().toIso8601String(),
    if (sentByType != null) 'sentByType': sentByType,
    if (sentByStaffId != null) 'sentByStaffId': sentByStaffId,
    if (sentByStaffName != null) 'sentByStaffName': sentByStaffName,
    if (vendorCost != null) 'vendorCost': vendorCost,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
  };
}

@immutable
class MarkOutsideJobReturnedRequest {
  final DateTime? returnedAt;
  final double? vendorCost;
  final String? returnNotes;

  const MarkOutsideJobReturnedRequest({
    this.returnedAt,
    this.vendorCost,
    this.returnNotes,
  });

  Map<String, dynamic> toJson() => {
    if (returnedAt != null) 'returnedAt': returnedAt!.toUtc().toIso8601String(),
    if (vendorCost != null) 'vendorCost': vendorCost,
    if (returnNotes != null && returnNotes!.trim().isNotEmpty) 'returnNotes': returnNotes!.trim(),
  };
}

@immutable
class CancelOutsideJobRequest {
  final String reason;

  const CancelOutsideJobRequest({required this.reason});

  Map<String, dynamic> toJson() => {
    'reason': reason.trim(),
  };
}

@immutable
class CreateVendorRequest {
  final String name;
  final String? phone;
  final String? contactPerson;
  final String? address;
  final String? serviceSpecialty;

  const CreateVendorRequest({
    required this.name,
    this.phone,
    this.contactPerson,
    this.address,
    this.serviceSpecialty,
  });

  Map<String, dynamic> toJson() => {
    'name': name.trim(),
    if (phone != null && phone!.trim().isNotEmpty) 'phone': phone!.trim(),
    if (contactPerson != null && contactPerson!.trim().isNotEmpty) 'contactPerson': contactPerson!.trim(),
    if (address != null && address!.trim().isNotEmpty) 'address': address!.trim(),
    if (serviceSpecialty != null && serviceSpecialty!.trim().isNotEmpty) 'serviceSpecialty': serviceSpecialty!.trim(),
  };
}
