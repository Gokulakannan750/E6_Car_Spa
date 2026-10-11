import 'package:e6_car_spa/features/franchise/models/franchise_models.dart';
import 'package:e6_car_spa/features/franchise/presentation/pages/franchise_invite_screen.dart';
import 'package:e6_car_spa/features/franchise/presentation/pages/franchise_screen.dart';
import 'package:e6_car_spa/features/franchise/presentation/pages/franchise_sharing_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'franchise_fakes.dart';

void main() {
  setUpAll(disableFontDownloads);

  group('Franchise screen', () {
    testWidgets('a company without the add-on is told it is not switched on', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()..access = FranchiseAccess.none;
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_not_active')), findsOneWidget);
      expect(find.byKey(const Key('franchise_send_invite')), findsNothing);
    });

    testWidgets('an empty network says so and offers the invitation form', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository();
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_no_franchisees')), findsOneWidget);
      expect(find.byKey(const Key('franchise_invite_code')), findsOneWidget);
      expect(find.byKey(const Key('franchise_send_invite')), findsOneWidget);
    });

    testWidgets('sending an invitation passes the code and shows the link', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository();
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('franchise_invite_code')),
        '0002',
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('franchise_send_invite')));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('invite:0002:financial_totals'));
      expect(find.byKey(const Key('franchise_link_box')), findsOneWidget);
      expect(find.byKey(const Key('franchise_notice_ok')), findsOneWidget);
    });

    testWidgets('a rejected invitation shows the reason', (tester) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..failWith = serverError('You cannot invite your own company.');
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('franchise_invite_code')),
        '0001',
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('franchise_send_invite')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_notice_error')), findsOneWidget);
      expect(find.textContaining('own company'), findsOneWidget);
    });

    testWidgets('a waiting invitation can be withdrawn or given a new link', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..currentNetwork = network(franchisees: [link(id: 'p1')]);
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_card_p1')), findsOneWidget);
      // Only the masked code is shown.
      expect(find.textContaining('0••2'), findsWidgets);

      await tester.tap(find.byKey(const Key('franchise_new_link_p1')));
      await tester.pumpAndSettle();
      expect(repo.calls, contains('newlink:p1'));
      expect(find.byKey(const Key('franchise_link_box')), findsOneWidget);
    });

    testWidgets('an active franchisee can be ended after confirming', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..currentNetwork = network(
          franchisees: [
            link(
              id: 'a1',
              status: 'Active',
              scopes: [scope('financial_totals', totalsLabel, 'Granted')],
            ),
          ],
        );
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('franchise_end_a1')));
      await tester.pumpAndSettle();
      // Nothing happens until the question is confirmed.
      expect(repo.calls.where((c) => c.startsWith('end:')), isEmpty);
    });

    testWidgets('the dashboard shows the totals and the chart', (tester) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..dashboard = FranchiseDashboard(
          from: '2026-10-01',
          to: '2026-10-07',
          network: totals(),
          franchisees: [
            FranchiseeFinancials(
              linkId: 'a',
              partnerCodeHint: '0••2',
              partnerName: 'Beta',
              financialTotalsAllowed: true,
              allowedItems: const ['financial_totals'],
              totals: totals(),
            ),
          ],
        );
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('franchise_tab_dashboard')));
      await tester.pumpAndSettle();

      expect(repo.dashboardPeriods, isNotEmpty);
      expect(find.byKey(const Key('franchise_chart_card')), findsOneWidget);
      expect(find.byKey(const Key('franchise_daily_chart')), findsOneWidget);
      expect(find.byKey(const Key('franchise_total_Invoiced')), findsWidgets);
      expect(find.byKey(const Key('franchise_total_Collected')), findsWidgets);
    });

    testWidgets('choosing another period asks for that period', (tester) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository();
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('franchise_tab_dashboard')));
      await tester.pumpAndSettle();
      final first = repo.dashboardPeriods.length;

      await tester.tap(find.byKey(const Key('franchise_period_90')));
      await tester.pumpAndSettle();

      expect(repo.dashboardPeriods.length, greaterThan(first));
      final period = repo.dashboardPeriods.last;
      final days = DateTime.parse(
        period.to,
      ).difference(DateTime.parse(period.from)).inDays;
      expect(days, 89);
    });

    testWidgets('companies that share nothing are listed apart', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..dashboard = FranchiseDashboard(
          from: '2026-10-01',
          to: '2026-10-07',
          network: totals(),
          franchisees: [
            FranchiseeFinancials(
              linkId: 'a',
              partnerCodeHint: '0••2',
              partnerName: 'Beta',
              financialTotalsAllowed: true,
              allowedItems: const ['financial_totals'],
              totals: totals(),
            ),
            const FranchiseeFinancials(
              linkId: 'b',
              partnerCodeHint: '0••3',
              partnerName: 'Gamma',
              financialTotalsAllowed: false,
              allowedItems: [],
            ),
          ],
        );
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('franchise_tab_dashboard')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_company_a')), findsOneWidget);
      expect(
        find.byKey(const Key('franchise_not_shared_heading')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('franchise_company_b')), findsNothing);
    });
  });

  group('Franchise sharing screen', () {
    testWidgets('a franchisee can open an invitation from a pasted link', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..access = const FranchiseAccess(
          canActAsFranchisor: false,
          isFranchisee: true,
        )
        ..currentNetwork = network(franchisors: [link(role: 'Franchisee')]);
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseSharingScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('franchise_answer_invitation')),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('franchise_waiting_invitation')),
        findsOneWidget,
      );
    });

    testWidgets('an active partner lists what is shared with switches', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..access = const FranchiseAccess(
          canActAsFranchisor: false,
          isFranchisee: true,
        )
        ..currentNetwork = network(
          franchisors: [
            link(
              id: 'f1',
              role: 'Franchisee',
              status: 'Active',
              scopes: [scope('financial_totals', totalsLabel, 'Granted')],
            ),
          ],
        );
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseSharingScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_sharing_f1')), findsOneWidget);
      final toggle = find.byKey(
        const Key('franchise_share_switch_financial_totals'),
      );
      expect(toggle, findsOneWidget);

      await tester.tap(toggle);
      await tester.pumpAndSettle();
      expect(repo.calls, contains('decide:f1:financial_totals:false'));
    });

    testWidgets('with no partners it says nobody can see anything', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..access = const FranchiseAccess(
          canActAsFranchisor: false,
          isFranchisee: true,
        );
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseSharingScreen(), repo: repo),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_nobody')), findsOneWidget);
    });
  });

  group('Franchise invitation screen', () {
    const token = 'abc';

    testWidgets('accepting sends the ticked items and shows thanks', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository();
      await tester.pumpWidget(
        franchiseApp(
          home: const FranchiseInviteScreen(token: token),
          repo: repo,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_invite_card')), findsOneWidget);
      await tester.tap(find.byKey(const Key('franchise_invite_accept')));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('respond:$token:true:financial_totals'));
      expect(find.byKey(const Key('franchise_invite_done')), findsOneWidget);
    });

    testWidgets(
      'unticking everything stops a first invitation being accepted',
      (tester) async {
        useTallScreen(tester);
        final repo = FakeFranchiseRepository();
        await tester.pumpWidget(
          franchiseApp(
            home: const FranchiseInviteScreen(token: token),
            repo: repo,
          ),
        );
        await tester.pumpAndSettle();

        await tester.tap(
          find.byKey(const Key('franchise_invite_scope_financial_totals')),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('franchise_invite_accept')));
        await tester.pumpAndSettle();

        expect(repo.calls.where((c) => c.startsWith('respond')), isEmpty);
      },
    );

    testWidgets('declining sends nothing granted', (tester) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository();
      await tester.pumpWidget(
        franchiseApp(
          home: const FranchiseInviteScreen(token: token),
          repo: repo,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('franchise_invite_decline')));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('respond:$token:false:'));
      expect(find.byKey(const Key('franchise_invite_done')), findsOneWidget);
    });

    testWidgets('a link that does not belong to this company is refused', (
      tester,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..failWith = serverError('This invitation link is not valid.', 404);
      await tester.pumpWidget(
        franchiseApp(
          home: const FranchiseInviteScreen(token: token),
          repo: repo,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('franchise_invite_error')), findsOneWidget);
      expect(find.byKey(const Key('franchise_invite_accept')), findsNothing);
    });
  });
}
