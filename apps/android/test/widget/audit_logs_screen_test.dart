import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/auditlogs/models/audit_log_model.dart';
import 'package:e6_car_spa/features/auditlogs/presentation/pages/audit_logs_screen.dart';
import 'package:e6_car_spa/features/auditlogs/presentation/widgets/audit_log_card.dart';
import 'package:e6_car_spa/features/auditlogs/presentation/widgets/audit_log_detail_sheet.dart';
import 'package:e6_car_spa/features/auditlogs/providers/audit_logs_provider.dart';
import 'package:e6_car_spa/features/auditlogs/providers/audit_logs_state.dart';

class TestAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  TestAuthNotifier(super.initialState);

  @override
  Future<bool> login(String username, String password) async => true;

  @override
  Future<void> logout() async {
    state = const Unauthenticated();
  }

  @override
  Future<void> restoreSession() async {}

  @override
  void clearError() {}
}

class TestAuditLogsNotifier extends StateNotifier<AuditLogsState>
    implements AuditLogsNotifier {
  TestAuditLogsNotifier(super.initialState);

  @override
  Future<void> loadLogs({bool resetPage = false}) async {}

  @override
  Future<void> refresh() async {}

  @override
  Future<void> loadMore() async {}

  @override
  void setSearch(String search) {
    state = state.copyWith(
      query: state.query.copyWith(search: search),
    );
  }

  @override
  void setModule(String? module) {
    state = state.copyWith(
      query: state.query.copyWith(module: module),
    );
  }

  @override
  void setOutcome(String? outcome) {
    state = state.copyWith(
      query: state.query.copyWith(outcome: outcome),
    );
  }

  @override
  void setDateRange(DateTime? from, DateTime? to) {
    state = state.copyWith(
      query: state.query.copyWith(fromDate: from, toDate: to),
    );
  }

  @override
  void clearFilters() {
    state = state.copyWith(
      query: const AuditLogsState().query,
    );
  }
}

void main() {
  final sampleOwner = const AuthUser(
    id: 'user-1',
    fullName: 'Administrator',
    username: 'admin',
    role: 'Owner',
    isOwner: true,
  );

  final sampleUnauthorizedUser = const AuthUser(
    id: 'user-2',
    fullName: 'Staff User',
    username: 'staff',
    role: 'Staff',
    isOwner: false,
    permissions: ['customers.view'],
  );

  final sampleLog = AuditLogModel(
    id: 'log-12345678-abcd',
    timestampUtc: DateTime.utc(2026, 8, 26, 10, 30),
    userName: 'Administrator',
    userRole: 'Owner',
    action: 'UPDATE_PERMISSIONS',
    module: 'Users',
    entityType: 'User',
    entityId: 'user-2',
    entityReference: '@e6manager',
    description: 'Updated permissions for user @e6manager',
    oldValues: '{"permissions": []}',
    newValues: '{"permissions": ["customers.view"]}',
    outcome: 'Success',
    createdAt: DateTime.utc(2026, 8, 26, 10, 30),
  );

  Widget createTestWidget({
    required AuthUser user,
    required AuditLogsState auditLogsState,
  }) {
    return ProviderScope(
      overrides: [
        authNotifierProvider.overrideWith(
          (ref) => TestAuthNotifier(Authenticated(user)),
        ),
        auditLogsNotifierProvider.overrideWith(
          (ref) => TestAuditLogsNotifier(auditLogsState),
        ),
      ],
      child: const MaterialApp(
        home: AuditLogsScreen(),
      ),
    );
  }

  group('AuditLogsScreen Widget Tests', () {
    testWidgets('renders screen, KPI cards, search field, chips, and logs for authorized user',
        (tester) async {
      final state = AuditLogsState(
        items: [sampleLog],
        totalCount: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        hasLoaded: true,
      );

      await tester.pumpWidget(createTestWidget(
        user: sampleOwner,
        auditLogsState: state,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Audit Trail'), findsOneWidget);
      expect(find.text('Total Logs'), findsOneWidget);
      expect(find.text('Current Page'), findsOneWidget);
      expect(find.text('1 / 1'), findsOneWidget);
      expect(find.text('Search user, action, module, reference...'), findsOneWidget);
      expect(find.text('All Modules'), findsOneWidget);
      expect(find.text('All Outcomes'), findsOneWidget);

      expect(find.byType(AuditLogCard), findsOneWidget);
      expect(find.text('Administrator'), findsOneWidget);
      expect(find.text('UPDATE_PERMISSIONS'), findsOneWidget);
      expect(find.text('@e6manager'), findsOneWidget);
    });

    testWidgets('tapping AuditLogCard opens AuditLogDetailSheet', (tester) async {
      final state = AuditLogsState(
        items: [sampleLog],
        totalCount: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        hasLoaded: true,
      );

      await tester.pumpWidget(createTestWidget(
        user: sampleOwner,
        auditLogsState: state,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(AuditLogCard));
      await tester.pumpAndSettle();

      expect(find.byType(AuditLogDetailSheet), findsOneWidget);
      expect(find.text('Audit Event Details'), findsOneWidget);
      expect(find.text('EVENT DESCRIPTION'), findsOneWidget);
      expect(find.text('PREVIOUS STATE (OLD VALUES)'), findsOneWidget);
      expect(find.text('NEW STATE (NEW VALUES)'), findsOneWidget);
      expect(find.text('Immutable System Record — Append-only'), findsOneWidget);
    });

    testWidgets('renders empty state when items list is empty', (tester) async {
      const state = AuditLogsState(
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
        hasLoaded: true,
      );

      await tester.pumpWidget(createTestWidget(
        user: sampleOwner,
        auditLogsState: state,
      ));
      await tester.pumpAndSettle();

      expect(find.text('No audit records found'), findsOneWidget);
    });

    testWidgets('renders Access Restricted banner when user lacks audit.view permission',
        (tester) async {
      const state = AuditLogsState(
        hasLoaded: true,
      );

      await tester.pumpWidget(createTestWidget(
        user: sampleUnauthorizedUser,
        auditLogsState: state,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(
        find.text('You do not have permission (audit.view) to view system audit logs.'),
        findsOneWidget,
      );
      expect(find.byType(AuditLogCard), findsNothing);
    });
  });
}
