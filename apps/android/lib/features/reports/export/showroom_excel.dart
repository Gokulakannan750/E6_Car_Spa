import '../models/showroom_report_model.dart';
import 'report_file_service.dart';
import 'xlsx_sheet.dart';

/// One workbook for each showroom, with the same seven sheets as the Windows export.
class ShowroomExcel {
  static List<ReportFile> build(
    MonthlyShowroomReportResponseModel report, {
    String? companyName,
  }) {
    if (report.showrooms.isEmpty) {
      final wb = newWorkbook('No Data');
      XlsxSheet(wb.first, columns: 1)
        ..title(reportTitle('SHOWROOM REPORT', companyName))
        ..subtitle('No showroom data available for export.')
        ..widths([48]);
      return [
        ReportFile(
          '${reportFilePrefix(companyName)}Showroom_Report_${_slug(report.monthName)}.xlsx',
          wb.excel.encode() ?? const [],
        ),
      ];
    }
    return [
      for (final sr in report.showrooms) _workbook(sr, report, companyName),
    ];
  }

  static String _slug(String s) => s.trim().replaceAll(RegExp(r'\s+'), '_');

  static ReportFile _workbook(
    MonthlyShowroomDetailModel sr,
    MonthlyShowroomReportResponseModel report,
    String? companyName,
  ) {
    final period =
        '${reportDate(report.fromDate)} to ${reportDate(report.toDate)}';
    final wb = newWorkbook('Summary');
    final m = sr.summary;

    XlsxSheet(wb.first, columns: 2)
      ..title(reportTitle('SHOWROOM MANAGEMENT REPORT', companyName))
      ..subtitle('${sr.showroomName.toUpperCase()}  |  Period: $period')
      ..blank()
      ..section('SHOWROOM')
      ..keyValue('Showroom', sr.showroomName)
      ..keyValue('Showroom ID', sr.showroomMasterId)
      ..keyValue('Address', sr.showroomAddress)
      ..keyValue('Phone', sr.showroomPhone ?? '')
      ..keyValue('GSTIN', sr.showroomGstin ?? '')
      ..blank()
      ..section('WORK')
      ..keyValue('Vehicles serviced', m.totalVehiclesServiced)
      ..keyValue('Work entries', m.totalWorkEntries)
      ..keyValue('Services performed', m.totalServicesPerformed)
      ..keyValue('Active staff', m.totalActiveStaff)
      ..keyValue('Staff hours', m.totalStaffHours)
      ..keyValue('Attendance days', m.totalAttendanceDays)
      ..keyValue('Staff swaps', m.totalSwaps)
      ..blank()
      ..section('BILLING (INR)')
      ..keyValue('Billed', m.totalBilledAmount)
      ..keyValue('Collected', m.totalCollectedAmount)
      ..keyValue('Outstanding', m.totalOutstandingAmount)
      ..keyValue('Billing days', m.totalBillingDays)
      ..keyValue('Paid days', m.paidDaysCount)
      ..keyValue('Partly paid days', m.partiallyPaidDaysCount)
      ..keyValue('Unpaid days', m.unpaidDaysCount)
      ..widths([30, 34]);

    final works =
        XlsxSheet(
            wb.excel[uniqueSheetName('Vehicle Service Details', wb.used)],
            columns: 15,
          )
          ..title(reportTitle('VEHICLE SERVICE DETAILS', companyName))
          ..subtitle('${sr.showroomName}  |  Period: $period')
          ..blank()
          ..header(const [
            'Date',
            'Vehicle Type',
            'Service Category',
            'Services Performed',
            'Vehicles',
            'Staff ID',
            'Staff Name',
            'Start Time',
            'End Time',
            'Hours',
            'Assignment Type',
            'Swap ID',
            'Payment Status',
            'Time Recorded',
            'Notes',
          ]);
    for (final w in sr.vehicleWorks) {
      works.rowOf([
        reportDate(w.date),
        w.vehicleTypeName,
        w.serviceCategory ?? '',
        w.servicesSummary,
        w.vehicleQuantity,
        w.staffMasterId,
        w.staffName,
        w.startTime ?? '',
        w.endTime ?? '',
        w.workingHours,
        w.assignmentType ?? '',
        w.swapId ?? '',
        w.paymentStatus,
        w.timeRecorded ?? '',
        w.notes ?? '',
      ]);
    }
    works.rowOf([
      'Total',
      '',
      '',
      '',
      sr.vehicleWorks.fold<int>(0, (n, w) => n + w.vehicleQuantity),
      '',
      '',
      '',
      '',
      sr.vehicleWorks.fold<double>(0, (n, w) => n + w.workingHours),
      '',
      '',
      '',
      '',
      '',
    ], bold: true);
    works.widths([14, 18, 20, 30, 10, 12, 22, 12, 12, 10, 16, 14, 16, 16, 28]);

    final staff =
        XlsxSheet(
            wb.excel[uniqueSheetName('Staff Productivity', wb.used)],
            columns: 10,
          )
          ..title(reportTitle('STAFF PRODUCTIVITY', companyName))
          ..subtitle('${sr.showroomName}  |  Period: $period')
          ..blank()
          ..header(const [
            'Staff ID',
            'Staff Name',
            'Role',
            'Home Showroom',
            'Assignment Type',
            'Vehicles',
            'Services',
            'Hours',
            'Attendance Days',
            'Workload Share (%)',
          ]);
    for (final p in sr.staffSummary) {
      staff.rowOf([
        p.staffMasterId,
        p.staffName,
        p.role ?? '',
        p.homeShowroom,
        p.assignmentType,
        p.totalVehicles,
        p.totalServices,
        p.totalHours,
        p.attendanceDays,
        Pct(p.workloadSharePercent),
      ]);
    }
    staff.widths([12, 24, 16, 22, 16, 10, 10, 10, 16, 18]);

    final att =
        XlsxSheet(wb.excel[uniqueSheetName('Attendance', wb.used)], columns: 13)
          ..title(reportTitle('ATTENDANCE', companyName))
          ..subtitle('${sr.showroomName}  |  Period: $period')
          ..blank()
          ..header(const [
            'Date',
            'Staff ID',
            'Staff Name',
            'Role',
            'Home Showroom',
            'Working Showroom',
            'Attendance Status',
            'Scheduled Start',
            'Scheduled End',
            'Scheduled Hours',
            'Actual Hours',
            'Confirmation Status',
            'Confirmed By',
          ]);
    for (final a in sr.attendanceRecords) {
      att.rowOf([
        reportDate(a.date),
        a.staffMasterId,
        a.staffName,
        a.role ?? '',
        a.homeShowroomName,
        a.workingShowroomName,
        a.attendanceStatus,
        a.scheduledStart ?? '',
        a.scheduledEnd ?? '',
        a.scheduledHours,
        a.actualHours,
        a.confirmationStatus,
        a.confirmedByName ?? '',
      ]);
    }
    att.widths([14, 12, 24, 16, 22, 22, 18, 14, 14, 14, 12, 20, 20]);

    final swaps =
        XlsxSheet(
            wb.excel[uniqueSheetName('Staff Swaps', wb.used)],
            columns: 15,
          )
          ..title(reportTitle('STAFF SWAPS', companyName))
          ..subtitle('${sr.showroomName}  |  Period: $period')
          ..blank()
          ..header(const [
            'Swap ID',
            'Date',
            'Showroom',
            'Original Staff ID',
            'Original Staff Name',
            'Replacement Staff ID',
            'Replacement Staff Name',
            'Swap Start Time',
            'Swap End Time',
            'Swap Hours',
            'Reason',
            'Created By',
            'Created At',
            'Status',
            'Reversed By',
          ]);
    for (final x in sr.swaps) {
      swaps.rowOf([
        x.swapId,
        reportDate(x.date),
        x.showroomName,
        x.staffAMasterId,
        x.staffAName,
        x.staffBMasterId,
        x.staffBName,
        x.swapStartTime ?? '',
        x.swapEndTime ?? '',
        x.swapHours,
        x.reason ?? '',
        x.createdByName ?? '',
        reportDateTime(x.createdAt),
        x.status,
        x.reversedByName ?? '',
      ]);
    }
    swaps.widths([14, 14, 20, 16, 24, 18, 24, 14, 14, 12, 28, 18, 20, 12, 18]);

    final types =
        XlsxSheet(
            wb.excel[uniqueSheetName('Vehicle Type Summary', wb.used)],
            columns: 5,
          )
          ..title(reportTitle('VEHICLE TYPE SUMMARY', companyName))
          ..subtitle('${sr.showroomName}  |  Period: $period')
          ..blank()
          ..header(const [
            'Vehicle Type',
            'Vehicles Serviced',
            'Services Performed',
            'Staff Hours',
            'Volume Share (%)',
          ]);
    for (final t in sr.vehicleTypeSummary) {
      types.rowOf([
        t.vehicleTypeName,
        t.totalVehicles,
        t.totalServices,
        t.totalStaffHours,
        Pct(t.sharePercentage),
      ]);
    }
    types.widths([24, 18, 20, 14, 18]);

    final services =
        XlsxSheet(
            wb.excel[uniqueSheetName('Service Summary', wb.used)],
            columns: 6,
          )
          ..title(reportTitle('SERVICE SUMMARY', companyName))
          ..subtitle('${sr.showroomName}  |  Period: $period')
          ..blank()
          ..header(const [
            'Service Category',
            'Service Name',
            'Vehicles Attended',
            'Total Quantity',
            'Staff Hours',
            'Service Share (%)',
          ]);
    for (final v in sr.serviceSummary) {
      services.rowOf([
        v.serviceCategory,
        v.serviceName,
        v.totalVehicles,
        v.totalQuantity,
        v.totalStaffHours,
        Pct(v.sharePercentage),
      ]);
    }
    services.widths([22, 28, 18, 16, 14, 18]);

    return ReportFile(
      '${reportFilePrefix(companyName)}${_slug(sr.showroomName)}_Report_${_slug(report.monthName)}.xlsx',
      wb.excel.encode() ?? const [],
    );
  }
}
