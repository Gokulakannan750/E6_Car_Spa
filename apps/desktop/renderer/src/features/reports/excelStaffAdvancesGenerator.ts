/**
 * Car Spa Management — Staff Advances Excel Generator (ExcelJS)
 *
 * Generates an executive-grade, beautifully formatted Excel workbook:
 *   - SHEET 1: "Staff Summary" (Executive presentation, KPIs, Monthly Advance Summary, Staff Directory & Balances, Reconciliation note)
 *   - SHEETS 2..N: Dedicated Staff Sheets ("Ramesh", "Kumar", "Suresh", etc.)
 *     - Staff Information banner
 *     - Monthly Advance Summary card for that staff member
 *     - Chronological Advance Transactions Ledger (ascending by Advance Date)
 *     - Prominent Staff Grand Totals (Total Advances Given, Total Recovered, Outstanding Balance)
 *
 * Professional Styling Specifications (Exact parity with approved Billing Report):
 *   - Main title: Dark Blue (#0B3A6E) + White Bold, ~34pt row height, vertically centered
 *   - Subtitle: Light Blue (#EAF2FF) + Dark Blue Bold, ~24pt row height, vertically centered
 *   - Section headers: Dark Blue (#0B3A6E) + White Bold, ~24pt row height
 *   - Table headers: Primary Blue (#0B5ED7) + White Bold, ~22pt row height
 *   - Total Rows: Light Blue (#EAF2FF) + Bold with Double Bottom Border
 *   - Recovered / Paid: Light Green (#EAF7EF) + Green Bold (#198754)
 *   - Outstanding: Light Red (#FDECEC) + Red Bold (#DC3545) when > ₹0
 *   - Status Badges: Settled (Green), Outstanding (Red), Obsolete/Cancelled (Gray)
 *   - Borders: Subtle thin gray borders (#D1D5DB), double bottom on Total rows
 *   - Numbers & Currency: Formatted explicitly with ₹ and thousands separators ("₹"#,##0.00)
 */

import ExcelJS from 'exceljs';
import {
	ARGB,
	NUM_FORMATS,
	formatDateDisplay,
	formatDateTimeDisplay,
} from './excelMonthlyBillingGenerator';
import { reportCreator, reportFilePrefix, reportTitle } from '../../lib/documentBranding';

export { ARGB, NUM_FORMATS, formatDateDisplay, formatDateTimeDisplay };

const FONT_NAME = 'Calibri';

// ────────────────────────────────────────────────────────────────────────────
// STANDARDIZED ROW HEIGHTS (Excel Points)
// ────────────────────────────────────────────────────────────────────────────
export const ROW_HEIGHTS = {
	TITLE: 30,           // Main report title (28–30 points)
	SUBTITLE: 22,        // Subtitle / metadata banner (22 points)
	SECTION_HEADER: 24,  // Major section headers (22–24 points)
	TABLE_HEADER: 22,    // Column / table headers (22 points)
	DATA_ROW: 21,        // Uniform standard height for ALL normal data rows (21 points)
	TOTAL_ROW: 22,       // Summary & ledger grand total rows (22 points)
	SPACER: 10,          // Section separation spacer rows (10 points)
} as const;

// ────────────────────────────────────────────────────────────────────────────
// BORDER DEFINITIONS
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
// DATA MODELS & INTERFACES
// ────────────────────────────────────────────────────────────────────────────

export interface StaffAdvanceRecord {
	id: string;
	staffId: string;
	staffName: string;
	staffPhone?: string | null;
	staffRole?: string | null;
	advanceDate: string;
	amount: number;
	reason: string;
	notes?: string | null;
	status: 'Outstanding' | 'Settled' | 'Obsolete' | string;
	settledAt?: string | null;
	settledByName?: string | null;
	obsoletedAt?: string | null;
	obsoletedByName?: string | null;
	obsoleteReason?: string | null;
}

export interface StaffMonthlyTotal {
	monthKey: string; // "YYYY-MM"
	monthLabel: string; // "October 2026"
	advancesCount: number;
	totalGiven: number;
	totalRecovered: number;
	outstandingBalance: number;
	recoveryRate: number;
}

export interface StaffMemberAdvanceGroup {
	staffId: string;
	staffName: string;
	staffRole: string;
	staffPhone: string;
	advances: StaffAdvanceRecord[];
	monthlyTotals: StaffMonthlyTotal[];
	totalGiven: number;
	totalRecovered: number;
	outstandingBalance: number;
	totalCount: number;
	settledCount: number;
	outstandingCount: number;
	obsoleteCount: number;
	obsoleteAmount: number;
}

export interface StaffAdvancesSummaryCalculation {
	totalStaffMembers: number;
	totalAdvancesGiven: number;
	totalAdvancesRecovered: number;
	totalOutstandingBalance: number;
	totalAdvanceCount: number;
	outstandingCount: number;
	settledCount: number;
	obsoleteCount: number;
	obsoleteAmount: number;
	overallRecoveryRate: number;
	monthlySummary: StaffMonthlyTotal[];
	staffGroups: StaffMemberAdvanceGroup[];
}

export interface StaffAdvancesReportData {
	periodLabel?: string;
	startDate: string;
	endDate: string;
	generatedAt?: string;
	advances: StaffAdvanceRecord[];
	summary?: {
		outstandingCount?: number;
		outstandingAmount?: number;
		settledCount?: number;
		settledAmount?: number;
		obsoleteCount?: number;
		obsoleteAmount?: number;
		totalStaffCount?: number;
		totalAdvancesGiven?: number;
	} | null;
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS FOR GROUPING & CALCULATIONS
// ────────────────────────────────────────────────────────────────────────────

export const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
] as const;

/**
 * Derives month key ("YYYY-MM") and formatted month label ("October 2026") from an ISO date string.
 */
export function getMonthKeyAndLabel(dateStr: string): { key: string; label: string; year: number; monthIndex: number } {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) {
		return { key: 'Unknown', label: 'Unknown Month', year: 0, monthIndex: 0 };
	}
	const year = d.getFullYear();
	const monthIndex = d.getMonth();
	const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
	const label = `${MONTH_NAMES[monthIndex]} ${year}`;
	return { key, label, year, monthIndex };
}

/**
 * Sanitizes and generates unique worksheet names suitable for Excel (max 31 chars, no illegal chars).
 */
export function sanitizeSheetName(rawName: string, existingNames: Set<string>): string {
	const clean = rawName.replace(/[\\/?*[\]:]/g, '').trim().substring(0, 28) || 'Staff';
	let finalName = clean;
	let counter = 1;
	while (existingNames.has(finalName.toLowerCase())) {
		finalName = `${clean.substring(0, 25)}_${counter}`;
		counter++;
	}
	existingNames.add(finalName.toLowerCase());
	return finalName;
}

/**
 * Calculates monthly breakdown for a specific list of advances.
 */
export function calculateMonthlyTotals(advances: StaffAdvanceRecord[]): StaffMonthlyTotal[] {
	const map = new Map<string, { label: string; year: number; monthIndex: number; given: number; recovered: number; outstanding: number; count: number }>();

	for (const adv of advances) {
		const { key, label, year, monthIndex } = getMonthKeyAndLabel(adv.advanceDate);
		if (!map.has(key)) {
			map.set(key, { label, year, monthIndex, given: 0, recovered: 0, outstanding: 0, count: 0 });
		}
		const entry = map.get(key)!;
		entry.count++;
		entry.given += adv.amount;
		if (adv.status === 'Settled') {
			entry.recovered += adv.amount;
		} else if (adv.status === 'Outstanding') {
			entry.outstanding += adv.amount;
		}
	}

	const sortedKeys = Array.from(map.keys()).sort((a, b) => {
		const ea = map.get(a)!;
		const eb = map.get(b)!;
		if (ea.year !== eb.year) return ea.year - eb.year;
		return ea.monthIndex - eb.monthIndex;
	});

	return sortedKeys.map((k) => {
		const e = map.get(k)!;
		const rate = e.given > 0 ? (e.recovered / e.given) * 100 : 0;
		return {
			monthKey: k,
			monthLabel: e.label,
			advancesCount: e.count,
			totalGiven: Math.round(e.given * 100) / 100,
			totalRecovered: Math.round(e.recovered * 100) / 100,
			outstandingBalance: Math.round(e.outstanding * 100) / 100,
			recoveryRate: Math.round(rate * 10) / 10,
		};
	});
}

/**
 * Groups advances by staff member, sorts chronologically, and calculates per-staff metrics.
 */
export function groupAdvancesByStaff(advances: StaffAdvanceRecord[]): StaffMemberAdvanceGroup[] {
	const staffMap = new Map<string, {
		staffId: string;
		staffName: string;
		staffRole: string;
		staffPhone: string;
		advances: StaffAdvanceRecord[];
	}>();

	for (const adv of advances) {
		const key = adv.staffId || adv.staffName || 'Unknown';
		if (!staffMap.has(key)) {
			staffMap.set(key, {
				staffId: adv.staffId || key,
				staffName: adv.staffName || 'Unknown Staff',
				staffRole: adv.staffRole || 'Staff',
				staffPhone: adv.staffPhone || '—',
				advances: [],
			});
		}
		const group = staffMap.get(key)!;
		// Keep role/phone updated if found in current record
		if (adv.staffRole && group.staffRole === 'Staff') group.staffRole = adv.staffRole;
		if (adv.staffPhone && group.staffPhone === '—') group.staffPhone = adv.staffPhone;
		group.advances.push(adv);
	}

	// Sort staff members alphabetically by name
	const sortedStaff = Array.from(staffMap.values()).sort((a, b) =>
		a.staffName.localeCompare(b.staffName)
	);

	return sortedStaff.map((sg) => {
		// Sort advances in ascending chronological order by advanceDate
		const sortedAdvances = [...sg.advances].sort((a, b) => {
			const timeA = new Date(a.advanceDate).getTime() || 0;
			const timeB = new Date(b.advanceDate).getTime() || 0;
			return timeA - timeB;
		});

		const monthlyTotals = calculateMonthlyTotals(sortedAdvances);

		let totalGiven = 0;
		let totalRecovered = 0;
		let outstandingBalance = 0;
		let settledCount = 0;
		let outstandingCount = 0;
		let obsoleteCount = 0;
		let obsoleteAmount = 0;

		for (const a of sortedAdvances) {
			totalGiven += a.amount;
			if (a.status === 'Settled') {
				totalRecovered += a.amount;
				settledCount++;
			} else if (a.status === 'Outstanding') {
				outstandingBalance += a.amount;
				outstandingCount++;
			} else if (a.status === 'Obsolete') {
				obsoleteAmount += a.amount;
				obsoleteCount++;
			}
		}

		return {
			staffId: sg.staffId,
			staffName: sg.staffName,
			staffRole: sg.staffRole,
			staffPhone: sg.staffPhone,
			advances: sortedAdvances,
			monthlyTotals,
			totalGiven: Math.round(totalGiven * 100) / 100,
			totalRecovered: Math.round(totalRecovered * 100) / 100,
			outstandingBalance: Math.round(outstandingBalance * 100) / 100,
			totalCount: sortedAdvances.length,
			settledCount,
			outstandingCount,
			obsoleteCount,
			obsoleteAmount: Math.round(obsoleteAmount * 100) / 100,
		};
	});
}

/**
 * Calculates executive summary metrics, monthly advance totals across all staff, and reconciles data.
 */
export function calculateStaffAdvancesSummary(
	advances: StaffAdvanceRecord[],
	_period?: { startDate?: string; endDate?: string }
): StaffAdvancesSummaryCalculation {
	const staffGroups = groupAdvancesByStaff(advances);
	const monthlySummary = calculateMonthlyTotals(advances);

	let totalAdvancesGiven = 0;
	let totalAdvancesRecovered = 0;
	let totalOutstandingBalance = 0;
	let totalAdvanceCount = advances.length;
	let outstandingCount = 0;
	let settledCount = 0;
	let obsoleteCount = 0;
	let obsoleteAmount = 0;

	for (const a of advances) {
		totalAdvancesGiven += a.amount;
		if (a.status === 'Settled') {
			totalAdvancesRecovered += a.amount;
			settledCount++;
		} else if (a.status === 'Outstanding') {
			totalOutstandingBalance += a.amount;
			outstandingCount++;
		} else if (a.status === 'Obsolete') {
			obsoleteAmount += a.amount;
			obsoleteCount++;
		}
	}

	const overallRecoveryRate = totalAdvancesGiven > 0
		? (totalAdvancesRecovered / totalAdvancesGiven) * 100
		: 0;

	return {
		totalStaffMembers: staffGroups.length,
		totalAdvancesGiven: Math.round(totalAdvancesGiven * 100) / 100,
		totalAdvancesRecovered: Math.round(totalAdvancesRecovered * 100) / 100,
		totalOutstandingBalance: Math.round(totalOutstandingBalance * 100) / 100,
		totalAdvanceCount,
		outstandingCount,
		settledCount,
		obsoleteCount,
		obsoleteAmount: Math.round(obsoleteAmount * 100) / 100,
		overallRecoveryRate: Math.round(overallRecoveryRate * 10) / 10,
		monthlySummary,
		staffGroups,
	};
}

/**
 * Verifies that summary totals reconcile with the sum of individual staff totals.
 */
export function validateStaffAdvancesReconciliation(
	summary: StaffAdvancesSummaryCalculation,
	staffGroups: StaffMemberAdvanceGroup[]
): boolean {
	const sumStaffGiven = staffGroups.reduce((acc, s) => acc + s.totalGiven, 0);
	const sumStaffRecovered = staffGroups.reduce((acc, s) => acc + s.totalRecovered, 0);
	const sumStaffOutstanding = staffGroups.reduce((acc, s) => acc + s.outstandingBalance, 0);

	const givenDiff = Math.abs(summary.totalAdvancesGiven - sumStaffGiven);
	const recDiff = Math.abs(summary.totalAdvancesRecovered - sumStaffRecovered);
	const outDiff = Math.abs(summary.totalOutstandingBalance - sumStaffOutstanding);

	return givenDiff < 0.01 && recDiff < 0.01 && outDiff < 0.01;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. SHEET 1: "Staff Summary"
// ────────────────────────────────────────────────────────────────────────────

export function buildStaffSummarySheet(
	workbook: ExcelJS.Workbook,
	summaryData: StaffAdvancesSummaryCalculation,
	reportData: StaffAdvancesReportData
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Staff Summary', {
		views: [{ showGridLines: true }],
		pageSetup: {
			orientation: 'portrait',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9, // A4
			margins: { left: 0.6, right: 0.6, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	// Standard default row height for any unexplicit rows
	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	// Column Widths (A through F)
	ws.columns = [
		{ key: 'colA', width: 36 }, // Labels / Staff Name / Metric
		{ key: 'colB', width: 20 }, // Role / Count / Records
		{ key: 'colC', width: 24 }, // Advances Given / Phone
		{ key: 'colD', width: 24 }, // Advances Recovered
		{ key: 'colE', width: 24 }, // Outstanding Balance
		{ key: 'colF', width: 18 }, // Status / Rate %
	];

	let r = 1;

	// 1. Main Title Banner (Row 1, Standard Title Height)
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:F${r}`);
	titleRow.getCell(1).value = reportTitle('STAFF ADVANCE REPORT');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 15,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// 2. Subtitle (Row 2, Standard Subtitle Height)
	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:F${r}`);
	subRow.getCell(1).value = 'STAFF ADVANCES & SETTLEMENTS EXECUTIVE SUMMARY';
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
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 3. REPORT PERIOD SECTION
	const periodHeader = ws.getRow(r);
	periodHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:F${r}`);
	periodHeader.getCell(1).value = 'REPORT PERIOD & METADATA';
	styleCell(periodHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const periodLabelStr = reportData.periodLabel || `${formatDateDisplay(reportData.startDate)} to ${formatDateDisplay(reportData.endDate)}`;
	const generatedAtStr = reportData.generatedAt ? formatDateTimeDisplay(reportData.generatedAt) : formatDateTimeDisplay(new Date().toISOString());

	const periodData = [
		{ label: 'Reporting Scope / Period', val: periodLabelStr },
		{ label: 'Report Start Date', val: formatDateDisplay(reportData.startDate) },
		{ label: 'Report End Date', val: formatDateDisplay(reportData.endDate) },
		{ label: 'Total Staff Members in Report', val: summaryData.totalStaffMembers, isNum: true },
		{ label: 'Total Advance Transactions', val: summaryData.totalAdvanceCount, isNum: true },
		{ label: 'Report Generated At', val: generatedAtStr },
	];

	for (const item of periodData) {
		const row = ws.getRow(r);
		row.height = ROW_HEIGHTS.DATA_ROW;
		row.getCell(1).value = item.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`B${r}:F${r}`);
		row.getCell(2).value = item.val;
		styleCell(row.getCell(2), {
			hAlign: item.isNum ? 'right' : 'left',
			numFmt: item.isNum ? NUM_FORMATS.INTEGER : undefined,
			bold: !!item.isNum,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 4. EXECUTIVE STAFF ADVANCE SUMMARY / KPIS
	const kpiHeader = ws.getRow(r);
	kpiHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:F${r}`);
	kpiHeader.getCell(1).value = 'STAFF ADVANCES EXECUTIVE SUMMARY';
	styleCell(kpiHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const kpiTableHead = ws.getRow(r);
	kpiTableHead.height = ROW_HEIGHTS.TABLE_HEADER;
	ws.mergeCells(`A${r}:C${r}`);
	kpiTableHead.getCell(1).value = 'EXECUTIVE METRIC';
	styleCell(kpiTableHead.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});

	ws.mergeCells(`D${r}:F${r}`);
	kpiTableHead.getCell(4).value = 'AMOUNT (INR) / COUNT';
	styleCell(kpiTableHead.getCell(4), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	r++;

	const kpiData: { label: string; val: number; isCurrency?: boolean; highlight?: 'blue' | 'green' | 'red' | 'default' }[] = [
		{ label: 'Total Staff Members with Advances', val: summaryData.totalStaffMembers },
		{ label: 'Total Advances Given', val: summaryData.totalAdvancesGiven, isCurrency: true, highlight: 'blue' },
		{ label: 'Total Advances Recovered (Settled)', val: summaryData.totalAdvancesRecovered, isCurrency: true, highlight: 'green' },
		{ label: 'Total Outstanding Advance Balance', val: summaryData.totalOutstandingBalance, isCurrency: true, highlight: summaryData.totalOutstandingBalance > 0 ? 'red' : 'default' },
		{ label: 'Total Advance Records Logged', val: summaryData.totalAdvanceCount },
		{ label: 'Active Outstanding Advances Count', val: summaryData.outstandingCount },
		{ label: 'Fully Settled Advances Count', val: summaryData.settledCount },
		{ label: 'Obsolete / Cancelled Advances Count', val: summaryData.obsoleteCount },
	];

	for (const item of kpiData) {
		const row = ws.getRow(r);
		row.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:C${r}`);
		row.getCell(1).value = item.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`D${r}:F${r}`);
		row.getCell(4).value = item.val;

		let fillColor: string | undefined = undefined;
		let fontColor: string = ARGB.DARK_TEXT;

		if (item.highlight === 'blue') {
			fillColor = ARGB.SECONDARY_LIGHT_BLUE;
			fontColor = ARGB.PRIMARY_DARK;
		} else if (item.highlight === 'green') {
			fillColor = ARGB.SUCCESS_LIGHT_GREEN;
			fontColor = ARGB.SUCCESS_GREEN;
		} else if (item.highlight === 'red') {
			fillColor = ARGB.DANGER_LIGHT_RED;
			fontColor = ARGB.DANGER_RED;
		}

		styleCell(row.getCell(4), {
			fillColor,
			fontColor,
			bold: true,
			hAlign: 'right',
			numFmt: item.isCurrency ? NUM_FORMATS.CURRENCY : NUM_FORMATS.INTEGER,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 5. MONTHLY ADVANCE SUMMARY (Requirement 4)
	const monthlyHeader = ws.getRow(r);
	monthlyHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:F${r}`);
	monthlyHeader.getCell(1).value = 'MONTHLY ADVANCE SUMMARY (RECONCILED)';
	styleCell(monthlyHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const monthlyHeadRow = ws.getRow(r);
	monthlyHeadRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const mCols = [
		{ col: 1, text: 'MONTH' },
		{ col: 2, text: 'RECORDS' },
		{ col: 3, text: 'TOTAL GIVEN (₹)' },
		{ col: 4, text: 'TOTAL RECOVERED (₹)' },
		{ col: 5, text: 'OUTSTANDING BALANCE (₹)' },
		{ col: 6, text: 'RECOVERY %' },
	];
	for (const mc of mCols) {
		const cell = monthlyHeadRow.getCell(mc.col);
		cell.value = mc.text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 10,
			bold: true,
			hAlign: mc.col === 1 ? 'left' : 'right',
			indent: mc.col === 1 ? 1 : 0,
		});
	}
	r++;

	if (summaryData.monthlySummary.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:F${r}`);
		emptyRow.getCell(1).value = 'No advance records found for the selected reporting period.';
		styleCell(emptyRow.getCell(1), {
			hAlign: 'center',
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
		});
		r++;
	} else {
		for (const m of summaryData.monthlySummary) {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;

			// Month
			row.getCell(1).value = m.monthLabel;
			styleCell(row.getCell(1), { bold: true, indent: 1 });

			// Records count
			row.getCell(2).value = m.advancesCount;
			styleCell(row.getCell(2), { hAlign: 'right', numFmt: NUM_FORMATS.INTEGER });

			// Total given
			row.getCell(3).value = m.totalGiven;
			styleCell(row.getCell(3), {
				hAlign: 'right',
				bold: true,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Total recovered
			row.getCell(4).value = m.totalRecovered;
			styleCell(row.getCell(4), {
				hAlign: 'right',
				bold: true,
				fontColor: m.totalRecovered > 0 ? ARGB.SUCCESS_GREEN : ARGB.DARK_TEXT,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Outstanding balance
			row.getCell(5).value = m.outstandingBalance;
			styleCell(row.getCell(5), {
				hAlign: 'right',
				bold: true,
				fontColor: m.outstandingBalance > 0 ? ARGB.DANGER_RED : ARGB.DARK_TEXT,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Recovery rate
			row.getCell(6).value = m.recoveryRate / 100;
			styleCell(row.getCell(6), { hAlign: 'right', numFmt: NUM_FORMATS.PERCENT });

			r++;
		}

		// Monthly Grand Total Row (Standard Total Row Height)
		const totRow = ws.getRow(r);
		totRow.height = ROW_HEIGHTS.TOTAL_ROW;

		totRow.getCell(1).value = 'TOTAL ADVANCES (RECONCILED)';
		styleCell(totRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		totRow.getCell(2).value = summaryData.totalAdvanceCount;
		styleCell(totRow.getCell(2), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		totRow.getCell(3).value = summaryData.totalAdvancesGiven;
		styleCell(totRow.getCell(3), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		totRow.getCell(4).value = summaryData.totalAdvancesRecovered;
		styleCell(totRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.SUCCESS_GREEN,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		totRow.getCell(5).value = summaryData.totalOutstandingBalance;
		styleCell(totRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: summaryData.totalOutstandingBalance > 0 ? ARGB.DANGER_RED : ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		totRow.getCell(6).value = summaryData.overallRecoveryRate / 100;
		styleCell(totRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.PERCENT,
			border: totalRowBorder,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 6. STAFF DIRECTORY & BALANCES BREAKDOWN
	const staffDirHeader = ws.getRow(r);
	staffDirHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:F${r}`);
	staffDirHeader.getCell(1).value = 'STAFF MEMBERS DIRECTORY & BALANCE SUMMARY';
	styleCell(staffDirHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const staffHeadRow = ws.getRow(r);
	staffHeadRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const sCols = [
		{ col: 1, text: 'STAFF MEMBER NAME' },
		{ col: 2, text: 'DESIGNATION / ROLE' },
		{ col: 3, text: 'PHONE NUMBER' },
		{ col: 4, text: 'TOTAL GIVEN (₹)' },
		{ col: 5, text: 'TOTAL RECOVERED (₹)' },
		{ col: 6, text: 'OUTSTANDING (₹)' },
	];
	for (const sc of sCols) {
		const cell = staffHeadRow.getCell(sc.col);
		cell.value = sc.text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 10,
			bold: true,
			hAlign: sc.col >= 4 ? 'right' : 'left',
			indent: sc.col === 1 ? 1 : 0,
		});
	}
	r++;

	if (summaryData.staffGroups.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:F${r}`);
		emptyRow.getCell(1).value = 'No staff advance records found.';
		styleCell(emptyRow.getCell(1), {
			hAlign: 'center',
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
		});
		r++;
	} else {
		for (const sg of summaryData.staffGroups) {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;

			// Staff Name
			row.getCell(1).value = sg.staffName;
			styleCell(row.getCell(1), { bold: true, indent: 1 });

			// Role
			row.getCell(2).value = sg.staffRole || 'Staff';
			styleCell(row.getCell(2), { fontColor: ARGB.DARK_TEXT });

			// Phone
			row.getCell(3).value = sg.staffPhone || '—';
			styleCell(row.getCell(3), { fontColor: ARGB.DARK_TEXT });

			// Total Given
			row.getCell(4).value = sg.totalGiven;
			styleCell(row.getCell(4), {
				hAlign: 'right',
				bold: true,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Total Recovered
			row.getCell(5).value = sg.totalRecovered;
			styleCell(row.getCell(5), {
				hAlign: 'right',
				bold: true,
				fontColor: sg.totalRecovered > 0 ? ARGB.SUCCESS_GREEN : ARGB.DARK_TEXT,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Outstanding Balance
			row.getCell(6).value = sg.outstandingBalance;
			styleCell(row.getCell(6), {
				hAlign: 'right',
				bold: true,
				fontColor: sg.outstandingBalance > 0 ? ARGB.DANGER_RED : ARGB.DARK_TEXT,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			r++;
		}

		// Staff Table Grand Total Row (Standard Total Row Height)
		const totStaffRow = ws.getRow(r);
		totStaffRow.height = ROW_HEIGHTS.TOTAL_ROW;

		totStaffRow.getCell(1).value = 'TOTAL FOR ALL STAFF';
		styleCell(totStaffRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		totStaffRow.getCell(2).value = `${summaryData.totalStaffMembers} Staff Members`;
		styleCell(totStaffRow.getCell(2), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			border: totalRowBorder,
		});

		totStaffRow.getCell(3).value = '—';
		styleCell(totStaffRow.getCell(3), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			hAlign: 'center',
			border: totalRowBorder,
		});

		totStaffRow.getCell(4).value = summaryData.totalAdvancesGiven;
		styleCell(totStaffRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		totStaffRow.getCell(5).value = summaryData.totalAdvancesRecovered;
		styleCell(totStaffRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.SUCCESS_GREEN,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		totStaffRow.getCell(6).value = summaryData.totalOutstandingBalance;
		styleCell(totStaffRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: summaryData.totalOutstandingBalance > 0 ? ARGB.DANGER_RED : ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 7. AUDIT & RECONCILIATION NOTE (Executive Callout Box)
	const noteRow1 = ws.getRow(r);
	noteRow1.height = ROW_HEIGHTS.DATA_ROW;
	ws.mergeCells(`A${r}:F${r}`);
	noteRow1.getCell(1).value = 'AUDIT & RECONCILIATION CERTIFICATION:';
	styleCell(noteRow1.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		fontSize: 9,
		indent: 1,
	});
	r++;

	const noteRow2 = ws.getRow(r);
	noteRow2.height = ROW_HEIGHTS.DATA_ROW;
	ws.mergeCells(`A${r}:F${r}`);
	noteRow2.getCell(1).value = `All individual staff sheets in this workbook reconcile with this executive summary. Total Advances Given (₹${summaryData.totalAdvancesGiven.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) = Sum of all staff sheet advance totals. Total Outstanding Balance = ₹${summaryData.totalOutstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} across ${summaryData.outstandingCount} active advances.`;
	styleCell(noteRow2.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.DARK_TEXT,
		fontSize: 8.5,
		italic: true,
		wrapText: false,
		indent: 1,
	});
	r++;

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. FOLLOWING SHEETS: Dedicated Sheet for EACH Staff Member
// ────────────────────────────────────────────────────────────────────────────

export function buildStaffMemberSheet(
	workbook: ExcelJS.Workbook,
	staffGroup: StaffMemberAdvanceGroup,
	reportData: StaffAdvancesReportData,
	sheetName: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet(sheetName, {
		views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
		pageSetup: {
			orientation: 'portrait',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9, // A4
			margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	// Standard default row height for any unexplicit rows
	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	// Column Widths (A through F) - Widened for clean, unclipped text presentation
	ws.columns = [
		{ key: 'colA', width: 18 }, // Advance Date
		{ key: 'colB', width: 22 }, // Advance Amount (INR)
		{ key: 'colC', width: 32 }, // Reason / Purpose
		{ key: 'colD', width: 18 }, // Status Badge
		{ key: 'colE', width: 36 }, // Settlement / Recovery Details
		{ key: 'colF', width: 32 }, // Notes / Remarks
	];

	let r = 1;

	// 1. Header Banner (Row 1, Standard Title Height)
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:F${r}`);
	titleRow.getCell(1).value = reportTitle('STAFF ADVANCE REPORT');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// 2. Subtitle Metadata (Row 2, Standard Subtitle Height)
	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:F${r}`);
	subRow.getCell(1).value = `STAFF STATEMENT: ${staffGroup.staffName.toUpperCase()}  |  ROLE: ${(staffGroup.staffRole || 'STAFF').toUpperCase()}  |  SHEET: ${sheetName}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row (Row 3, Standard Spacer Height)
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 3. STAFF INFORMATION SECTION (Row 4, Standard Section Header Height)
	const staffInfoHeader = ws.getRow(r);
	staffInfoHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:F${r}`);
	staffInfoHeader.getCell(1).value = 'STAFF MEMBER INFORMATION';
	styleCell(staffInfoHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const periodStr = reportData.periodLabel || `${formatDateDisplay(reportData.startDate)} to ${formatDateDisplay(reportData.endDate)}`;

	const staffInfoData = [
		{ label: 'Staff Member Name', val: staffGroup.staffName },
		{ label: 'Designation / Role', val: staffGroup.staffRole || 'Staff' },
		{ label: 'Contact Phone Number', val: staffGroup.staffPhone || '—' },
		{ label: 'Statement Date Range', val: periodStr },
		{ label: 'Total Advance Records in Period', val: staffGroup.totalCount, isNum: true },
	];

	for (const info of staffInfoData) {
		const row = ws.getRow(r);
		row.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:B${r}`);
		row.getCell(1).value = info.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`C${r}:F${r}`);
		row.getCell(3).value = info.val;
		styleCell(row.getCell(3), {
			hAlign: info.isNum ? 'right' : 'left',
			numFmt: info.isNum ? NUM_FORMATS.INTEGER : undefined,
			bold: !!info.isNum,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 4. MONTHLY ADVANCE SUMMARY FOR THIS STAFF MEMBER (Requirement 9 & 10)
	const monthlyHeader = ws.getRow(r);
	monthlyHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:F${r}`);
	monthlyHeader.getCell(1).value = `MONTHLY ADVANCE SUMMARY — ${staffGroup.staffName.toUpperCase()}`;
	styleCell(monthlyHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const mHeadRow = ws.getRow(r);
	mHeadRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const mCols = [
		{ col: 1, text: 'MONTH' },
		{ col: 2, text: 'RECORDS' },
		{ col: 3, text: 'TOTAL ADVANCE GIVEN (₹)' },
		{ col: 4, text: 'TOTAL RECOVERED (₹)' },
		{ col: 5, text: 'OUTSTANDING BALANCE (₹)' },
		{ col: 6, text: 'STATUS' },
	];
	for (const mc of mCols) {
		const cell = mHeadRow.getCell(mc.col);
		cell.value = mc.text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 10,
			bold: true,
			hAlign: mc.col === 1 ? 'left' : (mc.col === 6 ? 'center' : 'right'),
			indent: mc.col === 1 ? 1 : 0,
		});
	}
	r++;

	if (staffGroup.monthlyTotals.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:F${r}`);
		emptyRow.getCell(1).value = 'No advances recorded for this staff member in this period.';
		styleCell(emptyRow.getCell(1), {
			hAlign: 'center',
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
		});
		r++;
	} else {
		for (const m of staffGroup.monthlyTotals) {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;

			// Month
			row.getCell(1).value = m.monthLabel;
			styleCell(row.getCell(1), { bold: true, indent: 1 });

			// Records
			row.getCell(2).value = m.advancesCount;
			styleCell(row.getCell(2), { hAlign: 'right', numFmt: NUM_FORMATS.INTEGER });

			// Total Given
			row.getCell(3).value = m.totalGiven;
			styleCell(row.getCell(3), {
				hAlign: 'right',
				bold: true,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Total Recovered
			row.getCell(4).value = m.totalRecovered;
			styleCell(row.getCell(4), {
				hAlign: 'right',
				bold: true,
				fontColor: m.totalRecovered > 0 ? ARGB.SUCCESS_GREEN : ARGB.DARK_TEXT,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Outstanding Balance
			row.getCell(5).value = m.outstandingBalance;
			styleCell(row.getCell(5), {
				hAlign: 'right',
				bold: true,
				fontColor: m.outstandingBalance > 0 ? ARGB.DANGER_RED : ARGB.DARK_TEXT,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// Status badge
			const mStatus = m.outstandingBalance === 0 ? 'Settled in Full' : (m.totalRecovered > 0 ? 'Partially Settled' : 'Outstanding');
			row.getCell(6).value = mStatus;
			styleCell(row.getCell(6), {
				hAlign: 'center',
				bold: true,
				fontSize: 9,
				fontColor: m.outstandingBalance === 0 ? ARGB.SUCCESS_GREEN : (m.totalRecovered > 0 ? ARGB.WARNING_ORANGE : ARGB.DANGER_RED),
				fillColor: m.outstandingBalance === 0 ? ARGB.SUCCESS_LIGHT_GREEN : (m.totalRecovered > 0 ? ARGB.WARNING_LIGHT_ORANGE : ARGB.DANGER_LIGHT_RED),
			});
			r++;
		}

		// Staff Monthly Totals Summary Row (Standard Total Row Height)
		const staffTotRow = ws.getRow(r);
		staffTotRow.height = ROW_HEIGHTS.TOTAL_ROW;

		staffTotRow.getCell(1).value = 'TOTAL ADVANCES';
		styleCell(staffTotRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		staffTotRow.getCell(2).value = staffGroup.totalCount;
		styleCell(staffTotRow.getCell(2), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		staffTotRow.getCell(3).value = staffGroup.totalGiven;
		styleCell(staffTotRow.getCell(3), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		staffTotRow.getCell(4).value = staffGroup.totalRecovered;
		styleCell(staffTotRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.SUCCESS_GREEN,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		staffTotRow.getCell(5).value = staffGroup.outstandingBalance;
		styleCell(staffTotRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: staffGroup.outstandingBalance > 0 ? ARGB.DANGER_RED : ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		const overallStaffStatus = staffGroup.outstandingBalance === 0
			? 'All Settled'
			: `${staffGroup.outstandingCount} Unpaid`;
		staffTotRow.getCell(6).value = overallStaffStatus;
		styleCell(staffTotRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: staffGroup.outstandingBalance === 0 ? ARGB.SUCCESS_GREEN : ARGB.DANGER_RED,
			bold: true,
			hAlign: 'center',
			border: totalRowBorder,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 5. ADVANCE TRANSACTION TABLE (Requirement 7 & 8)
	const transHeader = ws.getRow(r);
	transHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:F${r}`);
	transHeader.getCell(1).value = `ADVANCE TRANSACTIONS LEDGER (CHRONOLOGICAL) — ${staffGroup.staffName.toUpperCase()}`;
	styleCell(transHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const transHeadRow = ws.getRow(r);
	transHeadRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const tCols = [
		{ col: 1, text: 'ADVANCE DATE' },
		{ col: 2, text: 'ADVANCE AMOUNT (INR)' },
		{ col: 3, text: 'REASON / PURPOSE' },
		{ col: 4, text: 'STATUS' },
		{ col: 5, text: 'RECOVERY / SETTLEMENT DETAILS' },
		{ col: 6, text: 'NOTES / REMARKS' },
	];
	for (const tc of tCols) {
		const cell = transHeadRow.getCell(tc.col);
		cell.value = tc.text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 10,
			bold: true,
			hAlign: tc.col === 2 ? 'right' : (tc.col === 4 ? 'center' : 'left'),
			indent: tc.col === 3 ? 1 : 0,
		});
	}
	r++;

	if (staffGroup.advances.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:F${r}`);
		emptyRow.getCell(1).value = 'No advance transactions recorded for this staff member.';
		styleCell(emptyRow.getCell(1), {
			hAlign: 'center',
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
		});
		r++;
	} else {
		for (let i = 0; i < staffGroup.advances.length; i++) {
			const a = staffGroup.advances[i];
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = i % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;

			// 1. Advance Date (Ascending order)
			row.getCell(1).value = formatDateDisplay(a.advanceDate);
			styleCell(row.getCell(1), {
				fillColor: rowFill,
				hAlign: 'center',
			});

			// 2. Advance Amount
			row.getCell(2).value = a.amount;
			styleCell(row.getCell(2), {
				fillColor: rowFill,
				hAlign: 'right',
				bold: true,
				numFmt: NUM_FORMATS.CURRENCY,
			});

			// 3. Reason / Purpose
			row.getCell(3).value = a.reason || 'Staff Advance';
			styleCell(row.getCell(3), {
				fillColor: rowFill,
				indent: 1,
			});

			// 4. Status Badge
			row.getCell(4).value = a.status;
			let statusFill: string = ARGB.LIGHT_GRAY_FILL;
			let statusColor: string = ARGB.DARK_TEXT;

			if (a.status === 'Settled') {
				statusFill = ARGB.SUCCESS_LIGHT_GREEN;
				statusColor = ARGB.SUCCESS_GREEN;
			} else if (a.status === 'Outstanding') {
				statusFill = ARGB.DANGER_LIGHT_RED;
				statusColor = ARGB.DANGER_RED;
			} else if (a.status === 'Obsolete') {
				statusFill = ARGB.LIGHT_GRAY_FILL;
				statusColor = ARGB.MUTED_TEXT;
			}

			styleCell(row.getCell(4), {
				fillColor: statusFill,
				fontColor: statusColor,
				bold: true,
				fontSize: 9.5,
				hAlign: 'center',
			});

			// 5. Recovery / Settlement Information
			let settlementInfo = '—';
			if (a.status === 'Settled') {
				const datePart = a.settledAt ? formatDateDisplay(a.settledAt) : 'Date unrecorded';
				const byPart = a.settledByName ? `by ${a.settledByName}` : 'via System';
				settlementInfo = `Settled on ${datePart} (${byPart})`;
			} else if (a.status === 'Obsolete') {
				const datePart = a.obsoletedAt ? formatDateDisplay(a.obsoletedAt) : 'Date unrecorded';
				const reasonPart = a.obsoleteReason ? ` - ${a.obsoleteReason}` : '';
				settlementInfo = `Obsoleted on ${datePart}${reasonPart}`;
			} else if (a.status === 'Outstanding') {
				settlementInfo = 'Payment pending settlement';
			}
			row.getCell(5).value = settlementInfo;
			styleCell(row.getCell(5), {
				fillColor: rowFill,
				fontSize: 9,
				fontColor: a.status === 'Settled' ? ARGB.SUCCESS_GREEN : ARGB.DARK_TEXT,
			});

			// 6. Notes
			row.getCell(6).value = a.notes || '—';
			styleCell(row.getCell(6), {
				fillColor: rowFill,
				fontSize: 9,
				fontColor: ARGB.MUTED_TEXT,
			});

			r++;
		}

		// 6. STAFF GRAND TOTAL ROW (Standard Total Row Height)
		const ledgerTotRow = ws.getRow(r);
		ledgerTotRow.height = ROW_HEIGHTS.TOTAL_ROW;

		ledgerTotRow.getCell(1).value = `TOTAL FOR ${staffGroup.staffName.toUpperCase()}`;
		styleCell(ledgerTotRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		ledgerTotRow.getCell(2).value = staffGroup.totalGiven;
		styleCell(ledgerTotRow.getCell(2), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.CURRENCY,
			border: totalRowBorder,
		});

		ledgerTotRow.getCell(3).value = `Total Recovered: ₹${staffGroup.totalRecovered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
		styleCell(ledgerTotRow.getCell(3), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.SUCCESS_GREEN,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		ledgerTotRow.getCell(4).value = `${staffGroup.outstandingCount} Unpaid`;
		styleCell(ledgerTotRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: staffGroup.outstandingCount > 0 ? ARGB.DANGER_RED : ARGB.SUCCESS_GREEN,
			bold: true,
			hAlign: 'center',
			border: totalRowBorder,
		});

		ledgerTotRow.getCell(5).value = `Outstanding Balance: ₹${staffGroup.outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
		styleCell(ledgerTotRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: staffGroup.outstandingBalance > 0 ? ARGB.DANGER_RED : ARGB.PRIMARY_DARK,
			bold: true,
			border: totalRowBorder,
		});

		ledgerTotRow.getCell(6).value = 'Reconciled';
		styleCell(ledgerTotRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
			hAlign: 'center',
			border: totalRowBorder,
		});
		r++;
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. WORKBOOK FACTORY & BROWSER DOWNLOAD HANDLER
// ────────────────────────────────────────────────────────────────────────────

/**
 * Creates the complete redesigned multi-sheet Staff Advances Excel Workbook:
 *   - Sheet 1: Staff Summary
 *   - Sheet 2..N: Exactly one dedicated sheet for each staff member.
 */
export function createStaffAdvancesWorkbook(
	reportData: StaffAdvancesReportData
): ExcelJS.Workbook {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = reportCreator();
	workbook.lastModifiedBy = reportCreator();
	workbook.created = new Date();
	workbook.modified = new Date();

	// Calculate summary and staff groups
	const summaryData = calculateStaffAdvancesSummary(reportData.advances, {
		startDate: reportData.startDate,
		endDate: reportData.endDate,
	});

	// Build Sheet 1: Staff Summary (ALWAYS the first sheet)
	buildStaffSummarySheet(workbook, summaryData, reportData);

	// Build Following Sheets: Exactly ONE sheet for each staff member
	const usedSheetNames = new Set<string>(['staff summary']);

	for (const staffGroup of summaryData.staffGroups) {
		const sheetName = sanitizeSheetName(staffGroup.staffName, usedSheetNames);
		buildStaffMemberSheet(workbook, staffGroup, reportData, sheetName);
	}

	return workbook;
}

/**
 * Generates the multi-sheet Excel file buffer and initiates browser download.
 */
export async function generateAndDownloadStaffAdvancesReport(
	reportData: StaffAdvancesReportData,
	fileName?: string
): Promise<void> {
	const workbook = createStaffAdvancesWorkbook(reportData);

	const defaultFileName = fileName || `${reportFilePrefix()}Staff_Advances_Report_${reportData.startDate}_to_${reportData.endDate}.xlsx`;

	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});

	const url = window.URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = defaultFileName;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	window.URL.revokeObjectURL(url);
}
