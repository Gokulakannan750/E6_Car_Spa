/**
 * E6 Car Spa Management — Outside Jobs & External Movements Excel Generator (ExcelJS)
 *
 * Generates an executive-grade, beautifully formatted 4-sheet operational & accounting workbook:
 *   - SHEET 1: "Executive Summary" (Executive presentation, KPIs, Vendor Workload & Cost Allocation, Reconciliation Notes)
 *   - SHEET 2: "Currently Outside" (Active movements at external workshops, overdue highlights, estimated vendor costs)
 *   - SHEET 3: "Movement History" (Chronological audit trail of all outside movements, turnaround times, final vendor costs)
 *   - SHEET 4: "Vendor Analysis" (Vendor workload distribution, completion rates, and total cost share)
 *
 * Professional Styling Specifications (Exact parity with approved Billing, Staff, and Showroom reports):
 *   - Main title: Dark Blue (#0B3A6E) + White Bold, 30pt row height, vertically centered
 *   - Subtitle: Light Blue (#EAF2FF) + Dark Blue Bold, 22pt row height, vertically centered
 *   - Section headers: Dark Blue (#0B3A6E) + White Bold, 24pt row height
 *   - Table headers: Primary Blue (#0B5ED7) + White Bold, 22pt row height
 *   - Total Rows: Light Blue (#EAF2FF) + Bold with Double Bottom Border (#0B3A6E), 22pt row height
 *   - Normal data rows: Uniform 21pt row height (defaultRowHeight = 21)
 *   - Spacer rows: 10pt row height
 *   - Status Badges: Returned (Green), Outside (Orange/Amber), Overdue (Red), Cancelled (Gray)
 *   - Cost Clarity: Explicit distinction between Estimated Vendor Cost and Final Vendor Cost
 *   - Borders: Subtle thin gray borders (#D1D5DB), double bottom on Total rows
 *   - Numbers & Currency: Formatted explicitly with ₹ and thousands separators ("₹"#,##0.00)
 */

import ExcelJS from 'exceljs';
import type {
	OutsideJobsReportDto,
	CurrentlyOutsideJobDto,
	OutsideJobHistoryReportDto,
	OutsideJobVendorSummaryDto,
} from '../../lib/api';

export type {
	OutsideJobsReportDto,
	CurrentlyOutsideJobDto,
	OutsideJobHistoryReportDto,
	OutsideJobVendorSummaryDto,
};
import {
	ARGB,
	formatDateDisplay,
	formatDateTimeDisplay,
} from './excelMonthlyBillingGenerator';

export { ARGB, formatDateDisplay, formatDateTimeDisplay };

export const NUM_FORMATS = {
	CURRENCY: '"₹"#,##0.00;[Red]-"₹"#,##0.00;"₹"0.00',
	INTEGER: '#,##0',
	PERCENT: '0.0%',
	DECIMAL: '#,##0.0',
};

const FONT_NAME = 'Calibri';

// ────────────────────────────────────────────────────────────────────────────
// STANDARDIZED ROW HEIGHTS (Excel Points)
// ────────────────────────────────────────────────────────────────────────────
export const ROW_HEIGHTS = {
	TITLE: 30,           // Main report title (30 points)
	SUBTITLE: 22,        // Subtitle / metadata banner (22 points)
	SECTION_HEADER: 24,  // Major section headers (24 points)
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

export function formatDurationDisplay(hours?: number | null): string {
	if (hours === null || hours === undefined || isNaN(hours)) return '—';
	if (hours < 1) {
		const mins = Math.round(hours * 60);
		return `${mins}m`;
	}
	const h = Math.floor(hours);
	const mins = Math.round((hours - h) * 60);
	return mins > 0 ? `${h}h ${mins}m` : `${h}h`;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. SHEET 1 — "Executive Summary"
// ────────────────────────────────────────────────────────────────────────────

export function buildExecutiveSummarySheet(
	workbook: ExcelJS.Workbook,
	reportData: OutsideJobsReportDto,
	dateRangeLabel: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Executive Summary', {
		properties: { defaultRowHeight: ROW_HEIGHTS.DATA_ROW, tabColor: { argb: ARGB.PRIMARY_DARK } },
		views: [{ showGridLines: true, state: 'frozen', ySplit: 2 }],
		pageSetup: {
			orientation: 'landscape',
			paperSize: 9,
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
		},
	});

	ws.columns = [
		{ key: 'colA', width: 6 },   // S.No
		{ key: 'colB', width: 28 },  // Metric / Vendor Name
		{ key: 'colC', width: 16 },  // Value / Phone
		{ key: 'colD', width: 16 },  // Total Jobs
		{ key: 'colE', width: 16 },  // Active Outside
		{ key: 'colF', width: 15 },  // Overdue
		{ key: 'colG', width: 16 },  // Completed
		{ key: 'colH', width: 22 },  // Total Cost (₹)
		{ key: 'colI', width: 16 },  // Cost Share %
	];

	// Row 1: Title Header
	const r1 = ws.getRow(1);
	r1.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells('A1:I1');
	const cTitle = ws.getCell('A1');
	cTitle.value = 'E6 CAR SPA — OUTSIDE JOBS & EXTERNAL MOVEMENTS REPORT';
	styleCell(cTitle, {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});

	// Row 2: Subtitle / Scope Banner
	const r2 = ws.getRow(2);
	r2.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells('A2:I2');
	const cSub = ws.getCell('A2');
	const genTimestamp = formatDateTimeDisplay(new Date().toISOString());
	cSub.value = `Period / Scope: ${dateRangeLabel}  |  Generated At: ${genTimestamp}  |  Executive Operations & Vendor Audit`;
	styleCell(cSub, {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});

	// Row 3: Spacer
	const r3 = ws.getRow(3);
	r3.height = ROW_HEIGHTS.SPACER;

	// Row 4: KPI Section Header
	let currRow = 4;
	const rKpiHdr = ws.getRow(currRow);
	rKpiHdr.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${currRow}:I${currRow}`);
	const cKpiHdr = ws.getCell(`A${currRow}`);
	cKpiHdr.value = 'OPERATIONAL KEY PERFORMANCE INDICATORS (KPIS)';
	styleCell(cKpiHdr, {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	currRow++;

	// Calculate Derived Summary Metrics
	const historyList = reportData.history ?? [];
	const currentlyOutsideList = reportData.currentlyOutside ?? [];
	const vendorSummaryList = reportData.vendorSummary ?? [];

	const totalMovementsCount = (reportData.totalOutsideCount || currentlyOutsideList.length) + historyList.length;
	const activeOutsideCount = reportData.totalOutsideCount ?? currentlyOutsideList.length;
	const overdueCount = reportData.totalOverdueCount ?? currentlyOutsideList.filter(x => x.isOverdue).length;
	const completedReturnedCount = historyList.filter(h => h.status === 2 || h.statusName === 'Returned').length;
	const cancelledCount = historyList.filter(h => h.status === 3 || h.statusName === 'Cancelled').length;

	// Distinguish Estimated Active Cost vs Final Returned Cost
	const totalActiveEstimatedCost = reportData.totalActiveCost ?? currentlyOutsideList.reduce((acc, j) => acc + (j.vendorCost ?? 0), 0);
	const totalReturnedFinalCost = historyList
		.filter(h => h.status === 2 || h.statusName === 'Returned')
		.reduce((acc, j) => acc + (j.vendorCost ?? 0), 0);
	const totalRecordedExpenditure = (reportData.totalActiveCost ?? 0) + (reportData.totalHistoricalCost ?? 0);

	const kpiItems = [
		{
			labelA: 'Total External Movements',
			valA: totalMovementsCount,
			fmtA: NUM_FORMATS.INTEGER,
			labelB: 'Total Recorded Vendor Expense',
			valB: totalRecordedExpenditure,
			fmtB: NUM_FORMATS.CURRENCY,
			highlightB: true,
		},
		{
			labelA: 'Currently Outside Vehicles',
			valA: activeOutsideCount,
			fmtA: NUM_FORMATS.INTEGER,
			labelB: 'Estimated Vendor Cost (Active)',
			valB: totalActiveEstimatedCost,
			fmtB: NUM_FORMATS.CURRENCY,
		},
		{
			labelA: 'Overdue Outside Vehicles (SLA Breach)',
			valA: overdueCount,
			fmtA: NUM_FORMATS.INTEGER,
			isAlertA: overdueCount > 0,
			labelB: 'Final Vendor Cost (Returned)',
			valB: totalReturnedFinalCost,
			fmtB: NUM_FORMATS.CURRENCY,
		},
		{
			labelA: 'Completed & Returned to Showroom',
			valA: completedReturnedCount,
			fmtA: NUM_FORMATS.INTEGER,
			isSuccessA: true,
			labelB: 'Cancelled Movements',
			valB: cancelledCount,
			fmtB: NUM_FORMATS.INTEGER,
		},
	];

	for (const kpi of kpiItems) {
		const row = ws.getRow(currRow);
		row.height = ROW_HEIGHTS.DATA_ROW;

		// Side A (Cols A..D)
		ws.mergeCells(`A${currRow}:C${currRow}`);
		const cLabelA = ws.getCell(`A${currRow}`);
		cLabelA.value = kpi.labelA;
		styleCell(cLabelA, {
			fontColor: ARGB.DARK_TEXT,
			fontSize: 10,
			bold: true,
			indent: 1,
			fillColor: ARGB.ROW_ALT_FILL,
		});

		const cValA = ws.getCell(`D${currRow}`);
		cValA.value = kpi.valA;
		styleCell(cValA, {
			fontColor: kpi.isAlertA ? ARGB.DANGER_RED : kpi.isSuccessA ? ARGB.SUCCESS_GREEN : ARGB.PRIMARY_DARK,
			fontSize: 11,
			bold: true,
			hAlign: 'right',
			numFmt: kpi.fmtA,
			fillColor: kpi.isAlertA ? ARGB.DANGER_LIGHT_RED : kpi.isSuccessA ? ARGB.SUCCESS_LIGHT_GREEN : ARGB.ROW_ALT_FILL,
		});

		// Side B (Cols E..I)
		ws.mergeCells(`E${currRow}:G${currRow}`);
		const cLabelB = ws.getCell(`E${currRow}`);
		cLabelB.value = kpi.labelB;
		styleCell(cLabelB, {
			fontColor: ARGB.DARK_TEXT,
			fontSize: 10,
			bold: true,
			indent: 1,
			fillColor: kpi.highlightB ? ARGB.SECONDARY_LIGHT_BLUE : ARGB.WHITE,
		});

		ws.mergeCells(`H${currRow}:I${currRow}`);
		const cValB = ws.getCell(`H${currRow}`);
		cValB.value = kpi.valB;
		styleCell(cValB, {
			fontColor: kpi.highlightB ? ARGB.PRIMARY_DARK : ARGB.DARK_TEXT,
			fontSize: 11,
			bold: true,
			hAlign: 'right',
			numFmt: kpi.fmtB,
			fillColor: kpi.highlightB ? ARGB.SECONDARY_LIGHT_BLUE : ARGB.WHITE,
		});

		currRow++;
	}

	// Spacer Row
	const rSpacer1 = ws.getRow(currRow);
	rSpacer1.height = ROW_HEIGHTS.SPACER;
	currRow++;

	// Section 2: Vendor Workload & Cost Allocation Summary
	const rVendorHdr = ws.getRow(currRow);
	rVendorHdr.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${currRow}:I${currRow}`);
	const cVendorHdr = ws.getCell(`A${currRow}`);
	cVendorHdr.value = 'VENDOR WORKLOAD DISTRIBUTION & COST ALLOCATION SUMMARY';
	styleCell(cVendorHdr, {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	currRow++;

	// Table Headers
	const rTableHdr = ws.getRow(currRow);
	rTableHdr.height = ROW_HEIGHTS.TABLE_HEADER;
	const vendorHeaders = [
		{ col: 'A', text: 'S.No', hAlign: 'center' as const },
		{ col: 'B', text: 'Vendor Name', hAlign: 'left' as const },
		{ col: 'C', text: 'Contact Phone', hAlign: 'center' as const },
		{ col: 'D', text: 'Total Jobs', hAlign: 'right' as const },
		{ col: 'E', text: 'Active Outside', hAlign: 'right' as const },
		{ col: 'F', text: 'Overdue', hAlign: 'right' as const },
		{ col: 'G', text: 'Completed', hAlign: 'right' as const },
		{ col: 'H', text: 'Total Cost (₹)', hAlign: 'right' as const },
		{ col: 'I', text: 'Cost Share %', hAlign: 'right' as const },
	];

	for (const h of vendorHeaders) {
		const cell = ws.getCell(`${h.col}${currRow}`);
		cell.value = h.text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 10,
			bold: true,
			hAlign: h.hAlign,
		});
	}
	currRow++;

	// Vendor Data Rows
	const totalVendorExpenditure = vendorSummaryList.reduce((acc, v) => acc + (v.totalVendorCost || 0), 0);

	if (vendorSummaryList.length === 0) {
		const rEmpty = ws.getRow(currRow);
		rEmpty.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${currRow}:I${currRow}`);
		const cEmpty = ws.getCell(`A${currRow}`);
		cEmpty.value = 'No vendor activity recorded in this reporting period.';
		styleCell(cEmpty, {
			fillColor: ARGB.LIGHT_GRAY_FILL,
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
			hAlign: 'center',
		});
		currRow++;
	} else {
		vendorSummaryList.forEach((v, idx) => {
			const row = ws.getRow(currRow);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			const sharePct = totalVendorExpenditure > 0 ? (v.totalVendorCost || 0) / totalVendorExpenditure : 0;

			// S.No
			const cSno = ws.getCell(`A${currRow}`);
			cSno.value = idx + 1;
			styleCell(cSno, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Vendor Name
			const cName = ws.getCell(`B${currRow}`);
			cName.value = v.vendorName || 'Unknown Vendor';
			styleCell(cName, { bold: true, fillColor: rowFill, indent: 1 });

			// Contact Phone
			const cPhone = ws.getCell(`C${currRow}`);
			cPhone.value = v.phone || '—';
			styleCell(cPhone, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Total Jobs
			const cTotal = ws.getCell(`D${currRow}`);
			cTotal.value = v.totalJobs || 0;
			styleCell(cTotal, { hAlign: 'right', bold: true, numFmt: NUM_FORMATS.INTEGER, fillColor: rowFill });

			// Active Outside
			const cActive = ws.getCell(`E${currRow}`);
			cActive.value = v.currentlyOutside || 0;
			styleCell(cActive, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: v.currentlyOutside > 0 ? ARGB.WARNING_LIGHT_ORANGE : rowFill,
				fontColor: v.currentlyOutside > 0 ? ARGB.WARNING_ORANGE : ARGB.DARK_TEXT,
				bold: v.currentlyOutside > 0,
			});

			// Overdue
			const cOverdue = ws.getCell(`F${currRow}`);
			cOverdue.value = v.overdueJobs || 0;
			styleCell(cOverdue, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: v.overdueJobs > 0 ? ARGB.DANGER_LIGHT_RED : rowFill,
				fontColor: v.overdueJobs > 0 ? ARGB.DANGER_RED : ARGB.DARK_TEXT,
				bold: v.overdueJobs > 0,
			});

			// Completed
			const cComp = ws.getCell(`G${currRow}`);
			cComp.value = v.completedJobs || 0;
			styleCell(cComp, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: rowFill,
				fontColor: v.completedJobs > 0 ? ARGB.SUCCESS_GREEN : ARGB.DARK_TEXT,
				bold: v.completedJobs > 0,
			});

			// Total Cost
			const cCost = ws.getCell(`H${currRow}`);
			cCost.value = v.totalVendorCost || 0;
			styleCell(cCost, { hAlign: 'right', bold: true, numFmt: NUM_FORMATS.CURRENCY, fillColor: rowFill });

			// Cost Share %
			const cShare = ws.getCell(`I${currRow}`);
			cShare.value = sharePct;
			styleCell(cShare, { hAlign: 'right', numFmt: NUM_FORMATS.PERCENT, fillColor: rowFill });

			currRow++;
		});

		// Vendor Grand Total Row
		const rTotal = ws.getRow(currRow);
		rTotal.height = ROW_HEIGHTS.TOTAL_ROW;

		ws.mergeCells(`A${currRow}:C${currRow}`);
		const cTotLabel = ws.getCell(`A${currRow}`);
		cTotLabel.value = 'Total Vendor Summary';
		styleCell(cTotLabel, {
			bold: true,
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			indent: 1,
			border: totalRowBorder,
		});

		const sumTotalJobs = vendorSummaryList.reduce((acc, v) => acc + (v.totalJobs || 0), 0);
		const sumActive = vendorSummaryList.reduce((acc, v) => acc + (v.currentlyOutside || 0), 0);
		const sumOverdue = vendorSummaryList.reduce((acc, v) => acc + (v.overdueJobs || 0), 0);
		const sumCompleted = vendorSummaryList.reduce((acc, v) => acc + (v.completedJobs || 0), 0);
		const sumCost = totalVendorExpenditure;

		const totalCols = [
			{ col: 'D', val: sumTotalJobs, fmt: NUM_FORMATS.INTEGER },
			{ col: 'E', val: sumActive, fmt: NUM_FORMATS.INTEGER },
			{ col: 'F', val: sumOverdue, fmt: NUM_FORMATS.INTEGER },
			{ col: 'G', val: sumCompleted, fmt: NUM_FORMATS.INTEGER },
			{ col: 'H', val: sumCost, fmt: NUM_FORMATS.CURRENCY },
			{ col: 'I', val: 1.0, fmt: NUM_FORMATS.PERCENT },
		];

		for (const tc of totalCols) {
			const cell = ws.getCell(`${tc.col}${currRow}`);
			cell.value = tc.val;
			styleCell(cell, {
				hAlign: 'right',
				bold: true,
				numFmt: tc.fmt,
				fillColor: ARGB.SECONDARY_LIGHT_BLUE,
				fontColor: ARGB.PRIMARY_DARK,
				border: totalRowBorder,
			});
		}
		currRow++;
	}

	// Spacer Row
	const rSpacer2 = ws.getRow(currRow);
	rSpacer2.height = ROW_HEIGHTS.SPACER;
	currRow++;

	// Section 3: Operational & Reconciliation Notes
	const rNotesHdr = ws.getRow(currRow);
	rNotesHdr.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${currRow}:I${currRow}`);
	const cNotesHdr = ws.getCell(`A${currRow}`);
	cNotesHdr.value = 'OPERATIONAL & ACCOUNTING RECONCILIATION NOTES';
	styleCell(cNotesHdr, {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	currRow++;

	const auditNotes = [
		'1. Cost Differentiation: Estimated Vendor Cost reflects the anticipated charge at dispatch; Final Vendor Cost is locked upon vehicle return and invoice validation.',
		'2. Active Movement Tracking: Vehicles currently at outside shops require formal "Mark Returned" status with final verified vendor charges before job card closing.',
		'3. SLA & Turnaround Monitoring: Movements exceeding Expected Return timestamps are flagged as Overdue for immediate workshop follow-up.',
		'4. Invoicing Integration: Outside job final vendor costs are automatically consolidated into customer invoice billing line items upon completion.',
	];

	for (const note of auditNotes) {
		const rNote = ws.getRow(currRow);
		rNote.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${currRow}:I${currRow}`);
		const cNote = ws.getCell(`A${currRow}`);
		cNote.value = note;
		styleCell(cNote, {
			fontColor: ARGB.MUTED_TEXT,
			fontSize: 9,
			italic: true,
			indent: 1,
			fillColor: ARGB.ROW_ALT_FILL,
		});
		currRow++;
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. SHEET 2 — "Currently Outside"
// ────────────────────────────────────────────────────────────────────────────

export function buildCurrentlyOutsideSheet(
	workbook: ExcelJS.Workbook,
	reportData: OutsideJobsReportDto,
	dateRangeLabel: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Currently Outside', {
		properties: { defaultRowHeight: ROW_HEIGHTS.DATA_ROW, tabColor: { argb: ARGB.WARNING_ORANGE } },
		views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }],
		pageSetup: {
			orientation: 'landscape',
			paperSize: 9,
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
		},
	});

	ws.columns = [
		{ key: 'sno', width: 6 },          // A: S.No
		{ key: 'status', width: 15 },       // B: Status Badge
		{ key: 'jobCard', width: 16 },      // C: Job Card #
		{ key: 'regNo', width: 18 },        // D: Vehicle Reg #
		{ key: 'model', width: 22 },        // E: Vehicle Model
		{ key: 'customer', width: 22 },     // F: Customer Name
		{ key: 'phone', width: 16 },        // G: Customer Phone
		{ key: 'vendor', width: 24 },       // H: External Vendor
		{ key: 'vendorPhone', width: 16 },  // I: Vendor Phone
		{ key: 'service', width: 24 },      // J: Service Requested
		{ key: 'sentAt', width: 20 },       // K: Sent Date & Time
		{ key: 'expectedAt', width: 20 },   // L: Expected Return
		{ key: 'overdueHrs', width: 15 },   // M: Overdue (Hours)
		{ key: 'estCost', width: 18 },      // N: Estimated Cost (₹)
		{ key: 'notes', width: 32 },        // O: Dispatch Notes
	];

	// Row 1: Title Header
	const r1 = ws.getRow(1);
	r1.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells('A1:O1');
	const cTitle = ws.getCell('A1');
	cTitle.value = 'E6 CAR SPA — CURRENTLY OUTSIDE VEHICLES (ACTIVE MOVEMENTS)';
	styleCell(cTitle, {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});

	// Row 2: Subtitle Banner
	const r2 = ws.getRow(2);
	r2.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells('A2:O2');
	const cSub = ws.getCell('A2');
	const activeCount = reportData.totalOutsideCount ?? reportData.currentlyOutside?.length ?? 0;
	cSub.value = `Active External Movements  |  Period: ${dateRangeLabel}  |  Vehicles at Outside Shops: ${activeCount}`;
	styleCell(cSub, {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});

	// Row 3: Spacer
	const r3 = ws.getRow(3);
	r3.height = ROW_HEIGHTS.SPACER;

	// Row 4: Table Headers
	const r4 = ws.getRow(4);
	r4.height = ROW_HEIGHTS.TABLE_HEADER;

	const headers = [
		{ col: 'A', text: 'S.No', hAlign: 'center' as const },
		{ col: 'B', text: 'Status', hAlign: 'center' as const },
		{ col: 'C', text: 'Job Card #', hAlign: 'center' as const },
		{ col: 'D', text: 'Vehicle Reg #', hAlign: 'center' as const },
		{ col: 'E', text: 'Vehicle Model', hAlign: 'left' as const },
		{ col: 'F', text: 'Customer Name', hAlign: 'left' as const },
		{ col: 'G', text: 'Customer Phone', hAlign: 'center' as const },
		{ col: 'H', text: 'External Vendor', hAlign: 'left' as const },
		{ col: 'I', text: 'Vendor Phone', hAlign: 'center' as const },
		{ col: 'J', text: 'Service Requested', hAlign: 'left' as const },
		{ col: 'K', text: 'Sent Date & Time', hAlign: 'center' as const },
		{ col: 'L', text: 'Expected Return', hAlign: 'center' as const },
		{ col: 'M', text: 'Overdue (Hrs)', hAlign: 'right' as const },
		{ col: 'N', text: 'Estimated Cost (₹)', hAlign: 'right' as const },
		{ col: 'O', text: 'Dispatch Notes', hAlign: 'left' as const },
	];

	for (const h of headers) {
		const cell = ws.getCell(`${h.col}4`);
		cell.value = h.text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 10,
			bold: true,
			hAlign: h.hAlign,
		});
	}

	let currRow = 5;
	const activeList = reportData.currentlyOutside ?? [];

	if (activeList.length === 0) {
		const rEmpty = ws.getRow(currRow);
		rEmpty.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${currRow}:O${currRow}`);
		const cEmpty = ws.getCell(`A${currRow}`);
		cEmpty.value = 'All Vehicles in Showroom — No vehicles are currently dispatched to external workshops.';
		styleCell(cEmpty, {
			fillColor: ARGB.LIGHT_GRAY_FILL,
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
			hAlign: 'center',
		});
		currRow++;
	} else {
		let sumEstCost = 0;

		activeList.forEach((job, idx) => {
			const row = ws.getRow(currRow);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			const estCost = job.vendorCost ?? 0;
			sumEstCost += estCost;

			// S.No
			const cSno = ws.getCell(`A${currRow}`);
			cSno.value = idx + 1;
			styleCell(cSno, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Status Badge
			const cStatus = ws.getCell(`B${currRow}`);
			cStatus.value = job.isOverdue ? 'OVERDUE' : 'Outside';
			styleCell(cStatus, {
				hAlign: 'center',
				bold: true,
				fontSize: 9,
				fillColor: job.isOverdue ? ARGB.DANGER_LIGHT_RED : ARGB.WARNING_LIGHT_ORANGE,
				fontColor: job.isOverdue ? ARGB.DANGER_RED : ARGB.WARNING_ORANGE,
			});

			// Job Card #
			const cJc = ws.getCell(`C${currRow}`);
			cJc.value = job.jobCardNumber || '—';
			styleCell(cJc, { hAlign: 'center', bold: true, fillColor: rowFill });

			// Vehicle Reg #
			const cReg = ws.getCell(`D${currRow}`);
			cReg.value = job.vehicleRegistration || '—';
			styleCell(cReg, { hAlign: 'center', bold: true, fillColor: rowFill });

			// Vehicle Model
			const cModel = ws.getCell(`E${currRow}`);
			cModel.value = job.vehicleModel || '—';
			styleCell(cModel, { fillColor: rowFill, indent: 1 });

			// Customer Name
			const cCust = ws.getCell(`F${currRow}`);
			cCust.value = job.customerName || '—';
			styleCell(cCust, { fillColor: rowFill, indent: 1 });

			// Customer Phone
			const cPhone = ws.getCell(`G${currRow}`);
			cPhone.value = job.customerPhone || '—';
			styleCell(cPhone, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// External Vendor
			const cVendor = ws.getCell(`H${currRow}`);
			cVendor.value = job.vendorName || '—';
			styleCell(cVendor, { bold: true, fillColor: rowFill, indent: 1 });

			// Vendor Phone
			const cVPhone = ws.getCell(`I${currRow}`);
			cVPhone.value = job.vendorPhone || '—';
			styleCell(cVPhone, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Service
			const cService = ws.getCell(`J${currRow}`);
			cService.value = job.serviceName || '—';
			styleCell(cService, { fillColor: rowFill, indent: 1 });

			// Sent Date & Time
			const cSent = ws.getCell(`K${currRow}`);
			cSent.value = formatDateTimeDisplay(job.sentAt);
			styleCell(cSent, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Expected Return
			const cExp = ws.getCell(`L${currRow}`);
			cExp.value = formatDateTimeDisplay(job.expectedReturnAt);
			styleCell(cExp, {
				hAlign: 'center',
				fontSize: 9,
				fillColor: job.isOverdue ? ARGB.DANGER_LIGHT_RED : rowFill,
				fontColor: job.isOverdue ? ARGB.DANGER_RED : ARGB.DARK_TEXT,
				bold: job.isOverdue,
			});

			// Overdue (Hours)
			const cOverdue = ws.getCell(`M${currRow}`);
			cOverdue.value = job.isOverdue ? job.overdueHours : 0;
			styleCell(cOverdue, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.DECIMAL,
				fillColor: job.isOverdue ? ARGB.DANGER_LIGHT_RED : rowFill,
				fontColor: job.isOverdue ? ARGB.DANGER_RED : ARGB.DARK_TEXT,
				bold: job.isOverdue,
			});

			// Estimated Cost (₹)
			const cCost = ws.getCell(`N${currRow}`);
			cCost.value = estCost;
			styleCell(cCost, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.CURRENCY,
				fillColor: rowFill,
				bold: true,
			});

			// Notes
			const cNotes = ws.getCell(`O${currRow}`);
			cNotes.value = job.notes || '—';
			styleCell(cNotes, { fillColor: rowFill, indent: 1 });

			currRow++;
		});

		// Total Row
		const rTotal = ws.getRow(currRow);
		rTotal.height = ROW_HEIGHTS.TOTAL_ROW;

		ws.mergeCells(`A${currRow}:M${currRow}`);
		const cTotLabel = ws.getCell(`A${currRow}`);
		cTotLabel.value = `Total Active Outside Vehicles (${activeList.length})`;
		styleCell(cTotLabel, {
			bold: true,
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			indent: 1,
			border: totalRowBorder,
		});

		const cTotCost = ws.getCell(`N${currRow}`);
		cTotCost.value = sumEstCost;
		styleCell(cTotCost, {
			hAlign: 'right',
			bold: true,
			numFmt: NUM_FORMATS.CURRENCY,
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			border: totalRowBorder,
		});

		const cTotEnd = ws.getCell(`O${currRow}`);
		cTotEnd.value = '';
		styleCell(cTotEnd, {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			border: totalRowBorder,
		});

		currRow++;
	}

	ws.autoFilter = {
		from: { row: 4, column: 1 },
		to: { row: currRow > 5 ? currRow - 1 : 5, column: 15 },
	};

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. SHEET 3 — "Movement History"
// ────────────────────────────────────────────────────────────────────────────

export function buildMovementHistorySheet(
	workbook: ExcelJS.Workbook,
	reportData: OutsideJobsReportDto,
	dateRangeLabel: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Movement History', {
		properties: { defaultRowHeight: ROW_HEIGHTS.DATA_ROW, tabColor: { argb: ARGB.PRIMARY_BLUE } },
		views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }],
		pageSetup: {
			orientation: 'landscape',
			paperSize: 9,
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
		},
	});

	ws.columns = [
		{ key: 'sno', width: 6 },          // A: S.No
		{ key: 'status', width: 14 },       // B: Status
		{ key: 'jobCard', width: 16 },      // C: Job Card #
		{ key: 'regNo', width: 18 },        // D: Vehicle Reg #
		{ key: 'model', width: 22 },        // E: Vehicle Model
		{ key: 'customer', width: 22 },     // F: Customer Name
		{ key: 'vendor', width: 24 },       // G: External Vendor
		{ key: 'service', width: 24 },      // H: Service Performed
		{ key: 'sentAt', width: 20 },       // I: Sent Date & Time
		{ key: 'returnedAt', width: 20 },   // J: Returned Date & Time
		{ key: 'duration', width: 16 },     // K: Turnaround Duration
		{ key: 'costType', width: 15 },     // L: Cost Type
		{ key: 'cost', width: 18 },         // M: Vendor Cost (₹)
		{ key: 'sentBy', width: 18 },       // N: Sent By Staff
		{ key: 'returnedBy', width: 18 },   // O: Returned By Staff
		{ key: 'notes', width: 28 },        // P: Dispatch Notes
		{ key: 'returnNotes', width: 28 },  // Q: Return Notes / Cancellation
	];

	// Row 1: Title Header
	const r1 = ws.getRow(1);
	r1.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells('A1:Q1');
	const cTitle = ws.getCell('A1');
	cTitle.value = 'E6 CAR SPA — OUTSIDE JOB & EXTERNAL MOVEMENT AUDIT TRAIL';
	styleCell(cTitle, {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});

	// Row 2: Subtitle Banner
	const r2 = ws.getRow(2);
	r2.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells('A2:Q2');
	const cSub = ws.getCell('A2');
	const histCount = reportData.history?.length ?? 0;
	cSub.value = `Movement Audit Log  |  Period: ${dateRangeLabel}  |  Total Movements Recorded: ${histCount}`;
	styleCell(cSub, {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});

	// Row 3: Spacer
	const r3 = ws.getRow(3);
	r3.height = ROW_HEIGHTS.SPACER;

	// Row 4: Table Headers
	const r4 = ws.getRow(4);
	r4.height = ROW_HEIGHTS.TABLE_HEADER;

	const headers = [
		{ col: 'A', text: 'S.No', hAlign: 'center' as const },
		{ col: 'B', text: 'Status', hAlign: 'center' as const },
		{ col: 'C', text: 'Job Card #', hAlign: 'center' as const },
		{ col: 'D', text: 'Vehicle Reg #', hAlign: 'center' as const },
		{ col: 'E', text: 'Vehicle Model', hAlign: 'left' as const },
		{ col: 'F', text: 'Customer Name', hAlign: 'left' as const },
		{ col: 'G', text: 'External Vendor', hAlign: 'left' as const },
		{ col: 'H', text: 'Service Performed', hAlign: 'left' as const },
		{ col: 'I', text: 'Sent Date & Time', hAlign: 'center' as const },
		{ col: 'J', text: 'Returned Date & Time', hAlign: 'center' as const },
		{ col: 'K', text: 'Duration', hAlign: 'center' as const },
		{ col: 'L', text: 'Cost Type', hAlign: 'center' as const },
		{ col: 'M', text: 'Vendor Cost (₹)', hAlign: 'right' as const },
		{ col: 'N', text: 'Sent By', hAlign: 'left' as const },
		{ col: 'O', text: 'Returned By', hAlign: 'left' as const },
		{ col: 'P', text: 'Dispatch Notes', hAlign: 'left' as const },
		{ col: 'Q', text: 'Return / Cancellation Notes', hAlign: 'left' as const },
	];

	for (const h of headers) {
		const cell = ws.getCell(`${h.col}4`);
		cell.value = h.text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 10,
			bold: true,
			hAlign: h.hAlign,
		});
	}

	let currRow = 5;
	const historyList = reportData.history ?? [];

	if (historyList.length === 0) {
		const rEmpty = ws.getRow(currRow);
		rEmpty.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${currRow}:Q${currRow}`);
		const cEmpty = ws.getCell(`A${currRow}`);
		cEmpty.value = 'No external vehicle movements recorded for this period.';
		styleCell(cEmpty, {
			fillColor: ARGB.LIGHT_GRAY_FILL,
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
			hAlign: 'center',
		});
		currRow++;
	} else {
		let sumCost = 0;

		historyList.forEach((job, idx) => {
			const row = ws.getRow(currRow);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			const vCost = job.vendorCost ?? 0;
			sumCost += vCost;

			const isReturned = job.status === 2 || job.statusName === 'Returned';
			const isCancelled = job.status === 3 || job.statusName === 'Cancelled';
			const isOutside = job.status === 1 || job.statusName === 'Outside';

			// S.No
			const cSno = ws.getCell(`A${currRow}`);
			cSno.value = idx + 1;
			styleCell(cSno, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Status Badge
			const cStatus = ws.getCell(`B${currRow}`);
			cStatus.value = isReturned ? 'Returned' : isCancelled ? 'Cancelled' : job.statusName || 'Outside';
			styleCell(cStatus, {
				hAlign: 'center',
				bold: true,
				fontSize: 9,
				fillColor: isReturned
					? ARGB.SUCCESS_LIGHT_GREEN
					: isCancelled
					? ARGB.LIGHT_GRAY_FILL
					: ARGB.WARNING_LIGHT_ORANGE,
				fontColor: isReturned
					? ARGB.SUCCESS_GREEN
					: isCancelled
					? ARGB.MUTED_TEXT
					: ARGB.WARNING_ORANGE,
			});

			// Job Card #
			const cJc = ws.getCell(`C${currRow}`);
			cJc.value = job.jobCardNumber || '—';
			styleCell(cJc, { hAlign: 'center', bold: true, fillColor: rowFill });

			// Vehicle Reg #
			const cReg = ws.getCell(`D${currRow}`);
			cReg.value = job.vehicleRegistration || '—';
			styleCell(cReg, { hAlign: 'center', bold: true, fillColor: rowFill });

			// Vehicle Model
			const cModel = ws.getCell(`E${currRow}`);
			cModel.value = job.vehicleModel || '—';
			styleCell(cModel, { fillColor: rowFill, indent: 1 });

			// Customer Name
			const cCust = ws.getCell(`F${currRow}`);
			cCust.value = job.customerName || '—';
			styleCell(cCust, { fillColor: rowFill, indent: 1 });

			// Vendor
			const cVendor = ws.getCell(`G${currRow}`);
			cVendor.value = job.vendorName || '—';
			styleCell(cVendor, { bold: true, fillColor: rowFill, indent: 1 });

			// Service
			const cService = ws.getCell(`H${currRow}`);
			cService.value = job.serviceName || '—';
			styleCell(cService, { fillColor: rowFill, indent: 1 });

			// Sent Date & Time
			const cSent = ws.getCell(`I${currRow}`);
			cSent.value = formatDateTimeDisplay(job.sentAt);
			styleCell(cSent, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Returned Date & Time
			const cRet = ws.getCell(`J${currRow}`);
			cRet.value = job.returnedAt ? formatDateTimeDisplay(job.returnedAt) : '—';
			styleCell(cRet, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Duration
			const cDur = ws.getCell(`K${currRow}`);
			cDur.value = formatDurationDisplay(job.durationHours);
			styleCell(cDur, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Cost Type
			const cCostType = ws.getCell(`L${currRow}`);
			cCostType.value = isReturned ? 'Final Cost' : isOutside ? 'Estimated' : '—';
			styleCell(cCostType, {
				hAlign: 'center',
				fontSize: 9,
				fillColor: rowFill,
				fontColor: isReturned ? ARGB.SUCCESS_GREEN : ARGB.MUTED_TEXT,
				bold: isReturned,
			});

			// Vendor Cost (₹)
			const cCost = ws.getCell(`M${currRow}`);
			cCost.value = vCost;
			styleCell(cCost, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.CURRENCY,
				fillColor: rowFill,
				bold: true,
			});

			// Sent By Staff
			const cSentBy = ws.getCell(`N${currRow}`);
			cSentBy.value = job.sentByUserName || '—';
			styleCell(cSentBy, { fillColor: rowFill, indent: 1, fontSize: 9 });

			// Returned By Staff
			const cRetBy = ws.getCell(`O${currRow}`);
			cRetBy.value = job.returnedByUserName || '—';
			styleCell(cRetBy, { fillColor: rowFill, indent: 1, fontSize: 9 });

			// Dispatch Notes
			const cNotes = ws.getCell(`P${currRow}`);
			cNotes.value = job.notes || '—';
			styleCell(cNotes, { fillColor: rowFill, indent: 1 });

			// Return Notes / Cancellation
			const cRetNotes = ws.getCell(`Q${currRow}`);
			cRetNotes.value = job.returnNotes || '—';
			styleCell(cRetNotes, { fillColor: rowFill, indent: 1 });

			currRow++;
		});

		// Grand Total Row
		const rTotal = ws.getRow(currRow);
		rTotal.height = ROW_HEIGHTS.TOTAL_ROW;

		ws.mergeCells(`A${currRow}:L${currRow}`);
		const cTotLabel = ws.getCell(`A${currRow}`);
		cTotLabel.value = `Total Recorded Movements (${historyList.length})`;
		styleCell(cTotLabel, {
			bold: true,
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			indent: 1,
			border: totalRowBorder,
		});

		const cTotCost = ws.getCell(`M${currRow}`);
		cTotCost.value = sumCost;
		styleCell(cTotCost, {
			hAlign: 'right',
			bold: true,
			numFmt: NUM_FORMATS.CURRENCY,
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			border: totalRowBorder,
		});

		ws.mergeCells(`N${currRow}:Q${currRow}`);
		const cTotEnd = ws.getCell(`N${currRow}`);
		cTotEnd.value = '';
		styleCell(cTotEnd, {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			border: totalRowBorder,
		});

		currRow++;
	}

	ws.autoFilter = {
		from: { row: 4, column: 1 },
		to: { row: currRow > 5 ? currRow - 1 : 5, column: 17 },
	};

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. SHEET 4 — "Vendor Analysis"
// ────────────────────────────────────────────────────────────────────────────

export function buildVendorAnalysisSheet(
	workbook: ExcelJS.Workbook,
	reportData: OutsideJobsReportDto,
	dateRangeLabel: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Vendor Analysis', {
		properties: { defaultRowHeight: ROW_HEIGHTS.DATA_ROW, tabColor: { argb: ARGB.PRIMARY_BLUE } },
		views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }],
		pageSetup: {
			orientation: 'landscape',
			paperSize: 9,
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
		},
	});

	ws.columns = [
		{ key: 'sno', width: 6 },          // A: S.No
		{ key: 'vendor', width: 30 },       // B: Vendor Name
		{ key: 'phone', width: 16 },        // C: Phone Number
		{ key: 'totalJobs', width: 18 },    // D: Total Jobs Assigned
		{ key: 'outside', width: 16 },      // E: Currently Outside
		{ key: 'overdue', width: 15 },      // F: Overdue Jobs
		{ key: 'completed', width: 18 },    // G: Completed / Returned
		{ key: 'cancelled', width: 16 },    // H: Cancelled Jobs
		{ key: 'rate', width: 18 },         // I: Completion Rate %
		{ key: 'totalCost', width: 22 },    // J: Total Vendor Cost (₹)
		{ key: 'costShare', width: 16 },    // K: Cost Share %
	];

	// Row 1: Title Header
	const r1 = ws.getRow(1);
	r1.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells('A1:K1');
	const cTitle = ws.getCell('A1');
	cTitle.value = 'E6 CAR SPA — EXTERNAL VENDOR OPERATIONAL & FINANCIAL ANALYSIS';
	styleCell(cTitle, {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});

	// Row 2: Subtitle Banner
	const r2 = ws.getRow(2);
	r2.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells('A2:K2');
	const cSub = ws.getCell('A2');
	const vendorCount = reportData.vendorSummary?.length ?? 0;
	cSub.value = `Vendor Workload & Turnaround Performance  |  Period: ${dateRangeLabel}  |  Active Vendors: ${vendorCount}`;
	styleCell(cSub, {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});

	// Row 3: Spacer
	const r3 = ws.getRow(3);
	r3.height = ROW_HEIGHTS.SPACER;

	// Row 4: Table Headers
	const r4 = ws.getRow(4);
	r4.height = ROW_HEIGHTS.TABLE_HEADER;

	const headers = [
		{ col: 'A', text: 'S.No', hAlign: 'center' as const },
		{ col: 'B', text: 'Vendor Name', hAlign: 'left' as const },
		{ col: 'C', text: 'Contact Phone', hAlign: 'center' as const },
		{ col: 'D', text: 'Total Jobs Assigned', hAlign: 'right' as const },
		{ col: 'E', text: 'Currently Outside', hAlign: 'right' as const },
		{ col: 'F', text: 'Overdue Jobs', hAlign: 'right' as const },
		{ col: 'G', text: 'Completed / Returned', hAlign: 'right' as const },
		{ col: 'H', text: 'Cancelled Jobs', hAlign: 'right' as const },
		{ col: 'I', text: 'Completion Rate %', hAlign: 'right' as const },
		{ col: 'J', text: 'Total Cost (₹)', hAlign: 'right' as const },
		{ col: 'K', text: 'Cost Share %', hAlign: 'right' as const },
	];

	for (const h of headers) {
		const cell = ws.getCell(`${h.col}4`);
		cell.value = h.text;
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 10,
			bold: true,
			hAlign: h.hAlign,
		});
	}

	let currRow = 5;
	const vendorList = reportData.vendorSummary ?? [];
	const grandTotalCost = vendorList.reduce((acc, v) => acc + (v.totalVendorCost || 0), 0);

	if (vendorList.length === 0) {
		const rEmpty = ws.getRow(currRow);
		rEmpty.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${currRow}:K${currRow}`);
		const cEmpty = ws.getCell(`A${currRow}`);
		cEmpty.value = 'No vendor operational data available for this reporting period.';
		styleCell(cEmpty, {
			fillColor: ARGB.LIGHT_GRAY_FILL,
			fontColor: ARGB.MUTED_TEXT,
			italic: true,
			hAlign: 'center',
		});
		currRow++;
	} else {
		vendorList.forEach((v, idx) => {
			const row = ws.getRow(currRow);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;

			const completionRate = v.totalJobs > 0 ? (v.completedJobs || 0) / v.totalJobs : 0;
			const costShare = grandTotalCost > 0 ? (v.totalVendorCost || 0) / grandTotalCost : 0;

			// S.No
			const cSno = ws.getCell(`A${currRow}`);
			cSno.value = idx + 1;
			styleCell(cSno, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Vendor Name
			const cName = ws.getCell(`B${currRow}`);
			cName.value = v.vendorName || 'Unknown Vendor';
			styleCell(cName, { bold: true, fillColor: rowFill, indent: 1 });

			// Contact Phone
			const cPhone = ws.getCell(`C${currRow}`);
			cPhone.value = v.phone || '—';
			styleCell(cPhone, { hAlign: 'center', fillColor: rowFill, fontSize: 9 });

			// Total Jobs
			const cTotal = ws.getCell(`D${currRow}`);
			cTotal.value = v.totalJobs || 0;
			styleCell(cTotal, { hAlign: 'right', bold: true, numFmt: NUM_FORMATS.INTEGER, fillColor: rowFill });

			// Currently Outside
			const cActive = ws.getCell(`E${currRow}`);
			cActive.value = v.currentlyOutside || 0;
			styleCell(cActive, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: v.currentlyOutside > 0 ? ARGB.WARNING_LIGHT_ORANGE : rowFill,
				fontColor: v.currentlyOutside > 0 ? ARGB.WARNING_ORANGE : ARGB.DARK_TEXT,
				bold: v.currentlyOutside > 0,
			});

			// Overdue Jobs
			const cOverdue = ws.getCell(`F${currRow}`);
			cOverdue.value = v.overdueJobs || 0;
			styleCell(cOverdue, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: v.overdueJobs > 0 ? ARGB.DANGER_LIGHT_RED : rowFill,
				fontColor: v.overdueJobs > 0 ? ARGB.DANGER_RED : ARGB.DARK_TEXT,
				bold: v.overdueJobs > 0,
			});

			// Completed / Returned
			const cComp = ws.getCell(`G${currRow}`);
			cComp.value = v.completedJobs || 0;
			styleCell(cComp, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: rowFill,
				fontColor: v.completedJobs > 0 ? ARGB.SUCCESS_GREEN : ARGB.DARK_TEXT,
				bold: v.completedJobs > 0,
			});

			// Cancelled
			const cCanc = ws.getCell(`H${currRow}`);
			cCanc.value = v.cancelledJobs || 0;
			styleCell(cCanc, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.INTEGER,
				fillColor: rowFill,
				fontColor: ARGB.MUTED_TEXT,
			});

			// Completion Rate %
			const cRate = ws.getCell(`I${currRow}`);
			cRate.value = completionRate;
			styleCell(cRate, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.PERCENT,
				fillColor: rowFill,
				bold: true,
			});

			// Total Cost
			const cCost = ws.getCell(`J${currRow}`);
			cCost.value = v.totalVendorCost || 0;
			styleCell(cCost, {
				hAlign: 'right',
				bold: true,
				numFmt: NUM_FORMATS.CURRENCY,
				fillColor: rowFill,
			});

			// Cost Share %
			const cShare = ws.getCell(`K${currRow}`);
			cShare.value = costShare;
			styleCell(cShare, {
				hAlign: 'right',
				numFmt: NUM_FORMATS.PERCENT,
				fillColor: rowFill,
			});

			currRow++;
		});

		// Grand Total Row
		const rTotal = ws.getRow(currRow);
		rTotal.height = ROW_HEIGHTS.TOTAL_ROW;

		ws.mergeCells(`A${currRow}:C${currRow}`);
		const cTotLabel = ws.getCell(`A${currRow}`);
		cTotLabel.value = 'Total All Vendors';
		styleCell(cTotLabel, {
			bold: true,
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			indent: 1,
			border: totalRowBorder,
		});

		const sumTotalJobs = vendorList.reduce((acc, v) => acc + (v.totalJobs || 0), 0);
		const sumActive = vendorList.reduce((acc, v) => acc + (v.currentlyOutside || 0), 0);
		const sumOverdue = vendorList.reduce((acc, v) => acc + (v.overdueJobs || 0), 0);
		const sumCompleted = vendorList.reduce((acc, v) => acc + (v.completedJobs || 0), 0);
		const sumCancelled = vendorList.reduce((acc, v) => acc + (v.cancelledJobs || 0), 0);
		const overallCompRate = sumTotalJobs > 0 ? sumCompleted / sumTotalJobs : 0;
		const sumCost = grandTotalCost;

		const totalCols = [
			{ col: 'D', val: sumTotalJobs, fmt: NUM_FORMATS.INTEGER },
			{ col: 'E', val: sumActive, fmt: NUM_FORMATS.INTEGER },
			{ col: 'F', val: sumOverdue, fmt: NUM_FORMATS.INTEGER },
			{ col: 'G', val: sumCompleted, fmt: NUM_FORMATS.INTEGER },
			{ col: 'H', val: sumCancelled, fmt: NUM_FORMATS.INTEGER },
			{ col: 'I', val: overallCompRate, fmt: NUM_FORMATS.PERCENT },
			{ col: 'J', val: sumCost, fmt: NUM_FORMATS.CURRENCY },
			{ col: 'K', val: 1.0, fmt: NUM_FORMATS.PERCENT },
		];

		for (const tc of totalCols) {
			const cell = ws.getCell(`${tc.col}${currRow}`);
			cell.value = tc.val;
			styleCell(cell, {
				hAlign: 'right',
				bold: true,
				numFmt: tc.fmt,
				fillColor: ARGB.SECONDARY_LIGHT_BLUE,
				fontColor: ARGB.PRIMARY_DARK,
				border: totalRowBorder,
			});
		}
		currRow++;
	}

	ws.autoFilter = {
		from: { row: 4, column: 1 },
		to: { row: currRow > 5 ? currRow - 1 : 5, column: 11 },
	};

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. WORKBOOK BUILDER & BROWSER DOWNLOAD DISPATCHER
// ────────────────────────────────────────────────────────────────────────────

export function createOutsideJobsWorkbook(
	reportData: OutsideJobsReportDto,
	dateRangeLabel: string = 'All Time'
): ExcelJS.Workbook {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'E6 Car Spa Management Suite';
	workbook.lastModifiedBy = 'E6 Car Spa Management Suite';
	workbook.created = new Date();
	workbook.modified = new Date();

	// Sheet 1: Executive Summary
	buildExecutiveSummarySheet(workbook, reportData, dateRangeLabel);

	// Sheet 2: Currently Outside
	buildCurrentlyOutsideSheet(workbook, reportData, dateRangeLabel);

	// Sheet 3: Movement History
	buildMovementHistorySheet(workbook, reportData, dateRangeLabel);

	// Sheet 4: Vendor Analysis
	buildVendorAnalysisSheet(workbook, reportData, dateRangeLabel);

	return workbook;
}

export async function generateAndDownloadOutsideJobsReport(
	reportData: OutsideJobsReportDto,
	dateRangeLabel: string = 'All Time',
	fileName?: string
): Promise<string> {
	const workbook = createOutsideJobsWorkbook(reportData, dateRangeLabel);
	const sanitizedScope = dateRangeLabel.replace(/[\s/\\:]+/g, '_');
	const defaultFileName = fileName || `E6_Outside_Jobs_Report_${sanitizedScope}_${new Date().toISOString().slice(0, 10)}.xlsx`;

	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});

	const url = window.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = defaultFileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);

	return defaultFileName;
}

/**
 * Backward compatibility alias for generateOutsideJobsExcel
 */
export const generateOutsideJobsExcel = generateAndDownloadOutsideJobsReport;
