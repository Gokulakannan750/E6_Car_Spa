import 'package:flutter/foundation.dart' show kIsWeb;
import '../constants/app_constants.dart';

class AppEnvironment {
  static bool get isProduction => const bool.fromEnvironment('dart.vm.product');

  static bool get isDevelopment => !isProduction;

  /// The server address chosen on this device (Server settings on the sign-in screen). Null means the build's own
  /// address. Set when the app starts and whenever it is changed.
  static String? serverOverride;

  /// The server the app calls: the address chosen on this device, otherwise the one the app was built for.
  static String get apiBaseUrl {
    final chosen = serverOverride?.trim();
    if (chosen != null && chosen.isNotEmpty) return chosen;
    return builtInApiBaseUrl;
  }

  /// The address the app was built for.
  static String get builtInApiBaseUrl {
    const fromEnv = String.fromEnvironment('E6_API_URL');
    if (fromEnv.isNotEmpty) return fromEnv;

    // Release builds must never fall back to a development LAN address.
    // Build with --dart-define=E6_API_URL=https://<server>/api to target a specific server.
    if (isProduction) return AppConstants.defaultProdApiUrl;

    if (kIsWeb) {
      return AppConstants.defaultLocalhostApiUrl;
    }

    // Default to development machine LAN backend for real Android device testing
    return AppConstants.defaultDevApiUrl;
  }

  static String get appName => AppConstants.appName;
  static String get appVersion => AppConstants.appVersion;
}
