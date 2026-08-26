import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/report_dashboard_model.dart';
import '../models/sales_report_model.dart';
import '../models/payment_report_model.dart';
import '../models/outstanding_invoice_model.dart';
import '../models/gst_report_model.dart';
import '../models/job_card_report_model.dart';
import '../models/showroom_report_model.dart';
import '../models/staff_productivity_report_model.dart';
import '../models/staff_advances_report_model.dart';
import 'reports_api.dart';

final reportsApiProvider = Provider<ReportsApi>((ref) {
  final dio = ref.watch(dioProvider);
  return ReportsApi(dio);
});

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  final api = ref.watch(reportsApiProvider);
  return ReportsRepository(api);
});

class ReportsRepository {
  final ReportsApi _api;

  ReportsRepository(this._api);

  Future<DashboardSummaryModel> getDashboardSummary({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    try {
      return await _api.getDashboardSummary(
        fromDate: fromDate,
        toDate: toDate,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<SalesReportResponseModel> getSalesReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? customerId,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      return await _api.getSalesReport(
        fromDate: fromDate,
        toDate: toDate,
        customerId: customerId,
        page: page,
        pageSize: pageSize,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<PaymentReportResponseModel> getPaymentCollectionReport({
    DateTime? fromDate,
    DateTime? toDate,
    int? paymentMethod,
    String? invoiceId,
    bool includeVoided = false,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      return await _api.getPaymentCollectionReport(
        fromDate: fromDate,
        toDate: toDate,
        paymentMethod: paymentMethod,
        invoiceId: invoiceId,
        includeVoided: includeVoided,
        page: page,
        pageSize: pageSize,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<OutstandingInvoiceReportResponseModel> getOutstandingInvoicesReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? customerId,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      return await _api.getOutstandingInvoicesReport(
        fromDate: fromDate,
        toDate: toDate,
        customerId: customerId,
        page: page,
        pageSize: pageSize,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<GstReportModel> getGstReport({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    try {
      return await _api.getGstReport(
        fromDate: fromDate,
        toDate: toDate,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<JobCardReportResponseModel> getJobCardReport({
    DateTime? fromDate,
    DateTime? toDate,
    int? status,
    String? customerId,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      return await _api.getJobCardReport(
        fromDate: fromDate,
        toDate: toDate,
        status: status,
        customerId: customerId,
        page: page,
        pageSize: pageSize,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShowroomReportResponseModel> getShowroomReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? showroomId,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      return await _api.getShowroomReport(
        fromDate: fromDate,
        toDate: toDate,
        showroomId: showroomId,
        page: page,
        pageSize: pageSize,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffProductivityReportResponseModel> getStaffProductivityReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? staffId,
    String? showroomId,
  }) async {
    try {
      return await _api.getStaffProductivityReport(
        fromDate: fromDate,
        toDate: toDate,
        staffId: staffId,
        showroomId: showroomId,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StaffAdvanceReportResponseModel> getStaffAdvancesReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? staffId,
    int? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      return await _api.getStaffAdvancesReport(
        fromDate: fromDate,
        toDate: toDate,
        staffId: staffId,
        status: status,
        page: page,
        pageSize: pageSize,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
