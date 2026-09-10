import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';
import 'package:e6_car_spa/features/customers/presentation/widgets/add_customer_dialog.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:dio/dio.dart';

/// Stub that lets tests control success/failure of createCustomer.
/// Overrides getCustomers to return empty (avoiding real API calls from the notifier).
class StubCustomerRepo extends CustomerRepository {
  bool shouldThrowConflict = false;
  bool shouldThrowServer = false;
  CreateCustomerRequest? lastCreatedRequest;
  String conflictMessage = 'A customer with phone number 9876543210 already exists.';

  StubCustomerRepo() : super(CustomerApi(Dio()));

  @override
  Future<CustomerListResponse> getCustomers({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    return const CustomerListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);
  }

  @override
  Future<Customer> createCustomer(CreateCustomerRequest request) async {
    lastCreatedRequest = request;
    if (shouldThrowConflict) {
      throw ConflictException(
        message: conflictMessage,
        endpoint: '/api/customers',
      );
    }
    if (shouldThrowServer) {
      throw const ServerException(
        message: 'Internal server error occurred.',
        endpoint: '/api/customers',
      );
    }
    return Customer(
      id: 'cust-new-1',
      name: request.name,
      phoneNumber: request.phoneNumber,
      email: request.email,
      address: request.address,
      createdAt: DateTime.now(),
    );
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  Widget createTestWidget({
    required StubCustomerRepo repo,
    String? initialPhone,
    Function(Customer)? onCreated,
  }) {
    return ProviderScope(
      overrides: [
        customerRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: AddCustomerDialog(
            initialPhone: initialPhone,
            onCreated: onCreated,
          ),
        ),
      ),
    );
  }

  group('AddCustomerDialog - Phone Conflict & Validation Tests', () {
    testWidgets('renders customer form fields and pre-populates initial phone number', (tester) async {
      final repo = StubCustomerRepo();
      await tester.pumpWidget(createTestWidget(repo: repo, initialPhone: '9876543210'));
      await tester.pumpAndSettle();

      // Header text from AppModalHeader
      expect(find.text('Add New Customer'), findsOneWidget);

      // Field labels rendered by AppTextField
      expect(find.text('Full Name'), findsOneWidget);
      expect(find.text('Phone Number'), findsOneWidget);
      expect(find.text('Email (Optional)'), findsOneWidget);
      expect(find.text('Address (Optional)'), findsOneWidget);

      // Pre-populated phone value
      expect(find.text('9876543210'), findsOneWidget);

      // Submit button uses AppButton with label 'Create Customer'
      expect(find.widgetWithText(AppButton, 'Create Customer'), findsOneWidget);
    });

    testWidgets('validates required name and 10-digit phone number before submitting', (tester) async {
      final repo = StubCustomerRepo();
      await tester.pumpWidget(createTestWidget(repo: repo));
      await tester.pumpAndSettle();

      // Attempt to submit empty form
      await tester.tap(find.widgetWithText(AppButton, 'Create Customer'));
      await tester.pumpAndSettle();

      // Validation messages from production validators
      expect(find.text('Customer name is required'), findsOneWidget);
      expect(find.text('Phone number is required'), findsOneWidget);
      expect(repo.lastCreatedRequest, isNull);

      // Enter valid name but invalid phone (<10 digits)
      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), 'Gokul Sharma');
      await tester.enterText(textFields.at(1), '98765');

      await tester.tap(find.widgetWithText(AppButton, 'Create Customer'));
      await tester.pumpAndSettle();

      // PhoneValidator returns this exact message
      expect(find.text('Phone number must be exactly 10 digits'), findsOneWidget);
      expect(repo.lastCreatedRequest, isNull);
    });

    testWidgets('successfully submits valid customer details', (tester) async {
      final repo = StubCustomerRepo();
      Customer? createdCustomer;

      await tester.pumpWidget(createTestWidget(
        repo: repo,
        onCreated: (c) => createdCustomer = c,
      ));
      await tester.pumpAndSettle();

      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), 'Aravind Swamy');
      await tester.enterText(textFields.at(1), '9876543210');
      await tester.enterText(textFields.at(2), 'aravind@example.com');
      await tester.enterText(textFields.at(3), '123 Main Road, Chennai');

      await tester.tap(find.widgetWithText(AppButton, 'Create Customer'));
      await tester.pumpAndSettle();

      expect(repo.lastCreatedRequest, isNotNull);
      expect(repo.lastCreatedRequest!.name, 'Aravind Swamy');
      expect(repo.lastCreatedRequest!.phoneNumber, '9876543210');
      expect(repo.lastCreatedRequest!.email, 'aravind@example.com');
      expect(repo.lastCreatedRequest!.address, '123 Main Road, Chennai');
      expect(createdCustomer?.name, 'Aravind Swamy');
    });

    testWidgets('handles HTTP 409 duplicate phone conflict without crash and preserves inputs', (tester) async {
      final repo = StubCustomerRepo()..shouldThrowConflict = true;

      await tester.pumpWidget(createTestWidget(repo: repo));
      await tester.pumpAndSettle();

      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), 'Meena Kumari');
      await tester.enterText(textFields.at(1), '9876543210');
      await tester.enterText(textFields.at(2), 'meena@example.com');
      await tester.enterText(textFields.at(3), '45 Anna Nagar, Erode');

      await tester.tap(find.widgetWithText(AppButton, 'Create Customer'));
      await tester.pumpAndSettle();

      // Error is displayed via toString().replaceAll('ApiException: ', '')
      // ConflictException.toString() => 'ApiException[409]: <message> at <endpoint>'
      // After replaceAll => '[409]: <message> at <endpoint>'
      // The error banner should contain part of the conflict message
      expect(
        find.textContaining('A customer with phone number 9876543210 already exists.'),
        findsOneWidget,
      );

      // User entered text is preserved in form fields
      expect(find.text('Meena Kumari'), findsOneWidget);
      expect(find.text('9876543210'), findsOneWidget);
      expect(find.text('meena@example.com'), findsOneWidget);
      expect(find.text('45 Anna Nagar, Erode'), findsOneWidget);

      // Dialog remains active — button still visible
      expect(find.widgetWithText(AppButton, 'Create Customer'), findsOneWidget);
    });

    testWidgets('allows user to edit phone number and successfully retry after conflict', (tester) async {
      final repo = StubCustomerRepo()..shouldThrowConflict = true;
      Customer? createdCustomer;

      await tester.pumpWidget(createTestWidget(
        repo: repo,
        onCreated: (c) => createdCustomer = c,
      ));
      await tester.pumpAndSettle();

      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), 'Meena Kumari');
      await tester.enterText(textFields.at(1), '9876543210');

      // First submit - fails with 409
      await tester.tap(find.widgetWithText(AppButton, 'Create Customer'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('A customer with phone number 9876543210 already exists.'),
        findsOneWidget,
      );

      // Correct phone number and retry
      repo.shouldThrowConflict = false;
      await tester.enterText(textFields.at(1), '9876543211');

      await tester.tap(find.widgetWithText(AppButton, 'Create Customer'));
      await tester.pumpAndSettle();

      expect(repo.lastCreatedRequest!.phoneNumber, '9876543211');
      expect(createdCustomer?.phoneNumber, '9876543211');
    });
  });
}
