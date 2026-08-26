import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/vehicle_model.dart';
import 'vehicle_api.dart';

final vehicleApiProvider = Provider<VehicleApi>((ref) {
  final dio = ref.watch(dioProvider);
  return VehicleApi(dio);
});

final vehicleRepositoryProvider = Provider<VehicleRepository>((ref) {
  final api = ref.watch(vehicleApiProvider);
  return VehicleRepository(api);
});

class VehicleRepository {
  final VehicleApi _api;

  VehicleRepository(this._api);

  Future<List<Vehicle>> getVehiclesByCustomer(String customerId) async {
    try {
      return await _api.getVehiclesByCustomer(customerId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Vehicle> getVehicleById(String id) async {
    try {
      return await _api.getVehicleById(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Vehicle?> getVehicleByRegistration(String registrationNumber) async {
    try {
      return await _api.getVehicleByRegistration(registrationNumber);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<VehicleListResponse> getAllVehicles({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    try {
      return await _api.getAllVehicles(page: page, pageSize: pageSize, search: search);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Vehicle> createVehicle(CreateVehicleRequest request) async {
    try {
      return await _api.createVehicle(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Vehicle> updateVehicle(String id, UpdateVehicleRequest request) async {
    try {
      return await _api.updateVehicle(id, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteVehicle(String id) async {
    try {
      await _api.deleteVehicle(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
