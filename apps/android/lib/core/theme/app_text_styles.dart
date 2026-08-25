import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

class AppTextStyles {
  // Base font family: Inter
  static TextStyle get inter => GoogleFonts.inter();

  // Display / Hero
  static TextStyle get displayLarge =>
      inter.copyWith(fontSize: 30, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2);
  static TextStyle get displayMedium =>
      inter.copyWith(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.25);
  static TextStyle get displaySmall =>
      inter.copyWith(fontSize: 20, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.3);

  // Headings
  static TextStyle get headingLarge =>
      inter.copyWith(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.35);
  static TextStyle get headingMedium =>
      inter.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.4);
  static TextStyle get headingSmall =>
      inter.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.4);

  // Body
  static TextStyle get bodyLarge =>
      inter.copyWith(fontSize: 16, fontWeight: FontWeight.w400, color: AppColors.textPrimary, height: 1.5);
  static TextStyle get bodyMedium =>
      inter.copyWith(fontSize: 14, fontWeight: FontWeight.w400, color: AppColors.textPrimary, height: 1.5);
  static TextStyle get bodySmall =>
      inter.copyWith(fontSize: 12, fontWeight: FontWeight.w400, color: AppColors.textSecondary, height: 1.5);

  // Labels
  static TextStyle get labelLarge =>
      inter.copyWith(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary, height: 1.4);
  static TextStyle get labelMedium =>
      inter.copyWith(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textSecondary, height: 1.4);
  static TextStyle get labelSmall =>
      inter.copyWith(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textSecondary, height: 1.4);

  // Button text
  static TextStyle get button =>
      inter.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textOnPrimary, height: 1.2);
  static TextStyle get buttonSecondary =>
      inter.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primary, height: 1.2);

  // Caption
  static TextStyle get caption =>
      inter.copyWith(fontSize: 12, fontWeight: FontWeight.w400, color: AppColors.textTertiary, height: 1.4);

  // Overline
  static TextStyle get overline =>
      inter.copyWith(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary, height: 1.4, letterSpacing: 0.5);

  // Backward-compatible helpers with context
  static TextStyle displayLargeOf(BuildContext context) => displayLarge;
  static TextStyle headingLargeOf(BuildContext context) => headingLarge;
  static TextStyle bodyMediumOf(BuildContext context) => bodyMedium;
  static TextStyle captionOf(BuildContext context) => caption;
}
