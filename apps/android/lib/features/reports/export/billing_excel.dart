import 'package:excel/excel.dart';
import '../models/monthly_billing_report_model.dart';
import 'report_file_service.dart';
import 'xlsx_sheet.dart';

/// The monthly billing workbook: a summary sheet, then one sheet for each day with its job cards, invoices and services.
/// Same sheets and columns as the Windows export.
class BillingExcel {
  static ReportFile build(
    MonthlyBillingReportResponseModel report, {
    String? companyName,
  }) {
    final summary = report.summary;
    final wb = newWorkbook('Monthly Summary');

    XlsxSheet(wb.first, columns: 2)
      ..title(reportTitle('MONTHLY BILLING REPORT', companyName))
      ..subtitle(
        '${report.monthName}  |  ${report.fromDate} to ${report.toDate}',
      )
      ..blank()
      ..section('JOB CARDS')
      ..keyValue('Job cards created', summary.totalJobCardsCreated)
      ..keyValue('Job cards finished', summary.totalJobCardsFinished)
      ..blank()
      ..section('INVOICES')
      ..keyValue('Total invoices', summary.totalInvoices)
      ..keyValue('Paid', summary.totalInvoicesPaid)
      ..keyValue('Pending payment', summary.totalInvoicesPendingPayment)
      ..keyValue('Draft', summary.totalInvoicesDraft)
      ..keyValue('Cancelled', summary.totalInvoicesCancelled)
      ..blank()
      ..section('AMOUNTS (INR)')
      ..keyValue('Total invoiced', summary.totalInvoiceAmount)
      ..keyValue('Total paid', summary.totalAmountPaid)
      ..keyValue('Total pending', summary.totalAmountPending)
      ..blank()
      ..section('SERVICES')
      ..keyValue('Services performed', summary.totalServicesPerformed)
      ..keyValue('Total quantity', summary.totalServiceQuantity)
      ..blank()
      ..subtitle(
        'All figures above equal the sum of the ${report.dailySheets.length} daily sheets in this workbook.',
      )
      ..widths([30, 22]);

    for (final day in report.dailySheets) {
      _daySheet(wb.excel, wb.used, day, report.monthName, companyName);
    }

    return ReportFile(
      '${reportFilePrefix(companyName)}Billing_Report_${report.monthName.trim().replaceAll(RegExp(r'\s+'), '_')}.xlsx',
      wb.excel.encode() ?? const [],
    );
  }

  static void _daySheet(
    Excel excel,
    Set<String> used,
    DailyBillingSheetModel day,
    String monthName,
    String? companyName,
  ) {
    final name = uniqueSheetName(day.sheetName, used);
    final w = XlsxSheet(excel[name], columns: 9)
      ..title(
        reportTitle(
          'BILLING ACTIVITY FOR ${day.dateFormatted.toUpperCase()}',
          companyName,
        ),
      )
      ..subtitle(
        'Report date: ${day.dateFormatted}  |  Reporting month: $monthName',
      )
      ..blank()
      ..rowOf([
        'Job cards',
        day.totals.jobCardCount,
        'Invoices',
        day.totals.invoiceCount,
        'Services',
        day.totals.serviceCount,
      ], bold: true)
      ..rowOf([
        'Billed (INR)',
        day.totals.invoiceTotal,
        'Paid (INR)',
        day.totals.amountPaid,
        'Pending (INR)',
        day.totals.amountPending,
      ], bold: true)
      ..blank();

    if (!day.hasActivity) {
      w.subtitle('No billing activity on this day.');
      w.widths([22, 16, 24, 22, 18, 16, 16, 16, 16]);
      return;
    }

    w.section('SECTION 1: JOB CARDS (${day.jobCards.length} records)');
    w.header(const [
      'Job Card Number',
      'Job Card Date',
      'Customer Name',
      'Vehicle Registration',
      'Vehicle',
      'Job Card Status',
      'Total Services',
      'Job Card Total (INR)',
    ]);
    for (final j in day.jobCards) {
      w.rowOf([
        j.jobCardNumber,
        reportDate(j.jobCardDate),
        j.customerName,
        j.vehicleRegistration,
        j.vehicle,
        j.jobCardStatus,
        j.totalServices,
        j.jobCardTotal,
      ]);
    }
    w.rowOf([
      'Total',
      '',
      '',
      '',
      '',
      '',
      day.totals.jobCardCount,
      day.jobCards.fold<double>(0, (n, e) => n + e.jobCardTotal),
    ], bold: true);
    w.blank();

    w.section('SECTION 2: INVOICES (${day.invoices.length} records)');
    w.header(const [
      'Invoice Number',
      'Invoice Date',
      'Job Card Number',
      'Customer Name',
      'Vehicle Registration',
      'Invoice Status',
      'Invoice Total (INR)',
      'Amount Paid (INR)',
      'Amount Pending (INR)',
    ]);
    for (final i in day.invoices) {
      w.rowOf([
        i.invoiceNumber,
        reportDate(i.invoiceDate),
        i.jobCardNumber,
        i.customerName,
        i.vehicleRegistration,
        i.invoiceStatus,
        i.invoiceTotal,
        i.amountPaid,
        i.amountPending,
      ]);
    }
    w.rowOf([
      'Total',
      '',
      '',
      '',
      '',
      '',
      day.totals.invoiceTotal,
      day.totals.amountPaid,
      day.totals.amountPending,
    ], bold: true);
    w.blank();

    w.section('SECTION 3: SERVICES (${day.services.length} items)');
    w.header(const [
      'Job Card Number',
      'Invoice Number',
      'Customer Name',
      'Service',
      'Quantity',
      'Rate (INR)',
      'Amount (INR)',
    ]);
    for (final sv in day.services) {
      w.rowOf([
        sv.jobCardNumber,
        sv.invoiceNumber ?? '',
        sv.customerName,
        sv.serviceName,
        sv.quantity,
        sv.rate,
        sv.amount,
      ]);
    }
    w.rowOf([
      'Total',
      '',
      '',
      '',
      day.totals.serviceTotalQuantity,
      '',
      day.services.fold<double>(0, (n, e) => n + e.amount),
    ], bold: true);
    w.widths([22, 16, 24, 22, 18, 16, 16, 16, 16]);
  }
}
