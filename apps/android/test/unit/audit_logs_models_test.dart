import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/auditlogs/models/audit_log_model.dart';
import 'package:e6_car_spa/features/auditlogs/models/audit_log_query_parameters.dart';

void main() {
  group('AuditLogModel Tests', () {
    test('fromJson parses complete payload correctly', () {
      final json = {
        'id': 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        'timestampUtc': '2026-08-26T10:30:00Z',
        'userId': '60164693-ed3b-43ed-bc62-9bbb5faa79a1',
        'userName': 'Administrator',
        'userRole': 'Owner',
        'action': 'UPDATE_PERMISSIONS',
        'module': 'Users',
        'entityType': 'User',
        'entityId': '95959d83-f86f-4651-ba6c-b0694e1699fb',
        'entityReference': '@e6manager',
        'description': 'Updated permissions for user @e6manager',
        'oldValues': '{"permissions": []}',
        'newValues': '{"permissions": ["customers.view"]}',
        'metadata': '{"ip": "127.0.0.1"}',
        'ipAddress': '127.0.0.1',
        'outcome': 'Success',
        'createdAt': '2026-08-26T10:30:00.123Z',
      };

      final model = AuditLogModel.fromJson(json);

      expect(model.id, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
      expect(model.userName, 'Administrator');
      expect(model.userRole, 'Owner');
      expect(model.action, 'UPDATE_PERMISSIONS');
      expect(model.module, 'Users');
      expect(model.entityReference, '@e6manager');
      expect(model.isSuccess, true);
      expect(model.oldValues, '{"permissions": []}');
      expect(model.newValues, '{"permissions": ["customers.view"]}');
    });

    test('fromJson handles nullables and fallback defaults gracefully', () {
      final json = {
        'id': '123',
        'timestampUtc': '2026-08-26T12:00:00Z',
        'action': 'LOGIN_FAILURE',
        'module': 'Authentication',
        'description': 'Invalid credentials',
        'outcome': 'Failure',
        'createdAt': '2026-08-26T12:00:00Z',
      };

      final model = AuditLogModel.fromJson(json);

      expect(model.id, '123');
      expect(model.userId, isNull);
      expect(model.userName, isNull);
      expect(model.userRole, isNull);
      expect(model.isSuccess, false);
      expect(model.entityType, isNull);
      expect(model.oldValues, isNull);
    });

    test('toJson serializes correctly', () {
      final model = AuditLogModel(
        id: 'log-1',
        timestampUtc: DateTime.utc(2026, 8, 26, 12, 0),
        userName: 'Admin',
        action: 'CREATE',
        module: 'Customers',
        description: 'Created customer John Doe',
        outcome: 'Success',
        createdAt: DateTime.utc(2026, 8, 26, 12, 0),
      );

      final json = model.toJson();
      expect(json['id'], 'log-1');
      expect(json['action'], 'CREATE');
      expect(json['module'], 'Customers');
      expect(json['userName'], 'Admin');
    });
  });

  group('PagedAuditLogsModel Tests', () {
    test('fromJson parses items and pagination metadata correctly', () {
      final json = {
        'items': [
          {
            'id': '1',
            'timestampUtc': '2026-08-26T10:00:00Z',
            'action': 'LOGIN',
            'module': 'Authentication',
            'description': 'User logged in',
            'outcome': 'Success',
            'createdAt': '2026-08-26T10:00:00Z',
          }
        ],
        'totalCount': 105,
        'page': 1,
        'pageSize': 50,
        'totalPages': 3,
      };

      final paged = PagedAuditLogsModel.fromJson(json);

      expect(paged.items.length, 1);
      expect(paged.totalCount, 105);
      expect(paged.page, 1);
      expect(paged.pageSize, 50);
      expect(paged.totalPages, 3);
      expect(paged.hasNextPage, true);
      expect(paged.hasPreviousPage, false);
    });
  });

  group('AuditLogQueryParameters Tests', () {
    test('toQueryParameters serializes fields accurately', () {
      final query = AuditLogQueryParameters(
        page: 2,
        pageSize: 25,
        search: 'admin',
        module: 'Users',
        outcome: 'Success',
        fromDate: DateTime(2026, 8, 1),
        toDate: DateTime(2026, 8, 26),
      );

      final map = query.toQueryParameters();

      expect(map['page'], 2);
      expect(map['pageSize'], 25);
      expect(map['search'], 'admin');
      expect(map['module'], 'Users');
      expect(map['outcome'], 'Success');
      expect(map['fromDate'], '2026-08-01');
      expect(map['toDate'], '2026-08-26');
    });

    test('copyWith and clear flags operate properly', () {
      var query = const AuditLogQueryParameters(
        search: 'test',
        module: 'Users',
      );

      query = query.copyWith(clearSearch: true, module: 'Invoices');

      expect(query.search, isNull);
      expect(query.module, 'Invoices');
    });
  });
}
