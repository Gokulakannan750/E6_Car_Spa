/**
 * E6 Car Spa Management — Monthly Billing Reports Excel Generator
 *
 * Generates ONE professional, structured Excel workbook for the selected reporting month:
 *   - SHEET 1: "Monthly Summary" (Executive presentation, KPIs, Invoice & Payment breakdown, Reconciliation note)
 *   - SHEETS 2..N: Daily sheets ("01-Oct", "02-Oct", ... "31-Oct") with Job Cards, Invoices, and Services sections.
 *
 * Uses standard SheetJS (xlsx) without Node-specific runtime dependencies.
 */

import * as XLSX from 'xlsx';
import type {
	MonthlyBillingReportResponse,
	MonthlyBillingSummaryDto,
	DailyBillingSheetDto,
} from '../../lib/api';

// ────────────────────────────────────────────────────────────────────────────
// COLOR PALETTE CONSTANTS (RGB Hex Strings without '#')
// ────────────────────────────────────────────────────────────────────────────
const COLORS = {
	PRIMARY_DARK: '0B3A6E',
	PRIMARY_BLUE: '0B5ED7',
	SECONDARY_LIGHT_BLUE: 'EAF2FF',
	MEDIUM_LIGHT_BLUE: 'D0E2FF',
	SUCCESS_GREEN: '198754',
	SUCCESS_LIGHT_GREEN: 'EAF7EF',
	WARNING_ORANGE: 'F59E0B',
	WARNING_LIGHT_ORANGE: 'FFF4E0',
	DANGER_RED: 'DC3545',
	DANGER_LIGHT_RED: 'FDECEC',
	DARK_TEXT: '1F2937',
	MUTED_TEXT: '6B7280',
	LIGHT_GRAY_FILL: 'F3F4F6',
	ROW_ALT_FILL: 'F9FAFB',
	BORDER_GRAY: 'D1D5DB',
	BORDER_DARK: '0B3A6E',
	WHITE: 'FFFFFF',
};

const FONT_FAMILY = 'Calibri';

// ────────────────────────────────────────────────────────────────────────────
// STYLE PRESETS
// ────────────────────────────────────────────────────────────────────────────
const thinBorder = {
	top: { style: 'thin', color: { rgb: COLORS.BORDER_GRAY } },
	bottom: { style: 'thin', color: { rgb: COLORS.BORDER_GRAY } },
	left: { style: 'thin', color: { rgb: COLORS.BORDER_GRAY } },
	right: { style: 'thin', color: { rgb: COLORS.BORDER_GRAY } },
};

const totalRowBorder = {
	top: { style: 'thin', color: { rgb: COLORS.PRIMARY_DARK } },
	bottom: { style: 'double', color: { rgb: COLORS.PRIMARY_DARK } },
	left: { style: 'thin', color: { rgb: COLORS.BORDER_GRAY } },
	right: { style: 'thin', color: { rgb: COLORS.BORDER_GRAY } },
};

const STYLES = {
	// Main Workbook Title
	mainTitle: {
		fill: { fgColor: { rgb: COLORS.PRIMARY_DARK } },
		font: { name: FONT_FAMILY, sz: 16, bold: true, color: { rgb: COLORS.WHITE } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
	// Subtitle
	subTitle: {
		fill: { fgColor: { rgb: COLORS.SECONDARY_LIGHT_BLUE } },
		font: { name: FONT_FAMILY, sz: 11, bold: true, color: { rgb: COLORS.PRIMARY_DARK } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
	// Major Section Header (Dark Blue + White Bold)
	sectionHeader: {
		fill: { fgColor: { rgb: COLORS.PRIMARY_DARK } },
		font: { name: FONT_FAMILY, sz: 11, bold: true, color: { rgb: COLORS.WHITE } },
		alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
		border: thinBorder,
	},
	// Sub-section Column Table Header (Blue + White Bold)
	tableHeader: {
		fill: { fgColor: { rgb: COLORS.PRIMARY_BLUE } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.WHITE } },
		alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
		border: thinBorder,
	},
	// Sub-section Column Table Header Light
	tableHeaderLight: {
		fill: { fgColor: { rgb: COLORS.SECONDARY_LIGHT_BLUE } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.PRIMARY_DARK } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
	// Normal Data Label
	labelCell: {
		font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLORS.DARK_TEXT } },
		alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
		border: thinBorder,
	},
	// Bold Label
	boldLabelCell: {
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.DARK_TEXT } },
		alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
		border: thinBorder,
	},
	// Value Text
	textCell: {
		font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLORS.DARK_TEXT } },
		alignment: { horizontal: 'left', vertical: 'center' },
		border: thinBorder,
	},
	// Center-aligned Code / ID / Date
	centerCell: {
		font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLORS.DARK_TEXT } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
	// Numeric Count Cell
	countCell: {
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.DARK_TEXT } },
		alignment: { horizontal: 'right', vertical: 'center' },
		border: thinBorder,
	},
	// Currency Normal Cell
	currencyCell: {
		font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLORS.DARK_TEXT } },
		alignment: { horizontal: 'right', vertical: 'center' },
		border: thinBorder,
	},
	// Currency Bold Cell
	currencyBoldCell: {
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.DARK_TEXT } },
		alignment: { horizontal: 'right', vertical: 'center' },
		border: thinBorder,
	},
	// KPI Value Box (Light Blue)
	kpiCell: {
		fill: { fgColor: { rgb: COLORS.SECONDARY_LIGHT_BLUE } },
		font: { name: FONT_FAMILY, sz: 11, bold: true, color: { rgb: COLORS.PRIMARY_DARK } },
		alignment: { horizontal: 'right', vertical: 'center' },
		border: thinBorder,
	},
	// Paid / Success Value Box
	paidSuccessCell: {
		fill: { fgColor: { rgb: COLORS.SUCCESS_LIGHT_GREEN } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.SUCCESS_GREEN } },
		alignment: { horizontal: 'right', vertical: 'center' },
		border: thinBorder,
	},
	// Pending / Warning Value Box
	pendingWarningCell: {
		fill: { fgColor: { rgb: COLORS.DANGER_LIGHT_RED } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.DANGER_RED } },
		alignment: { horizontal: 'right', vertical: 'center' },
		border: thinBorder,
	},
	// Status Badge - Paid
	statusPaid: {
		fill: { fgColor: { rgb: COLORS.SUCCESS_LIGHT_GREEN } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.SUCCESS_GREEN } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
	// Status Badge - Pending
	statusPending: {
		fill: { fgColor: { rgb: COLORS.DANGER_LIGHT_RED } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.DANGER_RED } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
	// Status Badge - Partial
	statusPartial: {
		fill: { fgColor: { rgb: COLORS.WARNING_LIGHT_ORANGE } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.WARNING_ORANGE } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
	// Status Badge - Neutral
	statusNeutral: {
		fill: { fgColor: { rgb: COLORS.LIGHT_GRAY_FILL } },
		font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLORS.MUTED_TEXT } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
	// Total Row Cell
	totalRow: {
		fill: { fgColor: { rgb: COLORS.SECONDARY_LIGHT_BLUE } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.PRIMARY_DARK } },
		alignment: { horizontal: 'right', vertical: 'center' },
		border: totalRowBorder,
	},
	// Total Row Label Cell
	totalRowLabel: {
		fill: { fgColor: { rgb: COLORS.SECONDARY_LIGHT_BLUE } },
		font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLORS.PRIMARY_DARK } },
		alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
		border: totalRowBorder,
	},
	// Audit Verified Box
	auditNote: {
		fill: { fgColor: { rgb: COLORS.SUCCESS_LIGHT_GREEN } },
		font: { name: FONT_FAMILY, sz: 10, italic: true, color: { rgb: COLORS.SUCCESS_GREEN } },
		alignment: { horizontal: 'left', vertical: 'center' },
		border: thinBorder,
	},
	// Empty Sheet Notice
	emptyNotice: {
		fill: { fgColor: { rgb: COLORS.LIGHT_GRAY_FILL } },
		font: { name: FONT_FAMILY, sz: 11, bold: true, color: { rgb: COLORS.MUTED_TEXT } },
		alignment: { horizontal: 'center', vertical: 'center' },
		border: thinBorder,
	},
};

// ────────────────────────────────────────────────────────────────────────────
// DATE FORMATTERS
// ────────────────────────────────────────────────────────────────────────────
export function formatDateDisplay(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	const day = String(d.getDate()).padStart(2, '0');
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const month = months[d.getMonth()];
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}

export function formatDateTimeDisplay(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	const datePart = formatDateDisplay(dateStr);
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');
	return `${datePart} ${hours}:${minutes}`;
}

// ────────────────────────────────────────────────────────────────────────────
// CELL HELPER
// ────────────────────────────────────────────────────────────────────────────
interface CellConfig {
	v: string | number | null | undefined;
	t?: 's' | 'n' | 'b' | 'd';
	s?: any;
	z?: string;
}

function setCell(
	ws: XLSX.WorkSheet,
	r: number,
	c: number,
	config: CellConfig
) {
	const cellRef = XLSX.utils.encode_cell({ r, c });
	const val = config.v ?? '';
	const type = config.t || (typeof val === 'number' ? 'n' : 's');
	const cell: XLSX.CellObject = {
		v: val,
		t: type,
		s: config.s || STYLES.textCell,
	};
	if (config.z) {
		cell.z = config.z;
	}
	ws[cellRef] = cell;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. SHEET 1: "Monthly Summary"
// ────────────────────────────────────────────────────────────────────────────

export function generateMonthlySummaryWorksheet(
	summary: MonthlyBillingSummaryDto,
	monthName: string,
	daysInMonth: number
): XLSX.WorkSheet {
	const ws: XLSX.WorkSheet = {};
	let row = 0;

	const merges: XLSX.Range[] = [];
	const rowHeights: { hpt: number }[] = [];

	// 1. Report Title (Row 0, Height 36pt)
	setCell(ws, row, 0, { v: 'E6 CAR SPA — MONTHLY BILLING REPORT', s: STYLES.mainTitle });
	setCell(ws, row, 1, { v: '', s: STYLES.mainTitle });
	setCell(ws, row, 2, { v: '', s: STYLES.mainTitle });
	setCell(ws, row, 3, { v: '', s: STYLES.mainTitle });
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 36 });
	row++;

	// 2. Subtitle (Row 1, Height 22pt)
	setCell(ws, row, 0, { v: 'MONTHLY EXECUTIVE SUMMARY', s: STYLES.subTitle });
	setCell(ws, row, 1, { v: '', s: STYLES.subTitle });
	setCell(ws, row, 2, { v: '', s: STYLES.subTitle });
	setCell(ws, row, 3, { v: '', s: STYLES.subTitle });
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 22 });
	row++;

	// Spacing Row (Row 2, Height 10pt)
	rowHeights.push({ hpt: 10 });
	row++;

	// 3. REPORT PERIOD SECTION
	setCell(ws, row, 0, { v: 'REPORT PERIOD', s: STYLES.sectionHeader });
	setCell(ws, row, 1, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 2, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 3, { v: '', s: STYLES.sectionHeader });
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 24 });
	row++;

	const periodRows = [
		{ label: 'Month', val: summary.monthName || monthName },
		{ label: 'Start Date', val: formatDateDisplay(summary.startDate) },
		{ label: 'End Date', val: formatDateDisplay(summary.endDate) },
		{ label: 'Total Calendar Days', val: daysInMonth, isNum: true },
		{ label: 'Generated At', val: formatDateTimeDisplay(summary.generatedAt) },
	];

	for (const item of periodRows) {
		setCell(ws, row, 0, { v: item.label, s: STYLES.boldLabelCell });
		setCell(ws, row, 1, {
			v: item.val,
			t: item.isNum ? 'n' : 's',
			s: item.isNum ? STYLES.countCell : STYLES.textCell,
		});
		setCell(ws, row, 2, { v: '', s: STYLES.textCell });
		setCell(ws, row, 3, { v: '', s: STYLES.textCell });
		merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
		rowHeights.push({ hpt: 20 });
		row++;
	}

	// Spacing Row
	rowHeights.push({ hpt: 10 });
	row++;

	// 4. JOB CARD SUMMARY
	setCell(ws, row, 0, { v: 'JOB CARD SUMMARY', s: STYLES.sectionHeader });
	setCell(ws, row, 1, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 2, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 3, { v: '', s: STYLES.sectionHeader });
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 24 });
	row++;

	// Column Header
	setCell(ws, row, 0, { v: 'METRIC', s: STYLES.tableHeaderLight });
	setCell(ws, row, 1, { v: 'COUNT', s: STYLES.tableHeaderLight });
	setCell(ws, row, 2, { v: '', s: STYLES.tableHeaderLight });
	setCell(ws, row, 3, { v: '', s: STYLES.tableHeaderLight });
	merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 20 });
	row++;

	const jcRows = [
		{ label: 'Total Job Cards Created', val: summary.totalJobCardsCreated },
		{ label: 'Total Job Cards Finished / Completed', val: summary.totalJobCardsFinished },
	];

	for (const item of jcRows) {
		setCell(ws, row, 0, { v: item.label, s: STYLES.boldLabelCell });
		setCell(ws, row, 1, { v: item.val, t: 'n', s: STYLES.kpiCell, z: '#,##0' });
		setCell(ws, row, 2, { v: '', s: STYLES.kpiCell });
		setCell(ws, row, 3, { v: '', s: STYLES.kpiCell });
		merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
		rowHeights.push({ hpt: 22 });
		row++;
	}

	// Spacing Row
	rowHeights.push({ hpt: 10 });
	row++;

	// 5. INVOICE SUMMARY
	setCell(ws, row, 0, { v: 'INVOICE SUMMARY', s: STYLES.sectionHeader });
	setCell(ws, row, 1, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 2, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 3, { v: '', s: STYLES.sectionHeader });
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 24 });
	row++;

	// Column Header
	setCell(ws, row, 0, { v: 'METRIC', s: STYLES.tableHeaderLight });
	setCell(ws, row, 1, { v: 'METRIC / AMOUNT', s: STYLES.tableHeaderLight });
	setCell(ws, row, 2, { v: '', s: STYLES.tableHeaderLight });
	setCell(ws, row, 3, { v: '', s: STYLES.tableHeaderLight });
	merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 20 });
	row++;

	// Invoice Count Rows
	const invCountRows = [
		{ label: 'Total Invoices Issued', val: summary.totalInvoices, style: STYLES.countCell },
		{ label: 'Total Invoices Fully Paid', val: summary.totalInvoicesPaid, style: STYLES.paidSuccessCell },
		{
			label: 'Total Invoices Pending Payment',
			val: summary.totalInvoicesPendingPayment,
			style: summary.totalInvoicesPendingPayment > 0 ? STYLES.pendingWarningCell : STYLES.paidSuccessCell,
		},
		{ label: 'Total Draft Invoices', val: summary.totalInvoicesDraft, style: STYLES.countCell },
		{ label: 'Total Cancelled Invoices', val: summary.totalInvoicesCancelled, style: STYLES.countCell },
	];

	for (const item of invCountRows) {
		setCell(ws, row, 0, { v: item.label, s: STYLES.boldLabelCell });
		setCell(ws, row, 1, { v: item.val, t: 'n', s: item.style, z: '#,##0' });
		setCell(ws, row, 2, { v: '', s: item.style });
		setCell(ws, row, 3, { v: '', s: item.style });
		merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
		rowHeights.push({ hpt: 20 });
		row++;
	}

	// Invoice Monetary Rows
	const pendingAmountStyle =
		summary.totalAmountPending > 0 ? STYLES.pendingWarningCell : STYLES.paidSuccessCell;

	const invAmountRows = [
		{
			label: 'Total Invoice Amount (INR)',
			val: summary.totalInvoiceAmount,
			style: STYLES.kpiCell,
		},
		{
			label: 'Total Amount Paid (INR)',
			val: summary.totalAmountPaid,
			style: STYLES.paidSuccessCell,
		},
		{
			label: 'Total Amount Pending / Outstanding (INR)',
			val: summary.totalAmountPending,
			style: pendingAmountStyle,
		},
	];

	for (const item of invAmountRows) {
		setCell(ws, row, 0, { v: item.label, s: STYLES.boldLabelCell });
		setCell(ws, row, 1, {
			v: item.val,
			t: 'n',
			s: item.style,
			z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
		});
		setCell(ws, row, 2, { v: '', s: item.style });
		setCell(ws, row, 3, { v: '', s: item.style });
		merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
		rowHeights.push({ hpt: 22 });
		row++;
	}

	// Spacing Row
	rowHeights.push({ hpt: 10 });
	row++;

	// 6. SERVICE SUMMARY
	setCell(ws, row, 0, { v: 'SERVICE SUMMARY', s: STYLES.sectionHeader });
	setCell(ws, row, 1, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 2, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 3, { v: '', s: STYLES.sectionHeader });
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 24 });
	row++;

	// Column Header
	setCell(ws, row, 0, { v: 'METRIC', s: STYLES.tableHeaderLight });
	setCell(ws, row, 1, { v: 'COUNT / QUANTITY', s: STYLES.tableHeaderLight });
	setCell(ws, row, 2, { v: '', s: STYLES.tableHeaderLight });
	setCell(ws, row, 3, { v: '', s: STYLES.tableHeaderLight });
	merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 20 });
	row++;

	const sRows = [
		{ label: 'Total Services Performed', val: summary.totalServicesPerformed },
		{ label: 'Total Service Quantity', val: summary.totalServiceQuantity },
	];

	for (const item of sRows) {
		setCell(ws, row, 0, { v: item.label, s: STYLES.boldLabelCell });
		setCell(ws, row, 1, { v: item.val, t: 'n', s: STYLES.kpiCell, z: '#,##0' });
		setCell(ws, row, 2, { v: '', s: STYLES.kpiCell });
		setCell(ws, row, 3, { v: '', s: STYLES.kpiCell });
		merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
		rowHeights.push({ hpt: 22 });
		row++;
	}

	// Spacing Row
	rowHeights.push({ hpt: 10 });
	row++;

	// 7. RECONCILIATION AUDIT NOTE
	setCell(ws, row, 0, { v: 'AUDIT RECONCILIATION VERIFICATION', s: STYLES.sectionHeader });
	setCell(ws, row, 1, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 2, { v: '', s: STYLES.sectionHeader });
	setCell(ws, row, 3, { v: '', s: STYLES.sectionHeader });
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 24 });
	row++;

	// Note row
	setCell(ws, row, 0, { v: 'Note:', s: STYLES.boldLabelCell });
	setCell(ws, row, 1, {
		v: 'All figures above strictly reconcile with the sum of all daily sheets in this workbook.',
		s: STYLES.auditNote,
	});
	setCell(ws, row, 2, { v: '', s: STYLES.auditNote });
	setCell(ws, row, 3, { v: '', s: STYLES.auditNote });
	merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 22 });
	row++;

	// Daily sheets included row
	setCell(ws, row, 0, { v: 'Daily Sheets Included:', s: STYLES.boldLabelCell });
	setCell(ws, row, 1, {
		v: `${daysInMonth} daily sheets (${monthName})`,
		s: STYLES.subTitle,
	});
	setCell(ws, row, 2, { v: '', s: STYLES.subTitle });
	setCell(ws, row, 3, { v: '', s: STYLES.subTitle });
	merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 3 } });
	rowHeights.push({ hpt: 22 });

	// Dimension ref
	ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: 3 } });
	ws['!merges'] = merges;
	ws['!rows'] = rowHeights;
	ws['!cols'] = [{ wch: 45 }, { wch: 22 }, { wch: 22 }, { wch: 25 }];
	ws['!pageSetup'] = { orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 };

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. DAILY SHEETS: "01-Oct", "02-Oct", etc.
// ────────────────────────────────────────────────────────────────────────────

export function generateDailySheetWorksheet(
	sheet: DailyBillingSheetDto,
	monthName: string
): XLSX.WorkSheet {
	const ws: XLSX.WorkSheet = {};
	let row = 0;

	const merges: XLSX.Range[] = [];
	const rowHeights: { hpt: number }[] = [];
	const TOTAL_COLS = 9; // Col A to Col I (0 to 8)

	// 1. Sheet Header Banner (Row 0, Height 36pt)
	for (let c = 0; c < TOTAL_COLS; c++) {
		setCell(ws, row, c, {
			v: c === 0 ? `E6 CAR SPA — BILLING ACTIVITY FOR ${sheet.dateFormatted.toUpperCase()}` : '',
			s: STYLES.mainTitle,
		});
	}
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOTAL_COLS - 1 } });
	rowHeights.push({ hpt: 36 });
	row++;

	// 2. Subheader (Row 1, Height 22pt)
	const subText = `REPORT DATE: ${sheet.dateFormatted}  |  SHEET: ${sheet.sheetName}  |  REPORTING MONTH: ${monthName}`;
	for (let c = 0; c < TOTAL_COLS; c++) {
		setCell(ws, row, c, {
			v: c === 0 ? subText : '',
			s: STYLES.subTitle,
		});
	}
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOTAL_COLS - 1 } });
	rowHeights.push({ hpt: 22 });
	row++;

	// Spacing Row
	rowHeights.push({ hpt: 10 });
	row++;

	// 3. Day Summary Overview KPI Row
	for (let c = 0; c < TOTAL_COLS; c++) {
		setCell(ws, row, c, { v: c === 0 ? 'DAY SUMMARY' : '', s: STYLES.sectionHeader });
	}
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOTAL_COLS - 1 } });
	rowHeights.push({ hpt: 24 });
	row++;

	// Summary values across 3 blocks
	const jcSummaryText = `Job Cards: ${sheet.totals.jobCardCount} (Total: ₹${sheet.totals.jobCardTotal.toFixed(2)})`;
	const invSummaryText = `Invoices: ${sheet.totals.invoiceCount} (Billed: ₹${sheet.totals.invoiceTotal.toFixed(2)}, Paid: ₹${sheet.totals.amountPaid.toFixed(2)}, Pending: ₹${sheet.totals.amountPending.toFixed(2)})`;
	const sSummaryText = `Services: ${sheet.totals.serviceCount} (Total Qty: ${sheet.totals.serviceTotalQuantity})`;

	setCell(ws, row, 0, { v: jcSummaryText, s: STYLES.kpiCell });
	setCell(ws, row, 1, { v: '', s: STYLES.kpiCell });
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 1 } });

	setCell(ws, row, 2, { v: invSummaryText, s: STYLES.paidSuccessCell });
	setCell(ws, row, 3, { v: '', s: STYLES.paidSuccessCell });
	setCell(ws, row, 4, { v: '', s: STYLES.paidSuccessCell });
	setCell(ws, row, 5, { v: '', s: STYLES.paidSuccessCell });
	merges.push({ s: { r: row, c: 2 }, e: { r: row, c: 5 } });

	setCell(ws, row, 6, { v: sSummaryText, s: STYLES.kpiCell });
	setCell(ws, row, 7, { v: '', s: STYLES.kpiCell });
	setCell(ws, row, 8, { v: '', s: STYLES.kpiCell });
	merges.push({ s: { r: row, c: 6 }, e: { r: row, c: 8 } });

	rowHeights.push({ hpt: 24 });
	row++;

	// Spacing Row
	rowHeights.push({ hpt: 10 });
	row++;

	// ── Empty Day Handling ──────────────────────────────────────────────────
	if (!sheet.hasActivity) {
		for (let c = 0; c < TOTAL_COLS; c++) {
			setCell(ws, row, c, {
				v: c === 0 ? 'No billing activity for this date.' : '',
				s: STYLES.emptyNotice,
			});
		}
		merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOTAL_COLS - 1 } });
		rowHeights.push({ hpt: 40 });

		ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: TOTAL_COLS - 1 } });
		ws['!merges'] = merges;
		ws['!rows'] = rowHeights;
		ws['!cols'] = [
			{ wch: 22 }, // A
			{ wch: 20 }, // B
			{ wch: 26 }, // C
			{ wch: 24 }, // D
			{ wch: 20 }, // E
			{ wch: 18 }, // F
			{ wch: 20 }, // G
			{ wch: 22 }, // H
			{ wch: 22 }, // I
		];
		ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
		return ws;
	}

	// ── SECTION 1: JOB CARDS ────────────────────────────────────────────────
	for (let c = 0; c < 8; c++) {
		setCell(ws, row, c, {
			v: c === 0 ? `SECTION 1: JOB CARDS (${sheet.jobCards.length} records)` : '',
			s: STYLES.sectionHeader,
		});
	}
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 7 } });
	rowHeights.push({ hpt: 24 });
	row++;

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

	for (let c = 0; c < jcHeaders.length; c++) {
		setCell(ws, row, c, { v: jcHeaders[c], s: STYLES.tableHeader });
	}
	rowHeights.push({ hpt: 22 });
	row++;

	if (sheet.jobCards.length === 0) {
		for (let c = 0; c < 8; c++) {
			setCell(ws, row, c, {
				v: c === 0 ? 'No job cards created on this date.' : '',
				s: STYLES.textCell,
			});
		}
		merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 7 } });
		rowHeights.push({ hpt: 20 });
		row++;
	} else {
		for (let i = 0; i < sheet.jobCards.length; i++) {
			const jc = sheet.jobCards[i];
			const altBg = i % 2 === 1 ? { fill: { fgColor: { rgb: COLORS.ROW_ALT_FILL } } } : {};

			setCell(ws, row, 0, {
				v: jc.jobCardNumber,
				s: { ...STYLES.centerCell, ...altBg, font: { ...STYLES.centerCell.font, bold: true } },
			});
			setCell(ws, row, 1, {
				v: formatDateTimeDisplay(jc.jobCardDate),
				s: { ...STYLES.centerCell, ...altBg },
			});
			setCell(ws, row, 2, {
				v: jc.customerName,
				s: { ...STYLES.textCell, ...altBg },
			});
			setCell(ws, row, 3, {
				v: jc.vehicleRegistration,
				s: { ...STYLES.centerCell, ...altBg },
			});
			setCell(ws, row, 4, {
				v: jc.vehicle || '—',
				s: { ...STYLES.textCell, ...altBg },
			});
			setCell(ws, row, 5, {
				v: jc.jobCardStatus,
				s: {
					...altBg,
					...(jc.jobCardStatus === 'Ready' || jc.jobCardStatus === 'Delivered'
						? STYLES.statusPaid
						: STYLES.statusNeutral),
				},
			});
			setCell(ws, row, 6, {
				v: jc.totalServices ?? 0,
				t: 'n',
				s: { ...STYLES.countCell, ...altBg },
				z: '#,##0',
			});
			setCell(ws, row, 7, {
				v: jc.jobCardTotal ?? 0,
				t: 'n',
				s: { ...STYLES.currencyBoldCell, ...altBg },
				z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
			});

			rowHeights.push({ hpt: 20 });
			row++;
		}

		// Job Cards Total Row
		setCell(ws, row, 0, { v: 'TOTAL JOB CARDS', s: STYLES.totalRowLabel });
		setCell(ws, row, 1, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 2, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 3, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 4, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 5, { v: `${sheet.jobCards.length} records`, s: STYLES.totalRow });
		setCell(ws, row, 6, {
			v: sheet.totals.jobCardCount,
			t: 'n',
			s: STYLES.totalRow,
			z: '#,##0',
		});
		setCell(ws, row, 7, {
			v: sheet.totals.jobCardTotal,
			t: 'n',
			s: STYLES.totalRow,
			z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
		});
		rowHeights.push({ hpt: 22 });
		row++;
	}

	// Spacing Row
	rowHeights.push({ hpt: 12 });
	row++;

	// ── SECTION 2: INVOICES ─────────────────────────────────────────────────
	for (let c = 0; c < 9; c++) {
		setCell(ws, row, c, {
			v: c === 0 ? `SECTION 2: INVOICES (${sheet.invoices.length} records)` : '',
			s: STYLES.sectionHeader,
		});
	}
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 8 } });
	rowHeights.push({ hpt: 24 });
	row++;

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

	for (let c = 0; c < invHeaders.length; c++) {
		setCell(ws, row, c, { v: invHeaders[c], s: STYLES.tableHeader });
	}
	rowHeights.push({ hpt: 22 });
	row++;

	if (sheet.invoices.length === 0) {
		for (let c = 0; c < 9; c++) {
			setCell(ws, row, c, {
				v: c === 0 ? 'No invoices issued on this date.' : '',
				s: STYLES.textCell,
			});
		}
		merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 8 } });
		rowHeights.push({ hpt: 20 });
		row++;
	} else {
		for (let i = 0; i < sheet.invoices.length; i++) {
			const inv = sheet.invoices[i];
			const altBg = i % 2 === 1 ? { fill: { fgColor: { rgb: COLORS.ROW_ALT_FILL } } } : {};

			// Status style selection
			let statusStyle = STYLES.statusNeutral;
			if (inv.invoiceStatus === 'Paid') {
				statusStyle = STYLES.statusPaid;
			} else if (inv.invoiceStatus === 'PartiallyPaid' || inv.invoiceStatus === 'Partially Paid') {
				statusStyle = STYLES.statusPartial;
			} else if (inv.invoiceStatus === 'Pending' || inv.invoiceStatus === 'Finalized') {
				statusStyle = STYLES.statusPending;
			}

			setCell(ws, row, 0, {
				v: inv.invoiceNumber || '—',
				s: { ...STYLES.centerCell, ...altBg, font: { ...STYLES.centerCell.font, bold: true } },
			});
			setCell(ws, row, 1, {
				v: formatDateDisplay(inv.invoiceDate),
				s: { ...STYLES.centerCell, ...altBg },
			});
			setCell(ws, row, 2, {
				v: inv.jobCardNumber || '—',
				s: { ...STYLES.centerCell, ...altBg },
			});
			setCell(ws, row, 3, {
				v: inv.customerName,
				s: { ...STYLES.textCell, ...altBg },
			});
			setCell(ws, row, 4, {
				v: inv.vehicleRegistration,
				s: { ...STYLES.centerCell, ...altBg },
			});
			setCell(ws, row, 5, {
				v: inv.invoiceStatus,
				s: { ...statusStyle, ...altBg },
			});
			setCell(ws, row, 6, {
				v: inv.invoiceTotal ?? 0,
				t: 'n',
				s: { ...STYLES.currencyBoldCell, ...altBg },
				z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
			});
			setCell(ws, row, 7, {
				v: inv.amountPaid ?? 0,
				t: 'n',
				s: { ...STYLES.paidSuccessCell, ...altBg },
				z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
			});
			setCell(ws, row, 8, {
				v: inv.amountPending ?? 0,
				t: 'n',
				s: {
					...(inv.amountPending > 0 ? STYLES.pendingWarningCell : STYLES.paidSuccessCell),
					...altBg,
				},
				z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
			});

			rowHeights.push({ hpt: 20 });
			row++;
		}

		// Invoices Total Row
		setCell(ws, row, 0, { v: 'TOTAL INVOICES', s: STYLES.totalRowLabel });
		setCell(ws, row, 1, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 2, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 3, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 4, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 5, { v: `${sheet.invoices.length} records`, s: STYLES.totalRow });
		setCell(ws, row, 6, {
			v: sheet.totals.invoiceTotal,
			t: 'n',
			s: STYLES.totalRow,
			z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
		});
		setCell(ws, row, 7, {
			v: sheet.totals.amountPaid,
			t: 'n',
			s: { ...STYLES.totalRow, font: { ...STYLES.totalRow.font, color: { rgb: COLORS.SUCCESS_GREEN } } },
			z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
		});
		setCell(ws, row, 8, {
			v: sheet.totals.amountPending,
			t: 'n',
			s: {
				...STYLES.totalRow,
				font: {
					...STYLES.totalRow.font,
					color: { rgb: sheet.totals.amountPending > 0 ? COLORS.DANGER_RED : COLORS.SUCCESS_GREEN },
				},
			},
			z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
		});
		rowHeights.push({ hpt: 22 });
		row++;
	}

	// Spacing Row
	rowHeights.push({ hpt: 12 });
	row++;

	// ── SECTION 3: SERVICES ─────────────────────────────────────────────────
	for (let c = 0; c < 7; c++) {
		setCell(ws, row, c, {
			v: c === 0 ? `SECTION 3: SERVICES (${sheet.services.length} items)` : '',
			s: STYLES.sectionHeader,
		});
	}
	merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 6 } });
	rowHeights.push({ hpt: 24 });
	row++;

	const sHeaders = [
		'Job Card Number',
		'Invoice Number',
		'Customer Name',
		'Service Name',
		'Quantity',
		'Rate (INR)',
		'Amount (INR)',
	];

	for (let c = 0; c < sHeaders.length; c++) {
		setCell(ws, row, c, { v: sHeaders[c], s: STYLES.tableHeader });
	}
	rowHeights.push({ hpt: 22 });
	row++;

	if (sheet.services.length === 0) {
		for (let c = 0; c < 7; c++) {
			setCell(ws, row, c, {
				v: c === 0 ? 'No services recorded for this date.' : '',
				s: STYLES.textCell,
			});
		}
		merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 6 } });
		rowHeights.push({ hpt: 20 });
		row++;
	} else {
		let totalServicesSum = 0;
		for (let i = 0; i < sheet.services.length; i++) {
			const s = sheet.services[i];
			const altBg = i % 2 === 1 ? { fill: { fgColor: { rgb: COLORS.ROW_ALT_FILL } } } : {};
			const amt = s.amount ?? 0;
			totalServicesSum += amt;

			setCell(ws, row, 0, {
				v: s.jobCardNumber,
				s: { ...STYLES.centerCell, ...altBg, font: { ...STYLES.centerCell.font, bold: true } },
			});
			setCell(ws, row, 1, {
				v: s.invoiceNumber || '—',
				s: { ...STYLES.centerCell, ...altBg },
			});
			setCell(ws, row, 2, {
				v: s.customerName,
				s: { ...STYLES.textCell, ...altBg },
			});
			setCell(ws, row, 3, {
				v: s.serviceName,
				s: { ...STYLES.textCell, ...altBg, font: { ...STYLES.textCell.font, bold: true } },
			});
			setCell(ws, row, 4, {
				v: s.quantity ?? 1,
				t: 'n',
				s: { ...STYLES.countCell, ...altBg },
				z: '#,##0',
			});
			setCell(ws, row, 5, {
				v: s.rate ?? 0,
				t: 'n',
				s: { ...STYLES.currencyCell, ...altBg },
				z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
			});
			setCell(ws, row, 6, {
				v: amt,
				t: 'n',
				s: { ...STYLES.currencyBoldCell, ...altBg },
				z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
			});

			rowHeights.push({ hpt: 20 });
			row++;
		}

		// Services Total Row
		setCell(ws, row, 0, { v: 'TOTAL SERVICES', s: STYLES.totalRowLabel });
		setCell(ws, row, 1, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 2, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 3, { v: `${sheet.services.length} items`, s: STYLES.totalRow });
		setCell(ws, row, 4, {
			v: sheet.totals.serviceTotalQuantity,
			t: 'n',
			s: STYLES.totalRow,
			z: '#,##0',
		});
		setCell(ws, row, 5, { v: '', s: STYLES.totalRow });
		setCell(ws, row, 6, {
			v: totalServicesSum,
			t: 'n',
			s: STYLES.totalRow,
			z: '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"',
		});
		rowHeights.push({ hpt: 22 });
		row++;
	}

	ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: TOTAL_COLS - 1 } });
	ws['!merges'] = merges;
	ws['!rows'] = rowHeights;
	ws['!cols'] = [
		{ wch: 20 }, // A: Job Card / Invoice Number
		{ wch: 18 }, // B: Date
		{ wch: 26 }, // C: Customer Name
		{ wch: 24 }, // D: Vehicle Reg / Service Name
		{ wch: 20 }, // E: Vehicle / Qty
		{ wch: 18 }, // F: Status / Rate
		{ wch: 20 }, // G: Total Services / Amount
		{ wch: 22 }, // H: Total Amount / Amount Paid
		{ wch: 22 }, // I: Amount Pending
	];
	ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };

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

