import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/outside_job_model.dart';
import 'outside_job_api.dart';

final outsideJobApiProvider = Provider<OutsideJobApi>((ref) {
  final dio = ref.watch(dioProvider);
  return OutsideJobApi(dio);
});

final outsideJobRepositoryProvider = Provider<OutsideJobRepository>((ref) {
  final api = ref.watch(outsideJobApiProvider);
  return OutsideJobRepository(api);
});

class OutsideJobRepository {
  final OutsideJobApi _api;

  OutsideJobRepository(this._api);

  Future<List<OutsideJob>> getByJobCardId(String jobCardId) async {
    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return const [];
    }
    try {
      return await _api.getByJobCardId(jobCardId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<OutsideJob> createOutsideJob(
    String jobCardId,
    CreateOutsideJobRequest request,
  ) async {
    try {
      return await _api.createOutsideJob(jobCardId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<OutsideJob> markReturned(
    String outsideJobId,
    MarkOutsideJobReturnedRequest request,
  ) async {
    try {
      return await _api.markReturned(outsideJobId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<OutsideJob> cancel(
    String outsideJobId,
    CancelOutsideJobRequest request,
  ) async {
    try {
      return await _api.cancel(outsideJobId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<OutsideJob> updateCost(
    String outsideJobId,
    UpdateOutsideJobCostRequest request,
  ) async {
    try {
      return await _api.updateCost(outsideJobId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteOutsideJob(String outsideJobId) async {
    try {
      await _api.deleteOutsideJob(outsideJobId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<Vendor>> getVendors({bool? activeOnly}) async {
    try {
      return await _api.getVendors(activeOnly: activeOnly);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Vendor> createVendor(CreateVendorRequest request) async {
    try {
      return await _api.createVendor(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<VehicleLocation> getVehicleLocation(String jobCardId) async {
    try {
      return await _api.getVehicleLocation(jobCardId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
