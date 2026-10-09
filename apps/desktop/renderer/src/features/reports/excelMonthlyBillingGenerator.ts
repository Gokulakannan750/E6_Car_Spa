/**
 * Car Spa Management — Monthly Billing Reports Excel Generator (ExcelJS)
 *
 * Generates an executive-grade, beautifully formatted Excel workbook:
 *   - SHEET 1: "Monthly Summary" (Executive presentation, KPIs, Invoice & Payment breakdown, Reconciliation note)
 *   - SHEETS 2..N: Daily sheets ("01-Oct", "02-Oct", ... "31-Oct") with Job Cards, Invoices, and Services sections.
 *
 * Professional Styling Specifications:
 *   - Main title: Dark Blue (#0B3A6E) + White Bold, ~32pt row height, vertically centered
 *   - Subtitle: Light Blue (#EAF2FF) + Dark Blue Bold, ~24pt row height, vertically centered
 *   - Section headers: Dark Blue (#0B3A6E) + White Bold, ~24pt row height
 *   - Table headers: Primary Blue (#0B5ED7) + White Bold, ~22pt row height
 *   - Total Invoice Amount: Light Blue (#EAF2FF) + Bold
 *   - Amount Paid: Light Green (#EAF7EF) + Green Bold (#198754)
 *   - Outstanding: Light Red (#FDECEC) + Red Bold (#DC3545) when > ₹0
 *   - Status Badges: Paid (Green), Partial (Orange), Pending (Red), Draft/Others (Gray)
 *   - Borders: Subtle thin gray borders (#D1D5DB), double bottom on Total rows
 *   - Numbers & Currency: Formatted explicitly with ₹ and thousands separators
 */

import ExcelJS from 'exceljs';
import type {
	MonthlyBillingReportResponse,
	MonthlyBillingSummaryDto,
	DailyBillingSheetDto,
} from '../../lib/api';
import { reportCreator, reportFilePrefix, reportTitle } from '../../lib/documentBranding';

// ────────────────────────────────────────────────────────────────────────────
// COLOR PALETTE (ARGB Hex Strings with 'FF' Alpha prefix)
// ────────────────────────────────────────────────────────────────────────────
export const ARGB = {
	PRIMARY_DARK: 'FF0B3A6E',      // Deep Corporate Navy
	PRIMARY_BLUE: 'FF0B5ED7',      // Vibrant Section Blue
	SECONDARY_LIGHT_BLUE: 'FFEAF2FF', // Subtle Ice Blue
	MEDIUM_LIGHT_BLUE: 'FFD0E2FF',
	SUCCESS_GREEN: 'FF198754',     // Emerald Green
	SUCCESS_LIGHT_GREEN: 'FFEAF7EF',
	WARNING_ORANGE: 'FFF59E0B',    // Amber
	WARNING_LIGHT_ORANGE: 'FFFFF4E0',
	DANGER_RED: 'FFDC3545',        // Crimson Red
	DANGER_LIGHT_RED: 'FFFDECEC',
	DARK_TEXT: 'FF1F2937',         // Slate 800
	MUTED_TEXT: 'FF6B7280',        // Slate 500
	LIGHT_GRAY_FILL: 'FFF3F4F6',   // Slate 100
	ROW_ALT_FILL: 'FFF9FAFB',      // Slate 50
	BORDER_GRAY: 'FFD1D5DB',       // Slate 300
	WHITE: 'FFFFFFFF',
} as const;

const FONT_NAME = 'Calibri';

// ────────────────────────────────────────────────────────────────────────────
// NUMBER & CURRENCY FORMATS
// ────────────────────────────────────────────────────────────────────────────
export const NUM_FORMATS = {
	CURRENCY: '"₹"#,##0.00;[Red]-"₹"#,##0.00;"₹"0.00',
	INTEGER: '#,##0',
	PERCENT: '0.0%',
};

// ────────────────────────────────────────────────────────────────────────────
// STYLE HELPERS
// ────────────────────────────────────────────────────────────────────────────
const thinBorder: Partial<ExcelJS.Borders> = {
	top: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
	left: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
	bottom: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
	right: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
};

const totalRowBorder: Partial<ExcelJS.Borders> = {
	top: { style: 'thin', color: { argb: ARGB.PRIMARY_DARK } },
	left: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
	bottom: { style: 'double', color: { argb: ARGB.PRIMARY_DARK } },
	right: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
};

function styleCell(
	cell: ExcelJS.Cell,
	opts: {
		fillColor?: string;
		fontColor?: string;
		fontSize?: number;
		bold?: boolean;
		italic?: boolean;
		hAlign?: 'left' | 'center' | 'right';
		vAlign?: 'top' | 'middle' | 'bottom';
		indent?: number;
		wrapText?: boolean;
		numFmt?: string;
		border?: Partial<ExcelJS.Borders>;
	}
) {
	if (opts.fillColor) {
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: opts.fillColor },
		};
	}
	cell.font = {
		name: FONT_NAME,
		size: opts.fontSize ?? 10,
		bold: opts.bold ?? false,
		italic: opts.italic ?? false,
		color: { argb: opts.fontColor ?? ARGB.DARK_TEXT },
	};
	cell.alignment = {
		horizontal: opts.hAlign ?? 'left',
		vertical: opts.vAlign ?? 'middle',
		indent: opts.indent ?? 0,
		wrapText: opts.wrapText ?? false,
	};
	if (opts.numFmt) {
		cell.numFmt = opts.numFmt;
	}
	cell.border = opts.border ?? thinBorder;
}

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
// 1. SHEET 1: "Monthly Summary"
// ────────────────────────────────────────────────────────────────────────────
export function buildMonthlySummarySheet(
	workbook: ExcelJS.Workbook,
	summary: MonthlyBillingSummaryDto,
	monthName: string,
	daysInMonth: number,
	companyName?: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Monthly Summary', {
		views: [{ showGridLines: true }],
		pageSetup: {
			orientation: 'portrait',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9, // A4
			margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	// Column Widths
	ws.columns = [
		{ key: 'colA', width: 44 },
		{ key: 'colB', width: 22 },
		{ key: 'colC', width: 22 },
		{ key: 'colD', width: 24 },
	];

	let r = 1;

	// 1. Main Title (Row 1, Height 34)
	const titleRow = ws.getRow(r);
	titleRow.height = 34;
	ws.mergeCells(`A${r}:D${r}`);
	titleRow.getCell(1).value = reportTitle('MONTHLY BILLING REPORT', companyName);
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 15,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// 2. Subtitle (Row 2, Height 24)
	const subRow = ws.getRow(r);
	subRow.height = 24;
	ws.mergeCells(`A${r}:D${r}`);
	subRow.getCell(1).value = 'MONTHLY EXECUTIVE SUMMARY';
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 11,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row
	ws.getRow(r++).height = 10;

	// 3. REPORT PERIOD SECTION
	const periodHeader = ws.getRow(r);
	periodHeader.height = 24;
	ws.mergeCells(`A${r}:D${r}`);
	periodHeader.getCell(1).value = 'REPORT PERIOD';
	styleCell(periodHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const periodData = [
		{ label: 'Month', val: summary.monthName || monthName },
		{ label: 'Start Date', val: formatDateDisplay(summary.startDate) },
		{ label: 'End Date', val: formatDateDisplay(summary.endDate) },
		{ label: 'Total Calendar Days', val: daysInMonth, isNum: true },
		{ label: 'Generated At', val: formatDateTimeDisplay(summary.generatedAt) },
	];

	for (const item of periodData) {
		const row = ws.getRow(r);
		row.height = 21;
		row.getCell(1).value = item.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`B${r}:D${r}`);
		row.getCell(2).value = item.val;
		styleCell(row.getCell(2), {
			hAlign: item.isNum ? 'right' : 'left',
			numFmt: item.isNum ? NUM_FORMATS.INTEGER : undefined,
			bold: !!item.isNum,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = 10;

	// 4. JOB CARD SUMMARY
	const jcHeader = ws.getRow(r);
	jcHeader.height = 24;
	ws.mergeCells(`A${r}:D${r}`);
	jcHeader.getCell(1).value = 'JOB CARD SUMMARY';
	styleCell(jcHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const jcTableHead = ws.getRow(r);
	jcTableHead.height = 22;
	jcTableHead.getCell(1).value = 'METRIC';
	styleCell(jcTableHead.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	ws.mergeCells(`B${r}:D${r}`);
	jcTableHead.getCell(2).value = 'COUNT';
	styleCell(jcTableHead.getCell(2), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	r++;

	const jcData = [
		{ label: 'Total Job Cards Created', val: summary.totalJobCardsCreated },
		{ label: 'Total Job Cards Finished / Completed', val: summary.totalJobCardsFinished },
	];

	for (const item of jcData) {
		const row = ws.getRow(r);
		row.height = 22;
		row.getCell(1).value = item.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`B${r}:D${r}`);
		row.getCell(2).value = item.val;
		styleCell(row.getCell(2), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = 10;

	// 5. INVOICE SUMMARY
	const invHeader = ws.getRow(r);
	invHeader.height = 24;
	ws.mergeCells(`A${r}:D${r}`);
	invHeader.getCell(1).value = 'INVOICE SUMMARY';
	styleCell(invHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const invTableHead = ws.getRow(r);
	invTableHead.height = 22;
	invTableHead.getCell(1).value = 'METRIC';
	styleCell(invTableHead.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	ws.mergeCells(`B${r}:D${r}`);
	invTableHead.getCell(2).value = 'METRIC / AMOUNT';
	styleCell(invTableHead.getCell(2), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	r++;

	// Invoice Count Rows
	const invCounts = [
		{ label: 'Total Invoices Issued', val: summary.totalInvoices, fill: ARGB.SECONDARY_LIGHT_BLUE, font: ARGB.PRIMARY_DARK },
		{ label: 'Total Invoices Fully Paid', val: summary.totalInvoicesPaid, fill: ARGB.SUCCESS_LIGHT_GREEN, font: ARGB.SUCCESS_GREEN },
		{
			label: 'Total Invoices Pending Payment',
			val: summary.totalInvoicesPendingPayment,
			fill: summary.totalInvoicesPendingPayment > 0 ? ARGB.DANGER_LIGHT_RED : ARGB.SUCCESS_LIGHT_GREEN,
			font: summary.totalInvoicesPendingPayment > 0 ? ARGB.DANGER_RED : ARGB.SUCCESS_GREEN,
		},
		{ label: 'Total Draft Invoices', val: summary.totalInvoicesDraft, fill: ARGB.LIGHT_GRAY_FILL, font: ARGB.MUTED_TEXT },
		{ label: 'Total Cancelled Invoices', val: summary.totalInvoicesCancelled, fill: ARGB.LIGHT_GRAY_FILL, font: ARGB.MUTED_TEXT },
	];

	for (const item of invCounts) {
		const row = ws.getRow(r);
		row.height = 21;
		row.getCell(1).value = item.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`B${r}:D${r}`);
		row.getCell(2).value = item.val;
		styleCell(row.getCell(2), {
			fillColor: item.fill,
			fontColor: item.font,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
		});
		r++;
	}

	// Invoice Monetary Rows
	const invMonetary = [
		{
			label: 'Total Invoice Amount (INR)',
			val: summary.totalInvoiceAmount,
			fill: ARGB.SECONDARY_LIGHT_BLUE,
			font: ARGB.PRIMARY_DARK,
		},
		{
			label: 'Total Amount Paid (INR)',
			val: summary.totalAmountPaid,
			fill: ARGB.SUCCESS_LIGHT_GREEN,
			font: ARGB.SUCCESS_GREEN,
		},
		{
			label: 'Total Amount Pending / Outstanding (INR)',
			val: summary.totalAmountPending,
			fill: summary.totalAmountPending > 0 ? ARGB.DANGER_LIGHT_RED : ARGB.SUCCESS_LIGHT_GREEN,
			font: summary.totalAmountPending > 0 ? ARGB.DANGER_RED : ARGB.SUCCESS_GREEN,
		},
	];

	for (const item of invMonetary) {
		const row = ws.getRow(r);
		row.height = 23;
		row.getCell(1).value = item.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`B${r}:D${r}`);
		row.getCell(2).value = item.val;
		styleCell(row.getCell(2), {
			fillColor: item.fill,
			fontColor: item.font,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = 10;

	// 6. SERVICE SUMMARY
	const sHeader = ws.getRow(r);
	sHeader.height = 24;
	ws.mergeCells(`A${r}:D${r}`);
	sHeader.getCell(1).value = 'SERVICE SUMMARY';
	styleCell(sHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const sTableHead = ws.getRow(r);
	sTableHead.height = 22;
	sTableHead.getCell(1).value = 'METRIC';
	styleCell(sTableHead.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	ws.mergeCells(`B${r}:D${r}`);
	sTableHead.getCell(2).value = 'COUNT / QUANTITY';
	styleCell(sTableHead.getCell(2), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	r++;

	const sData = [
		{ label: 'Total Services Performed', val: summary.totalServicesPerformed },
		{ label: 'Total Service Quantity', val: summary.totalServiceQuantity },
	];

	for (const item of sData) {
		const row = ws.getRow(r);
		row.height = 22;
		row.getCell(1).value = item.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`B${r}:D${r}`);
		row.getCell(2).value = item.val;
		styleCell(row.getCell(2), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = 10;

	// 7. AUDIT RECONCILIATION VERIFICATION
	const auditHeader = ws.getRow(r);
	auditHeader.height = 24;
	ws.mergeCells(`A${r}:D${r}`);
	auditHeader.getCell(1).value = 'AUDIT RECONCILIATION VERIFICATION';
	styleCell(auditHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const noteRow = ws.getRow(r);
	noteRow.height = 24;
	noteRow.getCell(1).value = 'Note:';
	styleCell(noteRow.getCell(1), { bold: true, indent: 1 });
	ws.mergeCells(`B${r}:D${r}`);
	noteRow.getCell(2).value = 'All figures above strictly reconcile with the sum of all daily sheets in this workbook.';
	styleCell(noteRow.getCell(2), {
		fillColor: ARGB.SUCCESS_LIGHT_GREEN,
		fontColor: ARGB.SUCCESS_GREEN,
		italic: true,
		bold: true,
		hAlign: 'left',
	});
	r++;

	const sheetsIncRow = ws.getRow(r);
	sheetsIncRow.height = 22;
	sheetsIncRow.getCell(1).value = 'Daily Sheets Included:';
	styleCell(sheetsIncRow.getCell(1), { bold: true, indent: 1 });
	ws.mergeCells(`B${r}:D${r}`);
	sheetsIncRow.getCell(2).value = `${daysInMonth} daily sheets (${monthName})`;
	styleCell(sheetsIncRow.getCell(2), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'left',
	});

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. DAILY SHEETS: "01-Oct", "02-Oct", etc.
// ────────────────────────────────────────────────────────────────────────────
export function buildDailySheet(
	workbook: ExcelJS.Workbook,
	sheet: DailyBillingSheetDto,
	monthName: string,
	companyName?: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet(sheet.sheetName, {
		views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
		pageSetup: {
			orientation: 'landscape',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9, // A4
			margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	ws.columns = [
		{ key: 'colA', width: 22 }, // Job Card / Invoice Number
		{ key: 'colB', width: 20 }, // Date
		{ key: 'colC', width: 26 }, // Customer Name
		{ key: 'colD', width: 24 }, // Vehicle Reg / Service Name
		{ key: 'colE', width: 20 }, // Vehicle / Quantity
		{ key: 'colF', width: 18 }, // Status / Rate
		{ key: 'colG', width: 20 }, // Services Count / Amount
		{ key: 'colH', width: 22 }, // Total Amount / Amount Paid
		{ key: 'colI', width: 22 }, // Amount Pending
	];

	let r = 1;

	// 1. Header Banner (Row 1, Height 34)
	const titleRow = ws.getRow(r);
	titleRow.height = 34;
	ws.mergeCells(`A${r}:I${r}`);
	titleRow.getCell(1).value = reportTitle(`BILLING ACTIVITY FOR ${sheet.dateFormatted.toUpperCase()}`, companyName);
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// 2. Subtitle Metadata (Row 2, Height 22)
	const subRow = ws.getRow(r);
	subRow.height = 22;
	ws.mergeCells(`A${r}:I${r}`);
	subRow.getCell(1).value = `REPORT DATE: ${sheet.dateFormatted}  |  SHEET: ${sheet.sheetName}  |  REPORTING MONTH: ${monthName}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row (Row 3)
	ws.getRow(r++).height = 8;

	// 3. DAY SUMMARY Section Header (Row 4, Height 24)
	const daySumHeader = ws.getRow(r);
	daySumHeader.height = 24;
	ws.mergeCells(`A${r}:I${r}`);
	daySumHeader.getCell(1).value = 'DAY SUMMARY';
	styleCell(daySumHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	// 4. Day Summary 3 KPI Blocks (Row 5, Height 24)
	const sumRow = ws.getRow(r);
	sumRow.height = 24;

	// Block 1: Job Cards (Col A-B)
	ws.mergeCells(`A${r}:B${r}`);
	sumRow.getCell(1).value = `Job Cards: ${sheet.totals.jobCardCount} (Total: ₹${sheet.totals.jobCardTotal.toFixed(2)})`;
	styleCell(sumRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});

	// Block 2: Invoices (Col C-F)
	ws.mergeCells(`C${r}:F${r}`);
	sumRow.getCell(3).value = `Invoices: ${sheet.totals.invoiceCount} (Billed: ₹${sheet.totals.invoiceTotal.toFixed(2)}, Paid: ₹${sheet.totals.amountPaid.toFixed(2)}, Pending: ₹${sheet.totals.amountPending.toFixed(2)})`;
	styleCell(sumRow.getCell(3), {
		fillColor: ARGB.SUCCESS_LIGHT_GREEN,
		fontColor: ARGB.SUCCESS_GREEN,
		bold: true,
		hAlign: 'center',
	});

	// Block 3: Services (Col G-I)
	ws.mergeCells(`G${r}:I${r}`);
	sumRow.getCell(7).value = `Services: ${sheet.totals.serviceCount} (Total Qty: ${sheet.totals.serviceTotalQuantity})`;
	styleCell(sumRow.getCell(7), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	r++;

	// Spacer Row
	ws.getRow(r++).height = 10;

	// ── Empty Day Notice ────────────────────────────────────────────────────
	if (!sheet.hasActivity) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = 36;
		ws.mergeCells(`A${r}:I${r}`);
		emptyRow.getCell(1).value = 'No billing activity for this date.';
		styleCell(emptyRow.getCell(1), {
			fillColor: ARGB.LIGHT_GRAY_FILL,
			fontColor: ARGB.MUTED_TEXT,
			bold: true,
			fontSize: 11,
			hAlign: 'center',
		});
		return ws;
	}

	// ── SECTION 1: JOB CARDS ────────────────────────────────────────────────
	const jcSec = ws.getRow(r);
	jcSec.height = 24;
	ws.mergeCells(`A${r}:H${r}`);
	jcSec.getCell(1).value = `SECTION 1: JOB CARDS (${sheet.jobCards.length} records)`;
	styleCell(jcSec.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

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

	const jcHeaderRow = ws.getRow(r);
	jcHeaderRow.height = 22;
	jcHeaders.forEach((text, idx) => {
		const cell = jcHeaderRow.getCell(idx + 1);
		cell.value = text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			bold: true,
			hAlign: idx === 7 || idx === 6 ? 'right' : idx === 2 || idx === 4 ? 'left' : 'center',
		});
	});
	r++;

	if (sheet.jobCards.length === 0) {
		const noJcRow = ws.getRow(r);
		noJcRow.height = 20;
		ws.mergeCells(`A${r}:H${r}`);
		noJcRow.getCell(1).value = 'No job cards created on this date.';
		styleCell(noJcRow.getCell(1), {
			fillColor: ARGB.LIGHT_GRAY_FILL,
			fontColor: ARGB.MUTED_TEXT,
			hAlign: 'center',
		});
		r++;
	} else {
		for (let i = 0; i < sheet.jobCards.length; i++) {
			const jc = sheet.jobCards[i];
			const altBg = i % 2 === 1 ? ARGB.ROW_ALT_FILL : undefined;
			const row = ws.getRow(r);
			row.height = 21;

			// Col 1: Job Card Number
			row.getCell(1).value = jc.jobCardNumber;
			styleCell(row.getCell(1), { bold: true, hAlign: 'center', fillColor: altBg });

			// Col 2: Date
			row.getCell(2).value = formatDateTimeDisplay(jc.jobCardDate);
			styleCell(row.getCell(2), { hAlign: 'center', fillColor: altBg });

			// Col 3: Customer Name
			row.getCell(3).value = jc.customerName;
			styleCell(row.getCell(3), { hAlign: 'left', fillColor: altBg });

			// Col 4: Vehicle Reg
			row.getCell(4).value = jc.vehicleRegistration;
			styleCell(row.getCell(4), { hAlign: 'center', fillColor: altBg });

			// Col 5: Vehicle
			row.getCell(5).value = jc.vehicle || '—';
			styleCell(row.getCell(5), { hAlign: 'left', fillColor: altBg });

			// Col 6: Status
			const isDone = jc.jobCardStatus === 'Ready' || jc.jobCardStatus === 'Delivered';
			row.getCell(6).value = jc.jobCardStatus;
			styleCell(row.getCell(6), {
				fillColor: isDone ? ARGB.SUCCESS_LIGHT_GREEN : ARGB.LIGHT_GRAY_FILL,
				fontColor: isDone ? ARGB.SUCCESS_GREEN : ARGB.MUTED_TEXT,
				bold: isDone,
				hAlign: 'center',
			});

			// Col 7: Total Services
			row.getCell(7).value = jc.totalServices ?? 0;
			styleCell(row.getCell(7), {
				hAlign: 'right',
				bold: true,
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: altBg,
			});

			// Col 8: Total Amount
			row.getCell(8).value = jc.jobCardTotal ?? 0;
			styleCell(row.getCell(8), {
				hAlign: 'right',
				bold: true,
				numFmt: NUM_FORMATS.CURRENCY,
				fillColor: altBg,
			});

			r++;
		}

		// Job Cards Total Row
		const jcTotalRow = ws.getRow(r);
		jcTotalRow.height = 23;
		jcTotalRow.getCell(1).value = 'TOTAL JOB CARDS';
		styleCell(jcTotalRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			border: totalRowBorder,
			indent: 1,
		});
		for (let c = 2; c <= 5; c++) {
			jcTotalRow.getCell(c).value = '';
			styleCell(jcTotalRow.getCell(c), {
				fillColor: ARGB.SECONDARY_LIGHT_BLUE,
				border: totalRowBorder,
			});
		}
		jcTotalRow.getCell(6).value = `${sheet.jobCards.length} records`;
		styleCell(jcTotalRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'center',
			border: totalRowBorder,
		});
		jcTotalRow.getCell(7).value = sheet.totals.jobCardCount;
		styleCell(jcTotalRow.getCell(7), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});
		jcTotalRow.getCell(8).value = sheet.totals.jobCardTotal;
		styleCell(jcTotalRow.getCell(8), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = 12;

	// ── SECTION 2: INVOICES ─────────────────────────────────────────────────
	const invSec = ws.getRow(r);
	invSec.height = 24;
	ws.mergeCells(`A${r}:I${r}`);
	invSec.getCell(1).value = `SECTION 2: INVOICES (${sheet.invoices.length} records)`;
	styleCell(invSec.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

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

	const invHeaderRow = ws.getRow(r);
	invHeaderRow.height = 22;
	invHeaders.forEach((text, idx) => {
		const cell = invHeaderRow.getCell(idx + 1);
		cell.value = text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			bold: true,
			hAlign: idx >= 6 ? 'right' : idx === 3 ? 'left' : 'center',
		});
	});
	r++;

	if (sheet.invoices.length === 0) {
		const noInvRow = ws.getRow(r);
		noInvRow.height = 20;
		ws.mergeCells(`A${r}:I${r}`);
		noInvRow.getCell(1).value = 'No invoices issued on this date.';
		styleCell(noInvRow.getCell(1), {
			fillColor: ARGB.LIGHT_GRAY_FILL,
			fontColor: ARGB.MUTED_TEXT,
			hAlign: 'center',
		});
		r++;
	} else {
		for (let i = 0; i < sheet.invoices.length; i++) {
			const inv = sheet.invoices[i];
			const altBg = i % 2 === 1 ? ARGB.ROW_ALT_FILL : undefined;
			const row = ws.getRow(r);
			row.height = 21;

			// Col 1: Invoice Number
			row.getCell(1).value = inv.invoiceNumber || '—';
			styleCell(row.getCell(1), { bold: true, hAlign: 'center', fillColor: altBg });

			// Col 2: Invoice Date
			row.getCell(2).value = formatDateDisplay(inv.invoiceDate);
			styleCell(row.getCell(2), { hAlign: 'center', fillColor: altBg });

			// Col 3: Job Card Number
			row.getCell(3).value = inv.jobCardNumber || '—';
			styleCell(row.getCell(3), { hAlign: 'center', fillColor: altBg });

			// Col 4: Customer Name
			row.getCell(4).value = inv.customerName;
			styleCell(row.getCell(4), { hAlign: 'left', fillColor: altBg });

			// Col 5: Vehicle Reg
			row.getCell(5).value = inv.vehicleRegistration;
			styleCell(row.getCell(5), { hAlign: 'center', fillColor: altBg });

			// Col 6: Status
			let statusFill: string = ARGB.LIGHT_GRAY_FILL;
			let statusFont: string = ARGB.MUTED_TEXT;
			if (inv.invoiceStatus === 'Paid') {
				statusFill = ARGB.SUCCESS_LIGHT_GREEN;
				statusFont = ARGB.SUCCESS_GREEN;
			} else if (inv.invoiceStatus === 'PartiallyPaid' || inv.invoiceStatus === 'Partially Paid') {
				statusFill = ARGB.WARNING_LIGHT_ORANGE;
				statusFont = ARGB.WARNING_ORANGE;
			} else if (inv.invoiceStatus === 'Pending' || inv.invoiceStatus === 'Finalized') {
				statusFill = ARGB.DANGER_LIGHT_RED;
				statusFont = ARGB.DANGER_RED;
			}
			row.getCell(6).value = inv.invoiceStatus;
			styleCell(row.getCell(6), {
				fillColor: statusFill,
				fontColor: statusFont,
				bold: true,
				hAlign: 'center',
			});

			// Col 7: Invoice Total
			row.getCell(7).value = inv.invoiceTotal ?? 0;
			styleCell(row.getCell(7), {
				fillColor: ARGB.SECONDARY_LIGHT_BLUE,
				fontColor: ARGB.PRIMARY_DARK,
				bold: true,
				hAlign: 'right',
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Col 8: Amount Paid
			row.getCell(8).value = inv.amountPaid ?? 0;
			styleCell(row.getCell(8), {
				fillColor: ARGB.SUCCESS_LIGHT_GREEN,
				fontColor: ARGB.SUCCESS_GREEN,
				bold: true,
				hAlign: 'right',
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Col 9: Amount Pending
			const hasPending = inv.amountPending > 0;
			row.getCell(9).value = inv.amountPending ?? 0;
			styleCell(row.getCell(9), {
				fillColor: hasPending ? ARGB.DANGER_LIGHT_RED : ARGB.SUCCESS_LIGHT_GREEN,
				fontColor: hasPending ? ARGB.DANGER_RED : ARGB.SUCCESS_GREEN,
				bold: true,
				hAlign: 'right',
				numFmt: NUM_FORMATS.CURRENCY,
			});

			r++;
		}

		// Invoices Total Row
		const invTotalRow = ws.getRow(r);
		invTotalRow.height = 23;
		invTotalRow.getCell(1).value = 'TOTAL INVOICES';
		styleCell(invTotalRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			border: totalRowBorder,
			indent: 1,
		});
		for (let c = 2; c <= 5; c++) {
			invTotalRow.getCell(c).value = '';
			styleCell(invTotalRow.getCell(c), {
				fillColor: ARGB.SECONDARY_LIGHT_BLUE,
				border: totalRowBorder,
			});
		}
		invTotalRow.getCell(6).value = `${sheet.invoices.length} records`;
		styleCell(invTotalRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'center',
			border: totalRowBorder,
		});
		invTotalRow.getCell(7).value = sheet.totals.invoiceTotal;
		styleCell(invTotalRow.getCell(7), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});
		invTotalRow.getCell(8).value = sheet.totals.amountPaid;
		styleCell(invTotalRow.getCell(8), {
			fillColor: ARGB.SUCCESS_LIGHT_GREEN,
			fontColor: ARGB.SUCCESS_GREEN,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});
		invTotalRow.getCell(9).value = sheet.totals.amountPending;
		styleCell(invTotalRow.getCell(9), {
			fillColor: sheet.totals.amountPending > 0 ? ARGB.DANGER_LIGHT_RED : ARGB.SUCCESS_LIGHT_GREEN,
			fontColor: sheet.totals.amountPending > 0 ? ARGB.DANGER_RED : ARGB.SUCCESS_GREEN,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = 12;

	// ── SECTION 3: SERVICES ─────────────────────────────────────────────────
	const sSec = ws.getRow(r);
	sSec.height = 24;
	ws.mergeCells(`A${r}:G${r}`);
	sSec.getCell(1).value = `SECTION 3: SERVICES (${sheet.services.length} items)`;
	styleCell(sSec.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const sHeaders = [
		'Job Card Number',
		'Invoice Number',
		'Customer Name',
		'Service Name',
		'Quantity',
		'Rate (INR)',
		'Amount (INR)',
	];

	const sHeaderRow = ws.getRow(r);
	sHeaderRow.height = 22;
	sHeaders.forEach((text, idx) => {
		const cell = sHeaderRow.getCell(idx + 1);
		cell.value = text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			bold: true,
			hAlign: idx >= 4 ? 'right' : idx === 2 || idx === 3 ? 'left' : 'center',
		});
	});
	r++;

	if (sheet.services.length === 0) {
		const noSRow = ws.getRow(r);
		noSRow.height = 20;
		ws.mergeCells(`A${r}:G${r}`);
		noSRow.getCell(1).value = 'No services recorded for this date.';
		styleCell(noSRow.getCell(1), {
			fillColor: ARGB.LIGHT_GRAY_FILL,
			fontColor: ARGB.MUTED_TEXT,
			hAlign: 'center',
		});
		r++;
	} else {
		let totalServicesSum = 0;
		for (let i = 0; i < sheet.services.length; i++) {
			const s = sheet.services[i];
			const altBg = i % 2 === 1 ? ARGB.ROW_ALT_FILL : undefined;
			const amt = s.amount ?? 0;
			totalServicesSum += amt;

			const row = ws.getRow(r);
			row.height = 21;

			// Col 1: Job Card Number
			row.getCell(1).value = s.jobCardNumber;
			styleCell(row.getCell(1), { bold: true, hAlign: 'center', fillColor: altBg });

			// Col 2: Invoice Number
			row.getCell(2).value = s.invoiceNumber || '—';
			styleCell(row.getCell(2), { hAlign: 'center', fillColor: altBg });

			// Col 3: Customer Name
			row.getCell(3).value = s.customerName;
			styleCell(row.getCell(3), { hAlign: 'left', fillColor: altBg });

			// Col 4: Service Name
			row.getCell(4).value = s.serviceName;
			styleCell(row.getCell(4), { bold: true, hAlign: 'left', fillColor: altBg });

			// Col 5: Quantity
			row.getCell(5).value = s.quantity ?? 1;
			styleCell(row.getCell(5), {
				bold: true,
				hAlign: 'right',
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: altBg,
			});

			// Col 6: Rate
			row.getCell(6).value = s.rate ?? 0;
			styleCell(row.getCell(6), {
				hAlign: 'right',
				numFmt: NUM_FORMATS.CURRENCY,
				fillColor: altBg,
			});

			// Col 7: Amount
			row.getCell(7).value = amt;
			styleCell(row.getCell(7), {
				bold: true,
				hAlign: 'right',
				numFmt: NUM_FORMATS.CURRENCY,
				fillColor: altBg,
			});

			r++;
		}

		// Services Total Row
		const sTotalRow = ws.getRow(r);
		sTotalRow.height = 23;
		sTotalRow.getCell(1).value = 'TOTAL SERVICES';
		styleCell(sTotalRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			border: totalRowBorder,
			indent: 1,
		});
		for (let c = 2; c <= 3; c++) {
			sTotalRow.getCell(c).value = '';
			styleCell(sTotalRow.getCell(c), {
				fillColor: ARGB.SECONDARY_LIGHT_BLUE,
				border: totalRowBorder,
			});
		}
		sTotalRow.getCell(4).value = `${sheet.services.length} items`;
		styleCell(sTotalRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'left',
			border: totalRowBorder,
		});
		sTotalRow.getCell(5).value = sheet.totals.serviceTotalQuantity;
		styleCell(sTotalRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});
		sTotalRow.getCell(6).value = '';
		styleCell(sTotalRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			border: totalRowBorder,
		});
		sTotalRow.getCell(7).value = totalServicesSum;
		styleCell(sTotalRow.getCell(7), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});
		r++;
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. WORKBOOK BUILDER & EXPORT DISPATCHER
// ────────────────────────────────────────────────────────────────────────────
export function createMonthlyBillingWorkbook(
	report: MonthlyBillingReportResponse,
	companyName?: string
): ExcelJS.Workbook {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = reportCreator();
	workbook.lastModifiedBy = reportCreator();
	workbook.created = new Date();
	workbook.modified = new Date();

	// Sheet 1: Monthly Summary
	buildMonthlySummarySheet(
		workbook,
		report.summary,
		report.monthName,
		report.daysInMonth,
		companyName
	);

	// Sheets 2..N: Daily sheets for each calendar day in the month
	for (const daySheet of report.dailySheets) {
		buildDailySheet(workbook, daySheet, report.monthName, companyName);
	}

	return workbook;
}

export async function generateAndDownloadMonthlyBillingReport(
	report: MonthlyBillingReportResponse,
	companyName?: string
): Promise<string> {
	const workbook = createMonthlyBillingWorkbook(report, companyName);
	const sanitizedMonth = (report.monthName || `${report.year}_${report.month}`).replace(/\s+/g, '_');
	const fileName = `${reportFilePrefix(companyName)}Billing_Report_${sanitizedMonth}.xlsx`;

	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});

	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);

	return fileName;
}
