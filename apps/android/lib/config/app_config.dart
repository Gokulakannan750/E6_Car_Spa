import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/utils/app_environment.dart';
import '../core/constants/app_constants.dart';

class AppConfig {
 static const FlutterSecureStorage _storage = FlutterSecureStorage();

 static String get defaultApiBaseUrl => AppEnvironment.apiBaseUrl;

 static Future<String> getApiBaseUrl() async {
   final customUrl = await _storage.read(key: AppConstants.keyApiBaseUrl);
   if (customUrl != null && customUrl.trim().isNotEmpty) {
     return customUrl.trim();
   }
   return AppEnvironment.apiBaseUrl;
 }

 static Future<void> setApiBaseUrl(String url) async {
 await _storage.write(key: AppConstants.keyApiBaseUrl, value: url);
 }

 static Future<String?> getAccessToken() async {
 return _storage.read(key: AppConstants.keyAccessToken);
 }

 static Future<void> setAccessToken(String token) async {
 await _storage.write(key: AppConstants.keyAccessToken, value: token);
 }

 static Future<void> removeAccessToken() async {
 await _storage.delete(key: AppConstants.keyAccessToken);
 }

 static Future<String?> getRefreshToken() async {
 return _storage.read(key: AppConstants.keyRefreshToken);
 }

 static Future<void> setRefreshToken(String token) async {
 await _storage.write(key: AppConstants.keyRefreshToken, value: token);
 }

 static Future<void> removeRefreshToken() async {
 await _storage.delete(key: AppConstants.keyRefreshToken);
 }

 static Future<void> clearAuth() async {
 await _storage.delete(key: AppConstants.keyAccessToken);
 await _storage.delete(key: AppConstants.keyRefreshToken);
 await _storage.delete(key: AppConstants.keyUser);
 }
}

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig());
