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
import 'package:e6_car_spa/shared/widgets/app_loading_state.dart';
import 'package:dio/dio.dart';

class _FakeCustomerRepo extends CustomerRepository {
  Customer? mockCustomer;
  CustomerHistoryResponse? mockHistory;
  ApiException? errorToThrow;
  int getCustomerByIdCallCount = 0;

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

      expect(find.widgetWithText(FloatingActionButton, 'New Job Card'), findsOneWidget);

      await tester.tap(find.widgetWithText(FloatingActionButton, 'New Job Card'));
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
  });
}
