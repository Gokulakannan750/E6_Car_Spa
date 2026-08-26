import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/business_profile_model.dart';
import '../models/update_business_profile_request.dart';
import '../models/logo_upload_response.dart';
import 'settings_api.dart';

final settingsApiProvider = Provider<SettingsApi>((ref) {
  final dio = ref.watch(dioProvider);
  return SettingsApi(dio);
});

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  final api = ref.watch(settingsApiProvider);
  return SettingsRepository(api);
});

class SettingsRepository {
  final SettingsApi _api;

  SettingsRepository(this._api);

  Future<BusinessProfileModel> getBusinessProfile() async {
    try {
      return await _api.getBusinessProfile();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<BusinessProfileModel> updateBusinessProfile(
    UpdateBusinessProfileRequest request,
  ) async {
    try {
      return await _api.updateBusinessProfile(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<LogoUploadResponseModel> uploadLogo({
    required List<int> bytes,
    required String filename,
  }) async {
    try {
      return await _api.uploadLogo(bytes: bytes, filename: filename);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<BusinessProfileModel> removeLogo() async {
    try {
      return await _api.removeLogo();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
