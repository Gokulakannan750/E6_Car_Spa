import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/invoice_model.dart';
import '../models/invoice_request_models.dart';
import 'invoice_api.dart';

final invoiceApiProvider = Provider<InvoiceApi>((ref) {
  final dio = ref.watch(dioProvider);
  return InvoiceApi(dio);
});

final invoiceRepositoryProvider = Provider<InvoiceRepository>((ref) {
  final api = ref.watch(invoiceApiProvider);
  return InvoiceRepository(api);
});

class InvoiceRepository {
  final InvoiceApi _api;

  InvoiceRepository(this._api);

  Future<InvoiceListResponse> getInvoices({
    int page = 1,
    int pageSize = 20,
    String? search,
    InvoiceStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    try {
      return await _api.getInvoices(
        page: page,
        pageSize: pageSize,
        search: search,
        status: status,
        fromDate: fromDate,
        toDate: toDate,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Invoice> getInvoiceById(String id) async {
    try {
      return await _api.getInvoiceById(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Invoice?> getInvoiceByNumber(String invoiceNumber) async {
    try {
      return await _api.getInvoiceByNumber(invoiceNumber);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Invoice> createFromJobCard(String jobCardId) async {
    try {
      return await _api.createFromJobCard(jobCardId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Invoice> updateInvoice(String id, UpdateInvoiceRequest request) async {
    try {
      return await _api.updateInvoice(id, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Invoice> generateInvoice(String id) async {
    try {
      return await _api.generateInvoice(id);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<PaymentDto> recordPayment(String invoiceId, RecordPaymentRequest request) async {
    try {
      return await _api.recordPayment(invoiceId, request);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<PaymentDto>> getPayments(String invoiceId) async {
    try {
      return await _api.getPayments(invoiceId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
