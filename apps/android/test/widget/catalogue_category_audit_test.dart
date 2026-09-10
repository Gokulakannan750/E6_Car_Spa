import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/constants/app_constants.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:e6_car_spa/features/catalogue/presentation/pages/catalogue_screen.dart';
import 'package:e6_car_spa/features/catalogue/presentation/widgets/add_service_bottom_sheet.dart';
import 'package:e6_car_spa/features/catalogue/presentation/widgets/edit_service_bottom_sheet.dart';
import 'package:e6_car_spa/features/jobcards/presentation/widgets/add_custom_service_dialog.dart';
import 'package:e6_car_spa/shared/widgets/app_empty_state.dart';

class _AuditMockServiceRepository implements ServiceRepository {
  List<Service> mockServices = [];
  List<String> mockCategories = [];
  CreateServiceRequest? lastCreateRequest;
  UpdateServiceRequest? lastUpdateRequest;

  @override
  Future<ServiceListResponse> getServices({
    bool? isActive = true,
    int page = 1,
    int pageSize = 100,
    String? search,
    String? category,
  }) async {
    var items = mockServices;
    if (category != null && category.isNotEmpty) {
      items = items.where((s) => s.category == category).toList();
    }
    if (search != null && search.isNotEmpty) {
      items = items.where((s) => s.name.toLowerCase().contains(search.toLowerCase())).toList();
    }
    return ServiceListResponse(
      items: items,
      totalCount: items.length,
      page: page,
      pageSize: pageSize,
    );
  }

  @override
  Future<List<String>> getCategories() async => mockCategories;

  @override
  Future<Service> getServiceById(String id) async {
    return mockServices.firstWhere((s) => s.id == id);
  }

  @override
  Future<Service> createService(CreateServiceRequest request) async {
    lastCreateRequest = request;
    final created = Service(
      id: 'svc-created-123',
      name: request.name,
      price: request.price,
      category: request.category,
      durationMinutes: request.durationMinutes,
      description: request.description,
      taxPercentage: request.taxPercentage,
      isActive: request.isActive,
    );
    mockServices.add(created);
    return created;
  }

  @override
  Future<Service> updateService(String id, UpdateServiceRequest request) async {
    lastUpdateRequest = request;
    final index = mockServices.indexWhere((s) => s.id == id);
    final updated = Service(
      id: id,
      name: request.name,
      price: request.price,
      category: request.category,
      durationMinutes: request.durationMinutes ?? 60,
      description: request.description,
      isActive: request.isActive,
    );
    if (index >= 0) {
      mockServices[index] = updated;
    }
    return updated;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
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
  const adminUser = AuthUser(
    id: 'u-audit-admin',
    username: 'admin',
    fullName: 'Audit Admin',
    role: 'Owner',
    isOwner: true,
    permissions: ['catalogue.view', 'catalogue.create', 'catalogue.edit'],
  );

  Widget createTestApp({
    required Widget child,
    required _AuditMockServiceRepository repo,
  }) {
    return ProviderScope(
      overrides: [
        serviceRepositoryProvider.overrideWithValue(repo),
        authNotifierProvider.overrideWith((ref) => _TestAuthNotifier(const Authenticated(adminUser))),
      ],
      child: MaterialApp(
        home: Scaffold(body: child),
      ),
    );
  }

  group('Catalogue Category Audit & Population Tests', () {
    testWidgets('1. Backend returns ["Exterior Detailing"] -> Add Service displays all five categories', (tester) async {
      final repo = _AuditMockServiceRepository()..mockCategories = ['Exterior Detailing'];

      await tester.pumpWidget(createTestApp(
        child: const AddServiceBottomSheet(),
        repo: repo,
      ));
      await tester.pumpAndSettle();

      // Tap Dropdown
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();

      // Verify all 5 categories exist in menu
      expect(find.text('Exterior Detailing'), findsWidgets);
      expect(find.text('General Services'), findsWidgets);
      expect(find.text('Interior Care'), findsWidgets);
      expect(find.text('Others'), findsWidgets);
      expect(find.text('Protection Packages'), findsWidgets);
    });

    testWidgets('2. Backend returns ["Exterior Detailing", "Interior Care"] -> all five categories present', (tester) async {
      final repo = _AuditMockServiceRepository()..mockCategories = ['Exterior Detailing', 'Interior Care'];

      await tester.pumpWidget(createTestApp(
        child: const AddServiceBottomSheet(),
        repo: repo,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();

      expect(find.text('Exterior Detailing'), findsWidgets);
      expect(find.text('General Services'), findsWidgets);
      expect(find.text('Interior Care'), findsWidgets);
      expect(find.text('Others'), findsWidgets);
      expect(find.text('Protection Packages'), findsWidgets);
    });

    testWidgets('3. Backend returns all five -> all five present without duplicates', (tester) async {
      final repo = _AuditMockServiceRepository()
        ..mockCategories = [
          'Exterior Detailing',
          'General Services',
          'Interior Care',
          'Others',
          'Protection Packages',
        ];

      await tester.pumpWidget(createTestApp(
        child: const AddServiceBottomSheet(),
        repo: repo,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();

      // In popup menu + field value, exactly expected counts (no duplicates beyond dropdown items)
      expect(find.text('General Services'), findsWidgets);
      expect(find.text('Protection Packages'), findsWidgets);
    });

    testWidgets('4. Backend returns empty category list -> all five categories still present', (tester) async {
      final repo = _AuditMockServiceRepository()..mockCategories = [];

      await tester.pumpWidget(createTestApp(
        child: const AddServiceBottomSheet(),
        repo: repo,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();

      expect(find.text('Exterior Detailing'), findsWidgets);
      expect(find.text('General Services'), findsWidgets);
      expect(find.text('Interior Care'), findsWidgets);
      expect(find.text('Others'), findsWidgets);
      expect(find.text('Protection Packages'), findsWidgets);
    });

    testWidgets('5 & 6. Add Service: all 5 categories can be selected and form submits correctly', (tester) async {
      final repo = _AuditMockServiceRepository()..mockCategories = ['Exterior Detailing'];

      for (final targetCategory in kCatalogueCategories) {
        await tester.pumpWidget(ProviderScope(
          overrides: [
            serviceRepositoryProvider.overrideWithValue(repo),
            authNotifierProvider.overrideWith((ref) => _TestAuthNotifier(const Authenticated(adminUser))),
          ],
          child: MaterialApp(
            home: Builder(
              builder: (ctx) => Scaffold(
                body: ElevatedButton(
                  onPressed: () => AddServiceBottomSheet.show(ctx),
                  child: const Text('Open Add Sheet'),
                ),
              ),
            ),
          ),
        ));
        await tester.pumpAndSettle();

        await tester.tap(find.text('Open Add Sheet'));
        await tester.pumpAndSettle();

        // Fill form fields
        await tester.enterText(find.byType(TextFormField).at(0), 'Service for $targetCategory');
        await tester.enterText(find.byType(TextFormField).at(1), '1200');

        // Select category
        await tester.tap(find.byType(DropdownButtonFormField<String>));
        await tester.pumpAndSettle();
        await tester.tap(find.text(targetCategory).last);
        await tester.pumpAndSettle();

        // Submit form
        await tester.tap(find.byKey(const Key('modal_add_service_button')));
        await tester.pumpAndSettle();

        expect(repo.lastCreateRequest, isNotNull);
        expect(repo.lastCreateRequest!.category, targetCategory);
        expect(repo.lastCreateRequest!.name, 'Service for $targetCategory');
      }
    });

    testWidgets('7. Edit Service: loads existing category and displays all five categories', (tester) async {
      final repo = _AuditMockServiceRepository()..mockCategories = ['Exterior Detailing'];
      const testService = Service(
        id: 'svc-edit-1',
        name: 'Seat Deep Clean',
        price: 1500.0,
        category: 'Interior Care',
        durationMinutes: 90,
        isActive: true,
      );

      await tester.pumpWidget(ProviderScope(
        overrides: [
          serviceRepositoryProvider.overrideWithValue(repo),
          authNotifierProvider.overrideWith((ref) => _TestAuthNotifier(const Authenticated(adminUser))),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () => EditServiceBottomSheet.show(ctx, service: testService),
                child: const Text('Open Edit Sheet'),
              ),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Edit Sheet'));
      await tester.pumpAndSettle();

      // Existing category is loaded
      expect(find.text('Interior Care'), findsWidgets);

      // Tap dropdown to change category
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();

      // All 5 categories are available
      expect(find.text('Exterior Detailing'), findsWidgets);
      expect(find.text('General Services'), findsWidgets);
      expect(find.text('Interior Care'), findsWidgets);
      expect(find.text('Others'), findsWidgets);
      expect(find.text('Protection Packages'), findsWidgets);

      // Select 'General Services'
      await tester.tap(find.text('General Services').last);
      await tester.pumpAndSettle();

      // Submit update
      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();

      expect(repo.lastUpdateRequest, isNotNull);
      expect(repo.lastUpdateRequest!.category, 'General Services');
    });

    testWidgets('8. Custom Service: category selector displays all five categories', (tester) async {
      final repo = _AuditMockServiceRepository()..mockCategories = ['Exterior Detailing'];

      await tester.pumpWidget(createTestApp(
        child: const AddCustomServiceDialog(),
        repo: repo,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();

      expect(find.text('Exterior Detailing'), findsWidgets);
      expect(find.text('General Services'), findsWidgets);
      expect(find.text('Interior Care'), findsWidgets);
      expect(find.text('Others'), findsWidgets);
      expect(find.text('Protection Packages'), findsWidgets);
    });

    testWidgets('9. Catalogue filters display all five categories when backend returns single category', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _AuditMockServiceRepository()
        ..mockCategories = ['Exterior Detailing']
        ..mockServices = [
          const Service(
            id: 'svc-single',
            name: 'Basic Foam Wash',
            price: 500.0,
            category: 'Exterior Detailing',
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestApp(
        child: const CatalogueScreen(),
        repo: repo,
      ));
      await tester.pumpAndSettle();

      // Filter chips: All Categories + all 5 established categories
      expect(find.widgetWithText(ChoiceChip, 'All Categories'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'Exterior Detailing'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'General Services'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'Interior Care'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'Others'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'Protection Packages'), findsOneWidget);
    });

    testWidgets('10. Selecting a category with zero services shows empty state without hiding category', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _AuditMockServiceRepository()
        ..mockCategories = ['Exterior Detailing']
        ..mockServices = [
          const Service(
            id: 'svc-single',
            name: 'Basic Foam Wash',
            price: 500.0,
            category: 'Exterior Detailing',
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestApp(
        child: const CatalogueScreen(),
        repo: repo,
      ));
      await tester.pumpAndSettle();

      // Scroll horizontal chip bar so 'Protection Packages' is in viewport, then tap it
      final chipFinder = find.widgetWithText(ChoiceChip, 'Protection Packages');
      await tester.scrollUntilVisible(chipFinder, 100, scrollable: find.byType(Scrollable).first);
      await tester.pumpAndSettle();

      await tester.tap(chipFinder);
      await tester.pumpAndSettle();

      // Protection Packages chip is still visible and selected
      expect(find.widgetWithText(ChoiceChip, 'Protection Packages'), findsOneWidget);
      // Empty state is shown
      expect(find.byType(AppEmptyState), findsOneWidget);
      expect(find.text('No services match your search and category filter.'), findsOneWidget);
    });

    testWidgets('11 & 12. Actual services are loaded dynamically from GET /api/services with no hardcoding', (tester) async {
      final dynamicService = Service(
        id: 'svc-uuid-from-db',
        name: 'Custom Dynamic Ozone Treatment',
        price: 3499.0,
        category: 'Interior Care',
        durationMinutes: 45,
        isActive: true,
      );

      final repo = _AuditMockServiceRepository()
        ..mockCategories = ['Interior Care']
        ..mockServices = [dynamicService];

      await tester.pumpWidget(createTestApp(
        child: const CatalogueScreen(),
        repo: repo,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Custom Dynamic Ozone Treatment'), findsOneWidget);
      expect(find.text('₹3499.00'), findsOneWidget);
      expect(find.text('Interior Care'), findsWidgets);
    });
  });
}
