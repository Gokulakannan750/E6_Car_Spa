import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';

void main() {
  group('Android ApiException & Permission UX Tests', () {
    test('403 Forbidden with specific action produces friendly message', () {
      final dioException = DioException(
        requestOptions: RequestOptions(
          path: '/api/invoices/inv-123/generate',
          extra: {'action': 'generate invoices'},
        ),
        response: Response(
          requestOptions: RequestOptions(path: '/api/invoices/inv-123/generate'),
          statusCode: 403,
          data: {'error': 'Forbidden'},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<PermissionDeniedException>());
      expect(exception, isA<ForbiddenException>());
      expect(exception, isA<ApiException>());
      expect(exception.statusCode, 403);
      expect(exception.message, "You don't have permission to generate invoices.");
    });

    test('403 Forbidden with custom non-technical backend error preserves message', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/invoices/inv-123/payments'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/invoices/inv-123/payments'),
          statusCode: 403,
          data: {'error': 'Only managers may record payments.'},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<PermissionDeniedException>());
      expect(exception.message, 'Only managers may record payments.');
    });

    test('403 Forbidden without action falls back to clean default', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/unknown-endpoint'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/unknown-endpoint'),
          statusCode: 403,
          data: {'title': 'Forbidden'},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<PermissionDeniedException>());
      expect(exception.message, "You don't have permission to perform this action.");
    });

    test('401 Unauthorized produces session expired message', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/invoices'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/invoices'),
          statusCode: 401,
          data: {'title': 'Unauthorized'},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<UnauthorizedException>());
      expect(exception.statusCode, 401);
      expect(exception.message, contains('Session expired'));
    });

    test('409 Conflict preserves business lock message', () {
      const lockMsg = 'This job card is locked because its invoice has already been generated.';
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/job-cards'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/job-cards'),
          statusCode: 409,
          data: {'error': lockMsg},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<ConflictException>());
      expect(exception.statusCode, 409);
      expect(exception.message, lockMsg);
    });

    test('400 Bad Request maps to ValidationException', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/customers'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/customers'),
          statusCode: 400,
          data: {'error': 'Phone number must be 10 digits.'},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<ValidationException>());
      expect(exception.statusCode, 400);
      expect(exception.message, 'Phone number must be 10 digits.');
    });

    test('404 Not Found maps to NotFoundException', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/customers/123'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/customers/123'),
          statusCode: 404,
          data: {},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<NotFoundException>());
      expect(exception.statusCode, 404);
      expect(exception.message, 'The requested record could not be found.');
    });

    test('429 Too Many Requests maps to RateLimitedException', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/auth/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/auth/login'),
          statusCode: 429,
          data: {},
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<RateLimitedException>());
      expect(exception.statusCode, 429);
      expect(exception.message, 'Too many requests. Please try again shortly.');
    });

    test('500 Server Error sanitizes technical dump when no friendly message is provided', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/reports'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/reports'),
          statusCode: 500,
          data: 'Npgsql.NpgsqlException: Connection failed at Postgres.Execute()',
        ),
        type: DioExceptionType.badResponse,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<ServerException>());
      expect(exception.statusCode, 500);
      expect(exception.message, 'Server error. Please try again later.');
    });

    test('Network connection error maps to NetworkException', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/customers'),
        type: DioExceptionType.connectionError,
      );

      final exception = ApiException.fromDio(dioException);

      expect(exception, isA<NetworkException>());
      expect(exception.message, contains('Unable to connect to the server'));
    });
  });
}
