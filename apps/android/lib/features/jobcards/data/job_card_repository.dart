import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/job_card_model.dart';
import 'job_card_api.dart';

final jobCardApiProvider = Provider<JobCardApi>((ref) {
  final dio = ref.watch(dioProvider);
  return JobCardApi(dio);
});

final jobCardRepositoryProvider = Provider<JobCardRepository>((ref) {
  final api = ref.watch(jobCardApiProvider);
  return JobCardRepository(api);
});

class JobCardRepository {
  final JobCardApi _api;

  JobCardRepository(this._api);

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
    try {
      return await _api.getJobCards(
        page: page,
        pageSize: pageSize,
        status: status,
        customerId: customerId,
        vehicleId: vehicleId,
        search: search,
        fromDate: fromDate,
        toDate: toDate,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<JobCard> getJobCardById(String id) async {
    try {
      return await _api.getJobCardById(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<JobCard?> getJobCardByNumber(String jobCardNumber) async {
    try {
      return await _api.getJobCardByNumber(jobCardNumber);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<JobCardListResponse> getJobCardsByCustomer(
    String customerId, {
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      return await _api.getJobCardsByCustomer(customerId, page: page, pageSize: pageSize);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<JobCardListResponse> getJobCardsByVehicle(
    String vehicleId, {
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      return await _api.getJobCardsByVehicle(vehicleId, page: page, pageSize: pageSize);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<JobCard> createJobCard(CreateJobCardRequest request) async {
    try {
      return await _api.createJobCard(request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<JobCard> updateJobCardServices(String id, UpdateJobCardServicesRequest request) async {
    try {
      return await _api.updateJobCardServices(id, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteJobCard(String id) async {
    try {
      await _api.deleteJobCard(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
