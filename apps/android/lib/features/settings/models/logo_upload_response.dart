import 'business_profile_model.dart';

class LogoUploadResponseModel {
  final String logoUrl;
  final BusinessProfileModel profile;

  const LogoUploadResponseModel({
    required this.logoUrl,
    required this.profile,
  });

  factory LogoUploadResponseModel.fromJson(Map<String, dynamic> json) {
    return LogoUploadResponseModel(
      logoUrl: json['logoUrl'] as String? ?? '',
      profile: BusinessProfileModel.fromJson(
        json['profile'] as Map<String, dynamic>? ?? {},
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'logoUrl': logoUrl,
      'profile': profile.toJson(),
    };
  }
}
