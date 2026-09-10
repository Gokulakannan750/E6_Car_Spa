import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_api.dart';
import 'package:e6_car_spa/features/staffadvances/data/staff_advances_repository.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_model.dart';
import 'package:e6_car_spa/features/staffadvances/models/staff_advance_request_models.dart';
import 'package:flutter_test/flutter_test.dart';

class MockErrorStaffAdvancesApi extends StaffAdvancesApi {
  MockErrorStaffAdvancesApi() : super(Dio());

  DioException? exceptionToThrow;

  @override
  Future<StaffAdvanceListResponse> getStaffAdvances({
    int page = 1,
    int pageSize = 20,
    String? staffId,
    String? status,
    DateTime? fromDate,
    DateTime? toDate,
    String? search,
  }) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<StaffAdvance> getStaffAdvanceById(String id) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<StaffAdvance> createStaffAdvance(CreateStaffAdvanceRequest request) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<StaffAdvance> settleStaffAdvance(String id) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<StaffAdvance> obsoleteStaffAdvance(String id, ObsoleteStaffAdvanceRequest request) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<StaffAdvanceHistory> getStaffAdvanceHistory(String staffId) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }
}

void main() {
  late MockErrorStaffAdvancesApi mockApi;
  late StaffAdvancesRepository repository;

  setUp(() {
    mockApi = MockErrorStaffAdvancesApi();
    repository = StaffAdvancesRepository(mockApi);
  });

  group('StaffAdvancesRepository Error Boundary Tests', () {
    test('getStaffAdvances maps 401 Unauthorized to UnauthorizedException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances'),
          statusCode: 401,
          data: {'error': 'Session expired. Please log in again.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getStaffAdvances(),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('createStaffAdvance maps 400 Bad Request to ValidationException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances'),
          statusCode: 400,
          data: {'error': 'Advance amount must be greater than zero.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createStaffAdvance(
          CreateStaffAdvanceRequest(
            staffId: 'stf-1',
            amount: 0.0,
            advanceDate: DateTime(2026, 9, 9),
            reason: 'Advance',
          ),
        ),
        throwsA(isA<ValidationException>().having(
          (e) => e.message,
          'message',
          contains('Advance amount must be greater than zero.'),
        )),
      );
    });

    test('getStaffAdvanceById maps 404 Not Found to NotFoundException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/adv-999'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances/adv-999'),
          statusCode: 404,
          data: {'error': 'Staff advance record adv-999 not found.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getStaffAdvanceById('adv-999'),
        throwsA(isA<NotFoundException>()),
      );
    });

    test('obsoleteStaffAdvance maps 403 Forbidden to ForbiddenException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/adv-1/obsolete'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances/adv-1/obsolete'),
          statusCode: 403,
          data: {'error': 'User does not have permission to mark advance as obsolete.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.obsoleteStaffAdvance(
          'adv-1',
          const ObsoleteStaffAdvanceRequest(reason: 'Entered wrongly'),
        ),
        throwsA(isA<ForbiddenException>()),
      );
    });

    test('settleStaffAdvance maps 409 Conflict to ConflictException when advance already settled', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/adv-1/settle'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances/adv-1/settle'),
          statusCode: 409,
          data: {'error': 'This staff advance has already been settled.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.settleStaffAdvance('adv-1'),
        throwsA(isA<ConflictException>().having(
          (e) => e.message,
          'message',
          contains('This staff advance has already been settled.'),
        )),
      );
    });

    test('obsoleteStaffAdvance maps 409 Conflict when advance is already settled', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/adv-1/obsolete'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances/adv-1/obsolete'),
          statusCode: 409,
          data: {'error': 'Cannot mark settled advance as obsolete.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.obsoleteStaffAdvance(
          'adv-1',
          const ObsoleteStaffAdvanceRequest(reason: 'Entered by mistake'),
        ),
        throwsA(isA<ConflictException>()),
      );
    });

    test('createStaffAdvance maps 500 Server Error to ServerException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances'),
          statusCode: 500,
          data: {'error': 'Database deadlock occurred during advance creation.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createStaffAdvance(
          CreateStaffAdvanceRequest(
            staffId: 'stf-1',
            amount: 2000.0,
            advanceDate: DateTime(2026, 9, 9),
            reason: 'Emergency',
          ),
        ),
        throwsA(isA<ServerException>()),
      );
    });

    test('getStaffAdvanceHistory maps connection timeout to NetworkException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/staff/stf-1/history'),
        type: DioExceptionType.connectionTimeout,
      );

      expect(
        () => repository.getStaffAdvanceHistory('stf-1'),
        throwsA(isA<NetworkException>().having(
          (e) => e.message,
          'message',
          contains('Connection timeout'),
        )),
      );
    });

    test('getStaffAdvances maps network connection error to NetworkException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances'),
        type: DioExceptionType.connectionError,
      );

      expect(
        () => repository.getStaffAdvances(),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
