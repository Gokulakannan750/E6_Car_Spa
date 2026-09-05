import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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
  final FlutterSecureStorage _storage;

  static const String _cachedProfileKey = 'e6_cached_business_profile';

  SettingsRepository(this._api, [FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  Future<BusinessProfileModel?> getCachedBusinessProfile() async {
    try {
      final jsonStr = await _storage.read(key: _cachedProfileKey);
      if (jsonStr == null || jsonStr.isEmpty) return null;
      final map = jsonDecode(jsonStr) as Map<String, dynamic>;
      return BusinessProfileModel.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveCachedProfile(BusinessProfileModel profile) async {
    try {
      final jsonStr = jsonEncode(profile.toJson());
      await _storage.write(key: _cachedProfileKey, value: jsonStr);
    } catch (_) {}
  }

  Future<BusinessProfileModel> getBusinessProfile() async {
    try {
      final profile = await _api.getBusinessProfile();
      await _saveCachedProfile(profile);
      return profile;
    } on DioException catch (e) {
      final cached = await getCachedBusinessProfile();
      if (cached != null) return cached;
      throw ApiException.fromDio(e);
    }
  }

  Future<BusinessProfileModel> updateBusinessProfile(
    UpdateBusinessProfileRequest request,
  ) async {
    try {
      final profile = await _api.updateBusinessProfile(request);
      await _saveCachedProfile(profile);
      return profile;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<LogoUploadResponseModel> uploadLogo({
    required List<int> bytes,
    required String filename,
  }) async {
    try {
      final res = await _api.uploadLogo(bytes: bytes, filename: filename);
      await _saveCachedProfile(res.profile);
      return res;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<BusinessProfileModel> removeLogo() async {
    try {
      final profile = await _api.removeLogo();
      await _saveCachedProfile(profile);
      return profile;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
