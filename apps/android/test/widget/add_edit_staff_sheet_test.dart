import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/models/staff_request_models.dart';
import 'package:e6_car_spa/features/staff/presentation/widgets/add_edit_staff_bottom_sheet.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';

void main() {
  group('AddEditStaffBottomSheet Widget Tests', () {
    testWidgets('renders Create Staff modal with fields and header', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AddEditStaffBottomSheet(),
          ),
        ),
      );

      expect(find.text('Add Staff Member'), findsOneWidget);
      expect(find.text('Add an employee to the workshop directory'), findsOneWidget);
      expect(find.text('Full Name *'), findsOneWidget);
      expect(find.text('Phone Number *'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Create Staff'), findsOneWidget);
      expect(find.byKey(const Key('modal_cancel_button')), findsOneWidget);
    });

    testWidgets('validates required name field before submitting', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AddEditStaffBottomSheet(),
          ),
        ),
      );

      await tester.tap(find.widgetWithText(AppButton, 'Create Staff'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter the staff member\'s name.'), findsOneWidget);
    });

    testWidgets('validates 10-digit phone number field before submitting', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AddEditStaffBottomSheet(),
          ),
        ),
      );

      // Enter name but leave phone empty
      await tester.enterText(find.byType(TextField).at(0), 'Ramesh Kumar');
      await tester.tap(find.widgetWithText(AppButton, 'Create Staff'));
      await tester.pumpAndSettle();

      expect(find.text('Phone number is required'), findsOneWidget);

      // Enter invalid phone
      await tester.enterText(find.byType(TextField).at(1), '12345');
      await tester.tap(find.widgetWithText(AppButton, 'Create Staff'));
      await tester.pumpAndSettle();

      expect(find.text('Phone number must be exactly 10 digits'), findsOneWidget);
    });

    testWidgets('submits valid request and invokes onCreate callback', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      CreateStaffRequest? submittedRequest;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AddEditStaffBottomSheet(
              onCreate: (req) async {
                submittedRequest = req;
                return null; // Success
              },
            ),
          ),
        ),
      );

      await tester.enterText(find.byType(TextField).at(0), 'Ramesh Detailer');
      await tester.enterText(find.byType(TextField).at(1), '9876543210');
      await tester.enterText(find.byType(TextField).at(2), 'Floor Supervisor');

      await tester.tap(find.widgetWithText(AppButton, 'Create Staff'));
      await tester.pumpAndSettle();

      expect(submittedRequest, isNotNull);
      expect(submittedRequest!.name, 'Ramesh Detailer');
      expect(submittedRequest!.phoneNumber, '9876543210');
      expect(submittedRequest!.role, 'Floor Supervisor');
    });

    testWidgets('renders Edit mode prepopulated with existing staff data', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      const existingStaff = Staff(
        id: 'st-101',
        name: 'Karthik Raja',
        phoneNumber: '9123456780',
        email: 'karthik@e6carspa.com',
        address: 'Coimbatore',
        role: 'Master Polisher',
        isActive: true,
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AddEditStaffBottomSheet(
              staff: existingStaff,
            ),
          ),
        ),
      );

      expect(find.text('Edit Staff Member'), findsOneWidget);
      expect(find.text('Karthik Raja'), findsOneWidget);
      expect(find.text('9123456780'), findsOneWidget);
      expect(find.text('Master Polisher'), findsOneWidget);
      expect(find.text('Active Status'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Save Changes'), findsOneWidget);
    });

    testWidgets('displays error banner and preserves inputs when API returns error', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AddEditStaffBottomSheet(
              onCreate: (req) async {
                return 'Staff member with this phone number already exists.';
              },
            ),
          ),
        ),
      );

      await tester.enterText(find.byType(TextField).at(0), 'Duplicate Name');
      await tester.enterText(find.byType(TextField).at(1), '9876543210');

      await tester.tap(find.widgetWithText(AppButton, 'Create Staff'));
      await tester.pumpAndSettle();

      expect(find.text('Staff member with this phone number already exists.'), findsOneWidget);
      expect(find.text('Duplicate Name'), findsOneWidget);
      expect(find.text('9876543210'), findsOneWidget);
    });
  });
}
