import 'dart:math' as math;

import 'package:flutter/material.dart';

/// The company's colour theme, mirroring the desktop app.
///
/// A company picks an app accent and a sidebar/login colour in System Preferences. Each colour is expanded
/// into a 50–950 scale of shades (the chosen colour is shade 600), and [AppColors] reads from these scales, so
/// every screen follows the theme. When a company has not chosen a colour, a neutral default is used.
class BrandPalette {
  BrandPalette._();

  /// Tailwind's blue-600; used until the company picks an app colour.
  static const Color defaultApp = Color(0xFF2563EB);

  /// Deep slate; used until the company picks a sidebar and login colour.
  static const Color defaultSidebar = Color(0xFF1E293B);

  /// Used for invoices and job cards until the company picks a document colour.
  static const Color defaultDocument = Color(0xFF1E293B);

  static const List<int> shades = [
    50,
    100,
    200,
    300,
    400,
    500,
    600,
    700,
    800,
    900,
    950,
  ];

  /// How far each shade is pulled toward white (positive) or black (negative) from the chosen colour.
  static const Map<int, double> _mix = {
    50: 0.94,
    100: 0.86,
    200: 0.7,
    300: 0.5,
    400: 0.28,
    500: 0.12,
    600: 0,
    700: -0.18,
    800: -0.34,
    900: -0.5,
    950: -0.66,
  };

  static Map<int, Color> _app = buildScale(defaultApp);
  static Map<int, Color> _side = buildScale(defaultSidebar);

  /// Shade of the app accent colour (50–950).
  static Color app(int shade) => _app[shade]!;

  /// Shade of the sidebar / login colour (50–950).
  static Color side(int shade) => _side[shade]!;

  /// `#RRGGBB` (any case) as a colour, or null when the text is not a valid colour code.
  static Color? parse(String? hex) {
    final value = hex?.trim() ?? '';
    if (!RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(value)) return null;
    return Color(0xFF000000 | int.parse(value.substring(1), radix: 16));
  }

  /// Upper-case `#RRGGBB` for a colour.
  static String toHex(Color color) {
    final rgb = color.toARGB32() & 0xFFFFFF;
    return '#${rgb.toRadixString(16).padLeft(6, '0').toUpperCase()}';
  }

  static Map<int, Color> buildScale(Color base) {
    final scale = <int, Color>{};
    for (final shade in shades) {
      final amount = _mix[shade]!;
      final target = amount >= 0 ? 255.0 : 0.0;
      final t = amount.abs();
      int channel(double v) => (v + (target - v) * t).round().clamp(0, 255);
      scale[shade] = Color.fromARGB(
        255,
        channel(base.r * 255),
        channel(base.g * 255),
        channel(base.b * 255),
      );
    }
    return scale;
  }

  /// Applies the company's colours. A missing or invalid colour uses the neutral default.
  /// Returns true when anything changed, so the caller knows to rebuild the UI.
  static bool apply({String? appHex, String? sidebarHex}) {
    final app = parse(appHex) ?? defaultApp;
    final side = parse(sidebarHex) ?? defaultSidebar;
    final changed =
        _app[600] != buildScale(app)[600] ||
        _side[600] != buildScale(side)[600];
    _app = buildScale(app);
    _side = buildScale(side);
    return changed;
  }

  /// WCAG contrast of white text on [color]. Below 3 is hard to read.
  static double contrastWithWhite(Color color) {
    double lin(double c) => c <= 0.03928
        ? c / 12.92
        : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
    final l =
        0.2126 * lin(color.r) + 0.7152 * lin(color.g) + 0.0722 * lin(color.b);
    return 1.05 / (l + 0.05);
  }

  /// Ready-made colours offered next to the free colour picker.
  static const List<({String name, Color color})> presets = [
    (name: 'Sky', color: Color(0xFF0284C7)),
    (name: 'Royal Blue', color: Color(0xFF2563EB)),
    (name: 'Indigo', color: Color(0xFF4F46E5)),
    (name: 'Navy', color: Color(0xFF1E3A8A)),
    (name: 'Cyan', color: Color(0xFF0E7490)),
    (name: 'Teal', color: Color(0xFF0F766E)),
    (name: 'Emerald', color: Color(0xFF059669)),
    (name: 'Forest', color: Color(0xFF15803D)),
    (name: 'Olive', color: Color(0xFF4D7C0F)),
    (name: 'Gold', color: Color(0xFFA16207)),
    (name: 'Amber', color: Color(0xFFB45309)),
    (name: 'Orange', color: Color(0xFFC2410C)),
    (name: 'Red', color: Color(0xFFDC2626)),
    (name: 'Crimson', color: Color(0xFFA11A1A)),
    (name: 'Maroon', color: Color(0xFF7F1D1D)),
    (name: 'Rose', color: Color(0xFFBE123C)),
    (name: 'Pink', color: Color(0xFFBE185D)),
    (name: 'Violet', color: Color(0xFF7C3AED)),
    (name: 'Purple', color: Color(0xFF9333EA)),
    (name: 'Plum', color: Color(0xFF86198F)),
    (name: 'Brown', color: Color(0xFF78350F)),
    (name: 'Slate', color: Color(0xFF1E293B)),
    (name: 'Graphite', color: Color(0xFF374151)),
    (name: 'Black', color: Color(0xFF111111)),
  ];
}
