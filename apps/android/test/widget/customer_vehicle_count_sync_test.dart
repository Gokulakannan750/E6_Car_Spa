import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';
import 'package:e6_car_spa/features/customers/presentation/pages/customer_details_screen.dart';
import 'package:e6_car_spa/features/customers/presentation/pages/customers_screen.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_api.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_repository.dart';
import 'package:e6_car_spa/features/vehicles/models/vehicle_model.dart';
import 'package:e6_car_spa/shared/widgets/app_loading_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

class _TestAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  _TestAuthNotifier(super.initialState);

  @override
  Future<bool> login(String username, String password) async => true;
  @override
  Future<void> logout() async => state = const Unauthenticated();
  @override
  Future<void> restoreSession() async {}
  @override
  void clearError() {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _MockCustomerRepository extends CustomerRepository {
  List<Customer> customers = [];
  Map<String, Customer> customerMap = {};
  int getCustomersCalls = 0;
  int getCustomerByIdCalls = 0;

  _MockCustomerRepository() : super(CustomerApi(Dio()));

  @override
  Future<CustomerListResponse> getCustomers({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    getCustomersCalls++;
    var list = customers;
    if (search != null && search.isNotEmpty) {
      list = list
          .where((c) =>
              c.name.toLowerCase().contains(search.toLowerCase()) ||
              c.phoneNumber.contains(search))
          .toList();
    }
    return CustomerListResponse(
      items: list,
      totalCount: list.length,
      page: page,
      pageSize: pageSize,
    );
  }

  @override
  Future<Customer> getCustomerById(String id) async {
    getCustomerByIdCalls++;
    if (customerMap.containsKey(id)) {
      return customerMap[id]!;
    }
    final match = customers.where((c) => c.id == id).firstOrNull;
    if (match != null) return match;
    return Customer(id: id, name: 'Customer $id', phoneNumber: '9876543210');
  }

  @override
  Future<CustomerHistoryResponse> getCustomerHistory(String id) async {
    return CustomerHistoryResponse(
      customerId: id,
      customerName: 'Customer $id',
      phoneNumber: '9876543210',
      totalJobCards: 0,
      totalVehicles: 0,
      jobCards: const [],
    );
  }
}

class _MockVehicleRepository extends VehicleRepository {
  Map<String, List<Vehicle>> customerVehicles = {};
  int getVehiclesCalls = 0;
  int createVehicleCalls = 0;
  int transferCalls = 0;

  _MockVehicleRepository() : super(VehicleApi(Dio()));

  @override
  Future<List<Vehicle>> getVehiclesByCustomer(String customerId) async {
    getVehiclesCalls++;
    return customerVehicles[customerId] ?? [];
  }

  @override
  Future<Vehicle> createVehicle(CreateVehicleRequest request) async {
    createVehicleCalls++;
    final v = Vehicle(
      id: 'veh-${DateTime.now().millisecondsSinceEpoch}',
      registrationNumber: request.registrationNumber,
      make: request.make,
      model: request.model,
      variant: request.variant,
      customerId: request.customerId,
      createdAt: DateTime.now(),
    );
    customerVehicles.putIfAbsent(request.customerId, () => []).add(v);
    return v;
  }

  @override
  Future<Vehicle> transferOwnership(String vehicleId, String newCustomerId) async {
    transferCalls++;
    Vehicle? found;
    for (final list in customerVehicles.values) {
      final idx = list.indexWhere((v) => v.id == vehicleId);
      if (idx != -1) {
        found = list.removeAt(idx);
        break;
      }
    }
    final transferred = Vehicle(
      id: vehicleId,
      registrationNumber: found?.registrationNumber ?? 'TN33TRANSFER',
      make: found?.make ?? 'Make',
      model: found?.model ?? 'Model',
      customerId: newCustomerId,
      createdAt: DateTime.now(),
    );
    customerVehicles.putIfAbsent(newCustomerId, () => []).add(transferred);
    return transferred;
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  const managerUser = AuthUser(
    id: 'u-1',
    username: 'admin',
    fullName: 'Admin User',
    role: 'Admin',
    isOwner: true,
    permissions: ['customers.view', 'customers.create', 'customers.edit'],
  );

  Widget createCustomerListWidget({
    required _MockCustomerRepository custRepo,
    required _MockVehicleRepository vehRepo,
  }) {
    return ProviderScope(
      overrides: [
        customerRepositoryProvider.overrideWithValue(custRepo),
        vehicleRepositoryProvider.overrideWithValue(vehRepo),
        authNotifierProvider.overrideWith(
          (ref) => _TestAuthNotifier(const Authenticated(managerUser)),
        ),
      ],
      child: const MaterialApp(
        home: CustomersScreen(),
      ),
    );
  }

  Widget createCustomerDetailsWidget({
    required String customerId,
    required _MockCustomerRepository custRepo,
    required _MockVehicleRepository vehRepo,
  }) {
    return ProviderScope(
      overrides: [
        customerRepositoryProvider.overrideWithValue(custRepo),
        vehicleRepositoryProvider.overrideWithValue(vehRepo),
        authNotifierProvider.overrideWith(
          (ref) => _TestAuthNotifier(const Authenticated(managerUser)),
        ),
      ],
      child: MaterialApp(
        home: CustomerDetailsScreen(customerId: customerId),
      ),
    );
  }

  group('Customer Vehicle Count Display & Parity', () {
    testWidgets('Displays accurate counts for 0, 1, 2, and 3 vehicles with proper singular/plural UX',
        (tester) async {
      final custRepo = _MockCustomerRepository();
      final vehRepo = _MockVehicleRepository();

      custRepo.customers = [
        const Customer(id: 'c-0', name: 'Zero Vehicles', phoneNumber: '9870000000', vehicleCount: 0),
        const Customer(id: 'c-1', name: 'One Vehicle', phoneNumber: '9870000001', vehicleCount: 1),
        const Customer(id: 'c-2', name: 'Krishna', phoneNumber: '9874563210', vehicleCount: 2),
        const Customer(id: 'c-3', name: 'Three Vehicles', phoneNumber: '9870000003', vehicleCount: 3),
      ];

      await tester.pumpWidget(createCustomerListWidget(custRepo: custRepo, vehRepo: vehRepo));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('0 vehicles'), findsOneWidget);
      expect(find.text('1 vehicle'), findsOneWidget);
      expect(find.text('2 vehicles'), findsOneWidget);
      expect(find.text('3 vehicles'), findsOneWidget);
    });

    testWidgets('Customer List and Customer Details show consistent vehicle counts for Krishna',
        (tester) async {
      final custRepo = _MockCustomerRepository();
      final vehRepo = _MockVehicleRepository();

      const krishna = Customer(
        id: 'c-krishna',
        name: 'Krishna',
        phoneNumber: '9874563210',
        vehicleCount: 2,
      );
      custRepo.customers = [krishna];
      custRepo.customerMap[krishna.id] = krishna;

      vehRepo.customerVehicles[krishna.id] = [
        Vehicle(
          id: 'v-1',
          registrationNumber: 'TN33A0001',
          make: 'Tata',
          model: 'Nexon',
          customerId: krishna.id,
          createdAt: DateTime.now(),
        ),
        Vehicle(
          id: 'v-2',
          registrationNumber: 'TN33A0002',
          make: 'Tata',
          model: 'Mazza',
          customerId: krishna.id,
          createdAt: DateTime.now(),
        ),
      ];

      // 1. Verify Customer List
      await tester.pumpWidget(createCustomerListWidget(custRepo: custRepo, vehRepo: vehRepo));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Krishna'), findsOneWidget);
      expect(find.text('2 vehicles'), findsOneWidget);

      // 2. Verify Customer Details
      await tester.pumpWidget(createCustomerDetailsWidget(
        customerId: krishna.id,
        custRepo: custRepo,
        vehRepo: vehRepo,
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Registered Vehicles (2)'), findsOneWidget);
      expect(find.text('TN33A0001'), findsOneWidget);
      expect(find.text('TN33A0002'), findsOneWidget);
    });
  });

  group('Cross-Platform Auto-Refresh Synchronization', () {
    testWidgets('12-second periodic AutoRefreshMixin updates Customer List vehicle count without navigation',
        (tester) async {
      final custRepo = _MockCustomerRepository();
      final vehRepo = _MockVehicleRepository();

      custRepo.customers = [
        const Customer(id: 'c-krishna', name: 'Krishna', phoneNumber: '9874563210', vehicleCount: 2),
      ];

      await tester.pumpWidget(createCustomerListWidget(custRepo: custRepo, vehRepo: vehRepo));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('2 vehicles'), findsOneWidget);
      expect(find.text('3 vehicles'), findsNothing);

      // Simulate external service/vehicle creation (e.g. from Windows)
      custRepo.customers = [
        const Customer(id: 'c-krishna', name: 'Krishna', phoneNumber: '9874563210', vehicleCount: 3),
      ];

      // Advance timer by 12 seconds
      await tester.pump(const Duration(seconds: 12));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Rebuilt automatically on Customer List screen without navigation
      expect(find.text('3 vehicles'), findsOneWidget);
      expect(find.text('2 vehicles'), findsNothing);
    });

    testWidgets('12-second periodic AutoRefreshMixin updates Customer Details registered vehicles count',
        (tester) async {
      final custRepo = _MockCustomerRepository();
      final vehRepo = _MockVehicleRepository();

      const krishna = Customer(
        id: 'c-krishna',
        name: 'Krishna',
        phoneNumber: '9874563210',
        vehicleCount: 2,
      );
      custRepo.customers = [krishna];
      custRepo.customerMap[krishna.id] = krishna;

      vehRepo.customerVehicles[krishna.id] = [
        Vehicle(id: 'v-1', registrationNumber: 'TN33A0001', make: 'Tata', model: 'Nexon', customerId: krishna.id, createdAt: DateTime.now()),
        Vehicle(id: 'v-2', registrationNumber: 'TN33A0002', make: 'Tata', model: 'Mazza', customerId: krishna.id, createdAt: DateTime.now()),
      ];

      await tester.pumpWidget(createCustomerDetailsWidget(
        customerId: krishna.id,
        custRepo: custRepo,
        vehRepo: vehRepo,
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Registered Vehicles (2)'), findsOneWidget);

      // Windows adds a 3rd vehicle to Krishna
      vehRepo.customerVehicles[krishna.id] = [
        ...vehRepo.customerVehicles[krishna.id]!,
        Vehicle(id: 'v-3', registrationNumber: 'TN33A0003', make: 'Tata', model: 'Safari', customerId: krishna.id, createdAt: DateTime.now()),
      ];

      // Advance by 12 seconds
      await tester.pump(const Duration(seconds: 12));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Registered Vehicles (3)'), findsOneWidget);
      expect(find.text('TN33A0003'), findsOneWidget);
    });

    testWidgets('Silent refresh updates list quietly without showing full-page loading spinner',
        (tester) async {
      final custRepo = _MockCustomerRepository();
      final vehRepo = _MockVehicleRepository();

      custRepo.customers = [
        const Customer(id: 'c-1', name: 'Customer 1', phoneNumber: '9876543210', vehicleCount: 1),
      ];

      await tester.pumpWidget(createCustomerListWidget(custRepo: custRepo, vehRepo: vehRepo));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('1 vehicle'), findsOneWidget);
      expect(find.byType(AppLoadingState), findsNothing);

      // Trigger 12s periodic timer
      await tester.pump(const Duration(seconds: 12));

      // AppLoadingState is never shown during background refresh
      expect(find.byType(AppLoadingState), findsNothing);
      expect(find.text('Customer 1'), findsOneWidget);
    });

    testWidgets('Search query survives background silent refresh without resetting',
        (tester) async {
      final custRepo = _MockCustomerRepository();
      final vehRepo = _MockVehicleRepository();

      custRepo.customers = [
        const Customer(id: 'c-1', name: 'Gokul', phoneNumber: '9876543210', vehicleCount: 1),
        const Customer(id: 'c-2', name: 'Krishna', phoneNumber: '9874563210', vehicleCount: 2),
      ];

      await tester.pumpWidget(createCustomerListWidget(custRepo: custRepo, vehRepo: vehRepo));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Gokul'), findsOneWidget);
      expect(find.text('Krishna'), findsOneWidget);

      // Type search query
      await tester.enterText(find.byType(TextField), 'Krishna');
      await tester.pumpAndSettle();

      expect(find.widgetWithText(InkWell, 'Krishna'), findsOneWidget);
      expect(find.text('Gokul'), findsNothing);

      // Now background refresh fires after Windows updates data
      custRepo.customers = [
        const Customer(id: 'c-1', name: 'Gokul', phoneNumber: '9876543210', vehicleCount: 2),
        const Customer(id: 'c-2', name: 'Krishna', phoneNumber: '9874563210', vehicleCount: 3),
      ];

      await tester.pump(const Duration(seconds: 12));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Search remains active and displays updated Krishna data with 3 vehicles
      expect(find.widgetWithText(InkWell, 'Krishna'), findsOneWidget);
      expect(find.text('3 vehicles'), findsOneWidget);
      expect(find.text('Gokul'), findsNothing);
      expect(find.text('Search results for "Krishna"'), findsOneWidget);
    });

    testWidgets('App lifecycle inactive -> resumed triggers auto-refresh',
        (tester) async {
      final custRepo = _MockCustomerRepository();
      final vehRepo = _MockVehicleRepository();

      custRepo.customers = [
        const Customer(id: 'c-1', name: 'Krishna', phoneNumber: '9874563210', vehicleCount: 2),
      ];

      await tester.pumpWidget(createCustomerListWidget(custRepo: custRepo, vehRepo: vehRepo));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final initialCalls = custRepo.getCustomersCalls;

      // Simulate app backgrounding
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();

      // Simulate app returning to foreground
      custRepo.customers = [
        const Customer(id: 'c-1', name: 'Krishna', phoneNumber: '9874563210', vehicleCount: 3),
      ];
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(custRepo.getCustomersCalls, greaterThan(initialCalls));
      expect(find.text('3 vehicles'), findsOneWidget);
    });
  });
}
