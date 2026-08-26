import 'package:dio/dio.dart';
import '../models/report_dashboard_model.dart';
import '../models/sales_report_model.dart';
import '../models/payment_report_model.dart';
import '../models/outstanding_invoice_model.dart';
import '../models/gst_report_model.dart';
import '../models/job_card_report_model.dart';
import '../models/showroom_report_model.dart';
import '../models/staff_productivity_report_model.dart';
import '../models/staff_advances_report_model.dart';

class ReportsApi {
  final Dio _dio;

  ReportsApi(this._dio);

  String _formatDate(DateTime date) => date.toIso8601String().split('T').first;

  /// 1. Dashboard Summary
  Future<DashboardSummaryModel> getDashboardSummary({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);

    final response = await _dio.get(
      '/reports/dashboard',
      queryParameters: queryParameters,
    );
    return DashboardSummaryModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 2. Sales Report
  Future<SalesReportResponseModel> getSalesReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? customerId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);
    if (customerId != null && customerId.isNotEmpty) queryParameters['customerId'] = customerId;

    final response = await _dio.get(
      '/reports/sales',
      queryParameters: queryParameters,
    );
    return SalesReportResponseModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 3. Payment Collection Report
  Future<PaymentReportResponseModel> getPaymentCollectionReport({
    DateTime? fromDate,
    DateTime? toDate,
    int? paymentMethod,
    String? invoiceId,
    bool includeVoided = false,
    int page = 1,
    int pageSize = 20,
  }) async {
    final queryParameters = <String, dynamic>{
      'includeVoided': includeVoided,
      'page': page,
      'pageSize': pageSize,
    };
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);
    if (paymentMethod != null) queryParameters['paymentMethod'] = paymentMethod;
    if (invoiceId != null && invoiceId.isNotEmpty) queryParameters['invoiceId'] = invoiceId;

    final response = await _dio.get(
      '/reports/payments',
      queryParameters: queryParameters,
    );
    return PaymentReportResponseModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 4. Outstanding Invoices Report
  Future<OutstandingInvoiceReportResponseModel> getOutstandingInvoicesReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? customerId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);
    if (customerId != null && customerId.isNotEmpty) queryParameters['customerId'] = customerId;

    final response = await _dio.get(
      '/reports/invoices/outstanding',
      queryParameters: queryParameters,
    );
    return OutstandingInvoiceReportResponseModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 5. GST Summary Report
  Future<GstReportModel> getGstReport({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);

    final response = await _dio.get(
      '/reports/gst',
      queryParameters: queryParameters,
    );
    return GstReportModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 6. Job Card Operational Report
  Future<JobCardReportResponseModel> getJobCardReport({
    DateTime? fromDate,
    DateTime? toDate,
    int? status,
    String? customerId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);
    if (status != null) queryParameters['status'] = status;
    if (customerId != null && customerId.isNotEmpty) queryParameters['customerId'] = customerId;

    final response = await _dio.get(
      '/reports/job-cards',
      queryParameters: queryParameters,
    );
    return JobCardReportResponseModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 7. Showroom Daily Report
  Future<ShowroomReportResponseModel> getShowroomReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? showroomId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);
    if (showroomId != null && showroomId.isNotEmpty) queryParameters['showroomId'] = showroomId;

    final response = await _dio.get(
      '/reports/showrooms',
      queryParameters: queryParameters,
    );
    return ShowroomReportResponseModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 8. Staff Productivity Report
  Future<StaffProductivityReportResponseModel> getStaffProductivityReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? staffId,
    String? showroomId,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);
    if (staffId != null && staffId.isNotEmpty) queryParameters['staffId'] = staffId;
    if (showroomId != null && showroomId.isNotEmpty) queryParameters['showroomId'] = showroomId;

    final response = await _dio.get(
      '/reports/staff-productivity',
      queryParameters: queryParameters,
    );
    return StaffProductivityReportResponseModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 9. Staff Advances Report
  Future<StaffAdvanceReportResponseModel> getStaffAdvancesReport({
    DateTime? fromDate,
    DateTime? toDate,
    String? staffId,
    int? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (fromDate != null) queryParameters['fromDate'] = _formatDate(fromDate);
    if (toDate != null) queryParameters['toDate'] = _formatDate(toDate);
    if (staffId != null && staffId.isNotEmpty) queryParameters['staffId'] = staffId;
    if (status != null) queryParameters['status'] = status;

    final response = await _dio.get(
      '/reports/staff-advances',
      queryParameters: queryParameters,
    );
    return StaffAdvanceReportResponseModel.fromJson(response.data as Map<String, dynamic>);
  }
}
