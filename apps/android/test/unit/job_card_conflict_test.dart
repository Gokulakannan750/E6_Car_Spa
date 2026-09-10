import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/catalogue/data/service_api.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_api.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_repository.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/jobcards/providers/job_card_providers.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_api.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_repository.dart';
import 'package:e6_car_spa/features/vehicles/models/vehicle_model.dart';

// ── Stub Repositories ────────────────────────────────────────────────────────

class StubJobCardRepo extends JobCardRepository {
  bool shouldThrowConflict = false;
  bool shouldThrowServer = false;
  bool shouldThrowForbidden = false;
  String conflictMessage = 'A job card already exists for this vehicle today.';
  CreateJobCardRequest? lastCreateRequest;

  StubJobCardRepo() : super(JobCardApi(Dio()));

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
    return const JobCardListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);
  }

  @override
  Future<JobCard> createJobCard(CreateJobCardRequest request) async {
    lastCreateRequest = request;
    if (shouldThrowConflict) {
      throw ConflictException(
        message: conflictMessage,
        endpoint: '/api/job-cards',
      );
    }
    if (shouldThrowServer) {
      throw const ServerException(
        message: 'Database connection failed.',
        endpoint: '/api/job-cards',
      );
    }
    if (shouldThrowForbidden) {
      throw const ForbiddenException(
        message: "You don't have permission to create job cards.",
        endpoint: '/api/job-cards',
      );
    }
    return JobCard(
      id: 'jc-new-1',
      jobCardNumber: 'JC-20260908-001',
      customer: CustomerSummary(
        id: request.customerId,
        name: 'Test Customer',
        phoneNumber: '9876543210',
      ),
      vehicle: VehicleSummary(
        id: request.vehicleId,
        registrationNumber: 'TN01AB1234',
        make: 'Hyundai',
        model: 'Creta',
      ),
      status: JobCardStatus.draft,
      services: [
        const JobCardServiceItem(
          id: 'si-1',
          serviceId: 's1',
          serviceName: 'Foam Wash',
          unitPrice: 500.0,
          quantity: 1,
          taxPercentage: 18.0,
          lineTotal: 590.0,
        ),
      ],
      subtotal: 500.0,
      taxAmount: 90.0,
      totalAmount: 590.0,
    );
  }
}

class StubCustomerRepo extends CustomerRepository {
  Customer? customerToReturn;

  StubCustomerRepo() : super(CustomerApi(Dio()));

  @override
  Future<CustomerListResponse> getCustomers({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    return const CustomerListResponse(items: [], totalCount: 0, page: 1, pageSize: 20);
  }

  @override
  Future<Customer> getCustomerById(String id) async {
    return customerToReturn ?? Customer(id: id, name: 'Owner Customer', phoneNumber: '9876543210');
  }
}

class StubVehicleRepo extends VehicleRepository {
  String? lastLookedUpReg;
  Vehicle? vehicleToReturn;
  List<Vehicle> customerVehiclesToReturn = [];
  String? transferredVehicleId;
  String? transferredCustomerId;

  StubVehicleRepo() : super(VehicleApi(Dio()));

  @override
  Future<Vehicle?> getVehicleByRegistration(String registrationNumber) async {
    lastLookedUpReg = registrationNumber;
    return vehicleToReturn;
  }

  @override
  Future<List<Vehicle>> getVehiclesByCustomer(String customerId) async {
    return customerVehiclesToReturn;
  }

  @override
  Future<Vehicle> transferOwnership(String vehicleId, String newCustomerId) async {
    transferredVehicleId = vehicleId;
    transferredCustomerId = newCustomerId;
    return Vehicle(
      id: vehicleId,
      registrationNumber: vehicleToReturn?.registrationNumber ?? 'TN56P3334',
      make: vehicleToReturn?.make ?? 'Maruti',
      model: vehicleToReturn?.model ?? 'Baleno',
      customerId: newCustomerId,
    );
  }
}

class StubServiceRepo extends ServiceRepository {
  StubServiceRepo() : super(ServiceApi(Dio()));

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
        Service(id: 's1', name: 'Foam Wash', price: 500.0, taxPercentage: 18.0, isActive: true),
        Service(id: 's2', name: 'Interior Detailing', price: 1000.0, taxPercentage: 18.0, isActive: true),
      ],
      totalCount: 2,
      page: 1,
      pageSize: 100,
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const _testCustomer = Customer(id: 'c1', name: 'Aravind Swamy', phoneNumber: '9876543210');
const _testVehicle = Vehicle(
  id: 'v1',
  registrationNumber: 'TN01AB1234',
  make: 'Hyundai',
  model: 'Creta',
  customerId: 'c1',
);
const _testService = Service(id: 's1', name: 'Foam Wash', price: 500.0, taxPercentage: 18.0, isActive: true);

/// Creates a container with stub repos, populates the wizard with a customer, vehicle, and service.
({ProviderContainer container, StubJobCardRepo jobCardRepo}) createReadyWizard() {
  final jobCardRepo = StubJobCardRepo();
  final container = ProviderContainer(
    overrides: [
      jobCardRepositoryProvider.overrideWithValue(jobCardRepo),
      customerRepositoryProvider.overrideWithValue(StubCustomerRepo()),
      vehicleRepositoryProvider.overrideWithValue(StubVehicleRepo()),
      serviceRepositoryProvider.overrideWithValue(StubServiceRepo()),
    ],
  );

  final notifier = container.read(newJobCardProvider.notifier);
  notifier.selectCustomer(_testCustomer, [_testVehicle], vehicle: _testVehicle);
  notifier.addService(_testService);

  return (container: container, jobCardRepo: jobCardRepo);
}

void main() {
  group('Job Card Creation - Conflict & Edge Case Tests', () {
    test('submitJobCard returns null and sets submitError when no customer/vehicle/services selected', () async {
      final container = ProviderContainer(
        overrides: [
          jobCardRepositoryProvider.overrideWithValue(StubJobCardRepo()),
          customerRepositoryProvider.overrideWithValue(StubCustomerRepo()),
          vehicleRepositoryProvider.overrideWithValue(StubVehicleRepo()),
          serviceRepositoryProvider.overrideWithValue(StubServiceRepo()),
        ],
      );
      addTearDown(container.dispose);

      // State starts with no customer/vehicle/services
      final notifier = container.read(newJobCardProvider.notifier);
      final result = await notifier.submitJobCard();

      expect(result, isNull);
      final state = container.read(newJobCardProvider);
      expect(state.submitError, 'Please complete all required steps before submitting.');
      expect(state.isSubmitting, false);
    });

    test('submitJobCard succeeds and returns created job card when wizard is complete', () async {
      final (:container, :jobCardRepo) = createReadyWizard();
      addTearDown(container.dispose);

      final notifier = container.read(newJobCardProvider.notifier);
      final result = await notifier.submitJobCard();

      expect(result, isNotNull);
      expect(result!.jobCardNumber, 'JC-20260908-001');
      expect(jobCardRepo.lastCreateRequest, isNotNull);
      expect(jobCardRepo.lastCreateRequest!.customerId, 'c1');
      expect(jobCardRepo.lastCreateRequest!.vehicleId, 'v1');
      expect(jobCardRepo.lastCreateRequest!.services.length, 1);
      expect(jobCardRepo.lastCreateRequest!.services.first.serviceId, 's1');

      final state = container.read(newJobCardProvider);
      expect(state.isSubmitting, false);
      expect(state.submitError, isNull);
    });

    test('submitJobCard handles HTTP 409 conflict gracefully', () async {
      final (:container, :jobCardRepo) = createReadyWizard();
      addTearDown(container.dispose);
      jobCardRepo.shouldThrowConflict = true;

      final notifier = container.read(newJobCardProvider.notifier);
      final result = await notifier.submitJobCard();

      expect(result, isNull);
      final state = container.read(newJobCardProvider);
      expect(state.submitError, 'A job card already exists for this vehicle today.');
      expect(state.isSubmitting, false);

      // Wizard state (customer/vehicle/services) is preserved for retry
      expect(state.customer?.id, 'c1');
      expect(state.selectedVehicle?.id, 'v1');
      expect(state.selectedServices.containsKey('s1'), true);
    });

    test('submitJobCard handles server error gracefully', () async {
      final (:container, :jobCardRepo) = createReadyWizard();
      addTearDown(container.dispose);
      jobCardRepo.shouldThrowServer = true;

      final notifier = container.read(newJobCardProvider.notifier);
      final result = await notifier.submitJobCard();

      expect(result, isNull);
      final state = container.read(newJobCardProvider);
      expect(state.submitError, 'Database connection failed.');
      expect(state.isSubmitting, false);
    });

    test('submitJobCard handles permission denied (403) gracefully', () async {
      final (:container, :jobCardRepo) = createReadyWizard();
      addTearDown(container.dispose);
      jobCardRepo.shouldThrowForbidden = true;

      final notifier = container.read(newJobCardProvider.notifier);
      final result = await notifier.submitJobCard();

      expect(result, isNull);
      final state = container.read(newJobCardProvider);
      expect(state.submitError, "You don't have permission to create job cards.");
      expect(state.isSubmitting, false);
    });

    test('submitJobCard can succeed on retry after conflict is resolved', () async {
      final (:container, :jobCardRepo) = createReadyWizard();
      addTearDown(container.dispose);
      jobCardRepo.shouldThrowConflict = true;

      final notifier = container.read(newJobCardProvider.notifier);

      // First attempt fails with 409
      final first = await notifier.submitJobCard();
      expect(first, isNull);
      expect(container.read(newJobCardProvider).submitError, isNotNull);

      // Resolve conflict and retry
      jobCardRepo.shouldThrowConflict = false;
      final second = await notifier.submitJobCard();
      expect(second, isNotNull);
      expect(second!.jobCardNumber, 'JC-20260908-001');
      expect(container.read(newJobCardProvider).submitError, isNull);
    });

    test('submitJobCard passes isGstEnabled and notes from wizard state', () async {
      final (:container, :jobCardRepo) = createReadyWizard();
      addTearDown(container.dispose);

      final notifier = container.read(newJobCardProvider.notifier);
      notifier.setNotes('Please use ceramic coating');
      notifier.setGstEnabled(false);

      await notifier.submitJobCard();

      expect(jobCardRepo.lastCreateRequest!.notes, 'Please use ceramic coating');
      expect(jobCardRepo.lastCreateRequest!.isGstEnabled, false);
    });
  });

  group('JobCard.isLocked - Status Immutability Rules', () {
    JobCard makeJobCard({
      required JobCardStatus status,
      String? invoiceId,
      String? invoiceNumber,
      String? invoiceStatus,
    }) {
      return JobCard(
        id: 'jc1',
        jobCardNumber: 'JC-001',
        customer: const CustomerSummary(id: 'c1', name: 'Test', phoneNumber: '1234567890'),
        vehicle: const VehicleSummary(id: 'v1', registrationNumber: 'TN01AB1234', make: 'Hyundai', model: 'Creta'),
        status: status,
        services: const [],
        subtotal: 500.0,
        totalAmount: 590.0,
        invoiceId: invoiceId,
        invoiceNumber: invoiceNumber,
        invoiceStatus: invoiceStatus,
      );
    }

    test('draft job card without invoice is NOT locked', () {
      final jc = makeJobCard(status: JobCardStatus.draft);
      expect(jc.isLocked, false);
    });

    test('inProgress job card without invoice is NOT locked', () {
      final jc = makeJobCard(status: JobCardStatus.inProgress);
      expect(jc.isLocked, false);
    });

    test('invoiced status is always locked', () {
      final jc = makeJobCard(status: JobCardStatus.invoiced);
      expect(jc.isLocked, true);
    });

    test('paid status is always locked', () {
      final jc = makeJobCard(status: JobCardStatus.paid);
      expect(jc.isLocked, true);
    });

    test('delivered status is always locked', () {
      final jc = makeJobCard(status: JobCardStatus.delivered);
      expect(jc.isLocked, true);
    });

    test('draft job card with active invoice number is locked', () {
      final jc = makeJobCard(
        status: JobCardStatus.draft,
        invoiceNumber: 'INV-001',
      );
      expect(jc.isLocked, true);
    });

    test('draft job card with invoiceId and non-draft invoice status is locked', () {
      final jc = makeJobCard(
        status: JobCardStatus.draft,
        invoiceId: 'inv-1',
        invoiceStatus: 'Finalized',
      );
      expect(jc.isLocked, true);
    });

    test('draft job card with invoiceId and draft invoice status is NOT locked', () {
      final jc = makeJobCard(
        status: JobCardStatus.draft,
        invoiceId: 'inv-1',
        invoiceStatus: 'draft',
      );
      expect(jc.isLocked, false);
    });

    test('draft job card with invoiceId and "0" invoice status is NOT locked', () {
      final jc = makeJobCard(
        status: JobCardStatus.draft,
        invoiceId: 'inv-1',
        invoiceStatus: '0',
      );
      expect(jc.isLocked, false);
    });

    test('cancelled job card without invoice is NOT locked', () {
      final jc = makeJobCard(status: JobCardStatus.cancelled);
      expect(jc.isLocked, false);
    });
  });

  group('JobCardStatus - Parsing Edge Cases', () {
    test('fromValue maps all defined values correctly', () {
      expect(JobCardStatus.fromValue(0), JobCardStatus.draft);
      expect(JobCardStatus.fromValue(1), JobCardStatus.inProgress);
      expect(JobCardStatus.fromValue(2), JobCardStatus.qualityCheck);
      expect(JobCardStatus.fromValue(3), JobCardStatus.ready);
      expect(JobCardStatus.fromValue(4), JobCardStatus.invoiced);
      expect(JobCardStatus.fromValue(5), JobCardStatus.paid);
      expect(JobCardStatus.fromValue(6), JobCardStatus.delivered);
      expect(JobCardStatus.fromValue(7), JobCardStatus.cancelled);
    });

    test('fromValue defaults to draft for unknown values', () {
      expect(JobCardStatus.fromValue(99), JobCardStatus.draft);
      expect(JobCardStatus.fromValue(-1), JobCardStatus.draft);
    });

    test('fromString parses case-insensitively', () {
      expect(JobCardStatus.fromString('In Progress'), JobCardStatus.inProgress);
      expect(JobCardStatus.fromString('IN PROGRESS'), JobCardStatus.inProgress);
      expect(JobCardStatus.fromString('qualitycheck'), JobCardStatus.qualityCheck);
      expect(JobCardStatus.fromString('Quality Check'), JobCardStatus.qualityCheck);
    });

    test('fromString defaults to draft for unknown strings', () {
      expect(JobCardStatus.fromString('unknown'), JobCardStatus.draft);
      expect(JobCardStatus.fromString(''), JobCardStatus.draft);
    });
  });

  group('NewJobCardNotifier - Vehicle Lookup & Case-Insensitive Normalization', () {
    test('lookupByRegistration normalizes lowercase, uppercase, and mixed-case input', () async {
      final vehicleRepo = StubVehicleRepo();
      final container = ProviderContainer(
        overrides: [
          jobCardRepositoryProvider.overrideWithValue(StubJobCardRepo()),
          customerRepositoryProvider.overrideWithValue(StubCustomerRepo()),
          vehicleRepositoryProvider.overrideWithValue(vehicleRepo),
          serviceRepositoryProvider.overrideWithValue(StubServiceRepo()),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(newJobCardProvider.notifier);

      // 1. Lowercase
      await notifier.lookupByRegistration('tn56p3334');
      expect(vehicleRepo.lastLookedUpReg, 'TN56P3334');

      // 2. Mixed case with whitespace
      await notifier.lookupByRegistration('  tN56p3334 ');
      expect(vehicleRepo.lastLookedUpReg, 'TN56P3334');

      // 3. Uppercase
      await notifier.lookupByRegistration('TN56P3334');
      expect(vehicleRepo.lastLookedUpReg, 'TN56P3334');
    });

    test('Case 1: Same-customer vehicle duplicate detection works across case variations', () async {
      final vehicleRepo = StubVehicleRepo();
      final container = ProviderContainer(
        overrides: [
          jobCardRepositoryProvider.overrideWithValue(StubJobCardRepo()),
          customerRepositoryProvider.overrideWithValue(StubCustomerRepo()),
          vehicleRepositoryProvider.overrideWithValue(vehicleRepo),
          serviceRepositoryProvider.overrideWithValue(StubServiceRepo()),
        ],
      );
      addTearDown(container.dispose);

      const customer = Customer(id: 'c1', name: 'Gokula Kannan', phoneNumber: '9876543210');
      const existingVehicle = Vehicle(
        id: 'v-101',
        registrationNumber: 'TN56P3334',
        make: 'Maruti',
        model: 'Baleno',
        customerId: 'c1',
      );

      final notifier = container.read(newJobCardProvider.notifier);
      notifier.selectCustomer(customer, [existingVehicle]);

      // Lookup returns vehicle with same ID/registration for same customer
      vehicleRepo.vehicleToReturn = const Vehicle(
        id: 'v-101',
        registrationNumber: 'tn56p3334', // simulated lowercase from backend
        make: 'Maruti',
        model: 'Baleno',
        customerId: 'c1',
      );

      await notifier.lookupByRegistration('tn56p3334');

      final state = container.read(newJobCardProvider);
      expect(state.selectedVehicle?.id, 'v-101');
      expect(state.selectedVehicle?.registrationNumber, 'TN56P3334');
      // Should not duplicate in customerVehicles
      expect(state.customerVehicles.length, 1);
      expect(state.lookupError, isNull);
    });

    test('Case 2: Different-customer ownership conflict detection works across case variations', () async {
      final vehicleRepo = StubVehicleRepo();
      final container = ProviderContainer(
        overrides: [
          jobCardRepositoryProvider.overrideWithValue(StubJobCardRepo()),
          customerRepositoryProvider.overrideWithValue(StubCustomerRepo()),
          vehicleRepositoryProvider.overrideWithValue(vehicleRepo),
          serviceRepositoryProvider.overrideWithValue(StubServiceRepo()),
        ],
      );
      addTearDown(container.dispose);

      const currentCustomer = Customer(id: 'c2', name: 'New Customer', phoneNumber: '9876543211');
      final notifier = container.read(newJobCardProvider.notifier);
      notifier.selectCustomer(currentCustomer, []);

      // Vehicle belongs to customer 'c1' (Gokula Kannan)
      vehicleRepo.vehicleToReturn = const Vehicle(
        id: 'v-101',
        registrationNumber: 'TN56P3334',
        make: 'Maruti',
        model: 'Baleno',
        customerId: 'c1',
        customerName: 'Gokula Kannan',
      );

      // User searches with lowercase
      await notifier.lookupByRegistration('tn56p3334');

      final state = container.read(newJobCardProvider);
      expect(state.lookupError, contains('TN56P3334 is already registered to Gokula Kannan'));
      expect(state.lookupError, contains('transfer ownership'));
    });

    test('Ownership transfer preserves exact vehicle and customer GUIDs regardless of registration casing', () async {
      final vehicleRepo = StubVehicleRepo();
      const vehicleId = '3e44b988-7cd3-46c2-a003-24fb9857b946';
      const targetCustomerId = 'cust-destination-guid-777';

      final transferred = await vehicleRepo.transferOwnership(vehicleId, targetCustomerId);

      expect(transferred.id, vehicleId);
      expect(transferred.customerId, targetCustomerId);
      expect(vehicleRepo.transferredVehicleId, vehicleId);
      expect(vehicleRepo.transferredCustomerId, targetCustomerId);
    });
  });
}
