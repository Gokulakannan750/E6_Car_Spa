import 'package:dio/dio.dart';
import '../models/service_model.dart';

class ServiceApi {
  final Dio _dio;

  ServiceApi(this._dio);

  Future<ServiceListResponse> getServices({
    bool? isActive,
    int page = 1,
    int pageSize = 100,
    String? search,
    String? category,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (isActive != null) {
      queryParameters['isActive'] = isActive;
    }
    if (search != null && search.trim().isNotEmpty) {
      queryParameters['search'] = search.trim();
    }
    if (category != null && category.trim().isNotEmpty) {
      queryParameters['category'] = category.trim();
    }

    final response = await _dio.get(
      '/services',
      queryParameters: queryParameters,
    );

    return ServiceListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Service> getServiceById(String id) async {
    final response = await _dio.get('/services/$id');
    return Service.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Service> createService(CreateServiceRequest request) async {
    final response = await _dio.post(
      '/services',
      data: request.toJson(),
    );
    return Service.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<String>> getCategories() async {
    final response = await _dio.get('/services/categories');
    final list = response.data as List<dynamic>? ?? [];
    return list.map((e) => e.toString()).toList();
  }
}
