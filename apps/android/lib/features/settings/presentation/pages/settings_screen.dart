import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/app_environment.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../models/business_profile_model.dart';
import '../../models/update_business_profile_request.dart';
import '../../providers/settings_provider.dart';
import '../../providers/settings_state.dart';
import '../widgets/address_info_card.dart';
import '../widgets/business_info_card.dart';
import '../widgets/business_logo_card.dart';
import '../widgets/invoice_config_card.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late final TextEditingController _gstinController;
  late final TextEditingController _address1Controller;
  late final TextEditingController _address2Controller;
  late final TextEditingController _cityController;
  late final TextEditingController _stateController;
  late final TextEditingController _postalCodeController;
  late final TextEditingController _prefixController;
  late final TextEditingController _termsController;
  late final ScrollController _scrollController;

  BusinessProfileModel? _lastLoadedProfile;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _phoneController = TextEditingController();
    _emailController = TextEditingController();
    _gstinController = TextEditingController();
    _address1Controller = TextEditingController();
    _address2Controller = TextEditingController();
    _cityController = TextEditingController();
    _stateController = TextEditingController();
    _postalCodeController = TextEditingController();
    _prefixController = TextEditingController();
    _termsController = TextEditingController();
    _scrollController = ScrollController();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _gstinController.dispose();
    _address1Controller.dispose();
    _address2Controller.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _postalCodeController.dispose();
    _prefixController.dispose();
    _termsController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _populateControllers(BusinessProfileModel profile) {
    if (_lastLoadedProfile == profile) {
      return;
    }
    _lastLoadedProfile = profile;
    _nameController.text = profile.businessName;
    _phoneController.text = profile.phone;
    _emailController.text = profile.email;
    _gstinController.text = profile.gstin ?? '';
    _address1Controller.text = profile.addressLine1;
    _address2Controller.text = profile.addressLine2 ?? '';
    _cityController.text = profile.city;
    _stateController.text = profile.state;
    _postalCodeController.text = profile.postalCode;
    _prefixController.text = profile.invoicePrefix;
    _termsController.text = profile.termsAndConditions ?? '';
  }

  Future<void> _handleSave(bool canManage) async {
    if (!canManage) return;

    if (!_formKey.currentState!.validate()) {
      return;
    }

    final request = UpdateBusinessProfileRequest(
      businessName: _nameController.text,
      addressLine1: _address1Controller.text,
      addressLine2: _address2Controller.text,
      city: _cityController.text,
      state: _stateController.text,
      postalCode: _postalCodeController.text,
      phone: _phoneController.text,
      email: _emailController.text,
      gstin: _gstinController.text,
      invoicePrefix: _prefixController.text,
      termsAndConditions: _termsController.text,
    );

    final success = await ref
        .read(settingsNotifierProvider.notifier)
        .updateProfile(request);

    if (success && mounted) {
      FocusScope.of(context).unfocus();
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Business profile and invoice settings saved successfully.'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handleUploadLogo(XFile pickedFile) async {
    final bytes = await pickedFile.readAsBytes();
    final filename = pickedFile.name;
    await ref.read(settingsNotifierProvider.notifier).uploadLogo(
          bytes: bytes,
          filename: filename,
        );
  }

  Future<void> _handleRemoveLogo() async {
    await ref.read(settingsNotifierProvider.notifier).removeLogo();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final authUser = authState is Authenticated ? authState.user : null;

    final canView = authUser != null && authUser.hasPermission('settings.view');
    final canManage = authUser != null &&
        (authUser.isOwner || authUser.hasPermission('settings.business'));

    final state = ref.watch(settingsNotifierProvider);

    return AppScreenScaffold(
      title: 'Settings',
      actions: const [
        AppLogoutAction(),
      ],
      body: !canView
          ? const AppEmptyState(
              title: 'Access Restricted',
              message:
                  'You do not have permission to view Business Settings. Please contact your administrator.',
              icon: Icons.lock_outline,
            )
          : switch (state) {
              SettingsInitial() || SettingsLoading() => const AppLoadingState(
                  message: 'Loading business profile...',
                ),
              SettingsError(message: final msg) => AppErrorState(
                  message: msg,
                  onRetry: () =>
                      ref.read(settingsNotifierProvider.notifier).loadProfile(),
                ),
              SettingsLoaded(
                profile: final profile,
                isSaving: final isSaving,
                isUploadingLogo: final isUploadingLogo,
                successMessage: final successMsg,
                errorMessage: final errorMsg,
              ) =>
                _buildContent(
                  context: context,
                  profile: profile,
                  isSaving: isSaving,
                  isUploadingLogo: isUploadingLogo,
                  successMsg: successMsg,
                  errorMsg: errorMsg,
                  canManage: canManage,
                ),
            },
    );
  }

  Widget _buildContent({
    required BuildContext context,
    required BusinessProfileModel profile,
    required bool isSaving,
    required bool isUploadingLogo,
    String? successMsg,
    String? errorMsg,
    required bool canManage,
  }) {
    _populateControllers(profile);

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(settingsNotifierProvider.notifier).loadProfile(),
      color: AppColors.primary,
      child: SingleChildScrollView(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header description
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Business Profile',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Manage company identity, contact details, and invoice configuration.',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // View-only banner if not manager
              if (!canManage) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.accentPill,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.visibility_outlined,
                          color: AppColors.primary, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'View-Only Mode. Modifying business profile requires settings.business permission.',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Success Banner
              if (successMsg != null) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.successLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.success.withAlpha(50)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline,
                          color: AppColors.success, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          successMsg,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.successDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Error Banner
              if (errorMsg != null) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.error.withAlpha(50)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline,
                          color: AppColors.error, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          errorMsg,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.errorDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // 1. Logo Card
              BusinessLogoCard(
                logoPath: profile.logoPath,
                isUploading: isUploadingLogo,
                canManage: canManage,
                onUploadLogo: _handleUploadLogo,
                onRemoveLogo: _handleRemoveLogo,
              ),
              const SizedBox(height: 16),

              // 2. Business Details Card
              BusinessInfoCard(
                nameController: _nameController,
                phoneController: _phoneController,
                emailController: _emailController,
                gstinController: _gstinController,
                isEnabled: canManage && !isSaving,
              ),
              const SizedBox(height: 16),

              // 3. Registered Address Card
              AddressInfoCard(
                address1Controller: _address1Controller,
                address2Controller: _address2Controller,
                cityController: _cityController,
                stateController: _stateController,
                postalCodeController: _postalCodeController,
                isEnabled: canManage && !isSaving,
              ),
              const SizedBox(height: 16),

              // 4. Invoice & Billing Config Card
              InvoiceConfigCard(
                prefixController: _prefixController,
                termsController: _termsController,
                isEnabled: canManage && !isSaving,
              ),
              const SizedBox(height: 16),

              // 5. App Information Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.info_outline,
                            color: AppColors.textSecondary, size: 18),
                        SizedBox(width: 8),
                        Text(
                          'System Information',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Application',
                          style: TextStyle(
                              fontSize: 12, color: AppColors.textSecondary),
                        ),
                        Text(
                          AppEnvironment.appName,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Version',
                          style: TextStyle(
                              fontSize: 12, color: AppColors.textSecondary),
                        ),
                        Text(
                          'v${AppEnvironment.appVersion}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Environment',
                          style: TextStyle(
                              fontSize: 12, color: AppColors.textSecondary),
                        ),
                        Text(
                          'Production / Connected',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Save Action Button
              if (canManage) ...[
                AppButton(
                  label: 'Save Settings',
                  icon: Icons.save_outlined,
                  isLoading: isSaving,
                  fullWidth: true,
                  onPressed: isSaving ? null : () => _handleSave(canManage),
                ),
                const SizedBox(height: 30),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
