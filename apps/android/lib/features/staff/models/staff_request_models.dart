import 'package:flutter/foundation.dart';

@immutable
class CreateStaffRequest {
  final String name;
  final String phoneNumber;
  final String? email;
  final String? address;
  final String? role;
  final bool isActive;
  final String aadhaarNumber;

  const CreateStaffRequest({
    required this.name,
    required this.phoneNumber,
    this.email,
    this.address,
    this.role,
    this.isActive = true,
    required this.aadhaarNumber,
  });

  Map<String, dynamic> toJson() => {
    'name': name.trim(),
    'phoneNumber': phoneNumber.trim(),
    if (email != null && email!.trim().isNotEmpty) 'email': email!.trim(),
    if (address != null && address!.trim().isNotEmpty) 'address': address!.trim(),
    if (role != null && role!.trim().isNotEmpty) 'role': role!.trim(),
    'isActive': isActive,
    'aadhaarNumber': aadhaarNumber.trim().replaceAll(RegExp(r'[\s-]'), ''),
  };
}

@immutable
class UpdateStaffRequest {
  final String? name;
  final String? phoneNumber;
  final String? email;
  final String? address;
  final String? role;
  final bool? isActive;
  final String? aadhaarNumber;
  final bool? removeAadhaarDocument;

  const UpdateStaffRequest({
    this.name,
    this.phoneNumber,
    this.email,
    this.address,
    this.role,
    this.isActive,
    this.aadhaarNumber,
    this.removeAadhaarDocument,
  });

  Map<String, dynamic> toJson() => {
    if (name != null && name!.trim().isNotEmpty) 'name': name!.trim(),
    if (phoneNumber != null && phoneNumber!.trim().isNotEmpty) 'phoneNumber': phoneNumber!.trim(),
    if (email != null && email!.trim().isNotEmpty) 'email': email!.trim(),
    if (address != null && address!.trim().isNotEmpty) 'address': address!.trim(),
    if (role != null && role!.trim().isNotEmpty) 'role': role!.trim(),
    if (isActive != null) 'isActive': isActive,
    if (aadhaarNumber != null && aadhaarNumber!.trim().isNotEmpty)
      'aadhaarNumber': aadhaarNumber!.trim().replaceAll(RegExp(r'[\s-]'), ''),
    if (removeAadhaarDocument != null) 'removeAadhaarDocument': removeAadhaarDocument,
  };
}
