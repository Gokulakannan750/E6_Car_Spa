import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/core/utils/app_environment.dart';
import 'package:e6_car_spa/shared/widgets/app_business_logo.dart';

void main() {
  group('AppBusinessLogo URL Resolution Tests', () {
    test('resolveLogoUrl returns null for null or empty string', () {
      expect(AppBusinessLogo.resolveLogoUrl(null), isNull);
      expect(AppBusinessLogo.resolveLogoUrl(''), isNull);
      expect(AppBusinessLogo.resolveLogoUrl('   '), isNull);
    });

    test('resolveLogoUrl preserves absolute http/https URLs', () {
      expect(
        AppBusinessLogo.resolveLogoUrl('https://example.com/logo.png'),
        equals('https://example.com/logo.png'),
      );
      expect(
        AppBusinessLogo.resolveLogoUrl('http://192.168.1.100:5298/uploads/logos/logo_123.png'),
        equals('http://192.168.1.100:5298/uploads/logos/logo_123.png'),
      );
    });

    test('resolveLogoUrl resolves relative /uploads/... path with apiBaseUrl', () {
      final resolved = AppBusinessLogo.resolveLogoUrl('/uploads/logos/logo_abc.png');
      final expectedBase = AppEnvironment.apiBaseUrl.replaceAll(RegExp(r'/api/?$'), '');
      expect(resolved, equals('$expectedBase/uploads/logos/logo_abc.png'));
    });

    test('resolveLogoUrl appends cache-busting version param when updatedAt is provided', () {
      final date = DateTime.utc(2026, 9, 5, 12, 0, 0);
      final resolved = AppBusinessLogo.resolveLogoUrl('/uploads/logos/logo_abc.png', date);
      final expectedBase = AppEnvironment.apiBaseUrl.replaceAll(RegExp(r'/api/?$'), '');
      expect(
        resolved,
        equals('$expectedBase/uploads/logos/logo_abc.png?v=${date.millisecondsSinceEpoch}'),
      );
    });
  });

  group('AppBusinessLogo Fallback Widget Tests', () {
    testWidgets('renders fallback text when logo path is null', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: AppBusinessLogo(
                width: 32,
                height: 32,
                fallbackText: 'E6',
              ),
            ),
          ),
        ),
      );

      expect(find.text('E6'), findsOneWidget);
    });

    testWidgets('renders fallback icon when fallbackIcon is provided', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: AppBusinessLogo(
                width: 48,
                height: 48,
                fallbackIcon: Icons.local_car_wash_rounded,
              ),
            ),
          ),
        ),
      );
      expect(find.byIcon(Icons.local_car_wash_rounded), findsOneWidget);
    });

    testWidgets('renders fallback with dynamic width defaulted to height when width is null', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: AppBusinessLogo(
                height: 36,
                fallbackText: 'E6',
              ),
            ),
          ),
        ),
      );

      final containerFinder = find.byType(Container).first;
      final Container container = tester.widget(containerFinder);
      expect(container.constraints?.maxHeight, equals(36));
      expect(find.text('E6'), findsOneWidget);
    });
  });
}
