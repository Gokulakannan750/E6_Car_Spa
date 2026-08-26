import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/auditlogs/data/audit_logs_api.dart';
import 'package:e6_car_spa/features/auditlogs/data/audit_logs_repository.dart';
import 'package:e6_car_spa/features/auditlogs/models/audit_log_model.dart';
import 'package:e6_car_spa/features/auditlogs/models/audit_log_query_parameters.dart';
import 'package:e6_car_spa/features/auditlogs/providers/audit_logs_provider.dart';

class MockAuditLogsApi extends AuditLogsApi {
  MockAuditLogsApi() : super(Dio());

  PagedAuditLogsModel? responseToReturn;
  DioException? dioExceptionToThrow;

  @override
  Future<PagedAuditLogsModel> getLogs(AuditLogQueryParameters query) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return responseToReturn ??
        PagedAuditLogsModel(
          items: const [],
          totalCount: 0,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: 0,
        );
  }
}

void main() {
  late MockAuditLogsApi mockApi;
  late AuditLogsRepository repository;
  late AuditLogsNotifier notifier;

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
    notifier = AuditLogsNotifier(repository);
  });

  group('AuditLogsNotifier Tests', () {
    test('loadLogs populates state with items and metadata', () async {
      mockApi.responseToReturn = PagedAuditLogsModel(
        items: [sampleLog],
        totalCount: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      );

      await notifier.loadLogs();

      expect(notifier.state.items.length, 1);
      expect(notifier.state.totalCount, 1);
      expect(notifier.state.isLoading, false);
      expect(notifier.state.hasLoaded, true);
      expect(notifier.state.errorMessage, isNull);
    });

    test('setSearch updates query and triggers reload', () async {
      mockApi.responseToReturn = PagedAuditLogsModel(
        items: [sampleLog],
        totalCount: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      );

      notifier.setSearch('Admin');

      expect(notifier.state.query.search, 'Admin');
      await Future.delayed(Duration.zero);
      expect(notifier.state.items.length, 1);
    });

    test('setModule updates query module', () async {
      notifier.setModule('Users');

      expect(notifier.state.query.module, 'Users');
    });

    test('setOutcome updates query outcome', () async {
      notifier.setOutcome('Success');

      expect(notifier.state.query.outcome, 'Success');
    });

    test('setDateRange updates fromDate and toDate', () async {
      final from = DateTime(2026, 8, 1);
      final to = DateTime(2026, 8, 26);

      notifier.setDateRange(from, to);

      expect(notifier.state.query.fromDate, from);
      expect(notifier.state.query.toDate, to);
    });

    test('clearFilters resets query parameters', () async {
      notifier.setModule('Users');
      notifier.setSearch('Test');
      notifier.clearFilters();

      expect(notifier.state.query.module, isNull);
      expect(notifier.state.query.search, isNull);
      expect(notifier.state.query.page, 1);
    });

    test('handles error gracefully and sets errorMessage', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/audit-logs'),
        response: Response(
          requestOptions: RequestOptions(path: '/audit-logs'),
          statusCode: 500,
          data: {'error': 'Server database down'},
        ),
        type: DioExceptionType.badResponse,
      );

      await notifier.loadLogs();

      expect(notifier.state.isLoading, false);
      expect(notifier.state.errorMessage, contains('Server database down'));
    });
  });
}
