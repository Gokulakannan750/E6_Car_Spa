class UpdateBusinessProfileRequest {
  final String businessName;
  final String addressLine1;
  final String? addressLine2;
  final String city;
  final String state;
  final String postalCode;
  final String phone;
  final String email;
  final String? gstin;
  final String? logoPath;
  final String? invoicePrefix;
  final String? termsAndConditions;

  const UpdateBusinessProfileRequest({
    required this.businessName,
    required this.addressLine1,
    this.addressLine2,
    required this.city,
    required this.state,
    required this.postalCode,
    required this.phone,
    required this.email,
    this.gstin,
    this.logoPath,
    this.invoicePrefix,
    this.termsAndConditions,
  });

  Map<String, dynamic> toJson() {
    return {
      'businessName': businessName.trim(),
      'addressLine1': addressLine1.trim(),
      'addressLine2':
          addressLine2 == null || addressLine2!.trim().isEmpty
              ? null
              : addressLine2!.trim(),
      'city': city.trim(),
      'state': state.trim(),
      'postalCode': postalCode.trim(),
      'phone': phone.trim(),
      'email': email.trim().toLowerCase(),
      'gstin':
          gstin == null || gstin!.trim().isEmpty ? null : gstin!.trim().toUpperCase(),
      'logoPath': logoPath,
      'invoicePrefix':
          invoicePrefix == null || invoicePrefix!.trim().isEmpty
              ? 'INV'
              : invoicePrefix!.trim().toUpperCase(),
      'termsAndConditions':
          termsAndConditions == null || termsAndConditions!.trim().isEmpty
              ? null
              : termsAndConditions!.trim(),
    };
  }
}
