import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/shared/widgets/powered_by_trovo.dart';

void main() {
  group('PoweredByTrovo Widget Tests', () {
    testWidgets('renders Powered by Trovo Tech Solutions text correctly', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: PoweredByTrovo(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Powered by Trovo Tech Solutions'), findsOneWidget);
    });

    testWidgets('applies custom padding and style when provided', (tester) async {
      const customStyle = TextStyle(fontSize: 16, color: Colors.blue);
      const customPadding = EdgeInsets.all(16);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: PoweredByTrovo(
              padding: customPadding,
              style: customStyle,
              isCenter: false,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final textWidget = tester.widget<Text>(find.text('Powered by Trovo Tech Solutions'));
      expect(textWidget.style?.fontSize, 16);
      expect(textWidget.style?.color, Colors.blue);
      expect(textWidget.textAlign, TextAlign.start);
    });
  });
}
