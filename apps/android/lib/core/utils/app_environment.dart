import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import '../constants/app_constants.dart';

class AppEnvironment {
  static bool get isProduction =>
      const bool.fromEnvironment('dart.vm.product');

  static bool get isDevelopment => !isProduction;

  static String get apiBaseUrl {
    const fromEnv = String.fromEnvironment('E6_API_URL');
    if (fromEnv.isNotEmpty) return fromEnv;

    if (isProduction) {
      return AppConstants.defaultProdApiUrl;
    }

    if (!kIsWeb && Platform.isAndroid) {
      return AppConstants.defaultEmulatorApiUrl;
    }

    return AppConstants.defaultDevApiUrl;
  }

  static String get appName => AppConstants.appName;
  static String get appVersion => AppConstants.appVersion;
}

