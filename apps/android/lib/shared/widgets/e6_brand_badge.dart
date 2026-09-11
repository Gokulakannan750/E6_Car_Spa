import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

/// A reusable luxury branded 'E6' badge with the red-to-black gradient
/// matching the login screen and desktop shell.
class E6BrandBadge extends StatelessWidget {
  final double size;
  final double borderRadius;
  final double? fontSize;
  final List<BoxShadow>? boxShadow;
  final BoxBorder? border;

  const E6BrandBadge({
    super.key,
    this.size = 28,
    this.borderRadius = 6,
    this.fontSize,
    this.boxShadow,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveFontSize = fontSize ?? (size * 0.44);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(borderRadius),
        border: border ??
            Border.all(
              color: Colors.white.withValues(alpha: 0.2),
              width: 0.75,
            ),
        boxShadow: boxShadow ??
            [
              BoxShadow(
                color: AppColors.loginAccent.withValues(alpha: 0.3),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 3,
                offset: const Offset(0, 1),
              ),
            ],
      ),
      child: Center(
        child: Text(
          'E6',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: effectiveFontSize,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }
}
