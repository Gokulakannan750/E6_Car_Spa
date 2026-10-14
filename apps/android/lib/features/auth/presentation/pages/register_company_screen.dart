import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/powered_by_trovo.dart';
import '../../models/register_company_request.dart';
import '../../providers/auth_provider.dart';

/// First registration of a company on Trovo's platform: the company code and
/// one-time registration code Trovo gave the customer, then the Owner account.
class RegisterCompanyScreen extends ConsumerStatefulWidget {
  const RegisterCompanyScreen({super.key});

  @override
  ConsumerState<RegisterCompanyScreen> createState() =>
      _RegisterCompanyScreenState();
}

class _RegisterCompanyScreenState extends ConsumerState<RegisterCompanyScreen> {
  final _companyCodeController = TextEditingController();
  final _registrationCodeController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _companyCodeController.dispose();
    _registrationCodeController.dispose();
    _fullNameController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validate() {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    if (_companyCodeController.text.trim().isEmpty) {
      return 'Company code is required.';
    }
    if (_registrationCodeController.text.trim().isEmpty) {
      return 'Registration code is required.';
    }
    if (_fullNameController.text.trim().isEmpty) {
      return 'Full name is required.';
    }
    if (username.isEmpty) return 'Username is required.';
    if (password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (password != _confirmPasswordController.text) {
      return 'Passwords do not match.';
    }
    if (password.trim().toLowerCase() == username.toLowerCase()) {
      return 'Password cannot be the same as the username.';
    }
    return null;
  }

  Future<void> _handleSubmit() async {
    final problem = _validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _isSubmitting = true;
    });

    final error = await ref
        .read(authNotifierProvider.notifier)
        .registerCompany(
          RegisterCompanyRequest(
            companyCode: _companyCodeController.text.trim().toUpperCase(),
            registrationCode: _registrationCodeController.text
                .trim()
                .toUpperCase(),
            fullName: _fullNameController.text.trim(),
            username: _usernameController.text.trim().toLowerCase(),
            password: _passwordController.text,
            confirmPassword: _confirmPasswordController.text,
          ),
        );

    if (!mounted) return;
    if (error == null) {
      context.go(AppRoutes.login);
    } else {
      setState(() {
        _error = error;
        _isSubmitting = false;
      });
    }
  }

  void _clearError(String _) {
    if (_error != null) setState(() => _error = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'WELCOME TO BAYLIOR',
                    style: AppTextStyles.displaySmall.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Register Your Company',
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  if (_error != null) ...[
                    Container(
                      key: const Key('register_error'),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.errorLight,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: AppColors.error.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Text(
                        _error!,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.errorDark,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.infoLight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.info.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Text(
                      'Enter the company code and registration code you received from Trovo, then create the Owner account. The registration code works only once.',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.infoDark,
                        height: 1.35,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: AppColors.border),
                    ),
                    color: AppColors.card,
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AppTextField(
                            key: const Key('register_company_code'),
                            controller: _companyCodeController,
                            label: 'Company Code',
                            hintText: 'e.g. 0002',
                            prefixIcon: const Icon(
                              Icons.business_outlined,
                              size: 20,
                            ),
                            isEnabled: !_isSubmitting,
                            onChanged: _clearError,
                          ),
                          const SizedBox(height: 16),
                          AppTextField(
                            key: const Key('register_registration_code'),
                            controller: _registrationCodeController,
                            label: 'Registration Code',
                            hintText: 'XXXX-XXXX-XXXX',
                            prefixIcon: const Icon(
                              Icons.vpn_key_outlined,
                              size: 20,
                            ),
                            isEnabled: !_isSubmitting,
                            onChanged: _clearError,
                          ),
                          const SizedBox(height: 16),
                          AppTextField(
                            key: const Key('register_full_name'),
                            controller: _fullNameController,
                            label: 'Owner Full Name',
                            prefixIcon: const Icon(
                              Icons.person_outline_rounded,
                              size: 20,
                            ),
                            isEnabled: !_isSubmitting,
                            onChanged: _clearError,
                          ),
                          const SizedBox(height: 16),
                          AppTextField(
                            key: const Key('register_username'),
                            controller: _usernameController,
                            label: 'Username',
                            prefixIcon: const Icon(
                              Icons.account_circle_outlined,
                              size: 20,
                            ),
                            isEnabled: !_isSubmitting,
                            onChanged: _clearError,
                          ),
                          const SizedBox(height: 16),
                          AppTextField(
                            key: const Key('register_password'),
                            controller: _passwordController,
                            label: 'Password',
                            hintText: 'Minimum 8 characters',
                            prefixIcon: const Icon(
                              Icons.lock_outline_rounded,
                              size: 20,
                            ),
                            isPassword: _obscurePassword,
                            isEnabled: !_isSubmitting,
                            onChanged: _clearError,
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                size: 20,
                                color: AppColors.textTertiary,
                              ),
                              onPressed: () => setState(
                                () => _obscurePassword = !_obscurePassword,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          AppTextField(
                            key: const Key('register_confirm_password'),
                            controller: _confirmPasswordController,
                            label: 'Confirm Password',
                            prefixIcon: const Icon(
                              Icons.lock_outline_rounded,
                              size: 20,
                            ),
                            isPassword: _obscurePassword,
                            isEnabled: !_isSubmitting,
                            onChanged: _clearError,
                          ),
                          const SizedBox(height: 24),
                          AppButton(
                            key: const Key('register_submit'),
                            label: _isSubmitting
                                ? 'Registering...'
                                : 'Register Company',
                            isLoading: _isSubmitting,
                            onPressed: _isSubmitting ? null : _handleSubmit,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    key: const Key('register_back_to_sign_in'),
                    onPressed: () => context.go(AppRoutes.login),
                    child: const Text('Already registered? Sign in'),
                  ),
                  const SizedBox(height: 12),
                  const PoweredByTrovo(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
