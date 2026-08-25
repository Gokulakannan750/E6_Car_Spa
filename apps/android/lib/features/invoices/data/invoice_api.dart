import 'package:dio/dio.dart';
import '../models/invoice_model.dart';
import '../models/invoice_request_models.dart';

class InvoiceApi {
  final Dio _dio;

  InvoiceApi(this._dio);

  Future<InvoiceListResponse> getInvoices({
    int page = 1,
    int pageSize = 20,
    String? search,
    InvoiceStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    final queryParameters = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (status != null) 'status': status.value,
      if (fromDate != null) 'fromDate': fromDate.toIso8601String(),
      if (toDate != null) 'toDate': toDate.toIso8601String(),
    };

    final response = await _dio.get(
      '/invoices',
      queryParameters: queryParameters,
    );

    return InvoiceListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Invoice> getInvoiceById(String id) async {
    final response = await _dio.get('/invoices/$id');
    return Invoice.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Invoice?> getInvoiceByNumber(String invoiceNumber) async {
    try {
      final response = await _dio.get('/invoices/by-number/$invoiceNumber');
      if (response.data == null) return null;
      return Invoice.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<Invoice> createFromJobCard(String jobCardId) async {
    final response = await _dio.post('/invoices/from-job-card/$jobCardId');
    return Invoice.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Invoice> updateInvoice(String id, UpdateInvoiceRequest request) async {
    final response = await _dio.put(
      '/invoices/$id',
      data: request.toJson(),
    );
    return Invoice.fromJson(response.data as Map<String, dynamic>);
  }

  Future<Invoice> generateInvoice(String id) async {
    final response = await _dio.post('/invoices/$id/generate');
    return Invoice.fromJson(response.data as Map<String, dynamic>);
  }

  Future<PaymentDto> recordPayment(String invoiceId, RecordPaymentRequest request) async {
    final response = await _dio.post(
      '/invoices/$invoiceId/payments',
      data: request.toJson(),
    );
    return PaymentDto.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<PaymentDto>> getPayments(String invoiceId) async {
    final response = await _dio.get('/invoices/$invoiceId/payments');
    final list = response.data as List<dynamic>? ?? [];
    return list.map((e) => PaymentDto.fromJson(e as Map<String, dynamic>)).toList();
  }
}
