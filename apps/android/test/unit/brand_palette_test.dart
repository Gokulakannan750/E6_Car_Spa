import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/constants/app_colors.dart';
import 'package:e6_car_spa/core/theme/brand_palette.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/models/public_business_profile_model.dart';

void main() {
  setUp(() => BrandPalette.apply());
  tearDown(() => BrandPalette.apply());

  group('BrandPalette', () {
    test(
      'builds a 50-950 scale whose 600 is the chosen colour, light to dark',
      () {
        final scale = BrandPalette.buildScale(const Color(0xFF0F766E));
        expect(scale[600], const Color(0xFF0F766E));
        expect(scale.length, 11);
        double brightness(Color c) => c.r + c.g + c.b;
        final ordered = BrandPalette.shades
            .map((s) => brightness(scale[s]!))
            .toList();
        final sorted = [...ordered]..sort((a, b) => b.compareTo(a));
        expect(ordered, sorted);
      },
    );

    test('parses #RRGGBB and rejects anything else', () {
      expect(BrandPalette.parse('#0f766e'), const Color(0xFF0F766E));
      expect(BrandPalette.parse(' #0F766E '), const Color(0xFF0F766E));
      for (final bad in [null, '', 'red', '#123', '0F766E', '#GGGGGG']) {
        expect(BrandPalette.parse(bad), isNull, reason: '$bad');
      }
      expect(BrandPalette.toHex(const Color(0xFF0F766E)), '#0F766E');
    });

    test('app and login colours follow the company theme', () {
      final changed = BrandPalette.apply(
        appHex: '#7C3AED',
        sidebarHex: '#A11A1A',
      );
      expect(changed, isTrue);
      expect(BrandPalette.app(600), const Color(0xFF7C3AED));
      expect(AppColors.primary, BrandPalette.app(700));
      expect(AppColors.accentPill, BrandPalette.app(50));
      expect(AppColors.loginGradientStart, BrandPalette.side(900));
      expect(AppColors.loginAccent, const Color(0xFFA11A1A));
      expect(
        BrandPalette.apply(appHex: '#7C3AED', sidebarHex: '#A11A1A'),
        isFalse,
      );
    });

    test(
      'falls back to the neutral defaults for missing or invalid colours',
      () {
        BrandPalette.apply(appHex: '#7C3AED', sidebarHex: '#A11A1A');
        BrandPalette.apply(appHex: 'nope', sidebarHex: null);
        expect(BrandPalette.app(600), BrandPalette.defaultApp);
        expect(BrandPalette.side(600), BrandPalette.defaultSidebar);
      },
    );

    test('flags colours that white text cannot be read on', () {
      expect(
        BrandPalette.contrastWithWhite(const Color(0xFFFFF9C4)),
        lessThan(3),
      );
      expect(
        BrandPalette.contrastWithWhite(const Color(0xFF1E293B)),
        greaterThan(10),
      );
      expect(
        BrandPalette.contrastWithWhite(BrandPalette.defaultApp),
        greaterThan(4.5),
      );
    });
  });

  group('profile models carry the colours', () {
    test('parse and serialise appColor and sidebarColor', () {
      final profile = BusinessProfileModel.fromJson(const {
        'businessName': 'Sunrise',
        'appColor': '#0F766E',
        'sidebarColor': '#A11A1A',
      });
      expect(profile.appColor, '#0F766E');
      expect(profile.toJson()['sidebarColor'], '#A11A1A');

      final public = PublicBusinessProfileModel.fromJson(const {
        'businessName': 'Sunrise',
        'appColor': '#0F766E',
      });
      expect(public.appColor, '#0F766E');
      expect(public.sidebarColor, isNull);
    });

    test('copyWith can clear a colour or leave it alone', () {
      final profile = BusinessProfileModel.fromJson(const {
        'businessName': 'Sunrise',
        'appColor': '#0F766E',
        'sidebarColor': '#A11A1A',
      });
      final kept = profile.copyWith(businessName: 'Sunrise 2');
      expect(kept.appColor, '#0F766E');
      final cleared = profile.copyWith(appColor: null);
      expect(cleared.appColor, isNull);
      expect(cleared.sidebarColor, '#A11A1A');
    });
  });
}
