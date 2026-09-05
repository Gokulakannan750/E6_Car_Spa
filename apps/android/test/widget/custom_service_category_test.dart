import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/jobcards/presentation/widgets/add_custom_service_dialog.dart';

void main() {
  group('AddCustomServiceDialog Widget Tests', () {
    testWidgets('Renders Category dropdown and required validation', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: AddCustomServiceDialog(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Service Name, Price, and Category fields exist
      expect(find.text('Service Name'), findsOneWidget);
      expect(find.text('Price (₹)'), findsOneWidget);
      expect(find.text('Category *'), findsOneWidget);
      expect(find.text('Select Category'), findsOneWidget);

      // Attempt submit without filling fields
      await tester.tap(find.text('Add to Job Card'));
      await tester.pumpAndSettle();

      // Verify validation errors
      expect(find.text('Service name is required'), findsOneWidget);
      expect(find.text('Price is required'), findsOneWidget);
      expect(find.text('Category is required'), findsOneWidget);
    });

    testWidgets('Populates authoritative fallback categories when backend returns empty or uninitialized', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: AddCustomServiceDialog(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap category dropdown to show menu items
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();

      // Verify the 4 authoritative categories are present
      expect(find.text('Exterior Detailing'), findsWidgets);
      expect(find.text('Interior Care'), findsWidgets);
      expect(find.text('Protection Packages'), findsWidgets);
      expect(find.text('Others'), findsWidgets);
    });
  });
}
