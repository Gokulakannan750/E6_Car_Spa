import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/constants/app_constants.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:e6_car_spa/features/catalogue/presentation/pages/catalogue_screen.dart';
import 'package:e6_car_spa/shared/widgets/app_empty_state.dart';
import 'package:e6_car_spa/shared/widgets/app_error_state.dart';

class _DynamicMockServiceRepository implements ServiceRepository {
  List<Service> services = [];
  List<String> categories = ['Exterior Detailing', 'General Services', 'Interior Care', 'Others', 'Protection Packages'];
  bool shouldThrow = false;
  String? lastCategoryFilter;

  @override
  Future<ServiceListResponse> getServices({
    bool? isActive = true,
    int page = 1,
    int pageSize = 100,
    String? search,
    String? category,
  }) async {
    if (shouldThrow) {
      throw const ApiException(message: 'Backend connection timeout', statusCode: 500);
    }
    lastCategoryFilter = category;
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
    if (shouldThrow) {
      throw const ApiException(message: 'Failed to load categories', statusCode: 500);
    }
    return categories;
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

  group('Android Catalogue Dynamic Service Tests (Step 6 Verification)', () {
    testWidgets('1. Backend catalogue service appears', (tester) async {
      final repo = _DynamicMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-dynamic-1',
            name: 'Test Dynamic Ceramic Service',
            category: 'Protection Packages',
            price: 8888.0,
            durationMinutes: 120,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      expect(find.text('Test Dynamic Ceramic Service'), findsOneWidget);
    });

    testWidgets('2. A newly added backend service appears without an application update', (tester) async {
      final repo = _DynamicMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-brand-new-2027',
            name: 'Nano Graphene Ultra Shield 2027',
            category: 'Protection Packages',
            price: 19999.0,
            durationMinutes: 240,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      expect(find.text('Nano Graphene Ultra Shield 2027'), findsOneWidget);
    });

    testWidgets('3. Backend service price is used and formatted properly', (tester) async {
      final repo = _DynamicMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-price-test',
            name: 'Engine Bay Detailing',
            category: 'Exterior Detailing',
            price: 1450.0,
            durationMinutes: 30,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      // Price displayed formatted with rupee symbol
      expect(find.text('₹1450.00'), findsOneWidget);
    });

    testWidgets('4. Backend service category is respected and filtered', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final repo = _DynamicMockServiceRepository()
        ..services = [
          const Service(
            id: 'svc-1',
            name: 'Headlight Restoration',
            category: 'Exterior Detailing',
            price: 800.0,
            durationMinutes: 40,
            isActive: true,
          ),
          const Service(
            id: 'svc-2',
            name: 'Leather Seat Conditioning',
            category: 'Interior Care',
            price: 1200.0,
            durationMinutes: 60,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      expect(find.text('Headlight Restoration'), findsOneWidget);
      expect(find.text('Leather Seat Conditioning'), findsOneWidget);

      // Tap 'Interior Care' chip
      await tester.tap(find.widgetWithText(ChoiceChip, 'Interior Care'));
      await tester.pumpAndSettle();

      expect(find.text('Leather Seat Conditioning'), findsOneWidget);
      expect(find.text('Headlight Restoration'), findsNothing);
    });

    testWidgets('5. Categories remain available as constants including General Services and NO General Detailing', (tester) async {
      expect(kCatalogueCategories, contains('Exterior Detailing'));
      expect(kCatalogueCategories, contains('General Services'));
      expect(kCatalogueCategories, contains('Interior Care'));
      expect(kCatalogueCategories, contains('Protection Packages'));
      expect(kCatalogueCategories, contains('Others'));
      expect(kCatalogueCategories, isNot(contains('General Detailing')));
      expect(kCatalogueCategories.length, 5);
    });

    testWidgets('6. No hardcoded production service list is required (loads purely from repo)', (tester) async {
      final repo = _DynamicMockServiceRepository()..services = [];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      // With empty repo, no phantom hardcoded production services are rendered
      expect(find.byType(ListView), findsNothing);
      expect(find.byType(AppEmptyState), findsOneWidget);
    });

    testWidgets('7. Empty catalogue response is handled gracefully', (tester) async {
      final repo = _DynamicMockServiceRepository()..services = [];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      expect(find.byType(AppEmptyState), findsOneWidget);
      expect(find.text('No services found'), findsOneWidget);
    });

    testWidgets('8. API failure does not crash the application and displays error state', (tester) async {
      final repo = _DynamicMockServiceRepository()..shouldThrow = true;

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      expect(find.byType(AppErrorState), findsOneWidget);
      expect(find.textContaining('Backend connection timeout'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);
    });

    testWidgets('9. Category Rename Verification: General Services appears and General Detailing is absent', (tester) async {
      final repo = _DynamicMockServiceRepository()
        ..services = [
          const Service(
            id: '74b58d22-17bc-441f-ad96-e0c79fdefdc5',
            name: 'Android service Testing',
            category: 'General Services',
            price: 15500.0,
            isActive: true,
          ),
        ];

      await tester.pumpWidget(createTestWidget(repo));
      await tester.pumpAndSettle();

      // General Services appears in category chip
      expect(find.widgetWithText(ChoiceChip, 'General Services'), findsOneWidget);
      // General Detailing does NOT appear anywhere
      expect(find.text('General Detailing'), findsNothing);
      expect(find.text('GENERAL DETAILING'), findsNothing);

      // Service card shows service name and General Services category
      expect(find.text('Android service Testing'), findsOneWidget);
      expect(find.text('General Services'), findsWidgets);
    });
  });
}
