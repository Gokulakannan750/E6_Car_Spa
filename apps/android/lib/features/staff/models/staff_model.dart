import 'package:flutter/foundation.dart';

@immutable
class Staff {
  final String id;
  final String name;
  final String phoneNumber;
  final String? email;
  final String? address;
  final String? role;
  final bool isActive;
  final int totalAdvances;
  final double totalAdvanceAmount;
  final String? aadhaarMasked;
  final bool hasAadhaarDocument;
  final String? aadhaarDocumentFileName;
  final String? aadhaarDocumentContentType;
  final int? aadhaarDocumentSize;

  const Staff({
    required this.id,
    required this.name,
    required this.phoneNumber,
    this.email,
    this.address,
    this.role,
    this.isActive = true,
    this.totalAdvances = 0,
    this.totalAdvanceAmount = 0.0,
    this.aadhaarMasked,
    this.hasAadhaarDocument = false,
    this.aadhaarDocumentFileName,
    this.aadhaarDocumentContentType,
    this.aadhaarDocumentSize,
  });

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'S';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  factory Staff.fromJson(Map<String, dynamic> json) {
    return Staff(
      id: json['id'] as String? ?? json['Id'] as String? ?? '',
      name: json['name'] as String? ?? json['Name'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? json['PhoneNumber'] as String? ?? '',
      email: json['email'] as String? ?? json['Email'] as String?,
      address: json['address'] as String? ?? json['Address'] as String?,
      role: json['role'] as String? ?? json['Role'] as String?,
      isActive: (json['isActive'] ?? json['IsActive'] ?? true) as bool,
      totalAdvances: (json['totalAdvances'] ?? json['TotalAdvances'] ?? 0) as int,
      totalAdvanceAmount: ((json['totalAdvanceAmount'] ?? json['TotalAdvanceAmount'] ?? 0.0) as num).toDouble(),
      aadhaarMasked: json['aadhaarMasked'] as String? ?? json['AadhaarMasked'] as String?,
      hasAadhaarDocument: (json['hasAadhaarDocument'] ?? json['HasAadhaarDocument'] ?? false) as bool,
      aadhaarDocumentFileName: json['aadhaarDocumentFileName'] as String? ?? json['AadhaarDocumentFileName'] as String?,
      aadhaarDocumentContentType: json['aadhaarDocumentContentType'] as String? ?? json['AadhaarDocumentContentType'] as String?,
      aadhaarDocumentSize: json['aadhaarDocumentSize'] as int? ?? json['AadhaarDocumentSize'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'phoneNumber': phoneNumber,
    'email': email,
    'address': address,
    'role': role,
    'isActive': isActive,
    'totalAdvances': totalAdvances,
    'totalAdvanceAmount': totalAdvanceAmount,
    'aadhaarMasked': aadhaarMasked,
    'hasAadhaarDocument': hasAadhaarDocument,
    'aadhaarDocumentFileName': aadhaarDocumentFileName,
    'aadhaarDocumentContentType': aadhaarDocumentContentType,
    'aadhaarDocumentSize': aadhaarDocumentSize,
  };
}
