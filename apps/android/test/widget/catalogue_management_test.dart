import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/catalogue/data/service_api.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:e6_car_spa/features/catalogue/presentation/pages/catalogue_screen.dart';
import 'package:e6_car_spa/features/catalogue/presentation/widgets/edit_service_bottom_sheet.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:e6_car_spa/shared/widgets/app_error_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class MockServiceRepository extends ServiceRepository {
  MockServiceRepository() : super(ServiceApi(Dio()));

  List<Service> servicesToReturn = [];
  List<String> categoriesToReturn = ['Exterior Detailing', 'Interior Care', 'Protection Packages'];
  bool shouldThrow = false;
  int getCalls = 0;
  UpdateServiceRequest? lastUpdateRequest;
  String? updateServiceId;

  @override
  Future<ServiceListResponse> getServices({
    bool? isActive = true,
    int page = 1,
    int pageSize = 100,
    String? search,
    String? category,
  }) async {
    getCalls++;
    if (shouldThrow) {
      throw const ApiException(message: 'Failed to load catalogue from server');
    }
    var list = servicesToReturn;
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
    if (shouldThrow) {
      throw const ApiException(message: 'Failed to load categories');
    }
    return categoriesToReturn;
  }

  @override
  Future<Service> updateService(String id, UpdateServiceRequest request) async {
    updateServiceId = id;
    lastUpdateRequest = request;
    final idx = servicesToReturn.indexWhere((s) => s.id == id);
    if (idx != -1) {
      final updated = Service(
        id: id,
        name: request.name,
        price: request.price,
        category: request.category,
        durationMinutes: request.durationMinutes,
        description: request.description,
        isActive: request.isActive,
      );
      servicesToReturn[idx] = updated;
      return updated;
    }
    throw const ApiException(message: 'Service not found', statusCode: 404);
  }
}

class FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  FakeAuthNotifier(AuthUser user) : super(Authenticated(user));

  @override
  Future<bool> login(String username, String password) async => true;
  @override
  Future<void> logout() async {
    state = const Unauthenticated();
  }
  @override
  Future<void> restoreSession() async {}
  @override
  void clearError() {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const managerUser = AuthUser(
    id: 'mgr-1',
    fullName: 'Workshop Manager',
    username: 'manager',
    role: 'Manager',
    isOwner: false,
    permissions: ['catalogue.view', 'catalogue.create', 'catalogue.edit'],
  );

  const sampleService1 = Service(
    id: 'svc-1',
    name: 'Foam Wash Deluxe',
    price: 650.0,
    category: 'Exterior Detailing',
    durationMinutes: 45,
    description: 'High-pressure foam wash and dry',
    isActive: true,
  );

  const sampleService2 = Service(
    id: 'svc-2',
    name: 'Deep Interior Vacuum',
    price: 1200.0,
    category: 'Interior Care',
    durationMinutes: 90,
    description: 'Complete upholstery deep clean',
    isActive: true,
  );

  group('CatalogueScreen State & Error Operations', () {
    testWidgets('Renders error state with retry button and reloads on retry', (tester) async {
      final mockRepo = MockServiceRepository()..shouldThrow = true;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: CatalogueScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(AppErrorState), findsOneWidget);
      expect(find.textContaining('Failed to load catalogue from server'), findsOneWidget);

      // Fix repo and retry
      mockRepo.shouldThrow = false;
      mockRepo.servicesToReturn = [sampleService1];

      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();

      expect(find.byType(AppErrorState), findsNothing);
      expect(find.text('Foam Wash Deluxe'), findsOneWidget);
    });

    testWidgets('Renders empty state when system has no catalogue services', (tester) async {
      final mockRepo = MockServiceRepository()..servicesToReturn = [];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: CatalogueScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No services found'), findsOneWidget);
      expect(find.text('No catalogue services available in the system.'), findsOneWidget);
    });
  });

  group('CatalogueScreen Search and Category Filtering', () {
    testWidgets('Category chips filter services and All Categories resets filter', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockServiceRepository()
        ..servicesToReturn = [sampleService1, sampleService2]
        ..categoriesToReturn = ['Exterior Detailing', 'Interior Care', 'Protection Packages'];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: CatalogueScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Foam Wash Deluxe'), findsOneWidget);
      expect(find.text('Deep Interior Vacuum'), findsOneWidget);

      // Tap 'Interior Care' chip
      await tester.tap(find.widgetWithText(ChoiceChip, 'Interior Care'));
      await tester.pumpAndSettle();

      expect(find.text('Deep Interior Vacuum'), findsOneWidget);
      expect(find.text('Foam Wash Deluxe'), findsNothing);

      // Tap 'All Categories' chip
      await tester.tap(find.widgetWithText(ChoiceChip, 'All Categories'));
      await tester.pumpAndSettle();

      expect(find.text('Foam Wash Deluxe'), findsOneWidget);
      expect(find.text('Deep Interior Vacuum'), findsOneWidget);
    });

    testWidgets('Search field filters services dynamically and shows zero match message', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockServiceRepository()
        ..servicesToReturn = [sampleService1, sampleService2];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(mockRepo),
            authNotifierProvider.overrideWith((ref) => FakeAuthNotifier(managerUser)),
          ],
          child: const MaterialApp(
            home: CatalogueScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter search term
      await tester.enterText(find.byType(TextField).first, 'Foam');
      await tester.pumpAndSettle();

      expect(find.text('Foam Wash Deluxe'), findsOneWidget);
      expect(find.text('Deep Interior Vacuum'), findsNothing);

      // Enter non-matching search term
      await tester.enterText(find.byType(TextField).first, 'NonexistentServiceXYZ');
      await tester.pumpAndSettle();

      expect(find.text('No services found'), findsOneWidget);
      expect(find.text('No services match your search and category filter.'), findsOneWidget);

      // Clear search
      await tester.tap(find.byIcon(Icons.clear_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Foam Wash Deluxe'), findsOneWidget);
      expect(find.text('Deep Interior Vacuum'), findsOneWidget);
    });
  });

  group('EditServiceBottomSheet Flow & Validations', () {
    testWidgets('Validates name and price in edit bottom sheet and does not show duration', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockServiceRepository();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: EditServiceBottomSheet(
                service: sampleService1,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify duration does not exist
      expect(find.text('Estimated Duration (Minutes)'), findsNothing);

      // Clear name and enter invalid price
      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), ''); // Service Name
      await tester.enterText(textFields.at(1), ''); // Price
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Save Changes'));
      await tester.pumpAndSettle();

      expect(find.text('Service name is required'), findsOneWidget);
      expect(find.text('Price is required'), findsOneWidget);
    });

    testWidgets('Successfully submits updated service details', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockRepo = MockServiceRepository()..servicesToReturn = [sampleService1];
      bool savedCallbackCalled = false;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(mockRepo),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: EditServiceBottomSheet(
                service: sampleService1,
                onSaved: () => savedCallbackCalled = true,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Update price and name
      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), 'Foam Wash Supreme');
      await tester.enterText(textFields.at(1), '750.00');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Save Changes'));
      await tester.pumpAndSettle();

      expect(savedCallbackCalled, isTrue);
      expect(mockRepo.updateServiceId, 'svc-1');
      expect(mockRepo.lastUpdateRequest?.name, 'Foam Wash Supreme');
      expect(mockRepo.lastUpdateRequest?.price, 750.00);
    });
  });
}
