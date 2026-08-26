import 'package:dio/dio.dart';
import '../models/vehicle_model.dart';

class VehicleApi {
  final Dio _dio;

  VehicleApi(this._dio);

  Future<List<Vehicle>> getVehiclesByCustomer(String customerId) async {
    final response = await _dio.get('/vehicles/by-customer/$customerId');
    final rawList = response.data as List<dynamic>? ?? [];
    return rawList.map((e) => Vehicle.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Vehicle> getVehicleById(String id) async {
    final response = await _dio.get('/vehicles/$id');
    return Vehicle.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Vehicle?> getVehicleByRegistration(String registrationNumber) async {
    try {
      final response = await _dio.get('/vehicles/by-registration/$registrationNumber');
      if (response.data == null) return null;
      return Vehicle.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<VehicleListResponse> getAllVehicles({
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
      '/vehicles',
      queryParameters: queryParameters,
    );

    return VehicleListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Vehicle> createVehicle(CreateVehicleRequest request) async {
    final response = await _dio.post(
      '/vehicles',
      data: request.toJson(),
    );
    return Vehicle.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Vehicle> updateVehicle(String id, UpdateVehicleRequest request) async {
    final response = await _dio.put(
      '/vehicles/$id',
      data: request.toJson(),
    );
    return Vehicle.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteVehicle(String id) async {
    await _dio.delete('/vehicles/$id');
  }
}
