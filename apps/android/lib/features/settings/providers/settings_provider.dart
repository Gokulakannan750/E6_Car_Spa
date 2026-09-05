import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/settings_repository.dart';
import '../models/business_profile_model.dart';
import '../models/update_business_profile_request.dart';
import 'settings_state.dart';

final settingsNotifierProvider =
    StateNotifierProvider<SettingsNotifier, SettingsState>((ref) {
  final repository = ref.watch(settingsRepositoryProvider);
  return SettingsNotifier(repository);
});

final businessProfileProvider = Provider<BusinessProfileModel?>((ref) {
  final state = ref.watch(settingsNotifierProvider);
  if (state is SettingsLoaded) return state.profile;
  return null;
});

class SettingsNotifier extends StateNotifier<SettingsState> {
  final SettingsRepository _repository;

  SettingsNotifier(this._repository) : super(const SettingsInitial()) {
    loadProfile();
  }

  Future<void> loadProfile() async {
    // Check if we have a cached profile for immediate zero-flicker display
    final cached = await _repository.getCachedBusinessProfile();
    if (cached != null && state is! SettingsLoaded) {
      state = SettingsLoaded(profile: cached);
    } else if (state is! SettingsLoaded) {
      state = const SettingsLoading();
    }

    try {
      final profile = await _repository.getBusinessProfile();
      state = SettingsLoaded(profile: profile);
    } catch (e) {
      if (state is! SettingsLoaded) {
        final message = e is ApiException
            ? e.message
            : 'Failed to load business profile. Please check connection.';
        state = SettingsError(message);
      }
    }
  }

  Future<bool> updateProfile(UpdateBusinessProfileRequest request) async {
    final currentState = state;
    if (currentState is! SettingsLoaded) return false;

    state = currentState.copyWith(
      isSaving: true,
      clearSuccess: true,
      clearError: true,
    );

    try {
      final updatedProfile = await _repository.updateBusinessProfile(request);
      state = SettingsLoaded(
        profile: updatedProfile,
        isSaving: false,
        successMessage: 'Business profile and invoice settings saved successfully.',
      );
      return true;
    } catch (e) {
      final message = e is ApiException ? e.message : 'Failed to save settings.';
      state = currentState.copyWith(
        isSaving: false,
        errorMessage: message,
      );
      return false;
    }
  }

  Future<bool> uploadLogo({
    required List<int> bytes,
    required String filename,
  }) async {
    final currentState = state;
    if (currentState is! SettingsLoaded) return false;

    state = currentState.copyWith(
      isUploadingLogo: true,
      clearSuccess: true,
      clearError: true,
    );

    try {
      final response = await _repository.uploadLogo(
        bytes: bytes,
        filename: filename,
      );
      state = SettingsLoaded(
        profile: response.profile,
        isUploadingLogo: false,
        successMessage: 'Business logo uploaded successfully.',
      );
      return true;
    } catch (e) {
      final message = e is ApiException ? e.message : 'Failed to upload logo.';
      state = currentState.copyWith(
        isUploadingLogo: false,
        errorMessage: message,
      );
      return false;
    }
  }

  Future<bool> removeLogo() async {
    final currentState = state;
    if (currentState is! SettingsLoaded) return false;

    state = currentState.copyWith(
      isUploadingLogo: true,
      clearSuccess: true,
      clearError: true,
    );

    try {
      final updatedProfile = await _repository.removeLogo();
      state = SettingsLoaded(
        profile: updatedProfile,
        isUploadingLogo: false,
        successMessage: 'Business logo removed successfully.',
      );
      return true;
    } catch (e) {
      final message = e is ApiException ? e.message : 'Failed to remove logo.';
      state = currentState.copyWith(
        isUploadingLogo: false,
        errorMessage: message,
      );
      return false;
    }
  }

  void clearMessages() {
    final currentState = state;
    if (currentState is SettingsLoaded) {
      state = currentState.copyWith(
        clearSuccess: true,
        clearError: true,
      );
    }
  }
}
