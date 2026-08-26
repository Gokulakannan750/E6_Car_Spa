import 'package:dio/dio.dart';
import '../models/customer_model.dart';

class CustomerApi {
  final Dio _dio;

  CustomerApi(this._dio);

  Future<CustomerListResponse> getCustomers({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    };

    final response = await _dio.get(
      '/customers',
      queryParameters: queryParameters,
    );

    return CustomerListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Customer> getCustomerById(String id) async {
    final response = await _dio.get('/customers/$id');
    return Customer.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Customer?> getCustomerByPhone(String phoneNumber) async {
    try {
      final response = await _dio.get('/customers/by-phone/$phoneNumber');
      if (response.data == null) return null;
      return Customer.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<Customer?> getCustomerByRegistration(String registrationNumber) async {
    try {
      final response = await _dio.get('/customers/by-registration/$registrationNumber');
      if (response.data == null) return null;
      return Customer.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<CustomerHistoryResponse> getCustomerHistory(String id) async {
    final response = await _dio.get('/customers/$id/history');
    return CustomerHistoryResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Customer> createCustomer(CreateCustomerRequest request) async {
    final response = await _dio.post(
      '/customers',
      data: request.toJson(),
    );
    return Customer.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Customer> updateCustomer(String id, UpdateCustomerRequest request) async {
    final response = await _dio.put(
      '/customers/$id',
      data: request.toJson(),
    );
    return Customer.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteCustomer(String id) async {
    await _dio.delete('/customers/$id');
  }
}
