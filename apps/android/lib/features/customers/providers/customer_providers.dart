import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../vehicles/data/vehicle_repository.dart';
import '../../vehicles/models/vehicle_model.dart';
import '../data/customer_repository.dart';
import '../models/customer_model.dart';

// ── Customer List State ───────────────────────────────────────────────────────

@immutable
class CustomerListState {
  final bool isLoading;
  final bool isRefreshing;
  final List<Customer> customers;
  final int totalCount;
  final int page;
  final int pageSize;
  final String searchQuery;
  final String? errorMessage;

  const CustomerListState({
    this.isLoading = false,
    this.isRefreshing = false,
    this.customers = const [],
    this.totalCount = 0,
    this.page = 1,
    this.pageSize = 20,
    this.searchQuery = '',
    this.errorMessage,
  });

  CustomerListState copyWith({
    bool? isLoading,
    bool? isRefreshing,
    List<Customer>? customers,
    int? totalCount,
    int? page,
    int? pageSize,
    String? searchQuery,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CustomerListState(
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      customers: customers ?? this.customers,
      totalCount: totalCount ?? this.totalCount,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      searchQuery: searchQuery ?? this.searchQuery,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class CustomerListNotifier extends StateNotifier<CustomerListState> {
  final CustomerRepository _repository;

  CustomerListNotifier(this._repository) : super(const CustomerListState()) {
    loadCustomers();
  }

  Future<void> loadCustomers({
    bool refresh = false,
    String? search,
  }) async {
    if (!mounted) return;
    if (refresh) {
      state = state.copyWith(isRefreshing: true, clearError: true);
    } else {
      state = state.copyWith(isLoading: true, clearError: true);
    }

    try {
      final response = await _repository.getCustomers(
        page: 1,
        pageSize: state.pageSize,
        search: search ?? (state.searchQuery.isEmpty ? null : state.searchQuery),
      );

      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        customers: response.items,
        totalCount: response.totalCount,
        page: 1,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        errorMessage: e.message,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        errorMessage: 'Failed to load customers. Please check your connection.',
      );
    }
  }

  void search(String query) {
    if (!mounted) return;
    state = state.copyWith(searchQuery: query);
    loadCustomers(search: query.trim().isEmpty ? null : query.trim());
  }

  Future<Customer> createCustomer(CreateCustomerRequest request) async {
    final customer = await _repository.createCustomer(request);
    await loadCustomers(refresh: true);
    return customer;
  }
}

final customerListProvider = StateNotifierProvider<CustomerListNotifier, CustomerListState>((ref) {
  final repo = ref.watch(customerRepositoryProvider);
  return CustomerListNotifier(repo);
});

// ── Customer Details State ────────────────────────────────────────────────────

@immutable
class CustomerDetailsState {
  final bool isLoading;
  final Customer? customer;
  final List<Vehicle> vehicles;
  final CustomerHistoryResponse? history;
  final String? errorMessage;

  const CustomerDetailsState({
    this.isLoading = true,
    this.customer,
    this.vehicles = const [],
    this.history,
    this.errorMessage,
  });

  CustomerDetailsState copyWith({
    bool? isLoading,
    Customer? customer,
    List<Vehicle>? vehicles,
    CustomerHistoryResponse? history,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CustomerDetailsState(
      isLoading: isLoading ?? this.isLoading,
      customer: customer ?? this.customer,
      vehicles: vehicles ?? this.vehicles,
      history: history ?? this.history,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class CustomerDetailsNotifier extends StateNotifier<CustomerDetailsState> {
  final String customerId;
  final CustomerRepository _customerRepo;
  final VehicleRepository _vehicleRepo;

  CustomerDetailsNotifier(
    this.customerId,
    this._customerRepo,
    this._vehicleRepo, [
    CustomerDetailsState initial = const CustomerDetailsState(),
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
      final customer = await _customerRepo.getCustomerById(customerId);
      final vehicles = await _vehicleRepo.getVehiclesByCustomer(customerId);
      final history = await _customerRepo.getCustomerHistory(customerId);

      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        customer: customer,
        vehicles: vehicles,
        history: history,
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
        errorMessage: 'Unable to load customer details.',
      );
    }
  }
}

final customerDetailsProvider =
    StateNotifierProvider.family<CustomerDetailsNotifier, CustomerDetailsState, String>((ref, customerId) {
  final customerRepo = ref.watch(customerRepositoryProvider);
  final vehicleRepo = ref.watch(vehicleRepositoryProvider);
  return CustomerDetailsNotifier(customerId, customerRepo, vehicleRepo);
});
