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

  SettingsNotifier(this._repository) : super(const SettingsInitial());

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

  /// Loads the public branding profile (businessName, logoPath, updatedAt).
  /// Safe to call before login or when unauthenticated.
  /// Preserves all protected business settings and never writes dummy profiles to protected storage.
  Future<void> loadPublicProfile() async {
    // 1. If full protected profile is already loaded in state, preserve all protected fields!
    if (state is SettingsLoaded) {
      final currentProfile = (state as SettingsLoaded).profile;
      try {
        final publicBranding = await _repository.getPublicBusinessProfile();
        state = (state as SettingsLoaded).copyWith(
          profile: currentProfile.copyWith(
            businessName: publicBranding.businessName,
            logoPath: publicBranding.logoPath,
            updatedAt: publicBranding.updatedAt,
            appColor: publicBranding.appColor,
            sidebarColor: publicBranding.sidebarColor,
            loginImagePath: publicBranding.loginImagePath,
          ),
        );
      } catch (_) {}
      return;
    }

    // 2. If a cached protected profile exists in storage, load it and update branding
    final cachedProfile = await _repository.getCachedBusinessProfile();
    if (cachedProfile != null) {
      state = SettingsLoaded(profile: cachedProfile);
      try {
        final publicBranding = await _repository.getPublicBusinessProfile();
        state = SettingsLoaded(
          profile: cachedProfile.copyWith(
            businessName: publicBranding.businessName,
            logoPath: publicBranding.logoPath,
            updatedAt: publicBranding.updatedAt,
            appColor: publicBranding.appColor,
            sidebarColor: publicBranding.sidebarColor,
            loginImagePath: publicBranding.loginImagePath,
          ),
        );
      } catch (_) {}
      return;
    }

    // 3. Check cached public branding for zero-flicker display
    final cachedBranding = await _repository.getCachedPublicBranding();
    if (cachedBranding != null && state is! SettingsLoaded) {
      state = SettingsLoaded(
        profile: BusinessProfileModel(
          id: '',
          businessName: cachedBranding.businessName,
          addressLine1: '',
          city: '',
          state: '',
          postalCode: '',
          phone: '',
          email: '',
          logoPath: cachedBranding.logoPath,
          updatedAt: cachedBranding.updatedAt,
        ),
      );
    }

    // 4. Fetch fresh public branding from anonymous endpoint
    try {
      final publicBranding = await _repository.getPublicBusinessProfile();
      final current = state is SettingsLoaded
          ? (state as SettingsLoaded).profile
          : null;
      state = SettingsLoaded(
        profile:
            (current ??
                    const BusinessProfileModel(
                      id: '',
                      businessName: '',
                      addressLine1: '',
                      city: '',
                      state: '',
                      postalCode: '',
                      phone: '',
                      email: '',
                    ))
                .copyWith(
                  businessName: publicBranding.businessName,
                  logoPath: publicBranding.logoPath,
                  updatedAt: publicBranding.updatedAt,
                  appColor: publicBranding.appColor,
                  sidebarColor: publicBranding.sidebarColor,
                  loginImagePath: publicBranding.loginImagePath,
                ),
      );
    } catch (_) {
      // If network fails and nothing was cached, leave state as is
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
        successMessage:
            'Business profile and invoice settings saved successfully.',
      );
      return true;
    } catch (e) {
      final message = e is ApiException
          ? e.message
          : 'Failed to save settings.';
      state = currentState.copyWith(isSaving: false, errorMessage: message);
      return false;
    }
  }

  /// Saves the company's colours and applies them to the whole app straight away.
  /// An empty string clears a colour; null leaves it unchanged.
  Future<bool> updateAppearance({
    String? appColor,
    String? sidebarColor,
    String? brandColor,
  }) async {
    final currentState = state;
    if (currentState is! SettingsLoaded) return false;

    state = currentState.copyWith(
      isSaving: true,
      clearSuccess: true,
      clearError: true,
    );

    try {
      final updated = await _repository.updateAppearance(
        appColor: appColor,
        sidebarColor: sidebarColor,
        brandColor: brandColor,
      );
      state = SettingsLoaded(
        profile: updated,
        isSaving: false,
        successMessage:
            'Colours saved. They now apply to everyone using this company.',
      );
      return true;
    } catch (e) {
      final message = e is ApiException ? e.message : 'Failed to save colours.';
      state = currentState.copyWith(isSaving: false, errorMessage: message);
      return false;
    }
  }

  /// Uploads the company's own picture for the login page.
  Future<bool> uploadLoginImage({
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
      final profile = await _repository.uploadLoginImage(
        bytes: bytes,
        filename: filename,
      );
      state = SettingsLoaded(
        profile: profile,
        isUploadingLogo: false,
        successMessage: 'Login page picture updated.',
      );
      return true;
    } catch (e) {
      final message = e is ApiException
          ? e.message
          : 'Failed to upload the picture.';
      state = currentState.copyWith(
        isUploadingLogo: false,
        errorMessage: message,
      );
      return false;
    }
  }

  Future<bool> removeLoginImage() async {
    final currentState = state;
    if (currentState is! SettingsLoaded) return false;

    state = currentState.copyWith(
      isUploadingLogo: true,
      clearSuccess: true,
      clearError: true,
    );

    try {
      final profile = await _repository.removeLoginImage();
      state = SettingsLoaded(
        profile: profile,
        isUploadingLogo: false,
        successMessage: 'Login page picture removed.',
      );
      return true;
    } catch (e) {
      final message = e is ApiException
          ? e.message
          : 'Failed to remove the picture.';
      state = currentState.copyWith(
        isUploadingLogo: false,
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
      state = currentState.copyWith(clearSuccess: true, clearError: true);
    }
  }
}
