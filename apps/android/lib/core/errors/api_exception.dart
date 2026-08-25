import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? endpoint;
  final dynamic details;

  const ApiException({
    required this.message,
    this.statusCode,
    this.endpoint,
    this.details,
  });

  @override
  String toString() => 'ApiException[$statusCode]: $message at $endpoint';

  factory ApiException.fromDio(DioException error) {
    String message = 'An unexpected error occurred.';
    final statusCode = error.response?.statusCode;
    final endpoint = error.requestOptions.path;

    if (statusCode == 401) {
      final data = error.response?.data;
      if (data is Map && data.containsKey('error')) {
        message = data['error'].toString();
      } else if (data is Map && data.containsKey('message')) {
        message = data['message'].toString();
      } else {
        message = 'Invalid credentials or session expired.';
      }
      return UnauthorizedException(message: message, endpoint: endpoint);
    }

    if (statusCode == 403) {
      final data = error.response?.data;
      if (data is Map && data.containsKey('error')) {
        message = data['error'].toString();
      } else {
        message = "You don't have permission to perform this action.";
      }
      return ForbiddenException(message: message, endpoint: endpoint);
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        message = 'Connection timeout. Please check your internet connection.';
        return NetworkException(message: message, endpoint: endpoint);
      case DioExceptionType.sendTimeout:
        message = 'Request send timeout. Please try again.';
        return NetworkException(message: message, endpoint: endpoint);
      case DioExceptionType.receiveTimeout:
        message = 'Server not responding. Please try again later.';
        return ServerException(message: message, endpoint: endpoint);
      case DioExceptionType.badCertificate:
        message = 'SSL certificate verification failed.';
        return ApiException(message: message, statusCode: statusCode, endpoint: endpoint);
      case DioExceptionType.connectionError:
        message = 'Unable to connect to server. Please check your network.';
        return NetworkException(message: message, endpoint: endpoint);
      case DioExceptionType.cancel:
        message = 'Request was cancelled.';
        return ApiException(message: message, statusCode: statusCode, endpoint: endpoint);
      default:
        if (error.response != null) {
          final data = error.response!.data;
          if (data is Map) {
            if (data.containsKey('error') && data['error'] != null) {
              message = data['error'].toString();
            } else if (data.containsKey('message') && data['message'] != null) {
              message = data['message'].toString();
            } else if (data.containsKey('title') && data['title'] != null) {
              message = data['title'].toString();
            }
          } else if (data is String && data.isNotEmpty) {
            message = data;
          } else {
            message = error.response!.statusMessage ?? 'Server returned error $statusCode.';
          }
        }
    }

    if (statusCode != null && statusCode >= 500) {
      return ServerException(message: message, endpoint: endpoint);
    }

    return ApiException(
      message: message,
      statusCode: statusCode,
      endpoint: endpoint,
      details: error.response?.data,
    );
  }
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException({
    super.message = 'Session expired. Please log in again.',
    super.endpoint,
    super.details,
  }) : super(statusCode: 401);
}

class ForbiddenException extends ApiException {
  const ForbiddenException({
    super.message = "You don't have permission to perform this action.",
    super.endpoint,
    super.details,
  }) : super(statusCode: 403);
}

class ServerException extends ApiException {
  const ServerException({
    super.endpoint,
    super.message = 'Server error. Please try again later.',
    super.details,
  }) : super(statusCode: 500);
}

class NetworkException extends ApiException {
  const NetworkException({
    super.endpoint,
    super.message = 'No internet connection.',
    super.details,
  });
}
