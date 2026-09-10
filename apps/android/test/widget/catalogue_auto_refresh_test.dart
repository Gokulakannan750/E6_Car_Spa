import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/catalogue/data/service_api.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:e6_car_spa/features/catalogue/presentation/pages/catalogue_screen.dart';
import 'package:e6_car_spa/features/catalogue/presentation/providers/catalogue_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _AutoRefreshMockServiceRepository extends ServiceRepository {
  _AutoRefreshMockServiceRepository() : super(ServiceApi(Dio()));

  List<Service> services = [];
  List<String> categories = [
    'Exterior Detailing',
    'General Services',
    'Interior Care',
    'Others',
    'Protection Packages',
  ];
  int getServicesCalls = 0;

  @override
  Future<ServiceListResponse> getServices({
    bool? isActive = true,
    int page = 1,
    int pageSize = 100,
    String? search,
    String? category,
  }) async {
    getServicesCalls++;
    var list = services;
    if (category != null && category.isNotEmpty) {
      list = list.where((s) => s.category == category).toList();
    }
    if (search != null && search.isNotEmpty) {
      list = list.where((s) => s.name.toLowerCase().contains(search.toLowerCase())).toList();
    }
    return ServiceListResponse(
      items: list,
      totalCount: list.length,
      page: page,
      pageSize: pageSize,
    );
  }

  @override
  Future<List<String>> getCategories() async {
    return categories;
  }

  @override
  Future<Service> createService(CreateServiceRequest request) async {
    final created = Service(
      id: 'svc-${DateTime.now().millisecondsSinceEpoch}',
      name: request.name,
      category: request.category,
      price: request.price,
      description: request.description,
      taxPercentage: request.taxPercentage,
      isActive: request.isActive,
    );
    services.add(created);
    return created;
  }
}

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

void main() {
  const managerUser = AuthUser(
    id: 'u-1',
    username: 'admin',
    fullName: 'Admin User',
    role: 'Admin',
    isOwner: true,
    permissions: ['catalogue.view', 'catalogue.create', 'catalogue.edit'],
  );

  Widget createTestWidget(ServiceRepository repo) {
    return ProviderScope(
      overrides: [
        serviceRepositoryProvider.overrideWithValue(repo),
        authNotifierProvider.overrideWith((ref) => _TestAuthNotifier(const Authenticated(managerUser))),
      ],
      child: const MaterialApp(
        home: CatalogueScreen(),
      ),
    );
  }

  group('Android Catalogue Auto-Refresh Tests', () {
    testWidgets('1. Windows adds a service -> Android Catalogue sitting open auto-refreshes after 12s without navigation',
        (tester) async {
      final repo = _AutoRefreshMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-1',
            name: 'Service A',
            category: 'General Services',
            price: 500.0,
            durationMinutes: 30,
            isActive: true,
          ),
        ];

      // Mount Catalogue screen
      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      // Initial state: Only Service A is displayed
      expect(find.text('Service A'), findsOneWidget);
      expect(find.text('Cross Platform Windows Test'), findsNothing);
      expect(repo.getServicesCalls, 1);

      // Windows creates a new service on backend
      repo.services.add(
        const Service(
          id: 'svc-windows-1',
          name: 'Cross Platform Windows Test',
          category: 'General Services',
          price: 1500.0,
          durationMinutes: 60,
          isActive: true,
        ),
      );

      // Advance time by 12 seconds (existing auto-refresh interval)
      await tester.pump(const Duration(seconds: 12));
      await tester.pump();

      // Verify GET /api/services was called again automatically
      expect(repo.getServicesCalls, greaterThanOrEqualTo(2));

      // The new service appears in the UI WITHOUT any navigation or manual action
      expect(find.text('Service A'), findsOneWidget);
      expect(find.text('Cross Platform Windows Test'), findsOneWidget);
      expect(find.text('₹1500.00'), findsOneWidget);
    });

    testWidgets('2. Category filter updates with newly refreshed service after 12s', (tester) async {
      final repo = _AutoRefreshMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-initial',
            name: 'Initial Exterior Wash',
            category: 'Exterior Detailing',
            price: 700.0,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      // Select 'General Services' category filter
      await tester.tap(find.widgetWithText(ChoiceChip, 'General Services'));
      await tester.pumpAndSettle();

      // Initial exterior wash is not in General Services
      expect(find.text('Initial Exterior Wash'), findsNothing);

      // Windows creates two services: one in 'General Services', one in 'Exterior Detailing'
      repo.services.addAll([
        const Service(
          id: 'svc-gen-new',
          name: 'Engine Bay General Clean',
          category: 'General Services',
          price: 1200.0,
          isActive: true,
        ),
        const Service(
          id: 'svc-ext-new',
          name: 'Graphene Coat Exterior',
          category: 'Exterior Detailing',
          price: 5000.0,
          isActive: true,
        ),
      ]);

      // Advance 12 seconds for auto-refresh
      await tester.pump(const Duration(seconds: 12));
      await tester.pump();

      // The service in 'General Services' appears in the active category
      expect(find.text('Engine Bay General Clean'), findsOneWidget);
      // The service in 'Exterior Detailing' is filtered out of current view
      expect(find.text('Graphene Coat Exterior'), findsNothing);

      // When switching category to 'Exterior Detailing', it appears
      await tester.tap(find.widgetWithText(ChoiceChip, 'Exterior Detailing'));
      await tester.pumpAndSettle();

      expect(find.text('Graphene Coat Exterior'), findsOneWidget);
      expect(find.text('Engine Bay General Clean'), findsNothing);
    });

    testWidgets('3. Search finds newly auto-refreshed service without page reload', (tester) async {
      final repo = _AutoRefreshMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-1',
            name: 'Basic Wash',
            category: 'General Services',
            price: 300.0,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      expect(find.text('Basic Wash'), findsOneWidget);

      // Windows creates 'Test Ceramic Service'
      repo.services.add(
        const Service(
          id: 'svc-ceramic',
          name: 'Test Ceramic Service',
          category: 'Protection Packages',
          price: 12000.0,
          description: 'High durability coating',
          isActive: true,
        ),
      );

      // Wait for auto-refresh interval
      await tester.pump(const Duration(seconds: 12));
      await tester.pump();

      // Now search for 'Ceramic'
      await tester.enterText(find.byType(TextField).first, 'Ceramic');
      await tester.pumpAndSettle();

      expect(find.text('Test Ceramic Service'), findsOneWidget);
      expect(find.text('Basic Wash'), findsNothing);
    });

    testWidgets('4. App lifecycle resume triggers auto-refresh', (tester) async {
      final repo = _AutoRefreshMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-1',
            name: 'Existing Service',
            category: 'General Services',
            price: 400.0,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      final initialCalls = repo.getServicesCalls;

      // Simulate app backgrounded / inactive
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();

      // Windows adds a service while app is in background
      repo.services.add(
        const Service(
          id: 'svc-bg-added',
          name: 'Background Synced Service',
          category: 'General Services',
          price: 800.0,
          isActive: true,
        ),
      );

      // Advance time while inactive — timer should be stopped/paused
      await tester.pump(const Duration(seconds: 12));

      // Simulate app returning to foreground: inactive -> resumed
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      // The resume triggers auto-refresh immediately
      expect(repo.getServicesCalls, greaterThan(initialCalls));
      expect(find.text('Background Synced Service'), findsOneWidget);
    });

    testWidgets('5. Android local service creation continues to update catalogue immediately', (tester) async {
      final repo = _AutoRefreshMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-1',
            name: 'Initial Service',
            category: 'General Services',
            price: 450.0,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      // Call createService via provider
      final element = tester.element(find.byType(CatalogueScreen));
      final container = ProviderScope.containerOf(element);

      await container.read(catalogueProvider.notifier).createService(
            const CreateServiceRequest(
              name: 'Android Created Service',
              category: 'General Services',
              price: 999.0,
              isActive: true,
            ),
          );

      await tester.pumpAndSettle();

      expect(find.text('Android Created Service'), findsOneWidget);
    });

    testWidgets('6. Simulated API progression (Service A -> Service A & Service B) updates provider state directly',
        (tester) async {
      final repo = _AutoRefreshMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-a',
            name: 'Service A',
            category: 'General Services',
            price: 500.0,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      final element = tester.element(find.byType(CatalogueScreen));
      final container = ProviderScope.containerOf(element);

      // Initial provider state: [Service A]
      expect(container.read(catalogueProvider).services.map((s) => s.name), ['Service A']);

      // Backend now returns Service A and Service B
      repo.services.add(
        const Service(
          id: 'svc-b',
          name: 'Service B',
          category: 'General Services',
          price: 750.0,
          isActive: true,
        ),
      );

      // Trigger silent refresh
      await container.read(catalogueProvider.notifier).loadCatalogue(silent: true);
      await tester.pump();

      // Expected provider state: [Service A, Service B]
      expect(container.read(catalogueProvider).services.map((s) => s.name), ['Service A', 'Service B']);
      expect(find.text('Service A'), findsOneWidget);
      expect(find.text('Service B'), findsOneWidget);
    });

    testWidgets('7. Auto-refresh runs silently without flashing full-page loading spinner', (tester) async {
      final repo = _AutoRefreshMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-1',
            name: 'Service Steady',
            category: 'General Services',
            price: 500.0,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      expect(find.text('Service Steady'), findsOneWidget);

      // Add a service
      repo.services.add(
        const Service(
          id: 'svc-2',
          name: 'Service Steady 2',
          category: 'General Services',
          price: 600.0,
          isActive: true,
        ),
      );

      // Advance time by 12s - auto-refresh triggers with silent: true
      await tester.pump(const Duration(seconds: 12));

      // Assert that full-page loading spinner is NOT displayed during silent auto-refresh
      expect(find.text('Loading service catalogue...'), findsNothing);

      await tester.pump();

      // The new item appears smoothly
      expect(find.text('Service Steady 2'), findsOneWidget);
    });
  });
}
