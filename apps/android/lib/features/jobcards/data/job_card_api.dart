import 'package:dio/dio.dart';
import '../models/job_card_model.dart';

class JobCardApi {
  final Dio _dio;

  JobCardApi(this._dio);

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
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
      if (status != null) 'status': status.value,
      if (customerId != null && customerId.trim().isNotEmpty) 'customerId': customerId.trim(),
      if (vehicleId != null && vehicleId.trim().isNotEmpty) 'vehicleId': vehicleId.trim(),
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (fromDate != null) 'fromDate': fromDate.toIso8601String(),
      if (toDate != null) 'toDate': toDate.toIso8601String(),
    };

    final response = await _dio.get(
      '/job-cards',
      queryParameters: queryParameters,
    );

    return JobCardListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<JobCard> getJobCardById(String id) async {
    final response = await _dio.get('/job-cards/$id');
    return JobCard.fromJson(response.data as Map<String, dynamic>);
  }

  Future<JobCard?> getJobCardByNumber(String jobCardNumber) async {
    try {
      final response = await _dio.get('/job-cards/by-number/$jobCardNumber');
      if (response.data == null) return null;
      return JobCard.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<JobCardListResponse> getJobCardsByCustomer(
    String customerId, {
    int page = 1,
    int pageSize = 20,
  }) async {
    final response = await _dio.get(
      '/job-cards/by-customer/$customerId',
      queryParameters: {'page': page, 'pageSize': pageSize},
    );
    return JobCardListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<JobCardListResponse> getJobCardsByVehicle(
    String vehicleId, {
    int page = 1,
    int pageSize = 20,
  }) async {
    final response = await _dio.get(
      '/job-cards/by-vehicle/$vehicleId',
      queryParameters: {'page': page, 'pageSize': pageSize},
    );
    return JobCardListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<JobCard> createJobCard(CreateJobCardRequest request) async {
    final response = await _dio.post(
      '/job-cards',
      data: request.toJson(),
    );
    return JobCard.fromJson(response.data as Map<String, dynamic>);
  }

  Future<JobCard> updateJobCardServices(String id, UpdateJobCardServicesRequest request) async {
    final response = await _dio.put(
      '/job-cards/$id/services',
      data: request.toJson(),
    );
    return JobCard.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteJobCard(String id) async {
    await _dio.delete('/job-cards/$id');
  }
}
