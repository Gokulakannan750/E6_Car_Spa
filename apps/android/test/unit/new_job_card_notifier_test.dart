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
import 'package:e6_car_spa/features/jobcards/providers/job_card_providers.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_api.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_repository.dart';
import 'package:e6_car_spa/features/vehicles/models/vehicle_model.dart';

class _FakeJobCardRepo extends JobCardRepository {
  _FakeJobCardRepo() : super(JobCardApi(Dio()));
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

ProviderContainer createTestContainer() {
  return ProviderContainer(
    overrides: [
      jobCardRepositoryProvider.overrideWithValue(_FakeJobCardRepo()),
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
      expect(state.previewTax, 0.0);
      expect(state.previewTotal, 0.0);
    });

    test('Selecting customer and vehicle enables proceeding to services', () {
      final container = createTestContainer();
      addTearDown(container.dispose);

      const customer = Customer(id: 'c1', name: 'John Doe', phoneNumber: '1234567890');
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

    test('Adding and modifying services computes accurate display previews', () {
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

      // Add svc1
      notifier.addService(svc1);
      var state = container.read(newJobCardProvider);
      expect(state.selectedServices.length, 1);
      expect(state.previewSubtotal, 500.0);
      expect(state.previewTax, 90.0); // 18% of 500
      expect(state.previewTotal, 590.0);
      expect(state.canProceedToReview, true);

      // Increase quantity of svc1 to 2
      notifier.updateQuantity('s1', 2);
      state = container.read(newJobCardProvider);
      expect(state.previewSubtotal, 1000.0);
      expect(state.previewTax, 180.0);
      expect(state.previewTotal, 1180.0);

      // Add svc2
      notifier.addService(svc2);
      state = container.read(newJobCardProvider);
      expect(state.previewSubtotal, 2000.0); // 1000 + 1000
      expect(state.previewTax, 360.0); // 180 + 180
      expect(state.previewTotal, 2360.0);

      // Disable GST
      notifier.setGstEnabled(false);
      state = container.read(newJobCardProvider);
      expect(state.isGstEnabled, false);
      expect(state.previewSubtotal, 2000.0);
      expect(state.previewTax, 0.0);
      expect(state.previewTotal, 2000.0);

      // Remove svc1
      notifier.removeService('s1');
      state = container.read(newJobCardProvider);
      expect(state.selectedServices.containsKey('s1'), false);
      expect(state.previewSubtotal, 1000.0);
    });

    test('Reset clears state back to clean step 0', () {
      final container = createTestContainer();
      addTearDown(container.dispose);

      const customer = Customer(id: 'c1', name: 'John Doe', phoneNumber: '1234567890');
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
