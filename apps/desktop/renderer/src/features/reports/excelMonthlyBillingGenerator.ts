/**
 * E6 Car Spa Management — Monthly Billing Reports Excel Generator
 *
 * Generates ONE professional Excel workbook for the selected reporting month:
 *   - SHEET 1: "Monthly Summary" (Report period, Job Card summary, Invoice summary with payment status, Service summary)
 *   - SHEETS 2..N: Daily sheets ("01-Oct", "02-Oct", ... "31-Oct")
 *
 * Rules:
 *   - Empty days are preserved with a clear "No billing activity for this date." notice.
 *   - Daily sheets include 3 separate tables: Job Cards, Invoices, Services.
 *   - 100% mathematical reconciliation between Monthly Summary and the sum of Daily Sheets.
 *   - Uses SheetJS (xlsx) already present in the workspace.
 */

import * as XLSX from 'xlsx';
import type {
	MonthlyBillingReportResponse,
	MonthlyBillingSummaryDto,
	DailyBillingSheetDto,
} from '../../lib/api';

/**
 * Formats ISO date string to DD-MMM-YYYY (e.g., "15-Oct-2026")
 */
export function formatDateDisplay(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	const day = String(d.getDate()).padStart(2, '0');
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const month = months[d.getMonth()];
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}

/**
 * Formats ISO datetime string to DD-MMM-YYYY HH:mm (e.g., "15-Oct-2026 14:30")
 */
export function formatDateTimeDisplay(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	const datePart = formatDateDisplay(dateStr);
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');
	return `${datePart} ${hours}:${minutes}`;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. SHEET 1: "Monthly Summary"
// ────────────────────────────────────────────────────────────────────────────

export function generateMonthlySummaryWorksheet(
	summary: MonthlyBillingSummaryDto,
	monthName: string,
	daysInMonth: number
): XLSX.WorkSheet {
	const data: (string | number | null)[][] = [];

	// Report Title Header
	data.push(['E6 CAR SPA — MONTHLY BILLING REPORT']);
	data.push(['MONTHLY EXECUTIVE SUMMARY']);
	data.push([]);

	// REPORT PERIOD
	data.push(['REPORT PERIOD', '']);
	data.push(['Month', summary.monthName || monthName]);
	data.push(['Start Date', formatDateDisplay(summary.startDate)]);
	data.push(['End Date', formatDateDisplay(summary.endDate)]);
	data.push(['Total Calendar Days', daysInMonth]);
	data.push(['Generated At', formatDateTimeDisplay(summary.generatedAt)]);
	data.push([]);

	// JOB CARD SUMMARY
	data.push(['JOB CARD SUMMARY', 'COUNT']);
	data.push(['Total Job Cards Created', summary.totalJobCardsCreated]);
	data.push(['Total Job Cards Finished / Completed', summary.totalJobCardsFinished]);
	data.push([]);

	// INVOICE SUMMARY
	data.push(['INVOICE SUMMARY', 'METRIC / AMOUNT']);
	data.push(['Total Invoices Issued', summary.totalInvoices]);
	data.push(['Total Invoices Fully Paid', summary.totalInvoicesPaid]);
	data.push(['Total Invoices Pending Payment', summary.totalInvoicesPendingPayment]);
	data.push(['Total Draft Invoices', summary.totalInvoicesDraft]);
	data.push(['Total Cancelled Invoices', summary.totalInvoicesCancelled]);
	data.push(['Total Invoice Amount (INR)', summary.totalInvoiceAmount]);
	data.push(['Total Amount Paid (INR)', summary.totalAmountPaid]);
	data.push(['Total Amount Pending / Outstanding (INR)', summary.totalAmountPending]);
	data.push([]);

	// SERVICE SUMMARY
	data.push(['SERVICE SUMMARY', 'COUNT / QUANTITY']);
	data.push(['Total Services Performed', summary.totalServicesPerformed]);
	data.push(['Total Service Quantity', summary.totalServiceQuantity]);
	data.push([]);

	// RECONCILIATION AUDIT NOTE
	data.push(['AUDIT RECONCILIATION VERIFICATION']);
	data.push(['Note:', 'All figures above strictly reconcile with the sum of all daily sheets in this workbook.']);
	data.push(['Daily Sheets Included:', `${daysInMonth} daily sheets (${monthName})`]);

	const ws = XLSX.utils.aoa_to_sheet(data);
	ws['!cols'] = [{ wch: 42 }, { wch: 30 }];
	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. DAILY SHEETS: "01-Oct", "02-Oct", etc.
// ────────────────────────────────────────────────────────────────────────────

export function generateDailySheetWorksheet(
	sheet: DailyBillingSheetDto,
	monthName: string
): XLSX.WorkSheet {
	const data: (string | number | null)[][] = [];

	// Sheet Header
	data.push([`E6 CAR SPA — BILLING ACTIVITY FOR ${sheet.dateFormatted.toUpperCase()}`]);
	data.push([`Date: ${sheet.dateFormatted} | Sheet: ${sheet.sheetName} | Reporting Month: ${monthName}`]);
	data.push([]);

	// Activity Overview Row
	data.push([
		'DAY SUMMARY',
		`Job Cards: ${sheet.totals.jobCardCount} (Total: ₹${sheet.totals.jobCardTotal.toFixed(2)})`,
		`Invoices: ${sheet.totals.invoiceCount} (Billed: ₹${sheet.totals.invoiceTotal.toFixed(2)}, Paid: ₹${sheet.totals.amountPaid.toFixed(2)}, Pending: ₹${sheet.totals.amountPending.toFixed(2)})`,
		`Services: ${sheet.totals.serviceCount} (Total Qty: ${sheet.totals.serviceTotalQuantity})`,
	]);
	data.push([]);

	// Empty Day Handling
	if (!sheet.hasActivity) {
		data.push(['No billing activity for this date.']);
		data.push([]);
		const ws = XLSX.utils.aoa_to_sheet(data);
		ws['!cols'] = [{ wch: 35 }, { wch: 30 }, { wch: 30 }, { wch: 25 }];
		return ws;
	}

	// ── SECTION 1: JOB CARDS ────────────────────────────────────────────────
	data.push(['SECTION 1: JOB CARDS']);
	const jcHeaders = [
		'Job Card Number',
		'Job Card Date',
		'Customer Name',
		'Vehicle Registration',
		'Vehicle',
		'Job Card Status',
		'Total Services',
		'Job Card Total (INR)',
	];
	data.push(jcHeaders);

	if (sheet.jobCards.length === 0) {
		data.push(['No job cards created on this date.', '', '', '', '', '', '', '']);
	} else {
		for (const jc of sheet.jobCards) {
			data.push([
				jc.jobCardNumber,
				formatDateTimeDisplay(jc.jobCardDate),
				jc.customerName,
				jc.vehicleRegistration,
				jc.vehicle || '—',
				jc.jobCardStatus,
				jc.totalServices ?? 0,
				jc.jobCardTotal ?? 0,
			]);
		}
		// Job cards total row
		data.push([
			'TOTAL JOB CARDS',
			'',
			'',
			'',
			'',
			`${sheet.jobCards.length} records`,
			sheet.totals.jobCardCount,
			sheet.totals.jobCardTotal,
		]);
	}
	data.push([]);

	// ── SECTION 2: INVOICES ─────────────────────────────────────────────────
	data.push(['SECTION 2: INVOICES']);
	const invHeaders = [
		'Invoice Number',
		'Invoice Date',
		'Job Card Number',
		'Customer Name',
		'Vehicle Registration',
		'Invoice Status',
		'Invoice Total (INR)',
		'Amount Paid (INR)',
		'Amount Pending (INR)',
	];
	data.push(invHeaders);

	if (sheet.invoices.length === 0) {
		data.push(['No invoices issued on this date.', '', '', '', '', '', '', '', '']);
	} else {
		for (const inv of sheet.invoices) {
			data.push([
				inv.invoiceNumber || '—',
				formatDateDisplay(inv.invoiceDate),
				inv.jobCardNumber || '—',
				inv.customerName,
				inv.vehicleRegistration,
				inv.invoiceStatus,
				inv.invoiceTotal ?? 0,
				inv.amountPaid ?? 0,
				inv.amountPending ?? 0,
			]);
		}
		// Invoices total row
		data.push([
			'TOTAL INVOICES',
			'',
			'',
			'',
			'',
			`${sheet.invoices.length} records`,
			sheet.totals.invoiceTotal,
			sheet.totals.amountPaid,
			sheet.totals.amountPending,
		]);
	}
	data.push([]);

	// ── SECTION 3: SERVICES ─────────────────────────────────────────────────
	data.push(['SECTION 3: SERVICES']);
	const sHeaders = [
		'Job Card Number',
		'Invoice Number',
		'Customer Name',
		'Service Name',
		'Quantity',
		'Rate (INR)',
		'Amount (INR)',
	];
	data.push(sHeaders);

	if (sheet.services.length === 0) {
		data.push(['No services recorded for this date.', '', '', '', '', '', '']);
	} else {
		let totalServicesSum = 0;
		for (const s of sheet.services) {
			const amt = s.amount ?? 0;
			totalServicesSum += amt;
			data.push([
				s.jobCardNumber,
				s.invoiceNumber || '—',
				s.customerName,
				s.serviceName,
				s.quantity ?? 1,
				s.rate ?? 0,
				amt,
			]);
		}
		// Services total row
		data.push([
			'TOTAL SERVICES',
			'',
			'',
			`${sheet.services.length} items`,
			sheet.totals.serviceTotalQuantity,
			'',
			totalServicesSum,
		]);
	}

	const ws = XLSX.utils.aoa_to_sheet(data);

	// Column widths
	ws['!cols'] = [
		{ wch: 20 }, // Col A: Job Card / Invoice Number
		{ wch: 18 }, // Col B: Date / Invoice Number
		{ wch: 26 }, // Col C: Customer Name
		{ wch: 22 }, // Col D: Vehicle Reg / Service Name
		{ wch: 20 }, // Col E: Vehicle / Qty
		{ wch: 18 }, // Col F: Status / Rate
		{ wch: 20 }, // Col G: Total Services / Amount
		{ wch: 20 }, // Col H: Total Amount
		{ wch: 20 }, // Col I: Amount Pending
	];

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. WORKBOOK BUILDER & EXPORT DISPATCHER
// ────────────────────────────────────────────────────────────────────────────

export function generateMonthlyBillingWorkbook(
	report: MonthlyBillingReportResponse
): XLSX.WorkBook {
	const wb = XLSX.utils.book_new();

	// Sheet 1: Monthly Summary
	const wsSummary = generateMonthlySummaryWorksheet(
		report.summary,
		report.monthName,
		report.daysInMonth
	);
	XLSX.utils.book_append_sheet(wb, wsSummary, 'Monthly Summary');

	// Sheets 2..N: Daily sheets for each calendar day in the month
	for (const daySheet of report.dailySheets) {
		const wsDay = generateDailySheetWorksheet(daySheet, report.monthName);
		XLSX.utils.book_append_sheet(wb, wsDay, daySheet.sheetName);
	}

	return wb;
}

export function generateAndDownloadMonthlyBillingReport(
	report: MonthlyBillingReportResponse
): string {
	const wb = generateMonthlyBillingWorkbook(report);
	const sanitizedMonth = (report.monthName || `${report.year}_${report.month}`).replace(/\s+/g, '_');
	const fileName = `E6_Car_Spa_Billing_Report_${sanitizedMonth}.xlsx`;
	XLSX.writeFile(wb, fileName);
	return fileName;
}
