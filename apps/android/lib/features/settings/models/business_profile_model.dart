const Object _keep = Object();

class BusinessProfileModel {
  final String id;
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
  final String invoicePrefix;
  final String? termsAndConditions;
  final String? tagline;
  final String? brandColor;

  /// Accent colour of the app itself (#RRGGBB); null means the neutral default.
  final String? appColor;

  /// Colour of the login page and dark surfaces (#RRGGBB); null means the neutral default.
  final String? sidebarColor;

  /// The company's own picture for the login page (server-relative URL); null when none is uploaded.
  final String? loginImagePath;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const BusinessProfileModel({
    required this.id,
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
    this.invoicePrefix = 'INV',
    this.termsAndConditions,
    this.tagline,
    this.brandColor,
    this.appColor,
    this.sidebarColor,
    this.loginImagePath,
    this.createdAt,
    this.updatedAt,
  });

  factory BusinessProfileModel.fromJson(Map<String, dynamic> json) {
    return BusinessProfileModel(
      id: json['id']?.toString() ?? '',
      businessName: json['businessName'] as String? ?? '',
      addressLine1: json['addressLine1'] as String? ?? '',
      addressLine2: json['addressLine2'] as String?,
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      postalCode: json['postalCode'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String? ?? '',
      gstin: json['gstin'] as String?,
      logoPath: json['logoPath'] as String?,
      invoicePrefix: json['invoicePrefix'] as String? ?? 'INV',
      termsAndConditions: json['termsAndConditions'] as String?,
      tagline: json['tagline'] as String?,
      brandColor: json['brandColor'] as String?,
      appColor: json['appColor'] as String?,
      sidebarColor: json['sidebarColor'] as String?,
      loginImagePath: json['loginImagePath'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'businessName': businessName,
      'addressLine1': addressLine1,
      'addressLine2': addressLine2,
      'city': city,
      'state': state,
      'postalCode': postalCode,
      'phone': phone,
      'email': email,
      'gstin': gstin,
      'logoPath': logoPath,
      'invoicePrefix': invoicePrefix,
      'termsAndConditions': termsAndConditions,
      'tagline': tagline,
      'brandColor': brandColor,
      'appColor': appColor,
      'sidebarColor': sidebarColor,
      'loginImagePath': loginImagePath,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  String get fullAddress {
    final parts = [
      addressLine1,
      if (addressLine2 != null && addressLine2!.isNotEmpty) addressLine2,
      '$city, $state - $postalCode',
    ];
    return parts.join(', ');
  }

  BusinessProfileModel copyWith({
    String? id,
    String? businessName,
    String? addressLine1,
    String? addressLine2,
    String? city,
    String? state,
    String? postalCode,
    String? phone,
    String? email,
    String? gstin,
    String? logoPath,
    String? invoicePrefix,
    String? termsAndConditions,
    String? tagline,
    String? brandColor,
    // Pass null to clear a colour (the company went back to the default); omit to keep the current one.
    Object? appColor = _keep,
    Object? sidebarColor = _keep,
    Object? loginImagePath = _keep,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return BusinessProfileModel(
      id: id ?? this.id,
      businessName: businessName ?? this.businessName,
      addressLine1: addressLine1 ?? this.addressLine1,
      addressLine2: addressLine2 ?? this.addressLine2,
      city: city ?? this.city,
      state: state ?? this.state,
      postalCode: postalCode ?? this.postalCode,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      gstin: gstin ?? this.gstin,
      logoPath: logoPath ?? this.logoPath,
      invoicePrefix: invoicePrefix ?? this.invoicePrefix,
      termsAndConditions: termsAndConditions ?? this.termsAndConditions,
      tagline: tagline ?? this.tagline,
      brandColor: brandColor ?? this.brandColor,
      appColor: identical(appColor, _keep)
          ? this.appColor
          : appColor as String?,
      sidebarColor: identical(sidebarColor, _keep)
          ? this.sidebarColor
          : sidebarColor as String?,
      loginImagePath: identical(loginImagePath, _keep)
          ? this.loginImagePath
          : loginImagePath as String?,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
