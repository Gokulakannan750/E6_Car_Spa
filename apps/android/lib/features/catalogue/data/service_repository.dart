import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/service_model.dart';
import 'service_api.dart';

final serviceApiProvider = Provider<ServiceApi>((ref) {
  final dio = ref.watch(dioProvider);
  return ServiceApi(dio);
});

final serviceRepositoryProvider = Provider<ServiceRepository>((ref) {
  final api = ref.watch(serviceApiProvider);
  return ServiceRepository(api);
});

class ServiceRepository {
  final ServiceApi _api;

  ServiceRepository(this._api);

  Future<ServiceListResponse> getServices({
    bool? isActive = true,
    int page = 1,
    int pageSize = 100,
    String? search,
    String? category,
  }) async {
    try {
      return await _api.getServices(
        isActive: isActive,
        page: page,
        pageSize: pageSize,
        search: search,
        category: category,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Service> getServiceById(String id) async {
    try {
      return await _api.getServiceById(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Service> createService(CreateServiceRequest request) async {
    try {
      return await _api.createService(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<String>> getCategories() async {
    try {
      return await _api.getCategories();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
