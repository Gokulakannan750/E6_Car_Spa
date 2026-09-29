import 'package:dio/dio.dart';
import '../models/outside_job_model.dart';

class OutsideJobApi {
  final Dio _dio;

  OutsideJobApi(this._dio);

  /// Gets all outside jobs for a specific job card.
  Future<List<OutsideJob>> getByJobCardId(String jobCardId) async {
    final response = await _dio.get('/job-cards/$jobCardId/outside-jobs');
    final list = response.data as List<dynamic>? ?? [];
    return list.map((e) => OutsideJob.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Creates and sends a vehicle outside for a specific job card.
  Future<OutsideJob> createOutsideJob(String jobCardId, CreateOutsideJobRequest request) async {
    final response = await _dio.post(
      '/job-cards/$jobCardId/outside-jobs',
      data: request.toJson(),
    );
    return OutsideJob.fromJson(response.data as Map<String, dynamic>);
  }

  /// Marks an active outside job as returned.
  Future<OutsideJob> markReturned(String outsideJobId, MarkOutsideJobReturnedRequest request) async {
    final response = await _dio.post(
      '/outside-jobs/$outsideJobId/return',
      data: request.toJson(),
    );
    return OutsideJob.fromJson(response.data as Map<String, dynamic>);
  }

  /// Cancels an outside job.
  Future<OutsideJob> cancel(String outsideJobId, CancelOutsideJobRequest request) async {
    final response = await _dio.post(
      '/outside-jobs/$outsideJobId/cancel',
      data: request.toJson(),
    );
    return OutsideJob.fromJson(response.data as Map<String, dynamic>);
  }

  /// Gets all vendors (optionally only active).
  Future<List<Vendor>> getVendors({bool? activeOnly}) async {
    final queryParams = <String, dynamic>{};
    if (activeOnly != null) queryParams['activeOnly'] = activeOnly;
    final response = await _dio.get('/vendors', queryParameters: queryParams);
    final list = response.data as List<dynamic>? ?? [];
    return list.map((e) => Vendor.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Creates a new vendor.
  Future<Vendor> createVendor(CreateVendorRequest request) async {
    final response = await _dio.post(
      '/vendors',
      data: request.toJson(),
    );
    return Vendor.fromJson(response.data as Map<String, dynamic>);
  }

  /// Gets the current location of the vehicle for a job card.
  Future<VehicleLocation> getVehicleLocation(String jobCardId) async {
    final response = await _dio.get('/job-cards/$jobCardId/location');
    return VehicleLocation.fromJson(response.data as Map<String, dynamic>);
  }
}
