import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auditlogs/data/audit_logs_api.dart';
import 'package:e6_car_spa/features/auditlogs/data/audit_logs_repository.dart';
import 'package:e6_car_spa/features/auditlogs/models/audit_log_model.dart';
import 'package:e6_car_spa/features/auditlogs/models/audit_log_query_parameters.dart';

class MockAuditLogsApi extends AuditLogsApi {
  MockAuditLogsApi() : super(Dio());

  PagedAuditLogsModel? responseToReturn;
  DioException? dioExceptionToThrow;
  AuditLogQueryParameters? lastQuery;

  @override
  Future<PagedAuditLogsModel> getLogs(AuditLogQueryParameters query) async {
    lastQuery = query;
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return responseToReturn!;
  }
}

void main() {
  late MockAuditLogsApi mockApi;
  late AuditLogsRepository repository;

  final sampleLog = AuditLogModel(
    id: 'log-1',
    timestampUtc: DateTime.utc(2026, 8, 26, 12, 0),
    userName: 'Admin',
    userRole: 'Owner',
    action: 'LOGIN_SUCCESS',
    module: 'Authentication',
    description: 'User logged in',
    outcome: 'Success',
    createdAt: DateTime.utc(2026, 8, 26, 12, 0),
  );

  setUp(() {
    mockApi = MockAuditLogsApi();
    repository = AuditLogsRepository(mockApi);
  });

  group('AuditLogsRepository Tests', () {
    test('getLogs returns paged logs and forwards query correctly', () async {
      mockApi.responseToReturn = PagedAuditLogsModel(
        items: [sampleLog],
        totalCount: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      );

      const query = AuditLogQueryParameters(search: 'Admin', module: 'Authentication');
      final result = await repository.getLogs(query);

      expect(mockApi.lastQuery, query);
      expect(result.items.length, 1);
      expect(result.items.first.userName, 'Admin');
      expect(result.items.first.action, 'LOGIN_SUCCESS');
    });

    test('rethrows ApiException on 401 Unauthorized', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/audit-logs'),
        response: Response(
          requestOptions: RequestOptions(path: '/audit-logs'),
          statusCode: 401,
          data: {'error': 'Unauthorized'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getLogs(const AuditLogQueryParameters()),
        throwsA(isA<ApiException>()),
      );
    });

    test('rethrows ApiException on 403 Forbidden', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/audit-logs'),
        response: Response(
          requestOptions: RequestOptions(path: '/audit-logs'),
          statusCode: 403,
          data: {'error': 'Forbidden access.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getLogs(const AuditLogQueryParameters()),
        throwsA(isA<ApiException>()),
      );
    });

    test('rethrows ApiException on 500 Server Error', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/audit-logs'),
        response: Response(
          requestOptions: RequestOptions(path: '/audit-logs'),
          statusCode: 500,
          data: {'error': 'Internal database error.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getLogs(const AuditLogQueryParameters()),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
