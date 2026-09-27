import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/network/dio_client.dart';
import '../data/settings_repository.dart';
import '../models/system_preferences_model.dart';

const String kSystemPreferencesStorageKey = 'e6_system_preferences';

class SystemPreferencesState {
  final SystemPreferencesModel preferences;
  final bool isLoading;
  final bool isSaving;
  final String? message;
  final String? errorMessage;
  final String connectivityStatus; // 'Online', 'Unreachable', 'Checking', 'Unknown'
  final bool isCheckingConnectivity;
  final DateTime? lastCheckedAt;

  const SystemPreferencesState({
    this.preferences = SystemPreferencesModel.defaultPreferences,
    this.isLoading = false,
    this.isSaving = false,
    this.message,
    this.errorMessage,
    this.connectivityStatus = 'Unknown',
    this.isCheckingConnectivity = false,
    this.lastCheckedAt,
  });

  SystemPreferencesState copyWith({
    SystemPreferencesModel? preferences,
    bool? isLoading,
    bool? isSaving,
    String? message,
    String? errorMessage,
    bool clearMessage = false,
    bool clearErrorMessage = false,
    String? connectivityStatus,
    bool? isCheckingConnectivity,
    DateTime? lastCheckedAt,
  }) {
    return SystemPreferencesState(
      preferences: preferences ?? this.preferences,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      message: clearMessage ? null : (message ?? this.message),
      errorMessage: clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
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
  final repository = ref.watch(settingsRepositoryProvider);
  final dio = ref.watch(dioProvider);
  return SystemPreferencesNotifier(repository: repository, dio: dio);
});

final systemPreferencesProvider = Provider<SystemPreferencesModel>((ref) {
  return ref.watch(systemPreferencesNotifierProvider.select((s) => s.preferences));
});

class SystemPreferencesNotifier extends StateNotifier<SystemPreferencesState> {
  final SettingsRepository _repository;
  final Dio _dio;

  SystemPreferencesNotifier({
    required SettingsRepository repository,
    required Dio dio,
  })  : _repository = repository,
        _dio = dio,
        super(const SystemPreferencesState()) {
    loadPreferences();
  }

  Future<void> loadPreferences() async {
    state = state.copyWith(
      isLoading: true,
      clearMessage: true,
      clearErrorMessage: true,
    );
    try {
      final prefs = await _repository.getSystemPreferences();
      state = state.copyWith(
        preferences: prefs,
        isLoading: false,
      );
    } catch (_) {
      final cached = await _repository.getCachedSystemPreferences();
      state = state.copyWith(
        preferences: cached ?? SystemPreferencesModel.defaultPreferences,
        isLoading: false,
      );
    }
  }

  Future<bool> savePreferences(SystemPreferencesModel newPreferences) async {
    state = state.copyWith(
      isSaving: true,
      clearMessage: true,
      clearErrorMessage: true,
    );
    try {
      final updated = await _repository.updateSystemPreferences(newPreferences);
      state = state.copyWith(
        preferences: updated,
        isSaving: false,
        message: 'System preferences saved successfully.',
      );
      return true;
    } catch (e) {
      // Still write to local cache as offline fallback
      await _repository.saveCachedSystemPreferences(newPreferences);
      state = state.copyWith(
        preferences: newPreferences,
        isSaving: false,
        errorMessage: 'Failed to save preferences to server. Cached locally.',
      );
      return false;
    }
  }

  Future<void> resetToDefaults() async {
    state = state.copyWith(
      isSaving: true,
      clearMessage: true,
      clearErrorMessage: true,
    );
    try {
      final reset = await _repository.resetSystemPreferences();
      state = state.copyWith(
        preferences: reset,
        isSaving: false,
        message: 'Preferences reset to standard defaults.',
      );
    } catch (_) {
      await _repository.saveCachedSystemPreferences(SystemPreferencesModel.defaultPreferences);
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
      clearErrorMessage: true,
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
