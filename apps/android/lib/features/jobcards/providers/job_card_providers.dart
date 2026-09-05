import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../catalogue/data/service_repository.dart';
import '../../catalogue/models/service_model.dart';
import '../../customers/data/customer_repository.dart';
import '../../customers/models/customer_model.dart';
import '../../vehicles/data/vehicle_repository.dart';
import '../../vehicles/models/vehicle_model.dart';
import '../data/job_card_repository.dart';
import '../models/job_card_model.dart';

// ── Job Card List State ───────────────────────────────────────────────────────

@immutable
class JobCardListState {
  final bool isLoading;
  final bool isRefreshing;
  final List<JobCardListItem> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final JobCardStatus? selectedStatus;
  final String searchQuery;
  final String? errorMessage;

  const JobCardListState({
    this.isLoading = false,
    this.isRefreshing = false,
    this.items = const [],
    this.totalCount = 0,
    this.page = 1,
    this.pageSize = 20,
    this.selectedStatus,
    this.searchQuery = '',
    this.errorMessage,
  });

  JobCardListState copyWith({
    bool? isLoading,
    bool? isRefreshing,
    List<JobCardListItem>? items,
    int? totalCount,
    int? page,
    int? pageSize,
    JobCardStatus? selectedStatus,
    bool clearStatus = false,
    String? searchQuery,
    String? errorMessage,
    bool clearError = false,
  }) {
    return JobCardListState(
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      items: items ?? this.items,
      totalCount: totalCount ?? this.totalCount,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      selectedStatus: clearStatus ? null : (selectedStatus ?? this.selectedStatus),
      searchQuery: searchQuery ?? this.searchQuery,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class JobCardListNotifier extends StateNotifier<JobCardListState> {
  final JobCardRepository _repository;

  JobCardListNotifier(this._repository) : super(const JobCardListState()) {
    loadJobCards();
  }

  Future<void> loadJobCards({
    bool refresh = false,
    bool silent = false,
    String? search,
    JobCardStatus? status,
  }) async {
    if (!mounted) return;
    if (!silent) {
      if (refresh) {
        state = state.copyWith(isRefreshing: true, clearError: true);
      } else {
        state = state.copyWith(isLoading: true, clearError: true);
      }
    }

    try {
      final response = await _repository.getJobCards(
        page: 1,
        pageSize: state.pageSize,
        search: search ?? (state.searchQuery.isEmpty ? null : state.searchQuery),
        status: status ?? state.selectedStatus,
      );

      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        items: response.items,
        totalCount: response.totalCount,
        page: 1,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (!silent) {
        state = state.copyWith(
          isLoading: false,
          isRefreshing: false,
          errorMessage: e.message,
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        state = state.copyWith(
          isLoading: false,
          isRefreshing: false,
          errorMessage: 'Failed to load job cards. Please try again.',
        );
      }
    }
  }

  void search(String query) {
    if (!mounted) return;
    state = state.copyWith(searchQuery: query);
    loadJobCards(search: query.trim().isEmpty ? null : query.trim());
  }

  void setStatusFilter(JobCardStatus? status) {
    if (!mounted) return;
    state = state.copyWith(
      selectedStatus: status,
      clearStatus: status == null,
    );
    loadJobCards(status: status);
  }
}

final jobCardListProvider = StateNotifierProvider<JobCardListNotifier, JobCardListState>((ref) {
  final repo = ref.watch(jobCardRepositoryProvider);
  return JobCardListNotifier(repo);
});

// ── Job Card Details State ────────────────────────────────────────────────────

@immutable
class JobCardDetailsState {
  final bool isLoading;
  final JobCard? jobCard;
  final String? errorMessage;

  const JobCardDetailsState({
    this.isLoading = true,
    this.jobCard,
    this.errorMessage,
  });

  JobCardDetailsState copyWith({
    bool? isLoading,
    JobCard? jobCard,
    String? errorMessage,
    bool clearError = false,
  }) {
    return JobCardDetailsState(
      isLoading: isLoading ?? this.isLoading,
      jobCard: jobCard ?? this.jobCard,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class JobCardDetailsNotifier extends StateNotifier<JobCardDetailsState> {
  final String jobCardId;
  final JobCardRepository _repository;

  JobCardDetailsNotifier(
    this.jobCardId,
    this._repository, [
    JobCardDetailsState initial = const JobCardDetailsState(),
    bool autoLoad = true,
  ]) : super(initial) {
    if (autoLoad) {
      loadDetails();
    }
  }

  Future<void> loadDetails() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final jobCard = await _repository.getJobCardById(jobCardId);
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        jobCard: jobCard,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.message,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Unable to load Job Card details. Please try again.',
      );
    }
  }

  Future<JobCard> updateServices(UpdateJobCardServicesRequest request) async {
    try {
      final updated = await _repository.updateJobCardServices(jobCardId, request);
      if (mounted) {
        state = state.copyWith(jobCard: updated, clearError: true);
      }
      return updated;
    } catch (_) {
      rethrow;
    }
  }
}

final jobCardDetailsProvider =
    StateNotifierProvider.family<JobCardDetailsNotifier, JobCardDetailsState, String>((ref, jobCardId) {
  final repo = ref.watch(jobCardRepositoryProvider);
  return JobCardDetailsNotifier(jobCardId, repo);
});

// ── New Job Card Wizard State ─────────────────────────────────────────────────

@immutable
class SelectedServiceDraft {
  final Service service;
  final int quantity;
  final double discountAmount;

  const SelectedServiceDraft({
    required this.service,
    this.quantity = 1,
    this.discountAmount = 0.0,
  });

  double get subtotal => service.price * quantity;
  double get effectiveTaxRate => service.taxPercentage;
  double get taxAmount => (subtotal - discountAmount) * (effectiveTaxRate / 100);
  double get lineTotal => subtotal - discountAmount + taxAmount;

  SelectedServiceDraft copyWith({
    int? quantity,
    double? discountAmount,
  }) {
    return SelectedServiceDraft(
      service: service,
      quantity: quantity ?? this.quantity,
      discountAmount: discountAmount ?? this.discountAmount,
    );
  }
}

@immutable
class NewJobCardState {
  final int step; // 0: Customer/Vehicle, 1: Services, 2: Review & Submit
  final Customer? customer;
  final List<Vehicle> customerVehicles;
  final Vehicle? selectedVehicle;
  final Map<String, SelectedServiceDraft> selectedServices;
  final String notes;
  final bool isGstEnabled;
  final bool isSearching;
  final String? lookupError;
  final bool isLoadingServices;
  final List<Service> availableServices;
  final bool isSubmitting;
  final String? submitError;

  const NewJobCardState({
    this.step = 0,
    this.customer,
    this.customerVehicles = const [],
    this.selectedVehicle,
    this.selectedServices = const {},
    this.notes = '',
    this.isGstEnabled = true,
    this.isSearching = false,
    this.lookupError,
    this.isLoadingServices = false,
    this.availableServices = const [],
    this.isSubmitting = false,
    this.submitError,
  });

  bool get canProceedToServices => customer != null && selectedVehicle != null;
  bool get canProceedToReview => selectedServices.isNotEmpty;

  double get previewSubtotal {
    return selectedServices.values.fold(0.0, (acc, item) => acc + item.subtotal);
  }

  double get previewTax {
    if (!isGstEnabled) return 0.0;
    return selectedServices.values.fold(0.0, (acc, item) => acc + item.taxAmount);
  }

  double get previewDiscount {
    return selectedServices.values.fold(0.0, (acc, item) => acc + item.discountAmount);
  }

  double get previewTotal {
    return previewSubtotal - previewDiscount + previewTax;
  }

  NewJobCardState copyWith({
    int? step,
    Customer? customer,
    bool clearCustomer = false,
    List<Vehicle>? customerVehicles,
    Vehicle? selectedVehicle,
    bool clearSelectedVehicle = false,
    Map<String, SelectedServiceDraft>? selectedServices,
    String? notes,
    bool? isGstEnabled,
    bool? isSearching,
    String? lookupError,
    bool clearLookupError = false,
    bool? isLoadingServices,
    List<Service>? availableServices,
    bool? isSubmitting,
    String? submitError,
    bool clearSubmitError = false,
  }) {
    return NewJobCardState(
      step: step ?? this.step,
      customer: clearCustomer ? null : (customer ?? this.customer),
      customerVehicles: customerVehicles ?? this.customerVehicles,
      selectedVehicle: clearSelectedVehicle ? null : (selectedVehicle ?? this.selectedVehicle),
      selectedServices: selectedServices ?? this.selectedServices,
      notes: notes ?? this.notes,
      isGstEnabled: isGstEnabled ?? this.isGstEnabled,
      isSearching: isSearching ?? this.isSearching,
      lookupError: clearLookupError ? null : (lookupError ?? this.lookupError),
      isLoadingServices: isLoadingServices ?? this.isLoadingServices,
      availableServices: availableServices ?? this.availableServices,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitError: clearSubmitError ? null : (submitError ?? this.submitError),
    );
  }
}

class NewJobCardNotifier extends StateNotifier<NewJobCardState> {
  final CustomerRepository _customerRepo;
  final VehicleRepository _vehicleRepo;
  final ServiceRepository _serviceRepo;
  final JobCardRepository _jobCardRepo;

  NewJobCardNotifier(
    this._customerRepo,
    this._vehicleRepo,
    this._serviceRepo,
    this._jobCardRepo, [
    bool autoLoadServices = true,
  ]) : super(const NewJobCardState()) {
    if (autoLoadServices) {
      loadServices();
    }
  }

  void setStep(int step) {
    if (!mounted) return;
    state = state.copyWith(step: step);
  }

  Future<void> loadServices() async {
    if (!mounted) return;
    state = state.copyWith(isLoadingServices: true);
    try {
      final response = await _serviceRepo.getServices(isActive: true, pageSize: 100);
      if (!mounted) return;
      state = state.copyWith(
        isLoadingServices: false,
        availableServices: response.items,
      );
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(isLoadingServices: false);
    }
  }

  Future<void> lookupByPhone(String phone) async {
    if (phone.trim().isEmpty) return;
    if (!mounted) return;
    state = state.copyWith(isSearching: true, clearLookupError: true);

    try {
      final customer = await _customerRepo.getCustomerByPhone(phone.trim());
      if (!mounted) return;
      if (customer != null) {
        final vehicles = await _vehicleRepo.getVehiclesByCustomer(customer.id);
        if (!mounted) return;
        state = state.copyWith(
          isSearching: false,
          customer: customer,
          customerVehicles: vehicles,
          selectedVehicle: vehicles.isNotEmpty ? vehicles.first : null,
          clearLookupError: true,
        );
      } else {
        state = state.copyWith(
          isSearching: false,
          lookupError: 'No customer found with phone $phone',
          clearCustomer: true,
          customerVehicles: [],
          clearSelectedVehicle: true,
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(isSearching: false, lookupError: e.message);
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(isSearching: false, lookupError: 'Search failed. Please try again.');
    }
  }

  Future<void> lookupByRegistration(String registrationNumber) async {
    if (registrationNumber.trim().isEmpty) return;
    if (!mounted) return;
    state = state.copyWith(isSearching: true, clearLookupError: true);

    try {
      final vehicle = await _vehicleRepo.getVehicleByRegistration(registrationNumber.trim());
      if (!mounted) return;
      if (vehicle != null) {
        final customer = await _customerRepo.getCustomerById(vehicle.customerId);
        if (!mounted) return;
        final vehicles = await _vehicleRepo.getVehiclesByCustomer(customer.id);
        if (!mounted) return;
        state = state.copyWith(
          isSearching: false,
          customer: customer,
          customerVehicles: vehicles,
          selectedVehicle: vehicle,
          clearLookupError: true,
        );
      } else {
        state = state.copyWith(
          isSearching: false,
          lookupError: 'No vehicle found with registration $registrationNumber',
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(isSearching: false, lookupError: e.message);
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(isSearching: false, lookupError: 'Search failed. Please try again.');
    }
  }

  void selectCustomer(Customer customer, List<Vehicle> vehicles, {Vehicle? vehicle}) {
    if (!mounted) return;
    state = state.copyWith(
      customer: customer,
      customerVehicles: vehicles,
      selectedVehicle: vehicle ?? (vehicles.isNotEmpty ? vehicles.first : null),
      clearLookupError: true,
    );
  }

  void selectVehicle(Vehicle vehicle) {
    if (!mounted) return;
    state = state.copyWith(selectedVehicle: vehicle);
  }

  void addService(Service service) {
    if (!mounted) return;
    final current = Map<String, SelectedServiceDraft>.from(state.selectedServices);
    if (current.containsKey(service.id)) {
      final existing = current[service.id]!;
      current[service.id] = existing.copyWith(quantity: existing.quantity + 1);
    } else {
      current[service.id] = SelectedServiceDraft(service: service);
    }
    state = state.copyWith(selectedServices: current);
  }

  void updateQuantity(String serviceId, int quantity) {
    if (quantity <= 0) {
      removeService(serviceId);
      return;
    }
    if (!mounted) return;
    final current = Map<String, SelectedServiceDraft>.from(state.selectedServices);
    if (current.containsKey(serviceId)) {
      current[serviceId] = current[serviceId]!.copyWith(quantity: quantity);
      state = state.copyWith(selectedServices: current);
    }
  }

  void removeService(String serviceId) {
    if (!mounted) return;
    final current = Map<String, SelectedServiceDraft>.from(state.selectedServices);
    current.remove(serviceId);
    state = state.copyWith(selectedServices: current);
  }

  void setNotes(String notes) {
    if (!mounted) return;
    state = state.copyWith(notes: notes);
  }

  void setGstEnabled(bool enabled) {
    if (!mounted) return;
    state = state.copyWith(isGstEnabled: enabled);
  }

  void reset() {
    if (!mounted) return;
    state = const NewJobCardState();
    loadServices();
  }

  Future<JobCard?> submitJobCard() async {
    if (state.customer == null || state.selectedVehicle == null || state.selectedServices.isEmpty) {
      if (!mounted) return null;
      state = state.copyWith(submitError: 'Please complete all required steps before submitting.');
      return null;
    }

    if (!mounted) return null;
    state = state.copyWith(isSubmitting: true, clearSubmitError: true);

    try {
      final serviceItems = state.selectedServices.values.map((item) {
        return JobCardServiceItemRequest(
          serviceId: item.service.id,
          quantity: item.quantity,
          discountAmount: item.discountAmount,
        );
      }).toList();

      final request = CreateJobCardRequest(
        customerId: state.customer!.id,
        vehicleId: state.selectedVehicle!.id,
        notes: state.notes.trim().isEmpty ? null : state.notes.trim(),
        services: serviceItems,
        isGstEnabled: state.isGstEnabled,
      );

      final createdJobCard = await _jobCardRepo.createJobCard(request);
      if (!mounted) return createdJobCard;
      state = state.copyWith(isSubmitting: false, clearSubmitError: true);
      return createdJobCard;
    } on ApiException catch (e) {
      if (!mounted) return null;
      state = state.copyWith(isSubmitting: false, submitError: e.message);
      return null;
    } catch (e) {
      if (!mounted) return null;
      state = state.copyWith(isSubmitting: false, submitError: 'Failed to create Job Card. Please try again.');
      return null;
    }
  }
}

final newJobCardProvider = StateNotifierProvider<NewJobCardNotifier, NewJobCardState>((ref) {
  return NewJobCardNotifier(
    ref.watch(customerRepositoryProvider),
    ref.watch(vehicleRepositoryProvider),
    ref.watch(serviceRepositoryProvider),
    ref.watch(jobCardRepositoryProvider),
  );
});
