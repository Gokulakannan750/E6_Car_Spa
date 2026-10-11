import '../models/outside_job_report_model.dart';
import 'report_file_service.dart';
import 'xlsx_sheet.dart';

/// The outside jobs workbook: executive summary, jobs currently outside, movement history and a vendor analysis.
class OutsideJobsExcel {
  /// 26.5 -> "26h 30m", 0.25 -> "15m", unknown -> "—" (same as the Windows export).
  static String _duration(double? hours) {
    if (hours == null || hours.isNaN) return '—';
    if (hours < 1) return '${(hours * 60).round()}m';
    final h = hours.floor();
    final mins = ((hours - h) * 60).round();
    return mins > 0 ? '${h}h ${mins}m' : '${h}h';
  }

  static ReportFile build(
    OutsideJobReportResponseModel report, {
    String? scopeLabel,
    String? companyName,
    DateTime? now,
  }) {
    final scope = (scopeLabel == null || scopeLabel.isEmpty)
        ? 'All Time'
        : scopeLabel;
    final wb = newWorkbook('Executive Summary');

    // Counts by status come from the history rows, the same rows the history sheet lists.
    final byStatus = <String, int>{};
    for (final h in report.history) {
      byStatus.update(h.statusName, (n) => n + 1, ifAbsent: () => 1);
    }

    final summary = XlsxSheet(wb.first, columns: 2)
      ..title(reportTitle('OUTSIDE JOBS REPORT', companyName))
      ..subtitle('Period: $scope')
      ..blank()
      ..section('OVERVIEW')
      ..keyValue('Jobs currently outside', report.totalOutsideCount)
      ..keyValue('Overdue', report.totalOverdueCount)
      ..keyValue('Estimated cost of jobs outside (INR)', report.totalActiveCost)
      ..keyValue('Vendor cost in the period (INR)', report.totalHistoricalCost)
      ..keyValue('Movements in the period', report.history.length)
      ..blank()
      ..section('MOVEMENTS BY STATUS')
      ..header(const ['Status', 'Count'])
      ..widths([42, 22]);
    for (final e in byStatus.entries) {
      summary.keyValue(e.key, e.value);
    }

    final out =
        XlsxSheet(
            wb.excel[uniqueSheetName('Currently Outside', wb.used)],
            columns: 15,
          )
          ..title(reportTitle('VEHICLES CURRENTLY OUTSIDE', companyName))
          ..subtitle(
            '${report.currentlyOutside.length} jobs  |  Period: $scope',
          )
          ..blank()
          ..header(const [
            'S.No',
            'Status',
            'Job Card #',
            'Vehicle Reg #',
            'Vehicle Model',
            'Customer Name',
            'Customer Phone',
            'External Vendor',
            'Vendor Phone',
            'Service Requested',
            'Sent Date & Time',
            'Expected Return',
            'Overdue (Hrs)',
            'Estimated Cost (INR)',
            'Dispatch Notes',
          ]);
    var i = 1;
    for (final j in report.currentlyOutside) {
      out.rowOf([
        i++,
        j.isOverdue ? 'Overdue' : 'Outside',
        j.jobCardNumber,
        j.vehicleRegistration,
        j.vehicleModel,
        j.customerName,
        j.customerPhone,
        j.vendorName,
        j.vendorPhone ?? '',
        j.serviceName,
        reportDateTime(j.sentAt),
        reportDateTime(j.expectedReturnAt),
        j.isOverdue ? j.overdueHours : 0.0,
        j.vendorCost ?? 0.0,
        j.notes ?? '',
      ]);
    }
    out.rowOf([
      'Total',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      report.totalActiveCost,
      '',
    ], bold: true);
    out.widths([7, 12, 16, 16, 18, 22, 16, 22, 16, 24, 20, 20, 14, 18, 28]);

    final hist =
        XlsxSheet(
            wb.excel[uniqueSheetName('Movement History', wb.used)],
            columns: 17,
          )
          ..title(reportTitle('OUTSIDE JOB MOVEMENT HISTORY', companyName))
          ..subtitle('${report.history.length} movements  |  Period: $scope')
          ..blank()
          ..header(const [
            'S.No',
            'Status',
            'Job Card #',
            'Vehicle Reg #',
            'Vehicle Model',
            'Customer Name',
            'External Vendor',
            'Service Performed',
            'Sent Date & Time',
            'Returned Date & Time',
            'Duration',
            'Vendor Cost (INR)',
            'Sent By',
            'Returned By',
            'Dispatch Notes',
            'Return / Cancellation Notes',
          ]);
    i = 1;
    for (final h in report.history) {
      hist.rowOf([
        i++,
        h.statusName,
        h.jobCardNumber,
        h.vehicleRegistration,
        h.vehicleModel,
        h.customerName,
        h.vendorName,
        h.serviceName,
        reportDateTime(h.sentAt),
        reportDateTime(h.returnedAt),
        _duration(h.durationHours),
        h.vendorCost ?? 0.0,
        h.sentByUserName ?? '',
        h.returnedByUserName ?? '',
        h.notes ?? '',
        h.returnNotes ?? '',
      ]);
    }
    hist.rowOf([
      'Total',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      report.totalHistoricalCost,
      '',
      '',
      '',
      '',
    ], bold: true);
    hist.widths([
      7,
      14,
      16,
      16,
      18,
      22,
      22,
      24,
      20,
      20,
      14,
      18,
      18,
      18,
      28,
      28,
    ]);

    final vendors =
        XlsxSheet(
            wb.excel[uniqueSheetName('Vendor Analysis', wb.used)],
            columns: 11,
          )
          ..title(reportTitle('VENDOR ANALYSIS', companyName))
          ..subtitle(
            '${report.vendorSummary.length} vendors  |  Period: $scope',
          )
          ..blank()
          ..header(const [
            'S.No',
            'Vendor Name',
            'Contact Phone',
            'Total Jobs Assigned',
            'Currently Outside',
            'Overdue Jobs',
            'Completed / Returned',
            'Cancelled Jobs',
            'Completion Rate %',
            'Total Cost (INR)',
            'Cost Share %',
          ]);
    final totalCost = report.vendorSummary.fold<double>(
      0,
      (n, v) => n + v.totalVendorCost,
    );
    i = 1;
    for (final v in report.vendorSummary) {
      vendors.rowOf([
        i++,
        v.vendorName,
        v.phone ?? '',
        v.totalJobs,
        v.currentlyOutside,
        v.overdueJobs,
        v.completedJobs,
        v.cancelledJobs,
        Pct(v.totalJobs == 0 ? 0 : v.completedJobs * 100 / v.totalJobs),
        v.totalVendorCost,
        Pct(totalCost == 0 ? 0 : v.totalVendorCost * 100 / totalCost),
      ]);
    }
    vendors.rowOf([
      'Total',
      '',
      '',
      report.vendorSummary.fold<int>(0, (n, v) => n + v.totalJobs),
      report.vendorSummary.fold<int>(0, (n, v) => n + v.currentlyOutside),
      report.vendorSummary.fold<int>(0, (n, v) => n + v.overdueJobs),
      report.vendorSummary.fold<int>(0, (n, v) => n + v.completedJobs),
      report.vendorSummary.fold<int>(0, (n, v) => n + v.cancelledJobs),
      '',
      totalCost,
      '',
    ], bold: true);
    vendors.widths([7, 26, 16, 18, 16, 14, 20, 16, 18, 18, 14]);

    final stamp = (now ?? DateTime.now()).toIso8601String().substring(0, 10);
    return ReportFile(
      '${reportFilePrefix(companyName)}Outside_Jobs_Report_${scope.replaceAll(RegExp(r'[\s/\\:]+'), '_')}_$stamp.xlsx',
      wb.excel.encode() ?? const [],
    );
  }
}
