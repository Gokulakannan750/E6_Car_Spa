import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/catalogue/data/service_api.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_api.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_repository.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/invoices/models/invoice_model.dart'
    show TaxBreakdown;
import 'package:e6_car_spa/features/jobcards/providers/job_card_providers.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_api.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_repository.dart';
import 'package:e6_car_spa/features/vehicles/models/vehicle_model.dart';

/// Stands in for POST /job-cards/preview and records what the notifier asked for.
class _FakeJobCardRepo extends JobCardRepository {
  _FakeJobCardRepo() : super(JobCardApi(Dio()));

  final List<({List<JobCardServiceItemRequest> services, bool isGstEnabled})>
  calls = [];
  JobCardEstimate Function(List<JobCardServiceItemRequest>, bool) respond =
      (services, gst) => JobCardEstimate(
        subtotal: 0,
        discountAmount: 0,
        taxableAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
      );

  @override
  Future<JobCardEstimate> previewJobCard(
    List<JobCardServiceItemRequest> services, {
    bool isGstEnabled = true,
  }) async {
    calls.add((services: services, isGstEnabled: isGstEnabled));
    return respond(services, isGstEnabled);
  }
}

final _fakeJobCardRepo = _FakeJobCardRepo();

class _FakeCustomerRepo extends CustomerRepository {
  _FakeCustomerRepo() : super(CustomerApi(Dio()));
}

class _FakeVehicleRepo extends VehicleRepository {
  _FakeVehicleRepo() : super(VehicleApi(Dio()));
}

class _FakeServiceRepo extends ServiceRepository {
  _FakeServiceRepo() : super(ServiceApi(Dio()));
}

ProviderContainer createTestContainer() {
  return ProviderContainer(
    overrides: [
      jobCardRepositoryProvider.overrideWithValue(_fakeJobCardRepo),
      customerRepositoryProvider.overrideWithValue(_FakeCustomerRepo()),
      vehicleRepositoryProvider.overrideWithValue(_FakeVehicleRepo()),
      serviceRepositoryProvider.overrideWithValue(_FakeServiceRepo()),
    ],
  );
}

void main() {
  group('NewJobCardNotifier State & Calculation Tests', () {
    test('Initial state is at step 0 and empty', () {
      final container = createTestContainer();
      addTearDown(container.dispose);

      final state = container.read(newJobCardProvider);

      expect(state.step, 0);
      expect(state.customer, null);
      expect(state.selectedVehicle, null);
      expect(state.selectedServices.isEmpty, true);
      expect(state.canProceedToServices, false);
      expect(state.canProceedToReview, false);
      expect(state.previewSubtotal, 0.0);
      expect(state.estimate, null);
    });

    test('Selecting customer and vehicle enables proceeding to services', () {
      final container = createTestContainer();
      addTearDown(container.dispose);

      const customer = Customer(
        id: 'c1',
        name: 'John Doe',
        phoneNumber: '1234567890',
      );
      const vehicle = Vehicle(
        id: 'v1',
        registrationNumber: 'TN01AB1234',
        make: 'Hyundai',
        model: 'Creta',
        customerId: 'c1',
      );

      final notifier = container.read(newJobCardProvider.notifier);
      notifier.selectCustomer(customer, [vehicle], vehicle: vehicle);

      final state = container.read(newJobCardProvider);
      expect(state.customer?.id, 'c1');
      expect(state.selectedVehicle?.id, 'v1');
      expect(state.canProceedToServices, true);
    });

    test(
      'Adding and modifying services computes accurate display previews',
      () async {
        final container = createTestContainer();
        addTearDown(container.dispose);

        const svc1 = Service(
          id: 's1',
          name: 'Foam Wash',
          price: 500.0,
          taxPercentage: 18.0,
          isActive: true,
        );

        const svc2 = Service(
          id: 's2',
          name: 'Interior Detailing',
          price: 1000.0,
          taxPercentage: 18.0,
          isActive: true,
        );

        final notifier = container.read(newJobCardProvider.notifier);

        // The server's numbers are shown as returned (here: a 5% response that a flat 18% would get wrong).
        _fakeJobCardRepo.calls.clear();
        _fakeJobCardRepo.respond = (services, gst) {
          final taxable = services.fold<double>(
            0,
            (sum, s) =>
                sum + (s.serviceId == 's1' ? 500.0 : 1000.0) * s.quantity,
          );
          final tax = gst ? taxable * 0.05 : 0.0;
          return JobCardEstimate(
            subtotal: taxable,
            discountAmount: 0,
            taxableAmount: taxable,
            taxAmount: tax,
            totalAmount: taxable + tax,
            taxBreakdown: gst
                ? [
                    TaxBreakdown(
                      ratePercent: 5,
                      taxableAmount: taxable,
                      cgstAmount: tax / 2,
                      sgstAmount: tax / 2,
                      taxAmount: tax,
                    ),
                  ]
                : const [],
          );
        };

        // Add svc1
        notifier.addService(svc1);
        await Future<void>.delayed(Duration.zero);
        var state = container.read(newJobCardProvider);
        expect(state.selectedServices.length, 1);
        expect(state.previewSubtotal, 500.0);
        expect(state.estimate?.totalAmount, 525.0);
        expect(state.canProceedToReview, true);

        // Increase quantity of svc1 to 2
        notifier.updateQuantity('s1', 2);
        await Future<void>.delayed(Duration.zero);
        state = container.read(newJobCardProvider);
        expect(_fakeJobCardRepo.calls.last.services.single.quantity, 2);
        expect(state.estimate?.totalAmount, 1050.0);

        // Add svc2
        notifier.addService(svc2);
        await Future<void>.delayed(Duration.zero);
        state = container.read(newJobCardProvider);
        expect(state.previewSubtotal, 2000.0); // 1000 + 1000
        expect(state.estimate?.taxAmount, 100.0);
        expect(state.estimate?.totalAmount, 2100.0);

        // Disable GST: the server is asked again without GST
        notifier.setGstEnabled(false);
        await Future<void>.delayed(Duration.zero);
        state = container.read(newJobCardProvider);
        expect(state.isGstEnabled, false);
        expect(_fakeJobCardRepo.calls.last.isGstEnabled, false);
        expect(state.estimate?.taxAmount, 0.0);
        expect(state.estimate?.totalAmount, 2000.0);

        // Remove svc1
        notifier.removeService('s1');
        state = container.read(newJobCardProvider);
        expect(state.selectedServices.containsKey('s1'), false);
        expect(state.previewSubtotal, 1000.0);
      },
    );

    test('Reset clears state back to clean step 0', () {
      final container = createTestContainer();
      addTearDown(container.dispose);

      const customer = Customer(
        id: 'c1',
        name: 'John Doe',
        phoneNumber: '1234567890',
      );
      final notifier = container.read(newJobCardProvider.notifier);
      notifier.selectCustomer(customer, []);
      notifier.setStep(1);

      expect(container.read(newJobCardProvider).step, 1);

      notifier.reset();
      expect(container.read(newJobCardProvider).step, 0);
      expect(container.read(newJobCardProvider).customer, null);
    });
  });
}
