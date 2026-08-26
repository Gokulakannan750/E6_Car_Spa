import 'package:e6_car_spa/features/showroom/presentation/widgets/showroom_form_sheet.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/add_edit_staff_bottom_sheet.dart';
import 'package:e6_car_spa/features/staffadvances/presentation/widgets/create_advance_bottom_sheet.dart';
import 'package:e6_car_spa/shared/widgets/app_modal_header.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('AppModalHeader triggers close callback and pops navigator', (tester) async {
    bool closeCalled = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppModalHeader(
            title: 'Test Modal',
            subtitle: 'Subtitle information',
            onClose: () => closeCalled = true,
          ),
        ),
      ),
    );

    expect(find.text('Test Modal'), findsOneWidget);
    expect(find.text('Subtitle information'), findsOneWidget);
    expect(find.byKey(const Key('modal_close_button')), findsOneWidget);

    await tester.tap(find.byKey(const Key('modal_close_button')));
    expect(closeCalled, isTrue);
  });

  testWidgets('AddEditStaffBottomSheet has modal_close_button and modal_cancel_button', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    builder: (context) => const AddEditStaffBottomSheet(),
                  );
                },
                child: const Text('Open Sheet'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open Sheet'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('modal_close_button')), findsOneWidget);
    expect(find.byKey(const Key('modal_cancel_button')), findsOneWidget);

    // Tap close button to dismiss
    await tester.tap(find.byKey(const Key('modal_close_button')));
    await tester.pumpAndSettle();

    expect(find.text('Add Staff Member'), findsNothing);
  });

  testWidgets('CreateAdvanceBottomSheet has modal_close_button and modal_cancel_button', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    builder: (context) => CreateAdvanceBottomSheet(
                      activeStaff: const [],
                      onSubmit: (req) async => null,
                    ),
                  );
                },
                child: const Text('Open Advance Sheet'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open Advance Sheet'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('modal_close_button')), findsOneWidget);
    expect(find.byKey(const Key('modal_cancel_button')), findsOneWidget);

    // Tap X to dismiss
    await tester.tap(find.byKey(const Key('modal_close_button')));
    await tester.pumpAndSettle();

    expect(find.text('Disburse Staff Advance'), findsNothing);
  });

  testWidgets('ShowroomFormSheet has modal_close_button and modal_cancel_button', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    builder: (context) => ShowroomFormSheet(
                      onCreate: (req) async {},
                    ),
                  );
                },
                child: const Text('Open Showroom Sheet'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open Showroom Sheet'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('modal_close_button')), findsOneWidget);
    expect(find.byKey(const Key('modal_cancel_button')), findsOneWidget);

    // Tap X close button to dismiss
    await tester.tap(find.byKey(const Key('modal_close_button')));
    await tester.pumpAndSettle();

    expect(find.text('Add New Showroom'), findsNothing);
  });
}
