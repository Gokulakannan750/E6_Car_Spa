import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/powered_by_trovo.dart';
import '../../models/bootstrap_owner_request.dart';
import '../../providers/auth_provider.dart';
import '../../providers/auth_state.dart';

class FirstTimeSetupScreen extends ConsumerStatefulWidget {
  const FirstTimeSetupScreen({super.key});

  @override
  ConsumerState<FirstTimeSetupScreen> createState() => _FirstTimeSetupScreenState();
}

class _FirstTimeSetupScreenState extends ConsumerState<FirstTimeSetupScreen>
    with WidgetsBindingObserver {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fullNameController;
  late final TextEditingController _usernameController;
  late final TextEditingController _passwordController;
  late final TextEditingController _confirmPasswordController;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String? _localError;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _fullNameController = TextEditingController();
    _usernameController = TextEditingController();
    _passwordController = TextEditingController();
    _confirmPasswordController = TextEditingController();

    _startPolling();
  }

  void _startPolling() {
    // 10-second polling interval (consistent with 10-12s cross-platform refresh strategy)
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _pollStatus();
    });
  }

  void _pollStatus() {
    if (!mounted) return;
    ref.read(authNotifierProvider.notifier).pollSetupStatus();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _pollStatus();
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _fullNameController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    setState(() => _localError = null);
    ref.read(authNotifierProvider.notifier).clearError();

    final fullName = _fullNameController.text.trim();
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (fullName.isEmpty) {
      setState(() => _localError = 'Full name is required.');
      return;
    }

    if (username.isEmpty) {
      setState(() => _localError = 'Username is required.');
      return;
    }

    if (password.length < 8) {
      setState(() => _localError = 'Password must be at least 8 characters long.');
      return;
    }

    if (password != confirmPassword) {
      setState(() => _localError = 'Passwords do not match.');
      return;
    }

    if (password.trim().toLowerCase() == username.toLowerCase()) {
      setState(() => _localError = 'Password cannot be the same as the username.');
      return;
    }

    // Dismiss keyboard
    FocusScope.of(context).unfocus();

    await ref.read(authNotifierProvider.notifier).bootstrapOwner(
          BootstrapOwnerRequest(
            fullName: fullName,
            username: username,
            password: password,
            confirmPassword: confirmPassword,
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final isLoading = authState is Authenticating;

    String? errorMessage = _localError;
    if (errorMessage == null) {
      if (authState is SetupRequired && authState.message != null) {
        errorMessage = authState.message;
      } else if (authState is AuthFailure) {
        errorMessage = authState.message;
      }
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand Header / Logo
                    Center(
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.local_car_wash_rounded,
                          size: 38,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'WELCOME TO E6 CAR SPA',
                      style: AppTextStyles.displaySmall.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'First-Time Setup — Create Owner Account',
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),

                    // Error Message Banner
                    if (errorMessage != null) ...[
                      Container(
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
                        child: Row(
                          children: [
                            const Icon(
                              Icons.error_outline_rounded,
                              size: 20,
                              color: AppColors.error,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                errorMessage,
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.errorDark,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Informational Privilege Card
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.infoLight,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.info.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.shield_outlined,
                            size: 22,
                            color: AppColors.info,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Initial Setup',
                                  style: AppTextStyles.bodyMedium.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.infoDark,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  'This account will have Owner privileges with unrestricted access to all current and future modules.',
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: AppColors.infoDark.withValues(alpha: 0.85),
                                    height: 1.35,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Card Container
                    Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: const BorderSide(color: AppColors.border),
                      ),
                      color: AppColors.card,
                      child: Padding(
                        padding: const EdgeInsets.all(20.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Full Name Field
                            AppTextField(
                              controller: _fullNameController,
                              label: 'Full Name',
                              hintText: 'e.g. Gokulakannan',
                              prefixIcon: const Icon(Icons.person_outline_rounded, size: 20),
                              isEnabled: !isLoading,
                              onChanged: (_) {
                                if (_localError != null) setState(() => _localError = null);
                              },
                            ),
                            const SizedBox(height: 16),

                            // Username Field
                            AppTextField(
                              controller: _usernameController,
                              label: 'Username',
                              hintText: 'e.g. gokul',
                              prefixIcon: const Icon(Icons.account_circle_outlined, size: 20),
                              isEnabled: !isLoading,
                              onChanged: (_) {
                                if (_localError != null) setState(() => _localError = null);
                              },
                            ),
                            const SizedBox(height: 16),

                            // Password Field
                            AppTextField(
                              controller: _passwordController,
                              label: 'Password',
                              hintText: 'Minimum 8 characters',
                              prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                              isPassword: _obscurePassword,
                              isEnabled: !isLoading,
                              onChanged: (_) {
                                if (_localError != null) setState(() => _localError = null);
                              },
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  size: 20,
                                  color: AppColors.textTertiary,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword = !_obscurePassword;
                                  });
                                },
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Confirm Password Field
                            AppTextField(
                              controller: _confirmPasswordController,
                              label: 'Confirm Password',
                              hintText: 'Re-enter password',
                              prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                              isPassword: _obscureConfirmPassword,
                              isEnabled: !isLoading,
                              onChanged: (_) {
                                if (_localError != null) setState(() => _localError = null);
                              },
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscureConfirmPassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  size: 20,
                                  color: AppColors.textTertiary,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscureConfirmPassword = !_obscureConfirmPassword;
                                  });
                                },
                              ),
                            ),
                            const SizedBox(height: 24),

                            // Submit Button
                            AppButton(
                              label: isLoading ? 'Creating Owner Account...' : 'Create Owner Account',
                              isLoading: isLoading,
                              onPressed: isLoading ? null : _handleSubmit,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Powered By Trovo Footer
                    const PoweredByTrovo(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
