import 'package:e6_car_spa/features/franchise/export/franchise_excel.dart';
import 'package:e6_car_spa/features/franchise/models/franchise_models.dart';
import 'package:e6_car_spa/features/franchise/presentation/pages/franchise_screen.dart';
import 'package:excel/excel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'franchise_fakes.dart';

List<String> everything(Excel book, String sheet) => [
  for (final row in book[sheet].rows)
    for (final cell in row)
      if (cell?.value != null) cell!.value.toString(),
];

FranchiseeFinancials sharingCompany({
  String id = 'a',
  String name = 'Beta Detailing',
  List<String> items = const ['financial_totals'],
}) => FranchiseeFinancials(
  linkId: id,
  partnerCodeHint: '0••2',
  partnerName: name,
  financialTotalsAllowed: true,
  allowedItems: items,
  totals: totals(),
);

FranchiseDashboard dashboardOf(List<FranchiseeFinancials> companies) =>
    FranchiseDashboard(
      from: '2026-10-01',
      to: '2026-10-31',
      network: totals(),
      franchisees: companies,
    );

void main() {
  setUpAll(disableFontDownloads);

  group('Workbooks', () {
    test(
      'the network summary lists each company, the total and the daily totals',
      () {
        final file = FranchiseExcel.networkSummary(
          dashboardOf([
            sharingCompany(),
            const FranchiseeFinancials(
              linkId: 'b',
              partnerCodeHint: '0••3',
              partnerName: 'Gamma Autos',
              financialTotalsAllowed: false,
            ),
          ]),
          companyName: 'Sunrise Detailing',
        );
        final book = Excel.decodeBytes(file.bytes);

        expect(
          file.fileName,
          'Sunrise_Detailing_Franchise_Network_Summary_2026-10-01_to_2026-10-31.xlsx',
        );
        expect(book.sheets.keys.toList(), ['Network Summary', 'Daily Totals']);

        final summary = everything(book, 'Network Summary');
        expect(
          summary,
          contains('SUNRISE DETAILING — FRANCHISE NETWORK SUMMARY'),
        );
        expect(summary, contains('NETWORK TOTAL (1 COMPANY)'));
        expect(
          summary,
          containsAll(['Beta Detailing', '1300', '700', '600', 'TOTAL']),
        );
        expect(summary, contains('NOT SHARED WITH YOU'));
        expect(
          summary,
          contains('Gamma Autos has not allowed the financial totals'),
        );

        final daily = everything(book, 'Daily Totals');
        expect(daily, containsAll(['2026-10-01', '2026-10-02']));
      },
    );

    test('one company gets a summary and its daily totals', () {
      final file = FranchiseExcel.companyTotals(
        sharingCompany(),
        '2026-10-01',
        '2026-10-31',
      );
      final book = Excel.decodeBytes(file.bytes);

      expect(
        file.fileName,
        'Beta_Detailing_Financial_Totals_2026-10-01_to_2026-10-31.xlsx',
      );
      expect(book.sheets.keys.toList(), ['Summary', 'Daily Totals']);
      expect(
        everything(book, 'Summary'),
        contains('BETA DETAILING — FINANCIAL TOTALS'),
      );
      expect(
        everything(book, 'Summary'),
        containsAll(['Invoiced (INR)', '1300']),
      );
    });

    test('a company that shares nothing cannot be exported', () {
      expect(
        () => FranchiseExcel.companyTotals(
          const FranchiseeFinancials(
            linkId: 'b',
            partnerCodeHint: '0••3',
            partnerName: 'Gamma Autos',
            financialTotalsAllowed: false,
          ),
          '2026-10-01',
          '2026-10-31',
        ),
        throwsA(isA<StateError>()),
      );
    });
  });

  group('Dashboard buttons', () {
    Future<(FakeFranchiseRepository, RecordingFileService)> open(
      WidgetTester tester,
      List<FranchiseeFinancials> companies,
    ) async {
      useTallScreen(tester);
      final repo = FakeFranchiseRepository()
        ..dashboard = dashboardOf(companies);
      final files = RecordingFileService();
      await tester.pumpWidget(
        franchiseApp(home: const FranchiseScreen(), repo: repo, files: files),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('franchise_tab_dashboard')));
      await tester.pumpAndSettle();
      return (repo, files);
    }

    testWidgets('the network summary is shared as one file', (tester) async {
      final (_, files) = await open(tester, [sharingCompany()]);

      await tester.tap(find.text('Download network summary (Excel)'));
      await tester.pumpAndSettle();

      expect(
        files.shared.single.single.fileName,
        contains('Franchise_Network_Summary'),
      );
    });

    testWidgets('a company that shared only totals gets the totals file', (
      tester,
    ) async {
      final (repo, files) = await open(tester, [sharingCompany()]);

      expect(find.text('Download totals (Excel)'), findsOneWidget);
      expect(find.byKey(const Key('franchise_export_hint_a')), findsOneWidget);
      await tester.tap(find.text('Download totals (Excel)'));
      await tester.pumpAndSettle();

      expect(repo.billingAsked, isEmpty);
      expect(files.shared.single.single.fileName, contains('Financial_Totals'));
    });

    testWidgets(
      'a company that shared its invoice list gets the full billing report for the month the period ends in',
      (tester) async {
        final (repo, files) = await open(tester, [
          sharingCompany(items: const ['financial_totals', 'invoice_list']),
        ]);

        expect(find.text('Full billing report (Excel)'), findsOneWidget);
        expect(find.textContaining('Every day of Oct 2026'), findsOneWidget);
        await tester.tap(find.text('Full billing report (Excel)'));
        await tester.pumpAndSettle();

        expect(repo.billingAsked.single, (linkId: 'a', year: 2026, month: 10));
        expect(
          files.shared.single.single.fileName,
          'Beta_Detailing_Billing_Report_October_2026.xlsx',
        );
      },
    );

    testWidgets('a server refusal is shown and nothing is shared', (
      tester,
    ) async {
      final (repo, files) = await open(tester, [
        sharingCompany(items: const ['financial_totals', 'invoice_list']),
      ]);
      repo.failWith = serverError(
        'Beta Detailing has not shared the invoice list.',
        403,
      );

      await tester.tap(find.text('Full billing report (Excel)'));
      await tester.pumpAndSettle();

      expect(files.shared, isEmpty);
      expect(
        find.textContaining('has not shared the invoice list'),
        findsOneWidget,
      );
    });
  });
}
