import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/network/dio_client.dart';
import '../models/system_preferences_model.dart';

const String kSystemPreferencesStorageKey = 'e6_system_preferences';

class SystemPreferencesState {
  final SystemPreferencesModel preferences;
  final bool isLoading;
  final bool isSaving;
  final String? message;
  final String connectivityStatus; // 'Online', 'Unreachable', 'Checking', 'Unknown'
  final bool isCheckingConnectivity;
  final DateTime? lastCheckedAt;

  const SystemPreferencesState({
    this.preferences = SystemPreferencesModel.defaultPreferences,
    this.isLoading = false,
    this.isSaving = false,
    this.message,
    this.connectivityStatus = 'Unknown',
    this.isCheckingConnectivity = false,
    this.lastCheckedAt,
  });

  SystemPreferencesState copyWith({
    SystemPreferencesModel? preferences,
    bool? isLoading,
    bool? isSaving,
    String? message,
    bool clearMessage = false,
    String? connectivityStatus,
    bool? isCheckingConnectivity,
    DateTime? lastCheckedAt,
  }) {
    return SystemPreferencesState(
      preferences: preferences ?? this.preferences,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      message: clearMessage ? null : (message ?? this.message),
      connectivityStatus: connectivityStatus ?? this.connectivityStatus,
      isCheckingConnectivity: isCheckingConnectivity ?? this.isCheckingConnectivity,
      lastCheckedAt: lastCheckedAt ?? this.lastCheckedAt,
    );
  }
}

final systemPreferencesStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final systemPreferencesNotifierProvider =
    StateNotifierProvider<SystemPreferencesNotifier, SystemPreferencesState>((ref) {
  final storage = ref.watch(systemPreferencesStorageProvider);
  final dio = ref.watch(dioProvider);
  return SystemPreferencesNotifier(storage: storage, dio: dio);
});

class SystemPreferencesNotifier extends StateNotifier<SystemPreferencesState> {
  final FlutterSecureStorage _storage;
  final Dio _dio;

  SystemPreferencesNotifier({
    required FlutterSecureStorage storage,
    required Dio dio,
  })  : _storage = storage,
        _dio = dio,
        super(const SystemPreferencesState()) {
    loadPreferences();
  }

  Future<void> loadPreferences() async {
    state = state.copyWith(isLoading: true, clearMessage: true);
    try {
      final jsonStr = await _storage.read(key: kSystemPreferencesStorageKey);
      if (jsonStr != null && jsonStr.isNotEmpty) {
        final map = jsonDecode(jsonStr) as Map<String, dynamic>;
        final prefs = SystemPreferencesModel.fromJson(map);
        state = state.copyWith(
          preferences: prefs,
          isLoading: false,
        );
        return;
      }
    } catch (_) {}

    state = state.copyWith(
      preferences: SystemPreferencesModel.defaultPreferences,
      isLoading: false,
    );
  }

  Future<bool> savePreferences(SystemPreferencesModel newPreferences) async {
    state = state.copyWith(isSaving: true, clearMessage: true);
    try {
      final jsonStr = jsonEncode(newPreferences.toJson());
      await _storage.write(key: kSystemPreferencesStorageKey, value: jsonStr);
      state = state.copyWith(
        preferences: newPreferences,
        isSaving: false,
        message: 'System preferences saved successfully.',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        message: 'Failed to save system preferences.',
      );
      return false;
    }
  }

  Future<void> resetToDefaults() async {
    state = state.copyWith(isSaving: true, clearMessage: true);
    try {
      await _storage.delete(key: kSystemPreferencesStorageKey);
      state = state.copyWith(
        preferences: SystemPreferencesModel.defaultPreferences,
        isSaving: false,
        message: 'Preferences reset to standard defaults.',
      );
    } catch (_) {
      state = state.copyWith(
        preferences: SystemPreferencesModel.defaultPreferences,
        isSaving: false,
        message: 'Preferences reset to standard defaults.',
      );
    }
  }

  Future<void> testConnectivity() async {
    state = state.copyWith(
      isCheckingConnectivity: true,
      connectivityStatus: 'Checking',
      clearMessage: true,
    );

    try {
      // Use the lightweight public endpoint
      final response = await _dio.get(
        '/public/business-profile',
        options: Options(
          sendTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );

      final isOnline = response.statusCode != null && response.statusCode! < 500;
      state = state.copyWith(
        isCheckingConnectivity: false,
        connectivityStatus: isOnline ? 'Online' : 'Unreachable',
        lastCheckedAt: DateTime.now(),
      );
    } catch (e) {
      // If server responded with 401 or 404, it is still reachable/online
      if (e is DioException && e.response != null) {
        state = state.copyWith(
          isCheckingConnectivity: false,
          connectivityStatus: 'Online',
          lastCheckedAt: DateTime.now(),
        );
      } else {
        state = state.copyWith(
          isCheckingConnectivity: false,
          connectivityStatus: 'Unreachable',
          lastCheckedAt: DateTime.now(),
        );
      }
    }
  }
}
