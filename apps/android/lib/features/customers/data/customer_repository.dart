import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/customer_model.dart';
import 'customer_api.dart';

final customerApiProvider = Provider<CustomerApi>((ref) {
  final dio = ref.watch(dioProvider);
  return CustomerApi(dio);
});

final customerRepositoryProvider = Provider<CustomerRepository>((ref) {
  final api = ref.watch(customerApiProvider);
  return CustomerRepository(api);
});

class CustomerRepository {
  final CustomerApi _api;

  CustomerRepository(this._api);

  Future<CustomerListResponse> getCustomers({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    try {
      return await _api.getCustomers(page: page, pageSize: pageSize, search: search);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Customer> getCustomerById(String id) async {
    try {
      return await _api.getCustomerById(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Customer?> getCustomerByPhone(String phoneNumber) async {
    try {
      return await _api.getCustomerByPhone(phoneNumber);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Customer?> getCustomerByRegistration(String registrationNumber) async {
    try {
      return await _api.getCustomerByRegistration(registrationNumber);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<CustomerHistoryResponse> getCustomerHistory(String id) async {
    try {
      return await _api.getCustomerHistory(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Customer> createCustomer(CreateCustomerRequest request) async {
    try {
      return await _api.createCustomer(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Customer> updateCustomer(String id, UpdateCustomerRequest request) async {
    try {
      return await _api.updateCustomer(id, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteCustomer(String id) async {
    try {
      await _api.deleteCustomer(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
