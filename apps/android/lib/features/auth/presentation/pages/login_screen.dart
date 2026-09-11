import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_business_logo.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/powered_by_trovo.dart';
import '../../../settings/providers/settings_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/auth_state.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _usernameController;
  late final TextEditingController _passwordController;
  bool _obscurePassword = true;
  String? _localError;
  Timer? _lockoutTimer;
  int _remainingLockoutSeconds = 0;

  @override
  void initState() {
    super.initState();
    _usernameController = TextEditingController();
    _passwordController = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(settingsNotifierProvider.notifier).loadPublicProfile();
    });
  }

  @override
  void dispose() {
    _lockoutTimer?.cancel();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _startLockoutTimer(int seconds) {
    _lockoutTimer?.cancel();
    setState(() {
      _remainingLockoutSeconds = seconds;
    });

    _lockoutTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      if (_remainingLockoutSeconds <= 1) {
        timer.cancel();
        setState(() {
          _remainingLockoutSeconds = 0;
        });
        ref.read(authNotifierProvider.notifier).clearError();
      } else {
        setState(() {
          _remainingLockoutSeconds--;
        });
      }
    });
  }

  Future<void> _handleLogin() async {
    if (_remainingLockoutSeconds > 0) return;

    setState(() => _localError = null);
    ref.read(authNotifierProvider.notifier).clearError();

    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty) {
      setState(() => _localError = 'Please enter your username.');
      return;
    }
    if (password.isEmpty) {
      setState(() => _localError = 'Please enter your password.');
      return;
    }

    // Dismiss keyboard
    FocusScope.of(context).unfocus();

    await ref
        .read(authNotifierProvider.notifier)
        .login(username, password);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authNotifierProvider, (previous, next) {
      if (next is AccountLocked) {
        _startLockoutTimer(next.remainingSeconds);
      }
    });

    final authState = ref.watch(authNotifierProvider);
    final businessProfile = ref.watch(businessProfileProvider);
    final businessName = businessProfile?.businessName.trim().isNotEmpty == true
        ? businessProfile!.businessName
        : 'E6 Car Spa';
    final isLoading = authState is Authenticating;
    final isLocked = _remainingLockoutSeconds > 0 || authState is AccountLocked;
    final isInputEnabled = !isLoading && !isLocked;

    String? errorMessage = _localError;
    if (_remainingLockoutSeconds > 0) {
      final mins = _remainingLockoutSeconds ~/ 60;
      final secs = _remainingLockoutSeconds % 60;
      final timeStr = mins > 0 ? '${mins}m ${secs.toString().padLeft(2, '0')}s' : '${secs}s';
      errorMessage = 'Account temporarily locked. Please try again later. ($timeStr remaining)';
    } else if (authState is AccountLocked) {
      final mins = authState.remainingSeconds ~/ 60;
      final secs = authState.remainingSeconds % 60;
      final timeStr = mins > 0 ? '${mins}m ${secs.toString().padLeft(2, '0')}s' : '${secs}s';
      errorMessage = '${authState.message} ($timeStr remaining)';
    } else if (authState is AuthFailure) {
      errorMessage = authState.message;
    } else if (authState is Unauthenticated && authState.message != null) {
      errorMessage = authState.message;
    }

    final isSuccess = authState is Unauthenticated && authState.isSuccess;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.loginGradientStart,
              AppColors.loginGradientMiddle,
              AppColors.loginGradientEnd,
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Brand Header / Logo
                      Center(
                        child: AppBusinessLogo(
                          height: 72,
                          maxHeight: 72,
                          maxWidth: 240,
                          borderRadius: 16,
                          fallbackIcon: Icons.local_car_wash_rounded,
                          fallbackColor: AppColors.loginAccent,
                          fallbackBoxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.4),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        businessName,
                        style: AppTextStyles.displayMedium.copyWith(
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Management Suite',
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: const Color(0xFFFECACA).withValues(alpha: 0.8),
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 32),

                      // Error / Success Message Banner
                      if (errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: isSuccess
                                ? const Color(0xE6064E3B)
                                : const Color(0xE6450A0A),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSuccess
                                  ? const Color(0xFF10B981).withValues(alpha: 0.5)
                                  : AppColors.loginAccent.withValues(alpha: 0.6),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                isSuccess
                                    ? Icons.check_circle_outline_rounded
                                    : (isLocked
                                        ? Icons.lock_clock_outlined
                                        : Icons.error_outline_rounded),
                                size: 20,
                                color: isSuccess ? const Color(0xFF34D399) : const Color(0xFFFCA5A5),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  errorMessage,
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: isSuccess ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Card Container
                      Card(
                        color: AppColors.loginCardBg,
                        elevation: 12,
                        shadowColor: Colors.black.withValues(alpha: 0.6),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: const BorderSide(
                            color: AppColors.loginCardBorder,
                            width: 1.2,
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(22.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Sign In',
                                style: AppTextStyles.headingMedium.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Enter your credentials to continue',
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.loginTextSecondary,
                                ),
                              ),
                              const SizedBox(height: 20),

                              // Username Input
                              AppTextField(
                                label: 'Username',
                                hintText: 'Enter username',
                                controller: _usernameController,
                                isEnabled: isInputEnabled,
                                keyboardType: TextInputType.text,
                                textColor: Colors.white,
                                labelColor: AppColors.loginTextSecondary,
                                hintColor: AppColors.loginTextMuted,
                                fillColor: AppColors.loginInputFill,
                                borderColor: AppColors.loginInputBorder,
                                focusedBorderColor: AppColors.loginAccent,
                                onChanged: (_) {
                                  if (!isLocked && (_localError != null || authState is AuthFailure)) {
                                    setState(() => _localError = null);
                                    ref.read(authNotifierProvider.notifier).clearError();
                                  }
                                },
                              ),
                              const SizedBox(height: 16),

                              // Password Input
                              AppTextField(
                                label: 'Password',
                                hintText: 'Enter password',
                                controller: _passwordController,
                                isPassword: _obscurePassword,
                                isEnabled: isInputEnabled,
                                keyboardType: TextInputType.visiblePassword,
                                textColor: Colors.white,
                                labelColor: AppColors.loginTextSecondary,
                                hintColor: AppColors.loginTextMuted,
                                fillColor: AppColors.loginInputFill,
                                borderColor: AppColors.loginInputBorder,
                                focusedBorderColor: AppColors.loginAccent,
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_off_outlined
                                        : Icons.visibility_outlined,
                                    size: 20,
                                    color: AppColors.loginTextSecondary,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _obscurePassword = !_obscurePassword;
                                    });
                                  },
                                ),
                                onChanged: (_) {
                                  if (!isLocked && (_localError != null || authState is AuthFailure)) {
                                    setState(() => _localError = null);
                                    ref.read(authNotifierProvider.notifier).clearError();
                                  }
                                },
                              ),
                              const SizedBox(height: 24),

                              // Submit Button (Red matching gradient branding)
                              AppButton(
                                label: isLocked
                                    ? 'Account Locked'
                                    : 'Sign In',
                                backgroundColor: AppColors.loginAccent,
                                onPressed: (isLoading || isLocked) ? null : _handleLogin,
                                isLoading: isLoading,
                                fullWidth: true,
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),
                      Text(
                        'Authorized staff and management only',
                        style: AppTextStyles.labelSmall.copyWith(
                          color: const Color(0xFFFECACA).withValues(alpha: 0.6),
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      PoweredByTrovo(
                        style: AppTextStyles.labelSmall.copyWith(
                          color: const Color(0xFFFECACA).withValues(alpha: 0.6),
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
