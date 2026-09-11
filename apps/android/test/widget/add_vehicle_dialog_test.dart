import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_repository.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_api.dart';
import 'package:e6_car_spa/features/vehicles/models/vehicle_model.dart';
import 'package:e6_car_spa/features/vehicles/presentation/widgets/add_vehicle_dialog.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:dio/dio.dart';

class StubVehicleRepo extends VehicleRepository {
  bool shouldThrowConflict = false;
  bool shouldThrowServer = false;
  CreateVehicleRequest? lastCreatedRequest;
  String conflictMessage = 'Vehicle with registration number TN01AZ9999 already exists.';
  dynamic conflictDetails;
  String? transferredVehicleId;
  String? transferredCustomerId;
  bool shouldThrowTransferError = false;
  int transferCallCount = 0;

  StubVehicleRepo() : super(VehicleApi(Dio()));

  @override
  Future<Vehicle> createVehicle(CreateVehicleRequest request) async {
    lastCreatedRequest = request;
    if (shouldThrowConflict) {
      throw ConflictException(
        message: conflictMessage,
        endpoint: '/api/vehicles',
        details: conflictDetails,
      );
    }
    if (shouldThrowServer) {
      throw const ServerException(
        message: 'Internal server error occurred.',
        endpoint: '/api/vehicles',
      );
    }
    return Vehicle(
      id: 'veh-created-1',
      registrationNumber: request.registrationNumber,
      make: request.make,
      model: request.model,
      variant: request.variant,
      customerId: request.customerId,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<Vehicle?> getVehicleByRegistration(String registrationNumber) async {
    if (registrationNumber == 'TN56P3334') {
      return Vehicle(
        id: '3e44b988-7cd3-46c2-a003-24fb9857b946',
        registrationNumber: 'TN56P3334',
        make: 'Maruti',
        model: 'Baleno',
        variant: 'Alpha',
        customerId: 'cust-101',
        createdAt: DateTime.now(),
      );
    }
    return null;
  }

  @override
  Future<Vehicle> transferOwnership(String vehicleId, String newCustomerId) async {
    transferCallCount++;
    transferredVehicleId = vehicleId;
    transferredCustomerId = newCustomerId;
    if (shouldThrowTransferError) {
      throw const ApiException(
        message: 'Network error during transfer.',
        endpoint: '/api/vehicles/transfer',
      );
    }
    return Vehicle(
      id: vehicleId,
      registrationNumber: 'TN56P3334',
      make: 'Maruti',
      model: 'Baleno',
      customerId: newCustomerId,
      createdAt: DateTime.now(),
    );
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  Widget createTestWidget({
    required StubVehicleRepo repo,
    String customerId = 'cust-101',
    String? customerName = 'Customer B',
    String? initialRegNumber,
    Function(Vehicle)? onCreated,
  }) {
    return ProviderScope(
      overrides: [
        vehicleRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: AddVehicleDialog(
            customerId: customerId,
            customerName: customerName,
            initialRegNumber: initialRegNumber,
            onCreated: onCreated,
          ),
        ),
      ),
    );
  }

  group('AddVehicleDialog - Widget & 409 Conflict Safety Tests', () {
    testWidgets('renders modal header, input fields, and save vehicle button', (tester) async {
      final repo = StubVehicleRepo();
      await tester.pumpWidget(createTestWidget(repo: repo, initialRegNumber: 'TN01AZ9999'));

      expect(find.text('Register Vehicle'), findsOneWidget);
      expect(find.text('Registration Number'), findsOneWidget);
      expect(find.text('TN01AZ9999'), findsOneWidget);
      expect(find.text('Make'), findsOneWidget);
      expect(find.text('Model'), findsOneWidget);
      expect(find.text('Variant (Optional)'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Save Vehicle'), findsOneWidget);
    });

    testWidgets('validates required registration, make, and model fields on submit', (tester) async {
      final repo = StubVehicleRepo();
      await tester.pumpWidget(createTestWidget(repo: repo));

      // Tap Save Vehicle without filling fields
      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      expect(find.text('Registration number is required'), findsOneWidget);
      expect(find.text('Make is required'), findsOneWidget);
      expect(find.text('Model is required'), findsOneWidget);
      expect(repo.lastCreatedRequest, isNull);
    });

    testWidgets('normalizes registration number to uppercase on successful submission', (tester) async {
      final repo = StubVehicleRepo();
      Vehicle? createdVehicle;

      await tester.pumpWidget(createTestWidget(
        repo: repo,
        onCreated: (v) => createdVehicle = v,
      ));

      // Enter lowercase registration number and details
      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'tn 01 ab 1234');
      await tester.enterText(textFields.at(1), 'Hyundai');
      await tester.enterText(textFields.at(2), 'Creta');
      await tester.enterText(textFields.at(3), 'SX(O)');

      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      expect(repo.lastCreatedRequest, isNotNull);
      // Registration should be normalized to uppercase trimmed
      expect(repo.lastCreatedRequest!.registrationNumber, 'TN 01 AB 1234');
      expect(repo.lastCreatedRequest!.make, 'Hyundai');
      expect(repo.lastCreatedRequest!.model, 'Creta');
      expect(repo.lastCreatedRequest!.variant, 'SX(O)');
      expect(createdVehicle?.registrationNumber, 'TN 01 AB 1234');
    });

    testWidgets('entering lowercase registration number into registration field immediately displays in uppercase', (tester) async {
      final repo = StubVehicleRepo();
      await tester.pumpWidget(createTestWidget(repo: repo));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'tn11as1123');
      await tester.pump();

      expect(find.text('TN11AS1123'), findsOneWidget);
    });

    testWidgets('submitting lowercase "tn56p3334" sends uppercase "TN56P3334" and detects conflict', (tester) async {
      final repo = StubVehicleRepo()
        ..shouldThrowConflict = true
        ..conflictDetails = {
          'existingVehicleId': 'veh-v',
          'existingCustomerId': 'cust-a',
          'existingCustomerName': 'Customer A',
          'registrationNumber': 'TN56P3334',
          'make': 'Maruti',
          'model': 'Baleno',
        };

      await tester.pumpWidget(createTestWidget(repo: repo));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'tn56p3334');
      await tester.enterText(textFields.at(1), 'Maruti');
      await tester.enterText(textFields.at(2), 'Baleno');

      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      expect(repo.lastCreatedRequest!.registrationNumber, 'TN56P3334');
      expect(find.text('Vehicle Already Registered'), findsOneWidget);
      expect(find.textContaining('TN56P3334 is already registered to Customer A.'), findsOneWidget);
    });

    testWidgets('handles HTTP 409 duplicate registration conflict without crash and preserves user input', (tester) async {
      final repo = StubVehicleRepo()..shouldThrowConflict = true;

      await tester.pumpWidget(createTestWidget(repo: repo));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'TN01AZ9999');
      await tester.enterText(textFields.at(1), 'BMW');
      await tester.enterText(textFields.at(2), '3 Series');
      await tester.enterText(textFields.at(3), '330i');

      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      // Verify friendly conflict error banner is rendered
      expect(
        find.text('Vehicle with registration number TN01AZ9999 already exists.'),
        findsOneWidget,
      );

      // Verify user inputs are preserved in text fields
      expect(find.text('TN01AZ9999'), findsOneWidget);
      expect(find.text('BMW'), findsOneWidget);
      expect(find.text('3 Series'), findsOneWidget);
      expect(find.text('330i'), findsOneWidget);

      // Verify Save Vehicle button is still active and usable
      expect(find.widgetWithText(AppButton, 'Save Vehicle'), findsOneWidget);
    });

    testWidgets('allows user to edit registration number and retry after 409 conflict', (tester) async {
      final repo = StubVehicleRepo()..shouldThrowConflict = true;
      Vehicle? createdVehicle;

      await tester.pumpWidget(createTestWidget(
        repo: repo,
        onCreated: (v) => createdVehicle = v,
      ));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'TN01AZ9999');
      await tester.enterText(textFields.at(1), 'BMW');
      await tester.enterText(textFields.at(2), '3 Series');

      // First submit - fails with 409
      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      expect(find.text('Vehicle with registration number TN01AZ9999 already exists.'), findsOneWidget);

      // User fixes registration number and backend conflict is resolved
      repo.shouldThrowConflict = false;
      await tester.enterText(textFields.at(0), 'TN01AZ9998');

      // Retry submission
      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      expect(repo.lastCreatedRequest!.registrationNumber, 'TN01AZ9998');
      expect(createdVehicle?.registrationNumber, 'TN01AZ9998');
    });

    testWidgets('displays server error banner gracefully when API fails with 500', (tester) async {
      final repo = StubVehicleRepo()..shouldThrowServer = true;

      await tester.pumpWidget(createTestWidget(repo: repo));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'TN01AZ1111');
      await tester.enterText(textFields.at(1), 'Toyota');
      await tester.enterText(textFields.at(2), 'Fortuner');

      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      expect(find.text('Internal server error occurred.'), findsOneWidget);
      expect(find.text('TN01AZ1111'), findsOneWidget);
    });

    testWidgets('presents vehicle ownership transfer when registered to another customer and confirms transfer', (tester) async {
      final repo = StubVehicleRepo()
        ..shouldThrowConflict = true
        ..conflictDetails = {
          'existingVehicleId': 'veh-v',
          'existingCustomerId': 'cust-a',
          'existingCustomerName': 'Customer A',
          'registrationNumber': 'TN56P3334',
          'make': 'Maruti',
          'model': 'Baleno',
        };

      Vehicle? transferredResult;

      await tester.pumpWidget(createTestWidget(
        repo: repo,
        customerId: 'cust-b',
        customerName: 'Customer B',
        onCreated: (v) => transferredResult = v,
      ));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'TN56P3334');
      await tester.enterText(textFields.at(1), 'Maruti');
      await tester.enterText(textFields.at(2), 'Baleno');

      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      // 1. Conflict banner with transfer action appears
      expect(find.text('Vehicle Already Registered'), findsOneWidget);
      expect(find.textContaining('TN56P3334 is already registered to Customer A.'), findsOneWidget);
      expect(find.byKey(const Key('transfer_vehicle_button')), findsOneWidget);

      // 2. Tap Transfer Vehicle -> Confirmation dialog opens
      await tester.tap(find.byKey(const Key('transfer_vehicle_button')));
      await tester.pumpAndSettle();

      expect(find.text('Transfer Vehicle Ownership?'), findsOneWidget);
      expect(find.textContaining('Customer A'), findsWidgets);
      expect(find.textContaining('Customer B'), findsOneWidget);
      expect(
        find.textContaining('All historical service records, job cards, and invoices will remain intact with the previous owner.'),
        findsOneWidget,
      );

      // 3. Cancel transfer
      await tester.tap(find.byKey(const Key('transfer_cancel_button')));
      await tester.pumpAndSettle();

      expect(repo.transferredVehicleId, isNull);

      // 4. Tap Transfer Vehicle again and Confirm
      await tester.tap(find.byKey(const Key('transfer_vehicle_button')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('transfer_confirm_button')));
      await tester.pumpAndSettle();

      expect(repo.transferredVehicleId, 'veh-v');
      expect(repo.transferredCustomerId, 'cust-b');
      expect(transferredResult?.id, 'veh-v');
    });

    testWidgets('Case 1: handles duplicate registration owned by same customer by returning existing vehicle without conflict', (tester) async {
      final repo = StubVehicleRepo()
        ..shouldThrowConflict = true
        ..conflictDetails = {
          'existingVehicleId': '3e44b988-7cd3-46c2-a003-24fb9857b946',
          'existingCustomerId': 'cust-101',
          'existingCustomerName': 'Customer A',
          'registrationNumber': 'TN56P3334',
          'make': 'Maruti',
          'model': 'Baleno',
        };

      Vehicle? createdResult;

      await tester.pumpWidget(createTestWidget(
        repo: repo,
        customerId: 'cust-101',
        customerName: 'Customer A',
        onCreated: (v) => createdResult = v,
      ));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'TN56P3334');
      await tester.enterText(textFields.at(1), 'Maruti');
      await tester.enterText(textFields.at(2), 'Baleno');

      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      // Should NOT show conflict banner
      expect(find.text('Vehicle Already Registered'), findsNothing);
      expect(find.byKey(const Key('transfer_vehicle_button')), findsNothing);

      // Should return the existing vehicle directly without creating a duplicate
      expect(createdResult, isNotNull);
      expect(createdResult!.id, '3e44b988-7cd3-46c2-a003-24fb9857b946');
      expect(createdResult!.registrationNumber, 'TN56P3334');
      expect(createdResult!.customerId, 'cust-101');
    });

    testWidgets('handles transfer failure, preserves conflict, and allows successful retry', (tester) async {
      final repo = StubVehicleRepo()
        ..shouldThrowConflict = true
        ..conflictDetails = {
          'existingVehicleId': '3e44b988-7cd3-46c2-a003-24fb9857b946',
          'existingCustomerId': 'cust-a',
          'existingCustomerName': 'Gokula Kannan',
          'registrationNumber': 'TN56P3334',
          'make': 'Maruti',
          'model': 'Baleno',
        }
        ..shouldThrowTransferError = true;

      Vehicle? transferredResult;

      await tester.pumpWidget(createTestWidget(
        repo: repo,
        customerId: 'cust-b',
        customerName: 'Vehicle number check',
        onCreated: (v) => transferredResult = v,
      ));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'TN56P3334');
      await tester.enterText(textFields.at(1), 'Maruti');
      await tester.enterText(textFields.at(2), 'Baleno');

      await tester.tap(find.widgetWithText(AppButton, 'Save Vehicle'));
      await tester.pumpAndSettle();

      expect(find.text('Vehicle Already Registered'), findsOneWidget);

      // Tap Transfer Vehicle
      await tester.tap(find.byKey(const Key('transfer_vehicle_button')));
      await tester.pumpAndSettle();

      // Confirm Transfer - First attempt fails
      await tester.tap(find.byKey(const Key('transfer_confirm_button')));
      await tester.pumpAndSettle();

      expect(find.text('Transfer failed: Network error during transfer.'), findsOneWidget);
      expect(repo.transferCallCount, 1);
      expect(transferredResult, isNull);

      // Conflict remains visible and retry button is available
      expect(find.byKey(const Key('transfer_vehicle_button')), findsOneWidget);

      // Now resolve error and retry
      repo.shouldThrowTransferError = false;
      await tester.tap(find.byKey(const Key('transfer_vehicle_button')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('transfer_confirm_button')));
      await tester.pumpAndSettle();

      expect(repo.transferCallCount, 2);
      expect(repo.transferredVehicleId, '3e44b988-7cd3-46c2-a003-24fb9857b946');
      expect(repo.transferredCustomerId, 'cust-b');
      expect(transferredResult?.id, '3e44b988-7cd3-46c2-a003-24fb9857b946');
    });
  });
}
