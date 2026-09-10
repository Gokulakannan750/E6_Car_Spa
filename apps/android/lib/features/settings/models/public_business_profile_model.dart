class PublicBusinessProfileModel {
  final String businessName;
  final String? logoPath;
  final DateTime? updatedAt;

  const PublicBusinessProfileModel({
    required this.businessName,
    this.logoPath,
    this.updatedAt,
  });

  factory PublicBusinessProfileModel.fromJson(Map<String, dynamic> json) {
    return PublicBusinessProfileModel(
      businessName: json['businessName'] as String? ?? 'E6 Car Spa',
      logoPath: json['logoPath'] as String?,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'businessName': businessName,
      'logoPath': logoPath,
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
