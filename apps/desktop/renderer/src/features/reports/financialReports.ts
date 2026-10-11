/**
 * The five financial reports every company needs for its books: sales, collections, outstanding invoices, GST and job
 * cards. This file holds what is shared by the screen and the Excel export: how a status reads, which columns each
 * report has, and how to fetch every page of a report.
 */
import {
	getGstReport,
	getJobCardReport,
	getJobCardStatusLabel,
	getOutstandingInvoicesReport,
	getPaymentCollectionReport,
	getSalesReport,
	type GstReportDto,
	type InvoiceStatus,
	type JobCardReportResponse,
	type OutstandingInvoiceReportResponse,
	type PagedReport,
	type PaymentReportResponse,
	type SalesReportResponse,
} from '../../lib/api';

export type FinancialReportId = 'sales' | 'collections' | 'outstanding' | 'gst' | 'job-cards';

export const FINANCIAL_REPORTS: {
	id: FinancialReportId;
	label: string;
	description: string;
	permission: string;
}[] = [
	{ id: 'sales', label: 'Sales', description: 'Invoice revenue with discount and GST', permission: 'reports.sales' },
	{ id: 'collections', label: 'Collections', description: 'Money received, by payment method', permission: 'reports.payments' },
	{ id: 'outstanding', label: 'Outstanding', description: 'Unpaid balances and how old they are', permission: 'reports.invoices' },
	{ id: 'gst', label: 'GST Summary', description: 'Taxable value, CGST and SGST', permission: 'reports.gst' },
	{ id: 'job-cards', label: 'Job Cards', description: 'Job cards by status and what was billed', permission: 'reports.job_cards' },
];

/** Every permission that opens at least one of the financial reports. */
export const FINANCIAL_REPORT_PERMISSIONS = FINANCIAL_REPORTS.map((r) => r.permission);

const INVOICE_STATUS_LABELS: Record<number, string> = {
	0: 'Draft',
	1: 'Sent',
	2: 'Paid',
	3: 'Partially Paid',
	4: 'Cancelled',
	5: 'Overdue',
	6: 'Payment Pending',
};

/** The server sends statuses as numbers; older code paths use names. Both read the same way. */
export function invoiceStatusLabel(status: InvoiceStatus | null | undefined): string {
	if (status === null || status === undefined) return '—';
	if (typeof status === 'number') return INVOICE_STATUS_LABELS[status] ?? `Status ${status}`;
	const asNumber = Number(status);
	if (!Number.isNaN(asNumber)) return INVOICE_STATUS_LABELS[asNumber] ?? `Status ${asNumber}`;
	if (status === 'Generated') return 'Payment Pending';
	return String(status).replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function formatReportDate(iso?: string | null): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** One table of a workbook: a heading, the column names, the rows and an optional totals row. */
export interface SheetSpec {
	sheetName: string;
	title: string;
	subtitle: string;
	headers: string[];
	/** Numbers are written as numbers, so a spreadsheet can add them up. */
	rows: (string | number)[][];
	totals?: (string | number)[];
	/** Column positions (0-based) that hold money and should show two decimals. */
	moneyColumns?: number[];
	widths: number[];
}

export const PAGE_LIMIT = 100;
/** Stops a runaway export; no ordinary month comes near this many rows. */
const MAX_EXPORT_ROWS = 20000;

/** Fetches every page of a paged report (the server allows at most 100 rows a page). */
export async function fetchAllRows<TRow, TSummary>(
	fetchPage: (page: number, pageSize: number) => Promise<PagedReport<TRow, TSummary>>,
): Promise<{ rows: TRow[]; summary: TSummary }> {
	const rows: TRow[] = [];
	let page = 1;
	let summary: TSummary | undefined;
	for (;;) {
		const result = await fetchPage(page, PAGE_LIMIT);
		summary = result.summary;
		rows.push(...result.items);
		if (result.items.length === 0 || rows.length >= result.totalCount || rows.length >= MAX_EXPORT_ROWS) break;
		page++;
	}
	return { rows, summary: summary as TSummary };
}

interface Period {
	fromDate: string;
	toDate: string;
	label: string;
}

const periodText = (p: Period) => `Period: ${p.label} (${p.fromDate} to ${p.toDate})`;

export function salesSheet(report: { rows: SalesReportResponse['items']; summary: SalesReportResponse['summary'] }, p: Period): SheetSpec {
	return {
		sheetName: 'Sales',
		title: 'SALES REPORT',
		subtitle: periodText(p),
		headers: [
			'Invoice No.', 'Date', 'Customer', 'Phone', 'Vehicle', 'Subtotal (INR)', 'Discount (INR)', 'GST (INR)',
			'Total (INR)', 'Paid (INR)', 'Balance (INR)', 'Status',
		],
		rows: report.rows.map((r) => [
			r.invoiceNumber ?? '—', formatReportDate(r.invoiceDate), r.customerName, r.customerPhone, r.registrationNumber,
			r.subtotal, r.discount, r.gst, r.totalAmount, r.paidAmount, r.balanceAmount, invoiceStatusLabel(r.status),
		]),
		totals: [
			'Total', '', '', '', `${report.summary.invoiceCount} invoices`, report.summary.totalSubtotal, report.summary.totalDiscount,
			report.summary.totalGst, report.summary.totalAmount, report.summary.totalPaid, report.summary.totalBalance, '',
		],
		moneyColumns: [5, 6, 7, 8, 9, 10],
		widths: [18, 14, 24, 16, 16, 16, 16, 14, 16, 16, 16, 16],
	};
}

export function collectionsSheet(report: { rows: PaymentReportResponse['items']; summary: PaymentReportResponse['summary'] }, p: Period): SheetSpec {
	const s = report.summary;
	return {
		sheetName: 'Collections',
		title: 'COLLECTIONS REPORT',
		subtitle: `${periodText(p)}  |  Cash ${s.cashAmount.toFixed(2)}, UPI ${s.upiAmount.toFixed(2)}, Card ${s.cardAmount.toFixed(2)}, Bank ${s.bankTransferAmount.toFixed(2)}`,
		headers: ['Date', 'Invoice No.', 'Customer', 'Method', 'Reference', 'Amount (INR)', 'Voided'],
		rows: report.rows.map((r) => [
			formatReportDate(r.paymentDate), r.invoiceNumber ?? '—', r.customerName, r.paymentMethod, r.reference ?? '',
			r.amount, r.isVoided ? 'Voided' : '',
		]),
		totals: ['Total collected', '', '', '', `${s.transactionCount} payments`, s.totalCollected, ''],
		moneyColumns: [5],
		widths: [14, 18, 24, 16, 22, 16, 10],
	};
}

export function outstandingSheet(report: { rows: OutstandingInvoiceReportResponse['items']; summary: OutstandingInvoiceReportResponse['summary'] }, p: Period): SheetSpec {
	const s = report.summary;
	return {
		sheetName: 'Outstanding',
		title: 'OUTSTANDING INVOICES',
		subtitle: periodText(p),
		headers: ['Invoice No.', 'Date', 'Customer', 'Phone', 'Vehicle', 'Total (INR)', 'Paid (INR)', 'Balance (INR)', 'Age (days)', 'Status'],
		rows: report.rows.map((r) => [
			r.invoiceNumber ?? '—', formatReportDate(r.invoiceDate), r.customerName, r.customerPhone, r.vehicleRegistration,
			r.totalAmount, r.paidAmount, r.balanceAmount, r.ageInDays, invoiceStatusLabel(r.status),
		]),
		totals: ['Total', '', '', '', `${s.invoiceCount} invoices`, s.totalInvoiceAmount, s.totalPaidAmount, s.totalOutstandingAmount, '', ''],
		moneyColumns: [5, 6, 7],
		widths: [18, 14, 24, 16, 16, 16, 16, 16, 12, 16],
	};
}

export function gstSheet(report: GstReportDto, p: Period): SheetSpec {
	return {
		sheetName: 'GST Summary',
		title: 'GST SUMMARY',
		subtitle: `${periodText(p)}  |  Taxable ${report.taxableBase.toFixed(2)}, CGST ${report.cgstAmount.toFixed(2)}, SGST ${report.sgstAmount.toFixed(2)}`,
		headers: ['Invoice No.', 'Date', 'Customer', 'Vehicle', 'GST Invoice', 'Taxable (INR)', 'GST (INR)', 'Total (INR)'],
		rows: report.invoices.map((r) => [
			r.invoiceNumber ?? '—', formatReportDate(r.invoiceDate), r.customerName, r.registrationNumber,
			r.isGstEnabled ? 'Yes' : 'No', r.taxableAmount, r.gstAmount, r.totalAmount,
		]),
		totals: ['Total', '', '', `${report.invoiceCount} invoices`, '', report.taxableBase, report.totalGstAmount, report.totalAmount],
		moneyColumns: [5, 6, 7],
		widths: [18, 14, 24, 16, 12, 16, 16, 16],
	};
}

export function jobCardsSheet(report: { rows: JobCardReportResponse['items']; summary: JobCardReportResponse['summary'] }, p: Period): SheetSpec {
	const s = report.summary;
	return {
		sheetName: 'Job Cards',
		title: 'JOB CARD REPORT',
		subtitle: periodText(p),
		headers: ['Job Card No.', 'Date', 'Customer', 'Phone', 'Vehicle', 'Details', 'Status', 'Amount (INR)', 'Invoice No.', 'Invoice Status'],
		rows: report.rows.map((r) => [
			r.jobCardNumber, formatReportDate(r.date), r.customerName, r.customerPhone, r.vehicleRegistration, r.vehicleDetails,
			getJobCardStatusLabel(r.status), r.totalAmount, r.invoiceNumber ?? '', r.invoiceStatus === null || r.invoiceStatus === undefined ? '' : invoiceStatusLabel(r.invoiceStatus),
		]),
		totals: ['Total', '', '', '', `${s.totalCount} job cards`, '', '', s.totalRevenue, '', ''],
		moneyColumns: [7],
		widths: [18, 14, 24, 16, 16, 26, 16, 16, 18, 16],
	};
}

/** Fetches everything for one report and lays it out for the Excel export. */
export async function buildFinancialSheet(id: FinancialReportId, fromDate: string, toDate: string, label: string): Promise<SheetSpec> {
	const p: Period = { fromDate, toDate, label };
	switch (id) {
		case 'sales':
			return salesSheet(await fetchAllRows((page, pageSize) => getSalesReport({ fromDate, toDate, page, pageSize })), p);
		case 'collections':
			return collectionsSheet(await fetchAllRows((page, pageSize) => getPaymentCollectionReport({ fromDate, toDate, page, pageSize })), p);
		case 'outstanding':
			return outstandingSheet(await fetchAllRows((page, pageSize) => getOutstandingInvoicesReport({ fromDate, toDate, page, pageSize })), p);
		case 'gst':
			return gstSheet(await getGstReport({ fromDate, toDate }), p);
		case 'job-cards':
			return jobCardsSheet(await fetchAllRows((page, pageSize) => getJobCardReport({ fromDate, toDate, page, pageSize })), p);
	}
}
