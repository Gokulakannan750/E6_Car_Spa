import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';
import 'package:e6_car_spa/features/customers/presentation/pages/customers_screen.dart';
import 'package:e6_car_spa/features/customers/providers/customer_providers.dart';

class _FakeCustomerRepo extends CustomerRepository {
  _FakeCustomerRepo() : super(CustomerApi(Dio()));

  @override
  Future<CustomerListResponse> getCustomers({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    return const CustomerListResponse(
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
    );
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  testWidgets('CustomersScreen renders header, search field and customer cards', (tester) async {
    const mockCustomers = [
      Customer(
        id: 'c-1',
        name: 'Ramesh Kumar',
        phoneNumber: '9876543210',
        email: 'ramesh@example.com',
        vehicleCount: 2,
      ),
      Customer(
        id: 'c-2',
        name: 'Suresh Babu',
        phoneNumber: '9876543211',
        email: null,
        vehicleCount: 1,
      ),
    ];

    final fakeRepo = _FakeCustomerRepo();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerRepositoryProvider.overrideWithValue(fakeRepo),
          customerListProvider.overrideWith(
            (ref) => _StubCustomerListNotifier(
              fakeRepo,
              const CustomerListState(
                customers: mockCustomers,
                totalCount: 2,
                isLoading: false,
              ),
            ),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const CustomersScreen(),
        ),
      ),
    );

    await tester.pump();

    // Verify Title & Counts
    expect(find.text('Customers'), findsWidgets);
    expect(find.text('2 customers'), findsOneWidget);

    // Verify Customer Cards
    expect(find.text('Ramesh Kumar'), findsOneWidget);
    expect(find.text('9876543210'), findsOneWidget);
    expect(find.text('2 vehicles'), findsOneWidget);

    expect(find.text('Suresh Babu'), findsOneWidget);
    expect(find.text('9876543211'), findsOneWidget);
    expect(find.text('1 vehicle'), findsOneWidget);

    // Verify Floating Action Button
    expect(find.text('Add Customer'), findsOneWidget);
  });

  testWidgets('CustomersScreen renders empty state when no customers found', (tester) async {
    final fakeRepo = _FakeCustomerRepo();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerRepositoryProvider.overrideWithValue(fakeRepo),
          customerListProvider.overrideWith(
            (ref) => _StubCustomerListNotifier(
              fakeRepo,
              const CustomerListState(
                customers: [],
                totalCount: 0,
                isLoading: false,
              ),
            ),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const CustomersScreen(),
        ),
      ),
    );

    await tester.pump();

    expect(find.text('No customers found'), findsOneWidget);
  });
}

class _StubCustomerListNotifier extends CustomerListNotifier {
  _StubCustomerListNotifier(super.repo, CustomerListState initial) {
    state = initial;
  }

  @override
  Future<void> loadCustomers({bool refresh = false, String? search}) async {
    // Stubbed
  }
}
