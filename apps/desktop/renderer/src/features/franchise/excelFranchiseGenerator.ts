/**
 * Franchise Excel exports (ExcelJS), styled like the billing reports.
 *
 *   - Network summary workbook: "Network Summary" (totals and one row per company), "Daily Totals".
 *   - One company's totals workbook: "Summary" and "Daily Totals" (what a franchisor gets when the franchisee has
 *     allowed the financial totals but not the invoice list). With the invoice list allowed, the franchisor
 *     downloads the full monthly billing report instead (see excelMonthlyBillingGenerator).
 *
 * Only the figures the franchisees have allowed are ever passed in here.
 */

import ExcelJS from 'exceljs';
import type { FranchiseDashboardDto, FranchiseeFinancialsDto, FranchiseFinancialTotalsDto } from '../../lib/api';
import { reportCreator, reportFilePrefix, reportTitle } from '../../lib/documentBranding';
import { ARGB, NUM_FORMATS } from '../reports/excelMonthlyBillingGenerator';

const FONT_NAME = 'Calibri';

const thin: Partial<ExcelJS.Borders> = {
	top: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
	left: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
	bottom: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
	right: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
};

const totalBorder: Partial<ExcelJS.Borders> = {
	top: { style: 'thin', color: { argb: ARGB.PRIMARY_DARK } },
	left: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
	bottom: { style: 'double', color: { argb: ARGB.PRIMARY_DARK } },
	right: { style: 'thin', color: { argb: ARGB.BORDER_GRAY } },
};

function style(
	cell: ExcelJS.Cell,
	o: {
		fill?: string;
		color?: string;
		size?: number;
		bold?: boolean;
		italic?: boolean;
		h?: 'left' | 'center' | 'right';
		fmt?: string;
		border?: Partial<ExcelJS.Borders>;
		wrap?: boolean;
	},
) {
	if (o.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
	cell.font = { name: FONT_NAME, size: o.size ?? 10, bold: o.bold ?? false, italic: o.italic ?? false, color: { argb: o.color ?? ARGB.DARK_TEXT } };
	cell.alignment = { horizontal: o.h ?? 'left', vertical: 'middle', wrapText: o.wrap ?? false };
	if (o.fmt) cell.numFmt = o.fmt;
	cell.border = o.border ?? thin;
}

function newWorkbook() {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = reportCreator();
	workbook.lastModifiedBy = reportCreator();
	workbook.created = new Date();
	workbook.modified = new Date();
	return workbook;
}

function banner(ws: ExcelJS.Worksheet, lastColumn: string, title: string, subtitle: string) {
	ws.mergeCells(`A1:${lastColumn}1`);
	const t = ws.getRow(1);
	t.height = 34;
	t.getCell(1).value = title;
	style(t.getCell(1), { fill: ARGB.PRIMARY_DARK, color: ARGB.WHITE, size: 15, bold: true, h: 'center', border: {} });

	ws.mergeCells(`A2:${lastColumn}2`);
	const s = ws.getRow(2);
	s.height = 24;
	s.getCell(1).value = subtitle;
	style(s.getCell(1), { fill: ARGB.SECONDARY_LIGHT_BLUE, color: ARGB.PRIMARY_DARK, size: 11, bold: true, h: 'center', border: {} });
}

function headerRow(ws: ExcelJS.Worksheet, rowNumber: number, labels: string[]) {
	const row = ws.getRow(rowNumber);
	row.height = 22;
	labels.forEach((label, i) => {
		const cell = row.getCell(i + 1);
		cell.value = label;
		style(cell, { fill: ARGB.PRIMARY_BLUE, color: ARGB.WHITE, bold: true, h: i === 0 ? 'left' : 'right' });
	});
}

function sectionHeader(ws: ExcelJS.Worksheet, rowNumber: number, lastColumn: string, label: string) {
	ws.mergeCells(`A${rowNumber}:${lastColumn}${rowNumber}`);
	const row = ws.getRow(rowNumber);
	row.height = 24;
	row.getCell(1).value = label;
	style(row.getCell(1), { fill: ARGB.PRIMARY_DARK, color: ARGB.WHITE, size: 11, bold: true, border: {} });
}

function periodText(from: string, to: string) {
	return `PERIOD: ${from} TO ${to}`;
}

/** KPI rows (label / value) used on both summary sheets. */
function kpiRows(ws: ExcelJS.Worksheet, startRow: number, totals: FranchiseFinancialTotalsDto): number {
	const rows: [string, number, string, string?][] = [
		['Total invoiced', totals.invoicedAmount, NUM_FORMATS.CURRENCY, ARGB.SECONDARY_LIGHT_BLUE],
		['Total collected', totals.collectedAmount, NUM_FORMATS.CURRENCY, ARGB.SUCCESS_LIGHT_GREEN],
		['Outstanding', totals.outstandingAmount, NUM_FORMATS.CURRENCY, totals.outstandingAmount > 0 ? ARGB.DANGER_LIGHT_RED : undefined],
		['Invoices', totals.invoiceCount, NUM_FORMATS.INTEGER],
		['Job cards', totals.jobCardCount, NUM_FORMATS.INTEGER],
	];
	let r = startRow;
	for (const [label, value, fmt, fill] of rows) {
		const row = ws.getRow(r);
		row.height = 20;
		row.getCell(1).value = label;
		style(row.getCell(1), { bold: true, fill: ARGB.LIGHT_GRAY_FILL });
		row.getCell(2).value = value;
		style(row.getCell(2), { fmt, h: 'right', bold: true, fill });
		r += 1;
	}
	return r;
}

function dailySheet(workbook: ExcelJS.Workbook, totals: FranchiseFinancialTotalsDto, title: string, subtitle: string) {
	const ws = workbook.addWorksheet('Daily Totals', { views: [{ state: 'frozen', ySplit: 4, showGridLines: true }] });
	ws.columns = [{ width: 16 }, { width: 20 }, { width: 20 }];
	banner(ws, 'C', title, subtitle);
	headerRow(ws, 4, ['Date', 'Invoiced', 'Collected']);

	let r = 5;
	if (totals.daily.length === 0) {
		ws.mergeCells(`A${r}:C${r}`);
		ws.getRow(r).getCell(1).value = 'No invoices or payments in this period.';
		style(ws.getRow(r).getCell(1), { italic: true, color: ARGB.MUTED_TEXT, h: 'center' });
		return ws;
	}
	for (const d of totals.daily) {
		const row = ws.getRow(r);
		row.getCell(1).value = d.date;
		style(row.getCell(1), {});
		row.getCell(2).value = d.invoiced;
		style(row.getCell(2), { fmt: NUM_FORMATS.CURRENCY, h: 'right' });
		row.getCell(3).value = d.collected;
		style(row.getCell(3), { fmt: NUM_FORMATS.CURRENCY, h: 'right' });
		r += 1;
	}
	const total = ws.getRow(r);
	total.height = 22;
	total.getCell(1).value = 'TOTAL';
	style(total.getCell(1), { bold: true, fill: ARGB.SECONDARY_LIGHT_BLUE, border: totalBorder });
	total.getCell(2).value = { formula: `SUM(B5:B${r - 1})`, result: totals.invoicedAmount };
	style(total.getCell(2), { bold: true, fill: ARGB.SECONDARY_LIGHT_BLUE, fmt: NUM_FORMATS.CURRENCY, h: 'right', border: totalBorder });
	total.getCell(3).value = { formula: `SUM(C5:C${r - 1})`, result: totals.collectedAmount };
	style(total.getCell(3), { bold: true, fill: ARGB.SECONDARY_LIGHT_BLUE, fmt: NUM_FORMATS.CURRENCY, h: 'right', border: totalBorder });
	return ws;
}

/** All franchisees together: totals, one row per company, and the daily totals. */
export function createNetworkSummaryWorkbook(dashboard: FranchiseDashboardDto): ExcelJS.Workbook {
	const workbook = newWorkbook();
	const sharing = dashboard.franchisees.filter((f) => f.totals !== null);
	const notSharing = dashboard.franchisees.filter((f) => f.totals === null);
	const title = reportTitle('FRANCHISE NETWORK SUMMARY');
	const subtitle = periodText(dashboard.from, dashboard.to);

	const ws = workbook.addWorksheet('Network Summary', { views: [{ showGridLines: true }] });
	ws.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 14 }];
	banner(ws, 'F', title, subtitle);

	sectionHeader(ws, 4, 'F', `NETWORK TOTAL (${sharing.length} ${sharing.length === 1 ? 'COMPANY' : 'COMPANIES'})`);
	let r = kpiRows(ws, 5, dashboard.network) + 1;

	sectionHeader(ws, r, 'F', 'BY COMPANY');
	r += 1;
	headerRow(ws, r, ['Company', 'Invoiced', 'Collected', 'Outstanding', 'Invoices', 'Job cards']);
	const first = r + 1;
	r += 1;
	for (const f of sharing) {
		const t = f.totals!;
		const row = ws.getRow(r);
		row.getCell(1).value = `${f.partnerName} (${f.partnerCodeHint})`;
		style(row.getCell(1), { bold: true });
		[t.invoicedAmount, t.collectedAmount, t.outstandingAmount].forEach((v, i) => {
			row.getCell(i + 2).value = v;
			style(row.getCell(i + 2), { fmt: NUM_FORMATS.CURRENCY, h: 'right' });
		});
		[t.invoiceCount, t.jobCardCount].forEach((v, i) => {
			row.getCell(i + 5).value = v;
			style(row.getCell(i + 5), { fmt: NUM_FORMATS.INTEGER, h: 'right' });
		});
		r += 1;
	}
	if (sharing.length > 0) {
		const total = ws.getRow(r);
		total.height = 22;
		total.getCell(1).value = 'TOTAL';
		style(total.getCell(1), { bold: true, fill: ARGB.SECONDARY_LIGHT_BLUE, border: totalBorder });
		const n = dashboard.network;
		const sums: [number, number, string][] = [
			[2, n.invoicedAmount, NUM_FORMATS.CURRENCY],
			[3, n.collectedAmount, NUM_FORMATS.CURRENCY],
			[4, n.outstandingAmount, NUM_FORMATS.CURRENCY],
			[5, n.invoiceCount, NUM_FORMATS.INTEGER],
			[6, n.jobCardCount, NUM_FORMATS.INTEGER],
		];
		for (const [col, result, fmt] of sums) {
			const letter = String.fromCharCode(64 + col);
			total.getCell(col).value = { formula: `SUM(${letter}${first}:${letter}${r - 1})`, result };
			style(total.getCell(col), { bold: true, fill: ARGB.SECONDARY_LIGHT_BLUE, fmt, h: 'right', border: totalBorder });
		}
		r += 2;
	}

	if (notSharing.length > 0) {
		sectionHeader(ws, r, 'F', 'NOT SHARED WITH YOU');
		r += 1;
		for (const f of notSharing) {
			ws.mergeCells(`A${r}:F${r}`);
			ws.getRow(r).getCell(1).value = `${f.partnerName} (${f.partnerCodeHint}) has not allowed the financial totals.`;
			style(ws.getRow(r).getCell(1), { italic: true, color: ARGB.MUTED_TEXT });
			r += 1;
		}
	}

	dailySheet(workbook, dashboard.network, title, subtitle);
	return workbook;
}

/** One franchisee's totals (when only the financial totals are allowed): summary and daily totals. */
export function createCompanyTotalsWorkbook(company: FranchiseeFinancialsDto, from: string, to: string): ExcelJS.Workbook {
	if (!company.totals) {
		throw new Error(`${company.partnerName} has not allowed the financial totals.`);
	}
	const workbook = newWorkbook();
	const title = reportTitle('FINANCIAL TOTALS', company.partnerName);
	const subtitle = periodText(from, to);

	const ws = workbook.addWorksheet('Summary', { views: [{ showGridLines: true }] });
	ws.columns = [{ width: 30 }, { width: 22 }];
	banner(ws, 'B', title, subtitle);
	sectionHeader(ws, 4, 'B', 'TOTALS FOR THE PERIOD');
	kpiRows(ws, 5, company.totals);

	dailySheet(workbook, company.totals, title, subtitle);
	return workbook;
}

async function download(workbook: ExcelJS.Workbook, fileName: string) {
	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

export function downloadNetworkSummary(dashboard: FranchiseDashboardDto) {
	return download(
		createNetworkSummaryWorkbook(dashboard),
		`${reportFilePrefix()}Franchise_Network_Summary_${dashboard.from}_to_${dashboard.to}.xlsx`,
	);
}

export function downloadCompanyTotals(company: FranchiseeFinancialsDto, from: string, to: string) {
	return download(
		createCompanyTotalsWorkbook(company, from, to),
		`${reportFilePrefix(company.partnerName)}Financial_Totals_${from}_to_${to}.xlsx`,
	);
}
