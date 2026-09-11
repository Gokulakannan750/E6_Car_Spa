import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';
import 'package:e6_car_spa/features/customers/presentation/widgets/edit_customer_dialog.dart';
import 'package:e6_car_spa/shared/widgets/app_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

class _FakeCustomerRepo extends CustomerRepository {
  UpdateCustomerRequest? lastUpdateRequest;
  int updateCallCount = 0;

  _FakeCustomerRepo() : super(CustomerApi(Dio()));

  @override
  Future<Customer> updateCustomer(String id, UpdateCustomerRequest request) async {
    updateCallCount++;
    lastUpdateRequest = request;
    return Customer(
      id: id,
      name: request.name,
      phoneNumber: request.phoneNumber,
      email: request.email,
      address: request.address,
      vehicleCount: 1,
    );
  }

  @override
  Future<Customer> getCustomerById(String id) async {
    return const Customer(
      id: 'cust-1',
      name: 'Ramesh Kumar',
      phoneNumber: '9876543210',
      email: 'ramesh@example.com',
      address: '12 Anna Salai, Chennai',
    );
  }

  @override
  Future<CustomerHistoryResponse> getCustomerHistory(String id) async {
    return const CustomerHistoryResponse(
      customerId: 'cust-1',
      customerName: 'Ramesh Kumar',
      phoneNumber: '9876543210',
      totalJobCards: 0,
      totalVehicles: 0,
      jobCards: [],
    );
  }
}

class _TestAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  _TestAuthNotifier(super.initialState);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  const testCustomer = Customer(
    id: 'cust-1',
    name: 'Ramesh Kumar',
    phoneNumber: '9876543210',
    email: 'ramesh@example.com',
    address: '12 Anna Salai, Chennai',
  );

  const managerUser = AuthUser(
    id: 'u-1',
    username: 'admin',
    fullName: 'Admin User',
    role: 'Admin',
    isOwner: true,
    permissions: ['customers.view', 'customers.edit'],
  );

  Widget createDialogWidget({required _FakeCustomerRepo repo}) {
    return ProviderScope(
      overrides: [
        customerRepositoryProvider.overrideWithValue(repo),
        authNotifierProvider.overrideWith((ref) => _TestAuthNotifier(const Authenticated(managerUser))),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () => EditCustomerDialog.show(context, customer: testCustomer),
              child: const Text('Open Dialog'),
            ),
          ),
        ),
      ),
    );
  }

  group('EditCustomerDialog Keyboard & Submission Tests', () {
    testWidgets('Pressing Next on Name field shifts focus to Phone and does NOT submit', (tester) async {
      final repo = _FakeCustomerRepo();
      await tester.pumpWidget(createDialogWidget(repo: repo));
      await tester.tap(find.text('Open Dialog'));
      await tester.pumpAndSettle();

      // Find fields
      final nameField = find.widgetWithText(TextFormField, 'Ramesh Kumar');
      final phoneField = find.widgetWithText(TextFormField, '9876543210');

      expect(nameField, findsOneWidget);
      expect(phoneField, findsOneWidget);

      // Focus name field and send TextInputAction.next
      await tester.tap(nameField);
      await tester.pumpAndSettle();
      await tester.testTextInput.receiveAction(TextInputAction.next);
      await tester.pumpAndSettle();

      // Form should NOT have submitted
      expect(repo.updateCallCount, 0);

      // Verify Name field has TextInputAction.next configured
      final nameAppTextField = tester.widget<AppTextField>(
        find.ancestor(of: nameField, matching: find.byType(AppTextField)),
      );
      expect(nameAppTextField.textInputAction, TextInputAction.next);
    });

    testWidgets('Pressing Next on Phone field does NOT submit and has TextInputAction.next', (tester) async {
      final repo = _FakeCustomerRepo();
      await tester.pumpWidget(createDialogWidget(repo: repo));
      await tester.tap(find.text('Open Dialog'));
      await tester.pumpAndSettle();

      final phoneField = find.widgetWithText(TextFormField, '9876543210');

      // Focus phone and trigger Next
      await tester.tap(phoneField);
      await tester.pumpAndSettle();
      await tester.testTextInput.receiveAction(TextInputAction.next);
      await tester.pumpAndSettle();

      expect(repo.updateCallCount, 0);

      final phoneAppTextField = tester.widget<AppTextField>(
        find.ancestor(of: phoneField, matching: find.byType(AppTextField)),
      );
      expect(phoneAppTextField.textInputAction, TextInputAction.next);
    });

    testWidgets('Pressing Next on Email field does NOT submit and has TextInputAction.next', (tester) async {
      final repo = _FakeCustomerRepo();
      await tester.pumpWidget(createDialogWidget(repo: repo));
      await tester.tap(find.text('Open Dialog'));
      await tester.pumpAndSettle();

      final emailField = find.widgetWithText(TextFormField, 'ramesh@example.com');

      // Focus email and trigger Next
      await tester.tap(emailField);
      await tester.pumpAndSettle();
      await tester.testTextInput.receiveAction(TextInputAction.next);
      await tester.pumpAndSettle();

      expect(repo.updateCallCount, 0);

      final emailAppTextField = tester.widget<AppTextField>(
        find.ancestor(of: emailField, matching: find.byType(AppTextField)),
      );
      expect(emailAppTextField.textInputAction, TextInputAction.next);
    });

    testWidgets('Pressing Done on Address field submits the form', (tester) async {
      final repo = _FakeCustomerRepo();
      await tester.pumpWidget(createDialogWidget(repo: repo));
      await tester.tap(find.text('Open Dialog'));
      await tester.pumpAndSettle();

      final addressField = find.widgetWithText(TextFormField, '12 Anna Salai, Chennai');

      await tester.tap(addressField);
      await tester.pumpAndSettle();
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(repo.updateCallCount, 1);
      expect(repo.lastUpdateRequest?.name, 'Ramesh Kumar');
      expect(repo.lastUpdateRequest?.phoneNumber, '9876543210');
    });

    testWidgets('Tapping explicit Save Changes button submits the form', (tester) async {
      final repo = _FakeCustomerRepo();
      await tester.pumpWidget(createDialogWidget(repo: repo));
      await tester.tap(find.text('Open Dialog'));
      await tester.pumpAndSettle();

      final saveButton = find.widgetWithText(ElevatedButton, 'Save Changes');
      expect(saveButton, findsOneWidget);

      await tester.tap(saveButton);
      await tester.pumpAndSettle();

      expect(repo.updateCallCount, 1);
      expect(repo.lastUpdateRequest?.name, 'Ramesh Kumar');
    });
  });
}
