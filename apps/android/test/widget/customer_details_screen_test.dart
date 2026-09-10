import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';
import 'package:e6_car_spa/features/customers/presentation/pages/customer_details_screen.dart';
import 'package:e6_car_spa/features/customers/providers/customer_providers.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_api.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_repository.dart';
import 'package:e6_car_spa/features/vehicles/models/vehicle_model.dart';
import 'package:e6_car_spa/shared/widgets/app_error_state.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/shared/widgets/app_loading_state.dart';
import 'package:dio/dio.dart';

class _FakeCustomerRepo extends CustomerRepository {
  Customer? mockCustomer;
  CustomerHistoryResponse? mockHistory;
  ApiException? errorToThrow;
  int getCustomerByIdCallCount = 0;
  int updateCustomerCallCount = 0;
  UpdateCustomerRequest? lastUpdateRequest;

  _FakeCustomerRepo() : super(CustomerApi(Dio()));

  @override
  Future<Customer> getCustomerById(String id) async {
    getCustomerByIdCallCount++;
    if (errorToThrow != null) throw errorToThrow!;
    if (mockCustomer != null) return mockCustomer!;
    throw const NotFoundException(message: 'Customer not found.');
  }

  @override
  Future<CustomerHistoryResponse> getCustomerHistory(String id) async {
    if (errorToThrow != null) throw errorToThrow!;
    return mockHistory ??
        const CustomerHistoryResponse(
          customerId: 'cust-100',
          customerName: 'Ramesh Kumar',
          phoneNumber: '9876543210',
          totalJobCards: 2,
          totalVehicles: 1,
          jobCards: [],
        );
  }

  @override
  Future<Customer> updateCustomer(String id, UpdateCustomerRequest request) async {
    updateCustomerCallCount++;
    lastUpdateRequest = request;
    if (errorToThrow != null) throw errorToThrow!;
    final updated = Customer(
      id: id,
      name: request.name,
      phoneNumber: request.phoneNumber,
      email: request.email,
      address: request.address,
      vehicleCount: mockCustomer?.vehicleCount ?? 0,
    );
    mockCustomer = updated;
    return updated;
  }
}

class _FakeVehicleRepo extends VehicleRepository {
  List<Vehicle> mockVehicles = [];

  _FakeVehicleRepo() : super(VehicleApi(Dio()));

  @override
  Future<List<Vehicle>> getVehiclesByCustomer(String customerId) async {
    return mockVehicles;
  }
}

void main() {
  group('CustomerDetailsScreen Widget Tests', () {
    const testCustomerId = 'cust-100';
    final sampleCustomer = const Customer(
      id: testCustomerId,
      name: 'Ramesh Kumar',
      phoneNumber: '9876543210',
      email: 'ramesh@example.com',
      vehicleCount: 1,
    );

    final sampleVehicle = Vehicle(
      id: 'veh-1',
      registrationNumber: 'TN01AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      color: 'Polar White',
      customerId: testCustomerId,
      createdAt: DateTime(2026, 1, 1),
    );

    testWidgets('renders loading state while customer details are fetching', (tester) async {
      final fakeCustRepo = _FakeCustomerRepo();
      final fakeVehRepo = _FakeVehicleRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                const CustomerDetailsState(isLoading: true),
                false, // autoLoad = false to test loading UI deterministically
              );
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      expect(find.byType(AppLoadingState), findsOneWidget);
      expect(find.text('Loading customer profile...'), findsOneWidget);
    });

    testWidgets('renders error state when customer lookup fails and allows retry', (tester) async {
      final fakeCustRepo = _FakeCustomerRepo();
      final fakeVehRepo = _FakeVehicleRepo();
      fakeCustRepo.errorToThrow = const ServerException(message: 'Database connection failed');

      late CustomerDetailsNotifier notifier;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              notifier = CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                const CustomerDetailsState(
                  isLoading: false,
                  errorMessage: 'Database connection failed',
                ),
                false,
              );
              return notifier;
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      expect(find.byType(AppErrorState), findsOneWidget);
      expect(find.text('Database connection failed'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);

      // Tap retry
      await tester.tap(find.text('Try Again'));
      await tester.pump();

      expect(fakeCustRepo.getCustomerByIdCallCount, 1);
    });

    testWidgets('renders customer profile information accurately', (tester) async {
      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();
      fakeVehRepo.mockVehicles = [sampleVehicle];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: [sampleVehicle],
                ),
                false,
              );
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      expect(find.text('Ramesh Kumar'), findsWidgets); // In AppBar and Card
      expect(find.text('9876543210'), findsOneWidget);
      expect(find.text('ramesh@example.com'), findsOneWidget);
      expect(find.text('RK'), findsOneWidget); // Customer initials
    });

    testWidgets('renders associated vehicles list and Add Vehicle action', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();
      fakeVehRepo.mockVehicles = [sampleVehicle];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: [sampleVehicle],
                ),
                false,
              );
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      expect(find.text('TN01AB1234'), findsOneWidget);
      expect(find.text('Hyundai Creta (SX(O))'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Add Vehicle'), findsOneWidget);
    });

    testWidgets('New Job Card Floating Action Button is enabled and triggers navigation', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();
      fakeVehRepo.mockVehicles = [sampleVehicle];

      String? navigatedRoute;

      final router = GoRouter(
        initialLocation: '/customers/$testCustomerId',
        routes: [
          GoRoute(
            path: '/customers/$testCustomerId',
            builder: (context, state) => const CustomerDetailsScreen(customerId: testCustomerId),
          ),
          GoRoute(
            path: '/job-cards/new',
            builder: (context, state) {
              navigatedRoute = '/job-cards/new';
              return const Scaffold(body: Text('New Job Card Page'));
            },
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: [sampleVehicle],
                ),
                false,
              );
            }),
          ],
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );

      expect(find.text('New Job Card'), findsOneWidget);

      await tester.tap(find.text('New Job Card'));
      await tester.pumpAndSettle();

      expect(navigatedRoute, '/job-cards/new');
      expect(find.text('New Job Card Page'), findsOneWidget);
    });

    testWidgets('AppBar back button navigates to /customers', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();

      String? navigatedRoute;

      final router = GoRouter(
        initialLocation: '/customers/$testCustomerId',
        routes: [
          GoRoute(
            path: '/customers/$testCustomerId',
            builder: (context, state) => const CustomerDetailsScreen(customerId: testCustomerId),
          ),
          GoRoute(
            path: '/customers',
            builder: (context, state) {
              navigatedRoute = '/customers';
              return const Scaffold(body: Text('Customers Directory'));
            },
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: const [],
                ),
                false,
              );
            }),
          ],
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );

      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      expect(navigatedRoute, '/customers');
      expect(find.text('Customers Directory'), findsOneWidget);
    });

    testWidgets('Customer Details displays Edit Details and New Job Card with pre-populated edit form', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: [sampleVehicle],
                ),
                false,
              );
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify "Edit Details" and "New Job Card" are both displayed
      expect(find.text('Edit Details'), findsOneWidget);
      expect(find.text('New Job Card'), findsOneWidget);
      expect(find.byKey(const Key('edit_details_action')), findsOneWidget);

      // Tap Edit Details bottom button
      await tester.tap(find.byKey(const Key('edit_details_bottom_button')));
      await tester.pumpAndSettle();

      // Verify Edit Details form is opened and pre-populated
      expect(find.text('Update customer contact profile'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Ramesh Kumar'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '9876543210'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'ramesh@example.com'), findsOneWidget);
    });

    testWidgets('Editing customer details and clicking Save updates customer and closes dialog', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: [sampleVehicle],
                ),
                false,
              );
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open Edit Dialog
      await tester.tap(find.byKey(const Key('edit_details_action')));
      await tester.pumpAndSettle();

      // Enter updated details
      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), 'Ramesh Kumar Updated');
      await tester.enterText(textFields.at(1), '9123456780');
      await tester.enterText(textFields.at(2), 'updated@example.com');
      await tester.enterText(textFields.at(3), '123 New Street, Chennai');

      // Click Save Changes
      await tester.tap(find.byKey(const Key('save_customer_button')));
      await tester.pumpAndSettle();

      // Verify update was called on repo
      expect(fakeCustRepo.updateCustomerCallCount, 1);
      expect(fakeCustRepo.lastUpdateRequest?.name, 'Ramesh Kumar Updated');
      expect(fakeCustRepo.lastUpdateRequest?.phoneNumber, '9123456780');
      expect(fakeCustRepo.lastUpdateRequest?.email, 'updated@example.com');
      expect(fakeCustRepo.lastUpdateRequest?.address, '123 New Street, Chennai');

      // Verify dialog closed and updated name is visible on screen
      expect(find.text('Update customer contact profile'), findsNothing);
      expect(find.text('Ramesh Kumar Updated'), findsWidgets);
    });

    testWidgets('Submitting form via Enter key executes same save handler and closes dialog', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: [sampleVehicle],
                ),
                false,
              );
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open Edit Dialog
      await tester.tap(find.byKey(const Key('edit_details_bottom_button')));
      await tester.pumpAndSettle();

      // Modify field and submit with Enter/Done action
      final nameField = find.widgetWithText(TextFormField, 'Ramesh Kumar');
      await tester.enterText(nameField, 'Ramesh By Enter');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(fakeCustRepo.updateCustomerCallCount, 1);
      expect(fakeCustRepo.lastUpdateRequest?.name, 'Ramesh By Enter');
      expect(find.text('Update customer contact profile'), findsNothing);
      expect(find.text('Ramesh By Enter'), findsWidgets);
    });

    testWidgets('Failed save keeps dialog open, preserves entered values, and displays error', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: [sampleVehicle],
                ),
                false,
              );
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open Edit Dialog
      await tester.tap(find.byKey(const Key('edit_details_bottom_button')));
      await tester.pumpAndSettle();

      // Set repo to fail
      fakeCustRepo.errorToThrow = const ValidationException(message: 'Customer name already exists.');
      final nameField = find.widgetWithText(TextFormField, 'Ramesh Kumar');
      await tester.enterText(nameField, 'Ramesh Duplicate');

      await tester.tap(find.byKey(const Key('save_customer_button')));
      await tester.pumpAndSettle();

      // Dialog is STILL open
      expect(find.text('Update customer contact profile'), findsOneWidget);
      // Friendly error shown
      expect(find.text('Customer name already exists.'), findsOneWidget);
      // Entered value preserved
      expect(find.widgetWithText(TextFormField, 'Ramesh Duplicate'), findsOneWidget);
    });

    testWidgets('Respects permissions: Edit Details is hidden when user lacks customers.edit', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final fakeCustRepo = _FakeCustomerRepo();
      fakeCustRepo.mockCustomer = sampleCustomer;
      final fakeVehRepo = _FakeVehicleRepo();

      const staffWithoutEdit = AuthUser(
        id: 'u-1',
        fullName: 'Staff Viewer',
        username: 'staff_viewer',
        role: 'Staff',
        isOwner: false,
        permissions: ['customers.view'], // no customers.edit
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(staffWithoutEdit),
            customerRepositoryProvider.overrideWithValue(fakeCustRepo),
            vehicleRepositoryProvider.overrideWithValue(fakeVehRepo),
            customerDetailsProvider(testCustomerId).overrideWith((ref) {
              return CustomerDetailsNotifier(
                testCustomerId,
                fakeCustRepo,
                fakeVehRepo,
                CustomerDetailsState(
                  isLoading: false,
                  customer: sampleCustomer,
                  vehicles: [sampleVehicle],
                ),
                false,
              );
            }),
          ],
          child: const MaterialApp(
            home: CustomerDetailsScreen(customerId: testCustomerId),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Edit Details is NOT shown anywhere
      expect(find.text('Edit Details'), findsNothing);
      expect(find.byKey(const Key('edit_details_action')), findsNothing);
      expect(find.byKey(const Key('edit_details_bottom_button')), findsNothing);

      // New Job Card remains accessible
      expect(find.text('New Job Card'), findsOneWidget);
    });
  });
}

