import 'package:flutter/material.dart';

import '../theme/brand_palette.dart';

class AppColors {
  // Company theme (app colour = blue scale, sidebar/login colour = side scale; see BrandPalette)
  static Color get primary => BrandPalette.app(700);
  static Color get primaryContainer => BrandPalette.side(950);
  static Color get primaryLight => BrandPalette.app(500);
  static Color get primaryDark => BrandPalette.app(800);

  // E6 Dark Navy (matching Desktop Sidebar)
  static Color get navy => BrandPalette.side(950);
  static Color get navyLight => BrandPalette.side(800);

  // Accent & Highlights
  static Color get accent => BrandPalette.app(700);
  static Color get accentLight => BrandPalette.app(500);
  static Color get accentDark => BrandPalette.app(800);
  static Color get accentPill => BrandPalette.app(50);

  // Background & Surfaces
  static const Color background = Color(0xFFF8FAFC); // Slate-50
  static const Color surface = Color(0xFFF8FAFC);
  static const Color card = Color(0xFFFFFFFF);
  static const Color surfaceAlt = Color(0xFFF1F5F9); // Slate-100

  // Typography
  static const Color textPrimary = Color(0xFF0F172A); // Slate-900
  static const Color textSecondary = Color(0xFF475569); // Slate-600
  static const Color textTertiary = Color(0xFF94A3B8); // Slate-400
  static const Color textOnPrimary = Color(0xFFFFFFFF);

  // Borders & Outlines
  static const Color outline = Color(0xFFCBD5E1); // Slate-300
  static const Color border = Color(0xFFE2E8F0); // Slate-200
  static const Color borderLight = Color(0xFFF1F5F9);
  static const Color borderDark = Color(0xFFCBD5E1);

  // Semantics & Badges
  static const Color success = Color(0xFF047857);
  static const Color successLight = Color(0xFFECFDF5);
  static const Color successDark = Color(0xFF065F46);

  static const Color warning = Color(0xFFB45309);
  static const Color warningLight = Color(0xFFFFFBEB);
  static const Color warningDark = Color(0xFF92400E);

  static const Color error = Color(0xFFB91C1C);
  static const Color errorLight = Color(0xFFFEF2F2);
  static const Color errorDark = Color(0xFF991B1B);

  static const Color info = Color(0xFF1D4ED8);
  static const Color infoLight = Color(0xFFEFF6FF);
  static const Color infoDark = Color(0xFF1E40AF);

  // Status Badges (Semantic backgrounds, borders, and text)
  static const Color draftBg = Color(0xFFF1F5F9);
  static const Color draftText = Color(0xFF475569);
  static const Color draftBorder = Color(0xFFCBD5E1);

  static const Color inProgressBg = Color(0xFFEFF6FF);
  static const Color inProgressText = Color(0xFF1D4ED8);
  static const Color inProgressBorder = Color(0xFFBFDBFE);

  static const Color qualityCheckBg = Color(0xFFFFFBEB);
  static const Color qualityCheckText = Color(0xFFB45309);
  static const Color qualityCheckBorder = Color(0xFFFDE68A);

  static const Color readyBg = Color(0xFFECFDF5);
  static const Color readyText = Color(0xFF047857);
  static const Color readyBorder = Color(0xFFA7F3D0);

  static const Color generatedBg = Color(0xFFEFF6FF);
  static const Color generatedText = Color(0xFF1D4ED8);
  static const Color generatedBorder = Color(0xFFBFDBFE);

  static const Color invoicedBg = generatedBg;
  static const Color invoicedText = generatedText;
  static const Color invoicedBorder = generatedBorder;

  static const Color deliveredBg = Color(0xFFF0FDFA);
  static const Color deliveredText = Color(0xFF0F766E);
  static const Color deliveredBorder = Color(0xFF99F6E4);

  static const Color cancelledBg = Color(0xFFFEF2F2);
  static const Color cancelledText = Color(0xFFB91C1C);
  static const Color cancelledBorder = Color(0xFFFECACA);

  // Shadows
  static const Color shadow = Color(0x0D000000);
  static const Color shadowMedium = Color(0x1A000000);
  static Color get overlay => BrandPalette.side(950).withValues(alpha: 0.4);

  // Navigation
  static const Color bottomNavBg = Color(0xFFFFFFFF);
  static const Color bottomNavBorder = Color(0xFFE2E8F0);
  static Color get bottomNavActive => BrandPalette.app(700);
  static const Color bottomNavInactive = Color(0xFF64748B);

  // Login branding (company sidebar colour through black, matching desktop)
  static Color get loginGradientStart => BrandPalette.side(900);
  static const Color loginGradientMiddle = Color(0xFF000000); // Black
  static Color get loginGradientEnd => BrandPalette.side(950);
  static Color get loginAccent => BrandPalette.side(600);
  static Color get loginCardBg =>
      BrandPalette.side(950).withValues(alpha: 0.95);
  static Color get loginCardBorder =>
      BrandPalette.side(600).withValues(alpha: 0.3);
  static Color get loginInputFill =>
      BrandPalette.side(900).withValues(alpha: 0.8);
  static Color get loginInputBorder =>
      BrandPalette.side(800).withValues(alpha: 0.45);
  static Color get loginTextSecondary =>
      BrandPalette.side(100).withValues(alpha: 0.8);
  static Color get loginTextMuted =>
      BrandPalette.side(100).withValues(alpha: 0.5);

  // Brand Gradients (matching the login and desktop aesthetic)
  static LinearGradient get brandGradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      BrandPalette.side(600), // Company colour highlight
      BrandPalette.side(900), // Deep shade
      BrandPalette.side(950), // Darkest shade
    ],
  );
}
