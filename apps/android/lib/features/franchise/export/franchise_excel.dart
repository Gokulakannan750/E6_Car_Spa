import 'package:excel/excel.dart';
import '../../reports/export/report_file_service.dart';
import '../../reports/export/xlsx_sheet.dart';
import '../models/franchise_models.dart';

/// Excel files for the franchise dashboard: every company together, or one company's totals. The full monthly billing
/// workbook (when a franchisee shared its invoice list) comes from the billing report export instead.
class FranchiseExcel {
  static String _period(String from, String to) => 'Period: $from to $to';

  static void _totals(XlsxSheet s, FranchiseTotals t) {
    s
      ..keyValue('Invoiced (INR)', t.invoicedAmount)
      ..keyValue('Collected (INR)', t.collectedAmount)
      ..keyValue('Outstanding (INR)', t.outstandingAmount)
      ..keyValue('Invoices', t.invoiceCount)
      ..keyValue('Job cards', t.jobCardCount);
  }

  static XlsxSheet _daily(
    Excel excel,
    Set<String> used,
    FranchiseTotals totals,
    String title,
    String subtitle,
  ) {
    final s =
        XlsxSheet(excel[uniqueSheetName('Daily Totals', used)], columns: 3)
          ..title(title)
          ..subtitle(subtitle)
          ..blank()
          ..header(const ['Date', 'Invoiced (INR)', 'Collected (INR)']);
    for (final d in totals.daily) {
      s.rowOf([d.date, d.invoiced, d.collected]);
    }
    s.rowOf([
      'Total',
      totals.daily.fold<double>(0, (n, d) => n + d.invoiced),
      totals.daily.fold<double>(0, (n, d) => n + d.collected),
    ], bold: true);
    s.widths([16, 20, 20]);
    return s;
  }

  /// All franchisees together: network totals, one line per company, who is not sharing, and the daily totals.
  static ReportFile networkSummary(
    FranchiseDashboard dashboard, {
    String? companyName,
  }) {
    final title = reportTitle('FRANCHISE NETWORK SUMMARY', companyName);
    final subtitle = _period(dashboard.from, dashboard.to);
    final wb = newWorkbook('Network Summary');
    final sharing = dashboard.sharing;

    final s = XlsxSheet(wb.first, columns: 6)
      ..title(title)
      ..subtitle(subtitle)
      ..blank()
      ..section(
        'NETWORK TOTAL (${sharing.length} ${sharing.length == 1 ? 'COMPANY' : 'COMPANIES'})',
      );
    _totals(s, dashboard.network);
    s
      ..blank()
      ..section('BY COMPANY')
      ..header(const [
        'Company',
        'Invoiced',
        'Collected',
        'Outstanding',
        'Invoices',
        'Job cards',
      ]);
    for (final f in sharing) {
      final t = f.totals!;
      s.rowOf([
        f.partnerName,
        t.invoicedAmount,
        t.collectedAmount,
        t.outstandingAmount,
        t.invoiceCount,
        t.jobCardCount,
      ]);
    }
    if (sharing.isNotEmpty) {
      final n = dashboard.network;
      s.rowOf([
        'TOTAL',
        n.invoicedAmount,
        n.collectedAmount,
        n.outstandingAmount,
        n.invoiceCount,
        n.jobCardCount,
      ], bold: true);
    }
    if (dashboard.notSharing.isNotEmpty) {
      s
        ..blank()
        ..section('NOT SHARED WITH YOU');
      for (final f in dashboard.notSharing) {
        s.rowOf(['${f.partnerName} has not allowed the financial totals']);
      }
    }
    s.widths([28, 18, 18, 18, 12, 12]);

    _daily(wb.excel, wb.used, dashboard.network, title, subtitle);
    return ReportFile(
      '${reportFilePrefix(companyName)}Franchise_Network_Summary_${dashboard.from}_to_${dashboard.to}.xlsx',
      wb.excel.encode() ?? const [],
    );
  }

  /// One franchisee's totals for the period, when only the financial totals are shared.
  static ReportFile companyTotals(
    FranchiseeFinancials company,
    String from,
    String to,
  ) {
    final totals = company.totals;
    if (totals == null) {
      throw StateError(
        '${company.partnerName} has not allowed the financial totals.',
      );
    }
    final title = reportTitle('FINANCIAL TOTALS', company.partnerName);
    final subtitle = _period(from, to);
    final wb = newWorkbook('Summary');

    final s = XlsxSheet(wb.first, columns: 2)
      ..title(title)
      ..subtitle(subtitle)
      ..blank()
      ..section('TOTALS FOR THE PERIOD');
    _totals(s, totals);
    s.widths([24, 20]);

    _daily(wb.excel, wb.used, totals, title, subtitle);
    return ReportFile(
      '${reportFilePrefix(company.partnerName)}Financial_Totals_${from}_to_$to.xlsx',
      wb.excel.encode() ?? const [],
    );
  }
}
