import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:flutter_test/flutter_test.dart';

ApiException failure(String path, int status, Object? body) {
  final options = RequestOptions(path: path);
  return ApiException.fromDio(
    DioException(
      requestOptions: options,
      response: Response(
        requestOptions: options,
        statusCode: status,
        data: body,
      ),
    ),
  );
}

void main() {
  test('sign-in shows the server message, e.g. a suspended company', () {
    final error = failure('/auth/login', 401, {
      'error': "This company's access is switched off. Please contact Trovo.",
    });
    expect(
      error.message,
      "This company's access is switched off. Please contact Trovo.",
    );
  });

  test('sign-in without a server message stays generic', () {
    expect(
      failure('/auth/login', 401, null).message,
      'Invalid username or password.',
    );
    expect(
      failure('/auth/login', 401, 'Unauthorized').message,
      'Invalid username or password.',
    );
  });

  test('outside sign-in a 401 still means the session expired', () {
    expect(
      failure('/customers', 401, {'error': 'anything'}).message,
      'Session expired. Please log in again.',
    );
  });

  test('a read-only company sees the server message when saving', () {
    expect(
      failure('/customers', 403, {
        'error': 'Your subscription is read-only until payment is received.',
        'code': 'SUBSCRIPTION_READ_ONLY',
      }).message,
      'Your subscription is read-only until payment is received.',
    );
  });
}
