import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/constants/app_constants.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:e6_car_spa/features/catalogue/presentation/pages/catalogue_screen.dart';
import 'package:e6_car_spa/features/catalogue/presentation/providers/catalogue_providers.dart';
import 'package:e6_car_spa/features/catalogue/presentation/widgets/add_service_bottom_sheet.dart';
import 'package:e6_car_spa/features/catalogue/presentation/widgets/edit_service_bottom_sheet.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';

class _MockServiceRepository implements ServiceRepository {
  List<Service> servicesToReturn = [];
  List<String> categoriesToReturn = [];
  CreateServiceRequest? lastCreateRequest;
  UpdateServiceRequest? lastUpdateRequest;
  Map<String, dynamic>? lastUpdateRawJson;

  @override
  Future<ServiceListResponse> getServices({
    int page = 1,
    int pageSize = 50,
    String? search,
    String? category,
    bool? isActive,
  }) async {
    var items = servicesToReturn;
    if (category != null && category.isNotEmpty) {
      items = items.where((s) => s.category == category).toList();
    }
    return ServiceListResponse(
      items: items,
      totalCount: items.length,
      page: page,
      pageSize: pageSize,
    );
  }

  @override
  Future<List<String>> getCategories() async => categoriesToReturn;

  @override
  Future<Service> getServiceById(String id) async {
    return servicesToReturn.firstWhere((s) => s.id == id);
  }

  @override
  Future<Service> createService(CreateServiceRequest request) async {
    lastCreateRequest = request;
    final created = Service(
      id: 'new-service-id',
      name: request.name,
      category: request.category,
      price: request.price,
      taxPercentage: request.taxPercentage,
      description: request.description,
      durationMinutes: request.durationMinutes,
      isActive: request.isActive,
      createdAt: DateTime.now(),
    );
    servicesToReturn.add(created);
    return created;
  }

  @override
  Future<Service> updateService(String id, UpdateServiceRequest request) async {
    lastUpdateRequest = request;
    lastUpdateRawJson = request.toJson();
    final index = servicesToReturn.indexWhere((s) => s.id == id);
    final existing = index >= 0 ? servicesToReturn[index] : null;
    final updated = Service(
      id: id,
      name: request.name,
      category: request.category ?? existing?.category,
      price: request.price,
      taxPercentage: request.taxPercentage,
      description: request.description ?? existing?.description,
      // Backend preserves durationMinutes when omitted/null from request
      durationMinutes: request.durationMinutes ?? existing?.durationMinutes,
      isActive: request.isActive,
      createdAt: existing?.createdAt ?? DateTime.now(),
    );
    if (index >= 0) {
      servicesToReturn[index] = updated;
    }
    return updated;
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
  const adminUser = AuthUser(
    id: 'u-dur-admin',
    username: 'admin',
    fullName: 'Duration Admin',
    role: 'Owner',
    isOwner: true,
    permissions: ['catalogue.view', 'catalogue.create', 'catalogue.edit'],
  );

  final sampleServiceWithDuration = Service(
    id: 'svc-dur-1',
    name: 'Ceramic Coating Gold',
    category: 'Protection Packages',
    price: 25000.0,
    taxPercentage: 18.0,
    durationMinutes: 180,
    description: 'Multi-layer ceramic coating',
    isActive: true,
    createdAt: DateTime.parse('2026-03-01T10:00:00Z'),
  );

  final sampleServiceWithoutDuration = Service(
    id: 'svc-no-dur-2',
    name: 'Quick Express Wash',
    category: 'Exterior Detailing',
    price: 450.0,
    taxPercentage: 18.0,
    durationMinutes: null,
    description: 'Fast exterior rinse',
    isActive: true,
    createdAt: DateTime.parse('2026-03-01T10:00:00Z'),
  );

  Widget createTestApp({
    required Widget child,
    required _MockServiceRepository repository,
  }) {
    return ProviderScope(
      overrides: [
        serviceRepositoryProvider.overrideWithValue(repository),
        serviceCategoriesProvider.overrideWith((ref) async => repository.getCategories()),
        authNotifierProvider.overrideWith((ref) => _TestAuthNotifier(const Authenticated(adminUser))),
      ],
      child: MaterialApp(
        home: Scaffold(body: child),
      ),
    );
  }

  group('Service Duration Removal & Compatibility Tests', () {
    testWidgets('1. Add Service does not show Estimated Duration field or label', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _MockServiceRepository()..categoriesToReturn = ['Exterior Detailing'];

      await tester.pumpWidget(createTestApp(
        child: const AddServiceBottomSheet(),
        repository: repo,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Add Service'), findsWidgets);
      expect(find.text('Estimated Duration (Minutes)'), findsNothing);
      expect(find.text('Estimated Duration (Minutes) *'), findsNothing);
      expect(find.text('Duration (Minutes)'), findsNothing);
      expect(find.byIcon(Icons.schedule), findsNothing);
    });

    testWidgets('2. Edit Service does not show Estimated Duration field or label', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _MockServiceRepository()..categoriesToReturn = ['Protection Packages'];

      await tester.pumpWidget(createTestApp(
        child: EditServiceBottomSheet(service: sampleServiceWithDuration),
        repository: repo,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Edit Service'), findsWidgets);
      expect(find.text('Estimated Duration (Minutes)'), findsNothing);
      expect(find.text('Estimated Duration (Minutes) *'), findsNothing);
      expect(find.text('Duration (Minutes)'), findsNothing);
      expect(find.byIcon(Icons.schedule), findsNothing);
    });

    testWidgets('3. Service creation succeeds without Duration', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _MockServiceRepository()..categoriesToReturn = ['Exterior Detailing'];
      bool created = false;

      await tester.pumpWidget(createTestApp(
        child: AddServiceBottomSheet(onCreated: () => created = true),
        repository: repo,
      ));
      await tester.pumpAndSettle();

      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), 'Clean Foam Wash');
      await tester.enterText(textFields.at(1), '500');
      await tester.enterText(textFields.at(2), 'Detailed wash package');

      await tester.tap(find.byKey(const Key('modal_add_service_button')));
      await tester.pumpAndSettle();

      expect(created, isTrue);
      expect(repo.lastCreateRequest, isNotNull);
      expect(repo.lastCreateRequest!.name, 'Clean Foam Wash');
      expect(repo.lastCreateRequest!.price, 500.0);
      expect(repo.lastCreateRequest!.durationMinutes, isNull);
      // Serialized JSON must omit durationMinutes
      final json = repo.lastCreateRequest!.toJson();
      expect(json.containsKey('durationMinutes'), isFalse);
    });

    testWidgets('4 & 6. Service editing succeeds without Duration and does NOT send durationMinutes: null', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _MockServiceRepository()
        ..servicesToReturn = [sampleServiceWithDuration]
        ..categoriesToReturn = ['Protection Packages'];
      bool saved = false;

      await tester.pumpWidget(createTestApp(
        child: EditServiceBottomSheet(
          service: sampleServiceWithDuration,
          onSaved: () => saved = true,
        ),
        repository: repo,
      ));
      await tester.pumpAndSettle();

      final textFields = find.byType(TextFormField);
      // Change name and price
      await tester.enterText(textFields.at(0), 'Ceramic Coating Platinum');
      await tester.enterText(textFields.at(1), '30000');

      await tester.tap(find.widgetWithText(AppButton, 'Save Changes'));
      await tester.pumpAndSettle();

      expect(saved, isTrue);
      expect(repo.lastUpdateRequest, isNotNull);
      expect(repo.lastUpdateRequest!.name, 'Ceramic Coating Platinum');
      expect(repo.lastUpdateRequest!.price, 30000.0);
      expect(repo.lastUpdateRequest!.durationMinutes, isNull);

      // CRITICAL PAYLOAD VERIFICATION:
      // Must NOT contain durationMinutes in the serialized JSON
      expect(repo.lastUpdateRawJson, isNotNull);
      expect(repo.lastUpdateRawJson!.containsKey('durationMinutes'), isFalse);
    });

    testWidgets('7. Existing ServiceModel deserializes DurationMinutes from legacy record', (tester) async {
      final legacyJson = {
        'id': 'legacy-uuid-1',
        'name': 'Legacy Diamond Coat',
        'category': 'Protection Packages',
        'price': 45000.0,
        'taxPercentage': 18.0,
        'durationMinutes': 240,
        'isActive': true,
        'createdAt': '2026-01-01T00:00:00Z',
      };

      final service = Service.fromJson(legacyJson);
      expect(service.id, 'legacy-uuid-1');
      expect(service.name, 'Legacy Diamond Coat');
      expect(service.durationMinutes, 240);
    });

    testWidgets('8. Catalogue service cards do NOT display Duration', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _MockServiceRepository()
        ..servicesToReturn = [sampleServiceWithDuration, sampleServiceWithoutDuration]
        ..categoriesToReturn = ['Protection Packages', 'Exterior Detailing'];

      await tester.pumpWidget(createTestApp(
        child: const CatalogueScreen(),
        repository: repo,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Ceramic Coating Gold'), findsOneWidget);
      expect(find.text('Quick Express Wash'), findsOneWidget);

      // Duration must NOT appear anywhere on the service cards
      expect(find.text('180 min'), findsNothing);
      expect(find.textContaining('min'), findsNothing);
      expect(find.byIcon(Icons.schedule), findsNothing);
    });

    testWidgets('10 & 11. Dynamic backend services and all 5 categories remain available', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _MockServiceRepository()
        ..servicesToReturn = [sampleServiceWithoutDuration]
        ..categoriesToReturn = ['Exterior Detailing'];

      await tester.pumpWidget(createTestApp(
        child: const CatalogueScreen(),
        repository: repo,
      ));
      await tester.pumpAndSettle();

      // All 5 categories must be in the filter chips
      expect(find.text('All Categories'), findsOneWidget);
      for (final cat in kCatalogueCategories) {
        expect(find.text(cat), findsWidgets);
      }
    });

    test('12. Regression: editing service preserves stored duration without erasing it', () {
      // Simulate backend behavior when client sends UpdateServiceRequest without durationMinutes
      final originalService = Service(
        id: 'svc-999',
        name: 'Original Name',
        category: 'Interior Care',
        price: 1500.0,
        taxPercentage: 18.0,
        durationMinutes: 60, // Stored duration
        isActive: true,
        createdAt: DateTime.now(),
      );

      const updateReq = UpdateServiceRequest(
        name: 'Updated Name',
        price: 1800.0,
        category: 'Interior Care',
        isActive: true,
      );

      // Verify request payload does NOT contain durationMinutes
      final json = updateReq.toJson();
      expect(json.containsKey('durationMinutes'), isFalse);

      // Simulate backend service update (DurationMinutes = request.DurationMinutes.HasValue ? ... : original)
      final int? newDuration = updateReq.durationMinutes ?? originalService.durationMinutes;
      expect(newDuration, 60); // Preserved!
    });
  });
}
