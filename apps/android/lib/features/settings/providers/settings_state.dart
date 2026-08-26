import '../models/business_profile_model.dart';

sealed class SettingsState {
  const SettingsState();
}

class SettingsInitial extends SettingsState {
  const SettingsInitial();
}

class SettingsLoading extends SettingsState {
  const SettingsLoading();
}

class SettingsLoaded extends SettingsState {
  final BusinessProfileModel profile;
  final bool isSaving;
  final bool isUploadingLogo;
  final String? successMessage;
  final String? errorMessage;

  const SettingsLoaded({
    required this.profile,
    this.isSaving = false,
    this.isUploadingLogo = false,
    this.successMessage,
    this.errorMessage,
  });

  SettingsLoaded copyWith({
    BusinessProfileModel? profile,
    bool? isSaving,
    bool? isUploadingLogo,
    String? successMessage,
    String? errorMessage,
    bool clearSuccess = false,
    bool clearError = false,
  }) {
    return SettingsLoaded(
      profile: profile ?? this.profile,
      isSaving: isSaving ?? this.isSaving,
      isUploadingLogo: isUploadingLogo ?? this.isUploadingLogo,
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SettingsLoaded &&
          runtimeType == other.runtimeType &&
          profile == other.profile &&
          isSaving == other.isSaving &&
          isUploadingLogo == other.isUploadingLogo &&
          successMessage == other.successMessage &&
          errorMessage == other.errorMessage;

  @override
  int get hashCode =>
      profile.hashCode ^
      isSaving.hashCode ^
      isUploadingLogo.hashCode ^
      successMessage.hashCode ^
      errorMessage.hashCode;
}

class SettingsError extends SettingsState {
  final String message;

  const SettingsError(this.message);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SettingsError &&
          runtimeType == other.runtimeType &&
          message == other.message;

  @override
  int get hashCode => message.hashCode;
}
