class PublicBusinessProfileModel {
  final String businessName;
  final String? logoPath;
  final DateTime? updatedAt;
  final String? appColor;
  final String? sidebarColor;
  final String? loginImagePath;

  const PublicBusinessProfileModel({
    required this.businessName,
    this.logoPath,
    this.updatedAt,
    this.appColor,
    this.sidebarColor,
    this.loginImagePath,
  });

  factory PublicBusinessProfileModel.fromJson(Map<String, dynamic> json) {
    return PublicBusinessProfileModel(
      businessName: json['businessName'] as String? ?? '',
      logoPath: json['logoPath'] as String?,
      appColor: json['appColor'] as String?,
      sidebarColor: json['sidebarColor'] as String?,
      loginImagePath: json['loginImagePath'] as String?,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'businessName': businessName,
      'logoPath': logoPath,
      'appColor': appColor,
      'sidebarColor': sidebarColor,
      'loginImagePath': loginImagePath,
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
