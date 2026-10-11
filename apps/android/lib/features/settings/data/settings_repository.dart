import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/brand_palette.dart';
import '../models/business_profile_model.dart';
import '../models/public_business_profile_model.dart';
import '../models/update_business_profile_request.dart';
import '../models/logo_upload_response.dart';
import '../models/system_preferences_model.dart';
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
  static const String _cachedPublicBrandingKey = 'e6_cached_public_branding';

  /// Applies the colours saved from the last session, before the first screen is drawn, so the app does not
  /// flash the default colours while the company profile is loading.
  static Future<void> applyCachedBrandColours([
    FlutterSecureStorage? storage,
  ]) async {
    final secure = storage ?? const FlutterSecureStorage();
    try {
      for (final key in [_cachedProfileKey, _cachedPublicBrandingKey]) {
        final jsonStr = await secure.read(key: key);
        if (jsonStr == null || jsonStr.isEmpty) continue;
        final map = jsonDecode(jsonStr) as Map<String, dynamic>;
        BrandPalette.apply(
          appHex: map['appColor'] as String?,
          sidebarHex: map['sidebarColor'] as String?,
        );
        return;
      }
    } catch (_) {
      // No cached colours: the neutral defaults stay in place.
    }
  }

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

  Future<PublicBusinessProfileModel?> getCachedPublicBranding() async {
    try {
      final jsonStr = await _storage.read(key: _cachedPublicBrandingKey);
      if (jsonStr == null || jsonStr.isEmpty) return null;
      final map = jsonDecode(jsonStr) as Map<String, dynamic>;
      return PublicBusinessProfileModel.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveCachedPublicBranding(
    PublicBusinessProfileModel branding,
  ) async {
    try {
      final jsonStr = jsonEncode(branding.toJson());
      await _storage.write(key: _cachedPublicBrandingKey, value: jsonStr);
    } catch (_) {}
  }

  /// Retrieves the anonymous public branding profile (businessName, logoPath, updatedAt).
  /// Strictly saves only to the public branding cache and NEVER overwrites the protected profile cache.
  Future<PublicBusinessProfileModel> getPublicBusinessProfile() async {
    try {
      String? companyCode;
      try {
        companyCode = await _storage.read(key: AppConstants.keyCompanyCode);
      } catch (_) {}
      final publicProfile = await _api.getPublicBusinessProfile(
        companyCode: companyCode,
      );
      await _saveCachedPublicBranding(publicProfile);
      return publicProfile;
    } on DioException catch (e) {
      final cached = await getCachedPublicBranding();
      if (cached != null) return cached;
      throw ApiException.fromDio(e);
    }
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

  Future<BusinessProfileModel> updateAppearance({
    String? appColor,
    String? sidebarColor,
    String? brandColor,
  }) async {
    try {
      final profile = await _api.updateAppearance(
        appColor: appColor,
        sidebarColor: sidebarColor,
        brandColor: brandColor,
      );
      await _saveCachedProfile(profile);
      return profile;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<BusinessProfileModel> uploadLoginImage({
    required List<int> bytes,
    required String filename,
  }) async {
    try {
      final profile = await _api.uploadLoginImage(
        bytes: bytes,
        filename: filename,
      );
      await _saveCachedProfile(profile);
      return profile;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<BusinessProfileModel> removeLoginImage() async {
    try {
      final profile = await _api.removeLoginImage();
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

  // ============================================================================
  // System Preferences (Synchronized with Backend)
  // ============================================================================
  static const String _cachedSystemPreferencesKey = 'e6_system_preferences';

  Future<SystemPreferencesModel?> getCachedSystemPreferences() async {
    try {
      final jsonStr = await _storage.read(key: _cachedSystemPreferencesKey);
      if (jsonStr == null || jsonStr.isEmpty) return null;
      final map = jsonDecode(jsonStr) as Map<String, dynamic>;
      return SystemPreferencesModel.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveCachedSystemPreferences(SystemPreferencesModel prefs) async {
    try {
      final jsonStr = jsonEncode(prefs.toJson());
      await _storage.write(key: _cachedSystemPreferencesKey, value: jsonStr);
    } catch (_) {}
  }

  Future<SystemPreferencesModel> getSystemPreferences() async {
    try {
      final prefs = await _api.getSystemPreferences();
      await saveCachedSystemPreferences(prefs);
      return prefs;
    } on DioException catch (e) {
      final cached = await getCachedSystemPreferences();
      if (cached != null) return cached;
      if (e.response == null) {
        // Network offline / unreachable fallback to default
        return SystemPreferencesModel.defaultPreferences;
      }
      throw ApiException.fromDio(e);
    } catch (_) {
      final cached = await getCachedSystemPreferences();
      return cached ?? SystemPreferencesModel.defaultPreferences;
    }
  }

  Future<SystemPreferencesModel> updateSystemPreferences(
    SystemPreferencesModel preferences,
  ) async {
    try {
      final updated = await _api.updateSystemPreferences(preferences);
      await saveCachedSystemPreferences(updated);
      return updated;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<SystemPreferencesModel> resetSystemPreferences() async {
    return updateSystemPreferences(SystemPreferencesModel.defaultPreferences);
  }
}
