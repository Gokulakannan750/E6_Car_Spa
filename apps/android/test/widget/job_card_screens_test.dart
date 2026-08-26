import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/catalogue/data/service_api.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_api.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_repository.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/jobcards/presentation/pages/job_cards_screen.dart';
import 'package:e6_car_spa/features/jobcards/presentation/pages/job_card_details_screen.dart';
import 'package:e6_car_spa/features/jobcards/providers/job_card_providers.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_api.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_repository.dart';

class _FakeJobCardRepo extends JobCardRepository {
  final JobCard? detailCard;

  _FakeJobCardRepo({this.detailCard}) : super(JobCardApi(Dio()));

  @override
  Future<JobCard> getJobCardById(String id) async {
    if (detailCard != null) return detailCard!;
    throw Exception('Job card not found');
  }

  @override
  Future<JobCardListResponse> getJobCards({
    int page = 1,
    int pageSize = 20,
    JobCardStatus? status,
    String? customerId,
    String? vehicleId,
    String? search,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return const JobCardListResponse(
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
    );
  }
}

class _FakeCustomerRepo extends CustomerRepository {
  _FakeCustomerRepo() : super(CustomerApi(Dio()));
}

class _FakeVehicleRepo extends VehicleRepository {
  _FakeVehicleRepo() : super(VehicleApi(Dio()));
}

class _FakeServiceRepo extends ServiceRepository {
  _FakeServiceRepo() : super(ServiceApi(Dio()));
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('Job Card Widget Tests', () {
    testWidgets('JobCardsScreen renders filter chips, job cards and amounts', (tester) async {
      const mockItems = <JobCardListItem>[
        JobCardListItem(
          id: 'jc-1',
          jobCardNumber: 'JC-2026-0001',
          status: JobCardStatus.inProgress,
          customerName: 'Ramesh Kumar',
          customerPhone: '9876543210',
          registrationNumber: 'TN01AB1234',
          vehicleDisplayName: 'Hyundai Creta',
          totalAmount: 1500.0,
        ),
      ];

      final fakeRepo = _FakeJobCardRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            jobCardRepositoryProvider.overrideWithValue(fakeRepo),
            customerRepositoryProvider.overrideWithValue(_FakeCustomerRepo()),
            vehicleRepositoryProvider.overrideWithValue(_FakeVehicleRepo()),
            serviceRepositoryProvider.overrideWithValue(_FakeServiceRepo()),
            jobCardListProvider.overrideWith(
              (ref) => _StubJobCardListNotifier(
                fakeRepo,
                const JobCardListState(
                  items: mockItems,
                  totalCount: 1,
                  isLoading: false,
                ),
              ),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const JobCardsScreen(),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('Job Cards'), findsWidgets);
      expect(find.text('All'), findsOneWidget);
      expect(find.text('JC-2026-0001'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('TN01AB1234'), findsOneWidget);
      expect(find.text('₹1500.00'), findsOneWidget);
      expect(find.text('New Job Card'), findsOneWidget);
    });

    testWidgets('JobCardDetailsScreen renders customer, vehicle, services and totals', (tester) async {
      const mockJobCard = JobCard(
        id: 'jc-1',
        jobCardNumber: 'JC-2026-0001',
        status: JobCardStatus.inProgress,
        customer: CustomerSummary(
          id: 'c-1',
          name: 'Ramesh Kumar',
          phoneNumber: '9876543210',
        ),
        vehicle: VehicleSummary(
          id: 'v-1',
          registrationNumber: 'TN01AB1234',
          make: 'Hyundai',
          model: 'Creta',
        ),
        services: [
          JobCardServiceItem(
            id: 's-1',
            serviceId: 'svc-1',
            serviceName: 'Premium Foam Wash',
            quantity: 1,
            unitPrice: 650.0,
            taxPercentage: 18.0,
            discountAmount: 0.0,
            lineTotal: 767.0,
          ),
        ],
        subtotal: 650.0,
        discountAmount: 0.0,
        taxAmount: 117.0,
        totalAmount: 767.0,
        notes: 'Full body wash and interior sanitize',
      );

      final fakeRepo = _FakeJobCardRepo(detailCard: mockJobCard);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            jobCardRepositoryProvider.overrideWithValue(fakeRepo),
            jobCardDetailsProvider('jc-1').overrideWith(
              (ref) => JobCardDetailsNotifier(
                'jc-1',
                fakeRepo,
                const JobCardDetailsState(
                  jobCard: mockJobCard,
                  isLoading: false,
                ),
                false,
              ),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const JobCardDetailsScreen(jobCardId: 'jc-1'),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('JC-2026-0001'), findsWidgets);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('TN01AB1234'), findsOneWidget);
      expect(find.text('Premium Foam Wash'), findsOneWidget);
      expect(find.text('₹650.00'), findsWidgets); // Subtotal
      expect(find.text('₹117.00'), findsOneWidget); // Tax
      expect(find.text('₹767.00'), findsWidgets); // Line total & Total Amount
      expect(find.text('Full body wash and interior sanitize'), findsOneWidget);
    });
  });
}

class _StubJobCardListNotifier extends JobCardListNotifier {
  _StubJobCardListNotifier(super.repo, JobCardListState initial) {
    state = initial;
  }

  @override
  Future<void> loadJobCards({bool refresh = false, String? search, JobCardStatus? status}) async {}
}
