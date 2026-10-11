import 'package:dio/dio.dart';
import '../models/business_profile_model.dart';
import '../models/public_business_profile_model.dart';
import '../models/update_business_profile_request.dart';
import '../models/logo_upload_response.dart';
import '../models/system_preferences_model.dart';
import '../models/invoice_series_model.dart';

class SettingsApi {
  final Dio _dio;

  SettingsApi(this._dio);

  /// Retrieves the anonymous public branding profile (businessName, logoPath, updatedAt)
  Future<PublicBusinessProfileModel> getPublicBusinessProfile({
    String? companyCode,
  }) async {
    final code = companyCode?.trim() ?? '';
    final response = await _dio.get(
      '/public/business-profile',
      queryParameters: code.isEmpty ? null : {'companyCode': code},
    );
    return PublicBusinessProfileModel.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

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

  /// Saves the company's colours. An empty string clears a colour (back to the neutral default);
  /// a null value leaves it unchanged.
  Future<BusinessProfileModel> updateAppearance({
    String? appColor,
    String? sidebarColor,
    String? brandColor,
  }) async {
    final response = await _dio.put(
      '/settings/business/appearance',
      data: {
        'appColor': appColor,
        'sidebarColor': sidebarColor,
        'brandColor': brandColor,
      },
    );
    return BusinessProfileModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// GST and non-GST invoice numbering series (prefixes + read-only next numbers).
  Future<InvoiceSeriesSettingsModel> getInvoiceSeries() async {
    final response = await _dio.get('/settings/invoice-series');
    return InvoiceSeriesSettingsModel.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// Owner only: changes the two prefixes. Counters cannot be changed.
  Future<InvoiceSeriesSettingsModel> updateInvoiceSeries({
    required String gstPrefix,
    required String nonGstPrefix,
  }) async {
    final response = await _dio.put(
      '/settings/invoice-series',
      data: {'gstPrefix': gstPrefix, 'nonGstPrefix': nonGstPrefix},
    );
    return InvoiceSeriesSettingsModel.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// Uploads a new business logo file
  Future<LogoUploadResponseModel> uploadLogo({
    required List<int> bytes,
    required String filename,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });

    final response = await _dio.post(
      '/settings/business/logo',
      data: formData,
      options: Options(headers: {'Content-Type': 'multipart/form-data'}),
    );
    return LogoUploadResponseModel.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// Uploads the company's own picture for the login page.
  Future<BusinessProfileModel> uploadLoginImage({
    required List<int> bytes,
    required String filename,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });

    final response = await _dio.post(
      '/settings/business/login-image',
      data: formData,
      options: Options(headers: {'Content-Type': 'multipart/form-data'}),
    );
    final json = response.data as Map<String, dynamic>;
    return BusinessProfileModel.fromJson(
      json['profile'] as Map<String, dynamic>? ?? {},
    );
  }

  /// Removes the company's login page picture.
  Future<BusinessProfileModel> removeLoginImage() async {
    final response = await _dio.delete('/settings/business/login-image');
    return BusinessProfileModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Removes the current business logo
  Future<BusinessProfileModel> removeLogo() async {
    final response = await _dio.delete('/settings/business/logo');
    return BusinessProfileModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Retrieves the current canonical System Preferences
  Future<SystemPreferencesModel> getSystemPreferences() async {
    final response = await _dio.get('/settings/system');
    return SystemPreferencesModel.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// Updates the canonical System Preferences
  Future<SystemPreferencesModel> updateSystemPreferences(
    SystemPreferencesModel preferences,
  ) async {
    final response = await _dio.put(
      '/settings/system',
      data: preferences.toJson(),
    );
    return SystemPreferencesModel.fromJson(
      response.data as Map<String, dynamic>,
    );
  }
}
