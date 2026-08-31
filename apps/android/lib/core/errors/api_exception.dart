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
    final statusCode = error.response?.statusCode;
    final endpoint = error.requestOptions.path;
    final action = error.requestOptions.extra['action'] as String?;

    bool isTechnical(String msg) {
      return msg.startsWith('HTTP ') ||
          msg.contains('Exception') ||
          msg.contains('DioException') ||
          msg.contains('Stack trace') ||
          msg.contains('SqlException') ||
          msg.contains('Npgsql') ||
          msg.contains('Postgres') ||
          msg == 'Forbidden' ||
          msg == 'Unauthorized' ||
          msg == 'Bad Request' ||
          msg == 'Internal Server Error';
    }

    String? rawMessage;
    if (error.response?.data != null) {
      final data = error.response!.data;
      if (data is Map) {
        if (data.containsKey('error') && data['error'] != null && data['error'].toString().trim().isNotEmpty) {
          rawMessage = data['error'].toString().trim();
        } else if (data.containsKey('detail') && data['detail'] != null && data['detail'].toString().trim().isNotEmpty) {
          rawMessage = data['detail'].toString().trim();
        } else if (data.containsKey('message') && data['message'] != null && data['message'].toString().trim().isNotEmpty) {
          rawMessage = data['message'].toString().trim();
        } else if (data.containsKey('errors') && data['errors'] is Map) {
          final errorsMap = data['errors'] as Map;
          for (final val in errorsMap.values) {
            if (val is List && val.isNotEmpty) {
              rawMessage = val.first.toString().trim();
              break;
            } else if (val is String && val.trim().isNotEmpty) {
              rawMessage = val.trim();
              break;
            }
          }
          if (rawMessage == null && data.containsKey('title') && data['title'] != null) {
            rawMessage = data['title'].toString().trim();
          }
        } else if (data.containsKey('title') && data['title'] != null && data['title'].toString().trim().isNotEmpty) {
          rawMessage = data['title'].toString().trim();
        }
      } else if (data is String && data.trim().isNotEmpty) {
        rawMessage = data.trim();
      }
    }

    if (statusCode == 401) {
      final isLogin = endpoint.contains('/api/auth/login');
      final msg = (isLogin && rawMessage != null && !isTechnical(rawMessage))
          ? rawMessage
          : 'Session expired. Please log in again.';
      return UnauthorizedException(message: msg, endpoint: endpoint, details: error.response?.data);
    }

    if (statusCode == 403) {
      String msg;
      if (rawMessage != null && !isTechnical(rawMessage) && !rawMessage.toLowerCase().startsWith('http')) {
        msg = rawMessage;
      } else if (action != null && action.isNotEmpty) {
        msg = "You don't have permission to $action.";
      } else {
        msg = "You don't have permission to perform this action.";
      }
      return ForbiddenException(
        message: msg,
        endpoint: endpoint,
        details: error.response?.data,
        action: action,
      );
    }

    if (statusCode == 409) {
      final msg = (rawMessage != null && !isTechnical(rawMessage))
          ? rawMessage
          : 'This record has a conflict or has already been modified.';
      return ConflictException(message: msg, endpoint: endpoint, details: error.response?.data);
    }

    if (statusCode == 400) {
      final msg = (rawMessage != null && !isTechnical(rawMessage))
          ? rawMessage
          : 'Invalid request. Please check the entered data.';
      return ValidationException(message: msg, endpoint: endpoint, details: error.response?.data);
    }

    if (statusCode == 404) {
      final msg = (rawMessage != null && !isTechnical(rawMessage))
          ? rawMessage
          : 'The requested record could not be found.';
      return NotFoundException(message: msg, endpoint: endpoint, details: error.response?.data);
    }

    if (statusCode == 429) {
      return RateLimitedException(
        message: 'Too many requests. Please try again shortly.',
        endpoint: endpoint,
        details: error.response?.data,
      );
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        return NetworkException(
          endpoint: endpoint,
          message: 'Connection timeout. Please check your internet connection.',
          details: error.response?.data,
        );
      case DioExceptionType.sendTimeout:
        return NetworkException(
          endpoint: endpoint,
          message: 'Request send timeout. Please try again.',
          details: error.response?.data,
        );
      case DioExceptionType.receiveTimeout:
        return ServerException(
          endpoint: endpoint,
          message: 'Server not responding. Please try again later.',
          details: error.response?.data,
        );
      case DioExceptionType.connectionError:
        return NetworkException(
          endpoint: endpoint,
          message: 'Unable to connect to the server. Please check that the E6 Car Spa server is running and try again.',
          details: error.response?.data,
        );
      case DioExceptionType.badCertificate:
        return NetworkException(
          endpoint: endpoint,
          message: 'SSL certificate verification failed.',
          details: error.response?.data,
        );
      case DioExceptionType.cancel:
        return ApiException(
          message: 'Request was cancelled.',
          statusCode: statusCode,
          endpoint: endpoint,
          details: error.response?.data,
        );
      default:
        break;
    }

    if (statusCode != null && statusCode >= 500) {
      final msg = (rawMessage != null && !isTechnical(rawMessage))
          ? rawMessage
          : 'Server error. Please try again later.';
      return ServerException(
        endpoint: endpoint,
        message: msg,
        details: error.response?.data,
      );
    }

    return ApiException(
      message: (rawMessage != null && !isTechnical(rawMessage)) ? rawMessage : 'An unexpected error occurred.',
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

class PermissionDeniedException extends ApiException {
  final String? action;

  const PermissionDeniedException({
    super.message = "You don't have permission to perform this action.",
    super.endpoint,
    super.details,
    this.action,
  }) : super(statusCode: 403);
}

class ForbiddenException extends PermissionDeniedException {
  const ForbiddenException({
    super.message = "You don't have permission to perform this action.",
    super.endpoint,
    super.details,
    super.action,
  });
}

class ConflictException extends ApiException {
  const ConflictException({
    required super.message,
    super.endpoint,
    super.details,
  }) : super(statusCode: 409);
}

class ValidationException extends ApiException {
  const ValidationException({
    required super.message,
    super.endpoint,
    super.details,
  }) : super(statusCode: 400);
}

class NotFoundException extends ApiException {
  const NotFoundException({
    super.message = 'The requested record could not be found.',
    super.endpoint,
    super.details,
  }) : super(statusCode: 404);
}

class RateLimitedException extends ApiException {
  const RateLimitedException({
    super.message = 'Too many requests. Please try again shortly.',
    super.endpoint,
    super.details,
  }) : super(statusCode: 429);
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
