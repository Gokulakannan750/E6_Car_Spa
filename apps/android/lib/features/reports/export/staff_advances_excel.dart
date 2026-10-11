import '../models/staff_advances_report_model.dart';
import 'report_file_service.dart';
import 'xlsx_sheet.dart';

/// The staff advances workbook: a summary with one line per staff member, then one sheet for each staff member listing
/// their advances.
class StaffAdvancesExcel {
  static bool _is(StaffAdvanceReportRowModel a, String status) =>
      a.status.toLowerCase() == status;

  static ReportFile build(
    List<StaffAdvanceReportRowModel> advances, {
    required DateTime from,
    required DateTime to,
    String? companyName,
  }) {
    final byStaff = <String, List<StaffAdvanceReportRowModel>>{};
    for (final a in advances) {
      byStaff.putIfAbsent(a.staffId, () => []).add(a);
    }
    final groups = byStaff.values.toList()
      ..sort((x, y) => x.first.staffName.compareTo(y.first.staffName));

    double sum(Iterable<StaffAdvanceReportRowModel> rows) =>
        rows.fold<double>(0, (n, a) => n + a.amount);

    final wb = newWorkbook('Staff Summary');
    final total = sum(advances);
    final outstanding = sum(advances.where((a) => _is(a, 'outstanding')));
    final settled = sum(advances.where((a) => _is(a, 'settled')));
    final obsolete = sum(advances.where((a) => _is(a, 'obsolete')));

    final s = XlsxSheet(wb.first, columns: 8)
      ..title(reportTitle('STAFF ADVANCES REPORT', companyName))
      ..subtitle('Period: ${reportDate(from)} to ${reportDate(to)}')
      ..blank()
      ..section('TOTALS (INR)')
      ..keyValue('Advances given', total)
      ..keyValue('Outstanding', outstanding)
      ..keyValue('Settled', settled)
      ..keyValue('Obsolete', obsolete)
      ..keyValue('Number of advances', advances.length)
      ..keyValue('Staff members', groups.length)
      ..blank()
      ..section('BY STAFF MEMBER')
      ..header(const [
        'Staff Name',
        'Role',
        'Phone',
        'Advances',
        'Total (INR)',
        'Outstanding (INR)',
        'Settled (INR)',
        'Obsolete (INR)',
      ]);
    for (final g in groups) {
      final first = g.first;
      s.rowOf([
        first.staffName,
        first.staffRole ?? '',
        first.staffPhone ?? '',
        g.length,
        sum(g),
        sum(g.where((a) => _is(a, 'outstanding'))),
        sum(g.where((a) => _is(a, 'settled'))),
        sum(g.where((a) => _is(a, 'obsolete'))),
      ]);
    }
    s.rowOf([
      'Total',
      '',
      '',
      advances.length,
      total,
      outstanding,
      settled,
      obsolete,
    ], bold: true);
    s.widths([26, 16, 16, 12, 16, 18, 16, 16]);

    for (final g in groups) {
      final first = g.first;
      final sheet =
          XlsxSheet(
              wb.excel[uniqueSheetName(first.staffName, wb.used)],
              columns: 9,
            )
            ..title(
              reportTitle(
                'STAFF ADVANCES: ${first.staffName.toUpperCase()}',
                companyName,
              ),
            )
            ..subtitle(
              [
                if ((first.staffRole ?? '').isNotEmpty) first.staffRole!,
                if ((first.staffPhone ?? '').isNotEmpty) first.staffPhone!,
                'Period: ${reportDate(from)} to ${reportDate(to)}',
              ].join('  |  '),
            )
            ..blank()
            ..header(const [
              'Date',
              'Amount (INR)',
              'Reason',
              'Status',
              'Settled On',
              'Settled By',
              'Obsolete On',
              'Obsolete Reason',
              'Notes',
            ]);
      final rows = [...g]
        ..sort((a, b) => a.advanceDate.compareTo(b.advanceDate));
      for (final a in rows) {
        sheet.rowOf([
          reportDate(a.advanceDate),
          a.amount,
          a.reason,
          a.status,
          reportDate(a.settledAt),
          a.settledByName ?? '',
          reportDate(a.obsoletedAt),
          a.obsoleteReason ?? '',
          a.notes ?? '',
        ]);
      }
      sheet.rowOf(['Total', sum(g), '', '', '', '', '', '', ''], bold: true);
      sheet.widths([14, 16, 28, 14, 14, 18, 14, 24, 28]);
    }

    return ReportFile(
      '${reportFilePrefix(companyName)}Staff_Advances_Report_${from.toIso8601String().substring(0, 10)}_to_${to.toIso8601String().substring(0, 10)}.xlsx',
      wb.excel.encode() ?? const [],
    );
  }
}
