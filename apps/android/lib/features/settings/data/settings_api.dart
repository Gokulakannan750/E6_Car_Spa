import 'package:dio/dio.dart';
import '../models/business_profile_model.dart';
import '../models/update_business_profile_request.dart';
import '../models/logo_upload_response.dart';

class SettingsApi {
  final Dio _dio;

  SettingsApi(this._dio);

  /// Retrieves the current Business Profile & Invoice Configuration
  Future<BusinessProfileModel> getBusinessProfile() async {
    final response = await _dio.get('/settings/business');
    return BusinessProfileModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Updates the Business Profile & Invoice Configuration
  Future<BusinessProfileModel> updateBusinessProfile(
    UpdateBusinessProfileRequest request,
  ) async {
    final response = await _dio.put(
      '/settings/business',
      data: request.toJson(),
    );
    return BusinessProfileModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Uploads a new business logo file
  Future<LogoUploadResponseModel> uploadLogo({
    required List<int> bytes,
    required String filename,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: filename,
      ),
    });

    final response = await _dio.post(
      '/settings/business/logo',
      data: formData,
      options: Options(
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      ),
    );
    return LogoUploadResponseModel.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// Removes the current business logo
  Future<BusinessProfileModel> removeLogo() async {
    final response = await _dio.delete('/settings/business/logo');
    return BusinessProfileModel.fromJson(response.data as Map<String, dynamic>);
  }
}
