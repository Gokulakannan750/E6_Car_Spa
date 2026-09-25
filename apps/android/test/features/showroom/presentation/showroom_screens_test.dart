import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/daily_staff_assignment_card.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/showroom_card.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/showroom_date_selector.dart';
import 'package:e6_car_spa/features/showroom/presentation/widgets/showroom_form_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Showroom UI Widgets Tests', () {
    testWidgets('ShowroomCard displays name, address, phone, and metrics', (tester) async {
      final showroom = Showroom(
        id: 'sr-001',
        name: 'Anna Nagar Prime Hub',
        address: '142 Brough Road, Chennai',
        phone: '9840154321',
        gstin: '33AAAAA0000A1Z5',
        isActive: true,
        activeStaffCountToday: 3,
        totalVehiclesToday: 10,
        createdAt: DateTime(2026, 8, 26),
      );

      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ShowroomCard(
              showroom: showroom,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Anna Nagar Prime Hub'), findsOneWidget);
      expect(find.text('142 Brough Road, Chennai'), findsOneWidget);
      expect(find.text('9840154321'), findsOneWidget);
      // Directory table / card does NOT show GSTIN
      expect(find.textContaining('33AAAAA0000A1Z5'), findsNothing);
      expect(find.text('Staff Today: '), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('10'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);

      await tester.tap(find.byType(InkWell).first);
      expect(tapped, true);
    });

    testWidgets('DailyStaffAssignmentCard displays staff details and vehicles', (tester) async {
      final assignment = DailyStaffAssignment(
        id: 'assign-1',
        showroomId: 'sr-001',
        showroomName: 'Anna Nagar Prime Hub',
        staffId: 'staff-001',
        staffName: 'Ramesh Detailer',
        staffPhone: '9876543210',
        staffRole: 'Detailer',
        date: DateTime(2026, 8, 26),
        vehiclesAttended: 4,
        createdAt: DateTime(2026, 8, 26),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DailyStaffAssignmentCard(
              assignment: assignment,
              onRemove: () {},
            ),
          ),
        ),
      );

      expect(find.text('Ramesh Detailer'), findsOneWidget);
      expect(find.text('Detailer'), findsOneWidget);
      expect(find.text('9876543210'), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
      expect(find.byIcon(Icons.delete_outline), findsOneWidget);
    });

    testWidgets('ShowroomDateSelector allows shifting dates', (tester) async {
      DateTime currentDate = DateTime(2026, 8, 26);
      DateTime? selected;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return ShowroomDateSelector(
                  selectedDate: currentDate,
                  onDateSelected: (d) {
                    setState(() => currentDate = d);
                    selected = d;
                  },
                );
              },
            ),
          ),
        ),
      );

      expect(find.text('Wed, 26 Aug 2026'), findsOneWidget);

      // Tap Next Day button
      await tester.tap(find.byIcon(Icons.chevron_right_rounded));
      await tester.pump();

      expect(selected?.day, 27);
      expect(find.text('Thu, 27 Aug 2026'), findsOneWidget);
    });

    testWidgets('ShowroomFormSheet accepts valid GSTIN and submits normalized uppercase', (tester) async {
      CreateShowroomRequest? capturedRequest;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ShowroomFormSheet(
              onCreate: (req) async {
                capturedRequest = req;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.widgetWithText(TextFormField, 'e.g. E6 Car Spa - Anna Nagar'), 'New Hub');
      await tester.enterText(find.widgetWithText(TextFormField, 'e.g. Plot 12, 2nd Avenue, Anna Nagar, Chennai - 600040'), 'Address 123');
      await tester.enterText(find.widgetWithText(TextFormField, 'e.g. 33AAAAA0000A1Z5'), '33aaaaa0000a1z5');

      await tester.tap(find.text('Create Showroom'));
      await tester.pumpAndSettle();

      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.name, 'New Hub');
      expect(capturedRequest!.gstin, '33AAAAA0000A1Z5');
      expect(capturedRequest!.toJson()['gstin'], '33AAAAA0000A1Z5');
    });

    testWidgets('ShowroomFormSheet rejects invalid GSTIN format', (tester) async {
      CreateShowroomRequest? capturedRequest;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ShowroomFormSheet(
              onCreate: (req) async {
                capturedRequest = req;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.widgetWithText(TextFormField, 'e.g. E6 Car Spa - Anna Nagar'), 'New Hub');
      await tester.enterText(find.widgetWithText(TextFormField, 'e.g. Plot 12, 2nd Avenue, Anna Nagar, Chennai - 600040'), 'Address 123');
      await tester.enterText(find.widgetWithText(TextFormField, 'e.g. 33AAAAA0000A1Z5'), 'INVALID123');

      await tester.tap(find.text('Create Showroom'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Invalid GSTIN format'), findsOneWidget);
      expect(capturedRequest, isNull);
    });

    testWidgets('ShowroomFormSheet accepts empty GSTIN as optional', (tester) async {
      CreateShowroomRequest? capturedRequest;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ShowroomFormSheet(
              onCreate: (req) async {
                capturedRequest = req;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.widgetWithText(TextFormField, 'e.g. E6 Car Spa - Anna Nagar'), 'New Hub');
      await tester.enterText(find.widgetWithText(TextFormField, 'e.g. Plot 12, 2nd Avenue, Anna Nagar, Chennai - 600040'), 'Address 123');

      await tester.tap(find.text('Create Showroom'));
      await tester.pumpAndSettle();

      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.gstin, isNull);
      expect(capturedRequest!.toJson().containsKey('gstin'), false);
    });

    testWidgets('ShowroomFormSheet clearing existing GSTIN submits request with gstin as null and serializes "gstin": null', (tester) async {
      final existing = Showroom(
        id: 'sr-1',
        name: 'Anna Nagar Hub',
        address: '2nd Avenue',
        gstin: '33AAAAA0000A1Z5',
        isActive: true,
        createdAt: DateTime.now(),
      );

      UpdateShowroomRequest? capturedUpdate;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ShowroomFormSheet(
              showroom: existing,
              onUpdate: (id, req) async {
                capturedUpdate = req;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // GSTIN should be populated with existing value
      expect(find.text('33AAAAA0000A1Z5'), findsOneWidget);

      // Clear the GSTIN field
      await tester.enterText(find.widgetWithText(TextFormField, '33AAAAA0000A1Z5'), '');
      await tester.pumpAndSettle();

      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();

      expect(capturedUpdate, isNotNull);
      expect(capturedUpdate!.gstin, isNull);

      final json = capturedUpdate!.toJson();
      expect(json.containsKey('gstin'), true);
      expect(json['gstin'], isNull);
    });
  });
}
