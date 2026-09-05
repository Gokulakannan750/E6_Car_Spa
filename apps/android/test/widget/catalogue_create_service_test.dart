import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:e6_car_spa/features/catalogue/presentation/pages/catalogue_screen.dart';
import 'package:e6_car_spa/features/catalogue/presentation/widgets/add_service_bottom_sheet.dart';

class _FakeServiceRepository implements ServiceRepository {
  CreateServiceRequest? lastCreateRequest;

  @override
  Future<ServiceListResponse> getServices({
    bool? isActive = true,
    int page = 1,
    int pageSize = 100,
    String? search,
    String? category,
  }) async {
    return const ServiceListResponse(
      items: [
        Service(
          id: 'svc-1',
          name: 'Standard Foam Wash',
          price: 500.0,
          category: 'Exterior Detailing',
          durationMinutes: 45,
          isActive: true,
        ),
      ],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    );
  }

  @override
  Future<List<String>> getCategories() async {
    return ['Exterior Detailing', 'Interior Care', 'Protection Packages', 'Others'];
  }

  @override
  Future<Service> createService(CreateServiceRequest request) async {
    lastCreateRequest = request;
    return Service(
      id: 'svc-new',
      name: request.name,
      price: request.price,
      category: request.category,
      durationMinutes: request.durationMinutes,
      description: request.description,
      taxPercentage: request.taxPercentage,
      isActive: request.isActive,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class TestAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  TestAuthNotifier(super.initialState);

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
}

void main() {
  const userWithCreate = AuthUser(
    id: 'u1',
    username: 'manager',
    fullName: 'Workshop Manager',
    role: 'manager',
    isOwner: false,
    permissions: ['catalogue.view', 'catalogue.create', 'catalogue.edit'],
  );

  const userWithoutCreate = AuthUser(
    id: 'u2',
    username: 'viewer',
    fullName: 'Staff Viewer',
    role: 'staff',
    isOwner: false,
    permissions: ['catalogue.view'],
  );

  group('Catalogue Create Service UI & Validation Tests', () {
    testWidgets('AddServiceBottomSheet renders form without any GST field and enforces validation', (tester) async {
      final fakeRepo = _FakeServiceRepository();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: AddServiceBottomSheet(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify header and fields exist
      expect(find.text('Add Service'), findsWidgets);
      expect(find.text('Service Name *'), findsOneWidget);
      expect(find.text('Category *'), findsOneWidget);
      expect(find.text('Price (₹) *'), findsOneWidget);
      expect(find.text('Estimated Duration (Minutes) *'), findsOneWidget);
      expect(find.text('Description / Scope (Optional)'), findsOneWidget);
      expect(find.text('Service Active Status'), findsOneWidget);

      // Verify GST field does NOT exist
      expect(find.text('GST (%)'), findsNothing);
      expect(find.text('Tax Percentage'), findsNothing);

      // Clear default fields and attempt submit
      await tester.enterText(find.widgetWithText(TextFormField, '60'), '');
      await tester.tap(find.byKey(const Key('modal_add_service_button')));
      await tester.pumpAndSettle();

      // Verify validation errors
      expect(find.text('Service name is required'), findsOneWidget);
      expect(find.text('Price is required'), findsOneWidget);
      expect(find.text('Duration is required'), findsOneWidget);
    });

    testWidgets('AddServiceBottomSheet successfully submits new service with authoritative categories', (tester) async {
      final fakeRepo = _FakeServiceRepository();
      bool createdCallbackCalled = false;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: MaterialApp(
            home: Builder(
              builder: (ctx) => Scaffold(
                body: ElevatedButton(
                  onPressed: () => AddServiceBottomSheet.show(
                    ctx,
                    onCreated: () => createdCallbackCalled = true,
                  ),
                  child: const Text('Open Add Sheet'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open sheet
      await tester.tap(find.text('Open Add Sheet'));
      await tester.pumpAndSettle();

      // Enter valid form data
      await tester.enterText(find.byType(TextFormField).at(0), 'Android Test Service');
      await tester.enterText(find.byType(TextFormField).at(1), '1500');
      await tester.enterText(find.byType(TextFormField).at(2), '60');
      await tester.enterText(find.byType(TextFormField).at(3), 'Real phone testing');

      // Tap submit
      await tester.tap(find.byKey(const Key('modal_add_service_button')));
      await tester.pumpAndSettle();

      expect(createdCallbackCalled, isTrue);
      expect(fakeRepo.lastCreateRequest, isNotNull);
      expect(fakeRepo.lastCreateRequest!.name, 'Android Test Service');
      expect(fakeRepo.lastCreateRequest!.price, 1500.0);
      expect(fakeRepo.lastCreateRequest!.durationMinutes, 60);
      expect(fakeRepo.lastCreateRequest!.description, 'Real phone testing');
      expect(fakeRepo.lastCreateRequest!.taxPercentage, 18.0); // preserved internally
      expect(fakeRepo.lastCreateRequest!.isActive, isTrue);
    });
  });

  group('CatalogueScreen Add Service Permission Tests', () {
    testWidgets('Add Service FAB is visible when user has catalogue.create permission', (tester) async {
      final fakeRepo = _FakeServiceRepository();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(fakeRepo),
            authNotifierProvider.overrideWith((ref) => TestAuthNotifier(const Authenticated(userWithCreate))),
          ],
          child: const MaterialApp(
            home: CatalogueScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // FAB is visible
      expect(find.byKey(const Key('add_service_fab')), findsOneWidget);
      expect(find.text('Add Service'), findsOneWidget);
    });

    testWidgets('Add Service FAB is hidden when user lacks catalogue.create permission', (tester) async {
      final fakeRepo = _FakeServiceRepository();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(fakeRepo),
            authNotifierProvider.overrideWith((ref) => TestAuthNotifier(const Authenticated(userWithoutCreate))),
          ],
          child: const MaterialApp(
            home: CatalogueScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // FAB is NOT visible
      expect(find.byKey(const Key('add_service_fab')), findsNothing);
    });
  });
}
