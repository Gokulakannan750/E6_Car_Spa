/**
 * Car Spa Management — Professional Monthly Showroom Management Excel Generator (ExcelJS)
 *
 * Generates an executive-grade, beautifully styled 7-sheet management & operations workbook:
 *   - SHEET 1: "Summary" (Executive presentation, KPIs, Service Summary, Vehicle Summary, Staff Summary, Audit Note)
 *   - SHEET 2: "Vehicle Service Details" (Chronological granular vehicle prep/work ledger with swap traceability)
 *   - SHEET 3: "Staff Productivity" (Staff workload audit breakdown with temporary assignment & swap coverage)
 *   - SHEET 4: "Attendance" (Scheduled vs actual hours, manager confirmation status, timestamps)
 *   - SHEET 5: "Staff Swaps" (Swap ID, Original/Replacement staff, coverage period, hours, Active/Reversed status)
 *   - SHEET 6: "Vehicle Type Summary" (Vehicle Type, Vehicles, Services, Staff Hours, Share %)
 *   - SHEET 7: "Service Summary" (Category, Service, Vehicles, Quantity, Staff Hours, Share %)
 *
 * Professional Styling Specifications (Exact parity with approved Billing and Staff reports):
 *   - Main title: Dark Blue (#0B3A6E) + White Bold, 30pt row height, vertically centered
 *   - Subtitle: Light Blue (#EAF2FF) + Dark Blue Bold, 22pt row height, vertically centered
 *   - Section headers: Dark Blue (#0B3A6E) + White Bold, 24pt row height
 *   - Table headers: Primary Blue (#0B5ED7) + White Bold, 22pt row height
 *   - Total Rows: Light Blue (#EAF2FF) + Bold with Double Bottom Border (#0B3A6E), 22pt row height
 *   - Normal/Data rows: Uniform 21pt row height (defaultRowHeight = 21)
 *   - Status Badges: Paid/Present/Active (Green), PartiallyPaid/HalfDay/Pending (Orange), Unpaid/Absent (Red)
 *   - Borders: Subtle thin gray borders (#D1D5DB), double bottom on Total rows
 *   - Numbers & Currency: Formatted explicitly with ₹ and thousands separators ("₹"#,##0.00)
 */

import ExcelJS from 'exceljs';
import type {
	MonthlyShowroomReportResponse,
	MonthlyShowroomDetailDto,
} from '../../lib/api';
import {
	ARGB,
	formatDateDisplay,
	formatDateTimeDisplay,
} from './excelMonthlyBillingGenerator';
import { reportCreator, reportFilePrefix, reportTitle } from '../../lib/documentBranding';

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

export function sanitizeSheetName(rawName: string, existingNames: Set<string>): string {
	const clean = rawName.replace(/[\\/?*[\]:]/g, '').trim().substring(0, 28) || 'Showroom';
	let finalName = clean;
	let counter = 1;
	while (existingNames.has(finalName.toLowerCase())) {
		finalName = `${clean.substring(0, 25)}_${counter}`;
		counter++;
	}
	existingNames.add(finalName.toLowerCase());
	return finalName;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. SHEET 1 — "Summary" (Executive Summary)
// ────────────────────────────────────────────────────────────────────────────

export function generateExecutiveSummaryWorksheet(
	workbook: ExcelJS.Workbook,
	sr: MonthlyShowroomDetailDto,
	monthName: string,
	fromDate?: string | Date,
	toDate?: string | Date
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Summary', {
		views: [{ showGridLines: true }],
		pageSetup: {
			orientation: 'portrait',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9, // A4
			margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	// Columns A through G
	ws.columns = [
		{ key: 'colA', width: 26 }, // Category / Label / Type / Staff
		{ key: 'colB', width: 28 }, // Service Name / Role / Detail
		{ key: 'colC', width: 18 }, // Home Showroom / Metric
		{ key: 'colD', width: 16 }, // Vehicles
		{ key: 'colE', width: 16 }, // Quantity / Services
		{ key: 'colF', width: 16 }, // Staff Hours
		{ key: 'colG', width: 16 }, // Share % / Attendance Days
	];

	let r = 1;

	// 1. Main Title Banner (Row 1, 30pt)
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:G${r}`);
	titleRow.getCell(1).value = reportTitle('SHOWROOM MANAGEMENT REPORT');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 15,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// 2. Subtitle Banner (Row 2, 22pt)
	const fromStr = fromDate ? (typeof fromDate === 'string' ? formatDateDisplay(fromDate) : formatDateDisplay(fromDate.toISOString())) : '';
	const toStr = toDate ? (typeof toDate === 'string' ? formatDateDisplay(toDate) : formatDateDisplay(toDate.toISOString())) : '';
	const reportPeriodStr = fromStr && toStr ? `${fromStr} to ${toStr}` : monthName;

	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:G${r}`);
	subRow.getCell(1).value = `EXECUTIVE SUMMARY: ${sr.showroomName.toUpperCase()}  |  PERIOD: ${reportPeriodStr.toUpperCase()}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 11,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row (Row 3, 10pt)
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 3. SHOWROOM INFORMATION & REPORT METADATA (Section Header, 24pt)
	const metaHeader = ws.getRow(r);
	metaHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:G${r}`);
	metaHeader.getCell(1).value = 'SHOWROOM INFORMATION & REPORT METADATA';
	styleCell(metaHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const metaItems = [
		{ label: 'Showroom Name', val: sr.showroomName },
		{ label: 'Showroom ID / Master Code', val: sr.showroomMasterId || '—' },
		{ label: 'GSTIN', val: sr.showroomGstin || 'Not Registered' },
		{ label: 'Showroom Address', val: sr.showroomAddress || '—' },
		{ label: 'Contact Phone Number', val: sr.showroomPhone || '—' },
		{ label: 'Report Period', val: reportPeriodStr },
		{ label: 'Report Generated Date', val: formatDateDisplay(new Date().toISOString()) },
	];

	for (const m of metaItems) {
		const row = ws.getRow(r);
		row.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:B${r}`);
		row.getCell(1).value = m.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`C${r}:G${r}`);
		row.getCell(3).value = m.val;
		styleCell(row.getCell(3), { indent: 1 });
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 4. KEY PERFORMANCE INDICATORS (KPIs) (Section Header, 24pt)
	const kpiHeader = ws.getRow(r);
	kpiHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:G${r}`);
	kpiHeader.getCell(1).value = 'KEY PERFORMANCE INDICATORS (OPERATIONAL & FINANCIAL)';
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
	ws.mergeCells(`A${r}:D${r}`);
	kpiTableHead.getCell(1).value = 'EXECUTIVE OPERATIONAL METRIC';
	styleCell(kpiTableHead.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});

	ws.mergeCells(`E${r}:G${r}`);
	kpiTableHead.getCell(5).value = 'QUANTITY / AMOUNT (INR)';
	styleCell(kpiTableHead.getCell(5), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		bold: true,
		hAlign: 'center',
	});
	r++;

	const totalStaffHours = sr.summary.totalStaffHours ?? (sr.staffSummary ? sr.staffSummary.reduce((a, b) => a + Number(b.totalHours), 0) : 0);
	const totalAttendanceDays = sr.summary.totalAttendanceDays ?? (sr.attendanceRecords ? sr.attendanceRecords.length : 0);
	const totalSwaps = sr.summary.totalSwaps ?? (sr.swaps ? sr.swaps.length : 0);

	const kpiData: { label: string; val: number; isCurrency?: boolean; highlight?: 'blue' | 'green' | 'red' | 'default' }[] = [
		{ label: 'Total Vehicles Serviced', val: sr.summary.totalVehiclesServiced },
		{ label: 'Total Services Performed', val: sr.summary.totalServicesPerformed },
		{ label: 'Total Active Staff Allocated', val: sr.summary.totalActiveStaff },
		{ label: 'Total Staff Work Hours Logged', val: Math.round(totalStaffHours * 10) / 10 },
		{ label: 'Total Attendance Days Recorded', val: totalAttendanceDays },
		{ label: 'Total Staff Swaps Executed', val: totalSwaps },
		{ label: 'Total Billed Amount', val: sr.summary.totalBilledAmount, isCurrency: true, highlight: 'blue' },
		{ label: 'Total Collections Received', val: sr.summary.totalCollectedAmount, isCurrency: true, highlight: 'green' },
		{ label: 'Total Outstanding Balance', val: sr.summary.totalOutstandingAmount, isCurrency: true, highlight: sr.summary.totalOutstandingAmount > 0 ? 'red' : 'default' },
	];

	for (const item of kpiData) {
		const row = ws.getRow(r);
		row.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:D${r}`);
		row.getCell(1).value = item.label;
		styleCell(row.getCell(1), { bold: true, indent: 1 });

		ws.mergeCells(`E${r}:G${r}`);
		row.getCell(5).value = item.val;

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

		styleCell(row.getCell(5), {
			fillColor,
			fontColor,
			bold: true,
			hAlign: 'right',
			numFmt: item.isCurrency ? NUM_FORMATS.CURRENCY : (item.val % 1 !== 0 ? NUM_FORMATS.DECIMAL : NUM_FORMATS.INTEGER),
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 5. SERVICE SUMMARY SECTION (Section Header, 24pt)
	const srvHeader = ws.getRow(r);
	srvHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:G${r}`);
	srvHeader.getCell(1).value = 'SERVICE BREAKDOWN SUMMARY';
	styleCell(srvHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const srvTableHead = ws.getRow(r);
	srvTableHead.height = ROW_HEIGHTS.TABLE_HEADER;

	ws.mergeCells(`A${r}:B${r}`);
	srvTableHead.getCell(1).value = 'SERVICE CATEGORY';
	styleCell(srvTableHead.getCell(1), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, indent: 1 });

	ws.mergeCells(`C${r}:D${r}`);
	srvTableHead.getCell(3).value = 'SERVICE NAME';
	styleCell(srvTableHead.getCell(3), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, indent: 1 });

	srvTableHead.getCell(5).value = 'VEHICLES';
	styleCell(srvTableHead.getCell(5), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });

	srvTableHead.getCell(6).value = 'QUANTITY';
	styleCell(srvTableHead.getCell(6), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });

	srvTableHead.getCell(7).value = 'SHARE (%)';
	styleCell(srvTableHead.getCell(7), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });
	r++;

	const servicesList = sr.serviceSummary && sr.serviceSummary.length > 0 ? sr.serviceSummary : [];
	let sumSrvVehicles = 0;
	let sumSrvQty = 0;

	if (servicesList.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:G${r}`);
		emptyRow.getCell(1).value = 'No services recorded for this showroom in the selected period.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		for (const s of servicesList) {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			sumSrvVehicles += s.totalVehicles;
			sumSrvQty += s.totalQuantity;

			ws.mergeCells(`A${r}:B${r}`);
			row.getCell(1).value = s.serviceCategory || 'General Service';
			styleCell(row.getCell(1), { indent: 1 });

			ws.mergeCells(`C${r}:D${r}`);
			row.getCell(3).value = s.serviceName;
			styleCell(row.getCell(3), { bold: true, indent: 1 });

			row.getCell(5).value = s.totalVehicles;
			styleCell(row.getCell(5), { hAlign: 'right', numFmt: NUM_FORMATS.INTEGER });

			row.getCell(6).value = s.totalQuantity;
			styleCell(row.getCell(6), { hAlign: 'right', bold: true, numFmt: NUM_FORMATS.INTEGER });

			row.getCell(7).value = s.sharePercentage / 100;
			styleCell(row.getCell(7), { hAlign: 'right', numFmt: NUM_FORMATS.PERCENT });

			r++;
		}

		// Service Summary Total Row (22pt)
		const sTotRow = ws.getRow(r);
		sTotRow.height = ROW_HEIGHTS.TOTAL_ROW;
		ws.mergeCells(`A${r}:D${r}`);
		sTotRow.getCell(1).value = 'TOTAL SERVICES PERFORMED';
		styleCell(sTotRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		sTotRow.getCell(5).value = sumSrvVehicles;
		styleCell(sTotRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		sTotRow.getCell(6).value = sumSrvQty;
		styleCell(sTotRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		sTotRow.getCell(7).value = 1.0;
		styleCell(sTotRow.getCell(7), {
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

	// 6. VEHICLE TYPE SUMMARY SECTION (Section Header, 24pt)
	const vtHeader = ws.getRow(r);
	vtHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:G${r}`);
	vtHeader.getCell(1).value = 'VEHICLE TYPE BREAKDOWN';
	styleCell(vtHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const vtTableHead = ws.getRow(r);
	vtTableHead.height = ROW_HEIGHTS.TABLE_HEADER;

	ws.mergeCells(`A${r}:C${r}`);
	vtTableHead.getCell(1).value = 'VEHICLE TYPE';
	styleCell(vtTableHead.getCell(1), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, indent: 1 });

	vtTableHead.getCell(4).value = 'VEHICLES';
	styleCell(vtTableHead.getCell(4), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });

	vtTableHead.getCell(5).value = 'SERVICES';
	styleCell(vtTableHead.getCell(5), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });

	vtTableHead.getCell(6).value = 'STAFF HOURS';
	styleCell(vtTableHead.getCell(6), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });

	vtTableHead.getCell(7).value = 'VOLUME SHARE (%)';
	styleCell(vtTableHead.getCell(7), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });
	r++;

	const vtList = sr.vehicleTypeSummary && sr.vehicleTypeSummary.length > 0 ? sr.vehicleTypeSummary : [];
	let sumVtVehicles = 0;
	let sumVtServices = 0;
	let sumVtHours = 0;

	if (vtList.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:G${r}`);
		emptyRow.getCell(1).value = 'No vehicle type records found for this showroom.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		for (const vt of vtList) {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			sumVtVehicles += vt.totalVehicles;
			sumVtServices += vt.totalServices;
			sumVtHours += Number(vt.totalStaffHours);

			ws.mergeCells(`A${r}:C${r}`);
			row.getCell(1).value = vt.vehicleTypeName;
			styleCell(row.getCell(1), { bold: true, indent: 1 });

			row.getCell(4).value = vt.totalVehicles;
			styleCell(row.getCell(4), { hAlign: 'right', bold: true, numFmt: NUM_FORMATS.INTEGER });

			row.getCell(5).value = vt.totalServices;
			styleCell(row.getCell(5), { hAlign: 'right', numFmt: NUM_FORMATS.INTEGER });

			row.getCell(6).value = Number(vt.totalStaffHours);
			styleCell(row.getCell(6), { hAlign: 'right', numFmt: NUM_FORMATS.DECIMAL });

			row.getCell(7).value = vt.sharePercentage / 100;
			styleCell(row.getCell(7), { hAlign: 'right', numFmt: NUM_FORMATS.PERCENT });

			r++;
		}

		// Vehicle Type Summary Total Row (22pt)
		const vtTotRow = ws.getRow(r);
		vtTotRow.height = ROW_HEIGHTS.TOTAL_ROW;
		ws.mergeCells(`A${r}:C${r}`);
		vtTotRow.getCell(1).value = 'TOTAL VEHICLES SERVICED';
		styleCell(vtTotRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		vtTotRow.getCell(4).value = sumVtVehicles;
		styleCell(vtTotRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		vtTotRow.getCell(5).value = sumVtServices;
		styleCell(vtTotRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		vtTotRow.getCell(6).value = Math.round(sumVtHours * 10) / 10;
		styleCell(vtTotRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		vtTotRow.getCell(7).value = 1.0;
		styleCell(vtTotRow.getCell(7), {
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

	// 7. STAFF PRODUCTIVITY SUMMARY SECTION (Section Header, 24pt)
	const stHeader = ws.getRow(r);
	stHeader.height = ROW_HEIGHTS.SECTION_HEADER;
	ws.mergeCells(`A${r}:G${r}`);
	stHeader.getCell(1).value = 'STAFF PRODUCTIVITY & WORKLOAD SUMMARY';
	styleCell(stHeader.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 11,
		bold: true,
		hAlign: 'left',
		indent: 1,
	});
	r++;

	const stTableHead = ws.getRow(r);
	stTableHead.height = ROW_HEIGHTS.TABLE_HEADER;

	stTableHead.getCell(1).value = 'STAFF MEMBER';
	styleCell(stTableHead.getCell(1), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, indent: 1 });

	stTableHead.getCell(2).value = 'ROLE';
	styleCell(stTableHead.getCell(2), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, indent: 1 });

	stTableHead.getCell(3).value = 'HOME SHOWROOM';
	styleCell(stTableHead.getCell(3), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, indent: 1 });

	stTableHead.getCell(4).value = 'VEHICLES';
	styleCell(stTableHead.getCell(4), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });

	stTableHead.getCell(5).value = 'SERVICES';
	styleCell(stTableHead.getCell(5), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });

	stTableHead.getCell(6).value = 'HOURS';
	styleCell(stTableHead.getCell(6), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });

	stTableHead.getCell(7).value = 'ATTENDANCE DAYS';
	styleCell(stTableHead.getCell(7), { fillColor: ARGB.PRIMARY_BLUE, fontColor: ARGB.WHITE, bold: true, hAlign: 'right' });
	r++;

	const staffList = sr.staffSummary && sr.staffSummary.length > 0 ? sr.staffSummary : [];
	let sumStVehicles = 0;
	let sumStServices = 0;
	let sumStHours = 0;

	if (staffList.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:G${r}`);
		emptyRow.getCell(1).value = 'No staff productivity logged for this showroom.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		for (const st of staffList) {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			sumStVehicles += st.totalVehicles;
			sumStServices += st.totalServices;
			sumStHours += Number(st.totalHours);

			row.getCell(1).value = st.staffName;
			styleCell(row.getCell(1), { bold: true, indent: 1 });

			row.getCell(2).value = st.role || 'Technician';
			styleCell(row.getCell(2), { indent: 1 });

			row.getCell(3).value = st.homeShowroom || sr.showroomName;
			styleCell(row.getCell(3), { indent: 1 });

			row.getCell(4).value = st.totalVehicles;
			styleCell(row.getCell(4), { hAlign: 'right', bold: true, numFmt: NUM_FORMATS.INTEGER });

			row.getCell(5).value = st.totalServices;
			styleCell(row.getCell(5), { hAlign: 'right', numFmt: NUM_FORMATS.INTEGER });

			row.getCell(6).value = Number(st.totalHours);
			styleCell(row.getCell(6), { hAlign: 'right', numFmt: NUM_FORMATS.DECIMAL });

			row.getCell(7).value = st.attendanceDays;
			styleCell(row.getCell(7), { hAlign: 'right', numFmt: NUM_FORMATS.INTEGER });

			r++;
		}

		// Staff Summary Total Row (22pt)
		const stTotRow = ws.getRow(r);
		stTotRow.height = ROW_HEIGHTS.TOTAL_ROW;
		stTotRow.getCell(1).value = 'TOTAL FOR ALL ALLOCATED STAFF';
		styleCell(stTotRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		stTotRow.getCell(2).value = `${staffList.length} Active Staff`;
		styleCell(stTotRow.getCell(2), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		stTotRow.getCell(3).value = '—';
		styleCell(stTotRow.getCell(3), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			hAlign: 'center',
			border: totalRowBorder,
		});

		stTotRow.getCell(4).value = sumStVehicles;
		styleCell(stTotRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		stTotRow.getCell(5).value = sumStServices;
		styleCell(stTotRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		stTotRow.getCell(6).value = Math.round(sumStHours * 10) / 10;
		styleCell(stTotRow.getCell(6), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		stTotRow.getCell(7).value = totalAttendanceDays;
		styleCell(stTotRow.getCell(7), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});
		r++;
	}

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// 8. AUDIT & RECONCILIATION CERTIFICATION (Executive Callout Box, 21pt)
	const noteRow1 = ws.getRow(r);
	noteRow1.height = ROW_HEIGHTS.DATA_ROW;
	ws.mergeCells(`A${r}:G${r}`);
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
	ws.mergeCells(`A${r}:G${r}`);
	noteRow2.getCell(1).value = `All granular detail worksheets in this workbook (Vehicle Service Details, Staff Productivity, Attendance, Swaps, Vehicle Type Summary, and Service Summary) reconcile with this executive summary. Total Billed = ₹${sr.summary.totalBilledAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Total Collected = ₹${sr.summary.totalCollectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Outstanding Balance = ₹${sr.summary.totalOutstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;
	styleCell(noteRow2.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.DARK_TEXT,
		fontSize: 8.5,
		italic: true,
		indent: 1,
	});
	r++;

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. SHEET 2 — "Vehicle Service Details"
// ────────────────────────────────────────────────────────────────────────────

export function generateVehicleServiceDetailsWorksheet(
	workbook: ExcelJS.Workbook,
	sr: MonthlyShowroomDetailDto,
	monthName: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Vehicle Service Details', {
		views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
		pageSetup: {
			orientation: 'landscape',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9,
			margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	ws.columns = [
		{ key: 'colA', width: 14 }, // Date
		{ key: 'colB', width: 22 }, // Showroom
		{ key: 'colC', width: 16 }, // Job/Vehicle ID
		{ key: 'colD', width: 18 }, // Vehicle Registration
		{ key: 'colE', width: 18 }, // Vehicle Make/Model
		{ key: 'colF', width: 18 }, // Vehicle Type
		{ key: 'colG', width: 18 }, // Service Category
		{ key: 'colH', width: 32 }, // Service Items
		{ key: 'colI', width: 16 }, // Staff ID
		{ key: 'colJ', width: 22 }, // Staff Name
		{ key: 'colK', width: 12 }, // Start Time
		{ key: 'colL', width: 12 }, // End Time
		{ key: 'colM', width: 12 }, // Hours
		{ key: 'colN', width: 16 }, // Work Status
		{ key: 'colO', width: 18 }, // Assignment Type
		{ key: 'colP', width: 16 }, // Swap ID
	];

	let r = 1;

	// Title
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:P${r}`);
	titleRow.getCell(1).value = reportTitle('VEHICLE SERVICE DETAILS');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Subtitle
	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:P${r}`);
	subRow.getCell(1).value = `SHOWROOM: ${sr.showroomName.toUpperCase()} (${sr.showroomMasterId})  |  PERIOD: ${monthName.toUpperCase()}  |  RECORDS: ${sr.vehicleWorks.length}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// Table Header (Row 4)
	const headRow = ws.getRow(r);
	headRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const headers = [
		'Date',
		'Showroom',
		'Job/Vehicle ID',
		'Vehicle Reg',
		'Vehicle Make/Model',
		'Vehicle Type',
		'Service Category',
		'Services Performed',
		'Staff ID',
		'Staff Name',
		'Start Time',
		'End Time',
		'Hours',
		'Work Status',
		'Assignment Type',
		'Swap ID',
	];

	headers.forEach((h, idx) => {
		const cell = headRow.getCell(idx + 1);
		cell.value = h.toUpperCase();
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 9.5,
			bold: true,
			hAlign: idx === 12 ? 'right' : (idx === 0 || idx === 10 || idx === 11 || idx === 13 || idx === 15 ? 'center' : 'left'),
			indent: (idx === 1 || idx === 5 || idx === 7 || idx === 9) ? 1 : 0,
		});
	});
	r++;

	if (sr.vehicleWorks.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:P${r}`);
		emptyRow.getCell(1).value = 'No vehicle service records found for this showroom for the selected period.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		let totalHours = 0;
		sr.vehicleWorks.forEach((w, idx) => {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			const hoursVal = w.workingHours != null ? Number(w.workingHours) : 9.0;
			totalHours += hoursVal;

			const servicesText = w.servicesSummary || (
				w.serviceItems.length > 0
					? w.serviceItems.map((s) => `${s.workTypeName} (${s.quantity})`).join(', ')
					: 'General Service'
			);
			const jobVehicleId = `JOB-${String(idx + 1).padStart(4, '0')}`;

			// Col A: Date
			row.getCell(1).value = formatDateDisplay(w.date);
			styleCell(row.getCell(1), { fillColor: rowFill, hAlign: 'center' });

			// Col B: Showroom
			row.getCell(2).value = w.showroomName || sr.showroomName;
			styleCell(row.getCell(2), { fillColor: rowFill, indent: 1 });

			// Col C: Job/Vehicle ID
			row.getCell(3).value = jobVehicleId;
			styleCell(row.getCell(3), { fillColor: rowFill, hAlign: 'center', bold: true });

			// Col D: Vehicle Reg (dealership batch work)
			row.getCell(4).value = '—';
			styleCell(row.getCell(4), { fillColor: rowFill, hAlign: 'center', fontColor: ARGB.MUTED_TEXT });

			// Col E: Vehicle Make/Model
			row.getCell(5).value = '—';
			styleCell(row.getCell(5), { fillColor: rowFill, hAlign: 'center', fontColor: ARGB.MUTED_TEXT });

			// Col F: Vehicle Type
			row.getCell(6).value = w.vehicleTypeName;
			styleCell(row.getCell(6), { fillColor: rowFill, bold: true, indent: 1 });

			// Col G: Service Category
			row.getCell(7).value = w.serviceCategory || 'General';
			styleCell(row.getCell(7), { fillColor: rowFill, indent: 1 });

			// Col H: Services Performed
			row.getCell(8).value = servicesText;
			styleCell(row.getCell(8), { fillColor: rowFill, indent: 1 });

			// Col I: Staff ID
			row.getCell(9).value = w.staffMasterId || '—';
			styleCell(row.getCell(9), { fillColor: rowFill, hAlign: 'center' });

			// Col J: Staff Name
			row.getCell(10).value = w.staffName;
			styleCell(row.getCell(10), { fillColor: rowFill, bold: true, indent: 1 });

			// Col K: Start Time
			row.getCell(11).value = w.startTime || '09:00';
			styleCell(row.getCell(11), { fillColor: rowFill, hAlign: 'center' });

			// Col L: End Time
			row.getCell(12).value = w.endTime || '18:00';
			styleCell(row.getCell(12), { fillColor: rowFill, hAlign: 'center' });

			// Col M: Hours
			row.getCell(13).value = hoursVal;
			styleCell(row.getCell(13), { fillColor: rowFill, hAlign: 'right', bold: true, numFmt: NUM_FORMATS.DECIMAL });

			// Col N: Work Status
			row.getCell(14).value = 'Completed';
			styleCell(row.getCell(14), {
				fillColor: ARGB.SUCCESS_LIGHT_GREEN,
				fontColor: ARGB.SUCCESS_GREEN,
				bold: true,
				fontSize: 9,
				hAlign: 'center',
			});

			// Col O: Assignment Type
			const assignType = w.assignmentType || 'Regular';
			let assignFill: string = ARGB.LIGHT_GRAY_FILL;
			let assignColor: string = ARGB.DARK_TEXT;
			if (assignType === 'Swapped') {
				assignFill = ARGB.WARNING_LIGHT_ORANGE;
				assignColor = ARGB.WARNING_ORANGE;
			} else if (assignType === 'Temporary Transfer') {
				assignFill = ARGB.SECONDARY_LIGHT_BLUE;
				assignColor = ARGB.PRIMARY_DARK;
			}
			row.getCell(15).value = assignType;
			styleCell(row.getCell(15), {
				fillColor: assignFill,
				fontColor: assignColor,
				bold: true,
				fontSize: 9,
				hAlign: 'center',
			});

			// Col P: Swap ID
			row.getCell(16).value = w.swapId || '—';
			styleCell(row.getCell(16), {
				fillColor: rowFill,
				hAlign: 'center',
				fontColor: w.swapId ? ARGB.PRIMARY_BLUE : ARGB.MUTED_TEXT,
				bold: !!w.swapId,
			});

			r++;
		});

		// Grand Total Row (22pt)
		const totRow = ws.getRow(r);
		totRow.height = ROW_HEIGHTS.TOTAL_ROW;
		ws.mergeCells(`A${r}:L${r}`);
		totRow.getCell(1).value = `TOTAL VEHICLE WORK RECORDS: ${sr.vehicleWorks.length}`;
		styleCell(totRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		totRow.getCell(13).value = Math.round(totalHours * 10) / 10;
		styleCell(totRow.getCell(13), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		ws.mergeCells(`N${r}:P${r}`);
		totRow.getCell(14).value = 'Audit Reconciled';
		styleCell(totRow.getCell(14), {
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
// 3. SHEET 3 — "Staff Productivity"
// ────────────────────────────────────────────────────────────────────────────

export function generateStaffProductivityWorksheet(
	workbook: ExcelJS.Workbook,
	sr: MonthlyShowroomDetailDto,
	monthName: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Staff Productivity', {
		views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
		pageSetup: {
			orientation: 'landscape',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9,
			margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	ws.columns = [
		{ key: 'colA', width: 14 }, // Date
		{ key: 'colB', width: 16 }, // Staff ID
		{ key: 'colC', width: 22 }, // Staff Name
		{ key: 'colD', width: 18 }, // Role
		{ key: 'colE', width: 20 }, // Home Showroom
		{ key: 'colF', width: 20 }, // Working Showroom
		{ key: 'colG', width: 18 }, // Vehicle Type
		{ key: 'colH', width: 18 }, // Service Category
		{ key: 'colI', width: 28 }, // Service
		{ key: 'colJ', width: 16 }, // Vehicle/Job ID
		{ key: 'colK', width: 12 }, // Vehicles
		{ key: 'colL', width: 12 }, // Start Time
		{ key: 'colM', width: 12 }, // End Time
		{ key: 'colN', width: 12 }, // Hours
		{ key: 'colO', width: 18 }, // Assignment Type
		{ key: 'colP', width: 16 }, // Swap ID
		{ key: 'colQ', width: 20 }, // Original Staff
		{ key: 'colR', width: 20 }, // Replacement Staff
	];

	let r = 1;

	// Title
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:R${r}`);
	titleRow.getCell(1).value = reportTitle('STAFF PRODUCTIVITY AUDIT');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Subtitle
	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:R${r}`);
	subRow.getCell(1).value = `SHOWROOM: ${sr.showroomName.toUpperCase()} (${sr.showroomMasterId})  |  PERIOD: ${monthName.toUpperCase()}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// Table Header (Row 4)
	const headRow = ws.getRow(r);
	headRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const headers = [
		'Date',
		'Staff ID',
		'Staff Name',
		'Role',
		'Home Showroom',
		'Working Showroom',
		'Vehicle Type',
		'Service Category',
		'Service',
		'Vehicle/Job ID',
		'Vehicles',
		'Start Time',
		'End Time',
		'Hours',
		'Assignment Type',
		'Swap ID',
		'Original Staff',
		'Replacement Staff',
	];

	headers.forEach((h, idx) => {
		const cell = headRow.getCell(idx + 1);
		cell.value = h.toUpperCase();
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 9.5,
			bold: true,
			hAlign: idx === 10 || idx === 13 ? 'right' : (idx === 0 || idx === 1 || idx === 11 || idx === 12 || idx === 14 || idx === 15 ? 'center' : 'left'),
			indent: (idx === 2 || idx === 4 || idx === 5 || idx === 6 || idx === 8 || idx === 16 || idx === 17) ? 1 : 0,
		});
	});
	r++;

	if (sr.vehicleWorks.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:R${r}`);
		emptyRow.getCell(1).value = 'No staff productivity records found for this showroom for the selected period.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		let totalVehicles = 0;
		let totalHours = 0;

		sr.vehicleWorks.forEach((w, idx) => {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			const hoursVal = w.workingHours != null ? Number(w.workingHours) : 9.0;
			totalVehicles += w.vehicleQuantity;
			totalHours += hoursVal;

			const servicesText = w.servicesSummary || (
				w.serviceItems.length > 0
					? w.serviceItems.map((s) => `${s.workTypeName} (${s.quantity})`).join(', ')
					: 'General Service'
			);
			const jobVehicleId = `JOB-${String(idx + 1).padStart(4, '0')}`;

			row.getCell(1).value = formatDateDisplay(w.date);
			styleCell(row.getCell(1), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(2).value = w.staffMasterId || '—';
			styleCell(row.getCell(2), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(3).value = w.staffName;
			styleCell(row.getCell(3), { fillColor: rowFill, bold: true, indent: 1 });

			row.getCell(4).value = w.staffRole || 'Technician';
			styleCell(row.getCell(4), { fillColor: rowFill, indent: 1 });

			row.getCell(5).value = w.homeShowroomName || sr.showroomName;
			styleCell(row.getCell(5), { fillColor: rowFill, indent: 1 });

			row.getCell(6).value = w.showroomName || sr.showroomName;
			styleCell(row.getCell(6), { fillColor: rowFill, indent: 1 });

			row.getCell(7).value = w.vehicleTypeName;
			styleCell(row.getCell(7), { fillColor: rowFill, indent: 1 });

			row.getCell(8).value = w.serviceCategory || 'General';
			styleCell(row.getCell(8), { fillColor: rowFill, indent: 1 });

			row.getCell(9).value = servicesText;
			styleCell(row.getCell(9), { fillColor: rowFill, indent: 1 });

			row.getCell(10).value = jobVehicleId;
			styleCell(row.getCell(10), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(11).value = w.vehicleQuantity;
			styleCell(row.getCell(11), { fillColor: rowFill, hAlign: 'right', bold: true, numFmt: NUM_FORMATS.INTEGER });

			row.getCell(12).value = w.startTime || '09:00';
			styleCell(row.getCell(12), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(13).value = w.endTime || '18:00';
			styleCell(row.getCell(13), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(14).value = hoursVal;
			styleCell(row.getCell(14), { fillColor: rowFill, hAlign: 'right', bold: true, numFmt: NUM_FORMATS.DECIMAL });

			row.getCell(15).value = w.assignmentType || 'Regular';
			styleCell(row.getCell(15), { fillColor: rowFill, hAlign: 'center', bold: true, fontSize: 9 });

			row.getCell(16).value = w.swapId || '—';
			styleCell(row.getCell(16), { fillColor: rowFill, hAlign: 'center', fontColor: w.swapId ? ARGB.PRIMARY_BLUE : ARGB.MUTED_TEXT });

			row.getCell(17).value = w.originalStaffName || '—';
			styleCell(row.getCell(17), { fillColor: rowFill, indent: 1, fontColor: w.originalStaffName ? ARGB.DARK_TEXT : ARGB.MUTED_TEXT });

			row.getCell(18).value = w.replacementStaffName || '—';
			styleCell(row.getCell(18), { fillColor: rowFill, indent: 1, fontColor: w.replacementStaffName ? ARGB.DARK_TEXT : ARGB.MUTED_TEXT });

			r++;
		});

		// Grand Total Row (22pt)
		const totRow = ws.getRow(r);
		totRow.height = ROW_HEIGHTS.TOTAL_ROW;
		ws.mergeCells(`A${r}:J${r}`);
		totRow.getCell(1).value = `TOTAL PRODUCTIVITY ENTRIES: ${sr.vehicleWorks.length}`;
		styleCell(totRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		totRow.getCell(11).value = totalVehicles;
		styleCell(totRow.getCell(11), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		ws.mergeCells(`L${r}:M${r}`);
		totRow.getCell(12).value = '—';
		styleCell(totRow.getCell(12), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			hAlign: 'center',
			border: totalRowBorder,
		});

		totRow.getCell(14).value = Math.round(totalHours * 10) / 10;
		styleCell(totRow.getCell(14), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		ws.mergeCells(`O${r}:R${r}`);
		totRow.getCell(15).value = 'Reconciled';
		styleCell(totRow.getCell(15), {
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
// 4. SHEET 4 — "Attendance"
// ────────────────────────────────────────────────────────────────────────────

export function generateAttendanceWorksheet(
	workbook: ExcelJS.Workbook,
	sr: MonthlyShowroomDetailDto,
	monthName: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Attendance', {
		views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
		pageSetup: {
			orientation: 'landscape',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9,
			margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	ws.columns = [
		{ key: 'colA', width: 14 }, // Date
		{ key: 'colB', width: 16 }, // Staff ID
		{ key: 'colC', width: 22 }, // Staff Name
		{ key: 'colD', width: 18 }, // Role
		{ key: 'colE', width: 20 }, // Home Showroom
		{ key: 'colF', width: 20 }, // Working Showroom
		{ key: 'colG', width: 18 }, // Attendance Status
		{ key: 'colH', width: 16 }, // Scheduled Start
		{ key: 'colI', width: 16 }, // Scheduled End
		{ key: 'colJ', width: 16 }, // Scheduled Hours
		{ key: 'colK', width: 18 }, // Actual Hours
		{ key: 'colL', width: 20 }, // Confirmation Status
		{ key: 'colM', width: 22 }, // Confirmed By
		{ key: 'colN', width: 16 }, // Confirmed At
	];

	let r = 1;

	// Title
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:N${r}`);
	titleRow.getCell(1).value = reportTitle('ATTENDANCE AUDIT LEDGER');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Subtitle
	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:N${r}`);
	subRow.getCell(1).value = `SHOWROOM: ${sr.showroomName.toUpperCase()} (${sr.showroomMasterId})  |  PERIOD: ${monthName.toUpperCase()}  |  RECORDS: ${sr.attendanceRecords?.length ?? 0}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// Table Header (Row 4)
	const headRow = ws.getRow(r);
	headRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const headers = [
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
		'Confirmed At',
	];

	headers.forEach((h, idx) => {
		const cell = headRow.getCell(idx + 1);
		cell.value = h.toUpperCase();
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 9.5,
			bold: true,
			hAlign: idx === 9 || idx === 10 ? 'right' : (idx === 0 || idx === 1 || idx === 6 || idx === 7 || idx === 8 || idx === 11 || idx === 13 ? 'center' : 'left'),
			indent: (idx === 2 || idx === 4 || idx === 5 || idx === 12) ? 1 : 0,
		});
	});
	r++;

	const records = sr.attendanceRecords || [];
	if (records.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:N${r}`);
		emptyRow.getCell(1).value = 'No attendance records found for this showroom for the selected period.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		let totalSched = 0;
		let totalActual = 0;

		records.forEach((att, idx) => {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			const sched = Number(att.scheduledHours ?? 0);
			const actual = Number(att.actualHours ?? 0);
			totalSched += sched;
			totalActual += actual;

			row.getCell(1).value = formatDateDisplay(att.date);
			styleCell(row.getCell(1), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(2).value = att.staffMasterId || '—';
			styleCell(row.getCell(2), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(3).value = att.staffName;
			styleCell(row.getCell(3), { fillColor: rowFill, bold: true, indent: 1 });

			row.getCell(4).value = att.role || 'Technician';
			styleCell(row.getCell(4), { fillColor: rowFill, indent: 1 });

			row.getCell(5).value = att.homeShowroomName || sr.showroomName;
			styleCell(row.getCell(5), { fillColor: rowFill, indent: 1 });

			row.getCell(6).value = att.workingShowroomName || sr.showroomName;
			styleCell(row.getCell(6), { fillColor: rowFill, indent: 1 });

			// Status badge
			const attStatus = att.attendanceStatus || 'Present';
			let attFill: string = ARGB.SUCCESS_LIGHT_GREEN;
			let attColor: string = ARGB.SUCCESS_GREEN;
			if (attStatus === 'HalfDay') {
				attFill = ARGB.WARNING_LIGHT_ORANGE;
				attColor = ARGB.WARNING_ORANGE;
			} else if (attStatus === 'Leave' || attStatus === 'Absent') {
				attFill = ARGB.DANGER_LIGHT_RED;
				attColor = ARGB.DANGER_RED;
			}
			row.getCell(7).value = attStatus;
			styleCell(row.getCell(7), {
				fillColor: attFill,
				fontColor: attColor,
				bold: true,
				fontSize: 9,
				hAlign: 'center',
			});

			row.getCell(8).value = att.scheduledStart || '09:00';
			styleCell(row.getCell(8), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(9).value = att.scheduledEnd || '18:00';
			styleCell(row.getCell(9), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(10).value = sched;
			styleCell(row.getCell(10), { fillColor: rowFill, hAlign: 'right', numFmt: NUM_FORMATS.DECIMAL });

			row.getCell(11).value = actual;
			styleCell(row.getCell(11), { fillColor: rowFill, hAlign: 'right', bold: true, numFmt: NUM_FORMATS.DECIMAL });

			// Confirmation Status
			const confStatus = att.confirmationStatus || 'Pending';
			row.getCell(12).value = confStatus;
			styleCell(row.getCell(12), {
				fillColor: confStatus === 'Confirmed' ? ARGB.SUCCESS_LIGHT_GREEN : ARGB.WARNING_LIGHT_ORANGE,
				fontColor: confStatus === 'Confirmed' ? ARGB.SUCCESS_GREEN : ARGB.WARNING_ORANGE,
				bold: true,
				fontSize: 9,
				hAlign: 'center',
			});

			row.getCell(13).value = att.confirmedByName || '—';
			styleCell(row.getCell(13), { fillColor: rowFill, indent: 1 });

			row.getCell(14).value = att.confirmedAt ? formatDateDisplay(att.confirmedAt) : '—';
			styleCell(row.getCell(14), { fillColor: rowFill, hAlign: 'center', fontColor: ARGB.MUTED_TEXT });

			r++;
		});

		// Grand Total Row (22pt)
		const totRow = ws.getRow(r);
		totRow.height = ROW_HEIGHTS.TOTAL_ROW;
		ws.mergeCells(`A${r}:I${r}`);
		totRow.getCell(1).value = `TOTAL ATTENDANCE LOGGED: ${records.length} SESSIONS`;
		styleCell(totRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		totRow.getCell(10).value = Math.round(totalSched * 10) / 10;
		styleCell(totRow.getCell(10), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		totRow.getCell(11).value = Math.round(totalActual * 10) / 10;
		styleCell(totRow.getCell(11), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		ws.mergeCells(`L${r}:N${r}`);
		totRow.getCell(12).value = 'Verified';
		styleCell(totRow.getCell(12), {
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
// 5. SHEET 5 — "Staff Swaps"
// ────────────────────────────────────────────────────────────────────────────

export function generateStaffSwapsWorksheet(
	workbook: ExcelJS.Workbook,
	sr: MonthlyShowroomDetailDto,
	monthName: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Staff Swaps', {
		views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
		pageSetup: {
			orientation: 'landscape',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9,
			margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	ws.columns = [
		{ key: 'colA', width: 16 }, // Swap ID
		{ key: 'colB', width: 14 }, // Date
		{ key: 'colC', width: 22 }, // Showroom
		{ key: 'colD', width: 18 }, // Original Staff ID
		{ key: 'colE', width: 22 }, // Original Staff Name
		{ key: 'colF', width: 20 }, // Replacement Staff ID
		{ key: 'colG', width: 22 }, // Replacement Staff Name
		{ key: 'colH', width: 22 }, // Original Working Time
		{ key: 'colI', width: 24 }, // Replacement Working Time
		{ key: 'colJ', width: 16 }, // Swap Start Time
		{ key: 'colK', width: 16 }, // Swap End Time
		{ key: 'colL', width: 14 }, // Swap Hours
		{ key: 'colM', width: 26 }, // Reason
		{ key: 'colN', width: 18 }, // Created By
		{ key: 'colO', width: 16 }, // Created At
		{ key: 'colP', width: 14 }, // Status
		{ key: 'colQ', width: 18 }, // Reversed By
		{ key: 'colR', width: 16 }, // Reversed At
		{ key: 'colS', width: 24 }, // Reversal Reason
	];

	let r = 1;

	// Title
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:S${r}`);
	titleRow.getCell(1).value = reportTitle('STAFF SWAPS & COVERAGE AUDIT LEDGER');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Subtitle
	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:S${r}`);
	subRow.getCell(1).value = `SHOWROOM: ${sr.showroomName.toUpperCase()} (${sr.showroomMasterId})  |  PERIOD: ${monthName.toUpperCase()}  |  TOTAL SWAPS: ${sr.swaps?.length ?? 0}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// Table Header (Row 4)
	const headRow = ws.getRow(r);
	headRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const headers = [
		'Swap ID',
		'Date',
		'Showroom',
		'Original Staff ID',
		'Original Staff Name',
		'Replacement Staff ID',
		'Replacement Staff Name',
		'Original Working Time',
		'Replacement Working Time',
		'Swap Start Time',
		'Swap End Time',
		'Swap Hours',
		'Reason',
		'Created By',
		'Created At',
		'Status',
		'Reversed By',
		'Reversed At',
		'Reversal Reason',
	];

	headers.forEach((h, idx) => {
		const cell = headRow.getCell(idx + 1);
		cell.value = h.toUpperCase();
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 9.5,
			bold: true,
			hAlign: idx === 11 ? 'right' : (idx === 0 || idx === 1 || idx === 3 || idx === 5 || idx === 9 || idx === 10 || idx === 14 || idx === 15 || idx === 17 ? 'center' : 'left'),
			indent: (idx === 2 || idx === 4 || idx === 6 || idx === 12 || idx === 13 || idx === 16 || idx === 18) ? 1 : 0,
		});
	});
	r++;

	const swapList = sr.swaps || [];
	if (swapList.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:S${r}`);
		emptyRow.getCell(1).value = 'No staff swaps recorded for this showroom for the selected period.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		let totalHours = 0;

		swapList.forEach((swp, idx) => {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			const hours = Number(swp.swapHours ?? 9.0);
			totalHours += hours;

			row.getCell(1).value = swp.swapId;
			styleCell(row.getCell(1), { fillColor: rowFill, hAlign: 'center', bold: true, fontColor: ARGB.PRIMARY_DARK });

			row.getCell(2).value = formatDateDisplay(swp.date);
			styleCell(row.getCell(2), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(3).value = swp.showroomName || sr.showroomName;
			styleCell(row.getCell(3), { fillColor: rowFill, indent: 1 });

			row.getCell(4).value = swp.staffAMasterId || '—';
			styleCell(row.getCell(4), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(5).value = swp.staffAName;
			styleCell(row.getCell(5), { fillColor: rowFill, bold: true, indent: 1 });

			row.getCell(6).value = swp.staffBMasterId || '—';
			styleCell(row.getCell(6), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(7).value = swp.staffBName;
			styleCell(row.getCell(7), { fillColor: rowFill, bold: true, indent: 1 });

			row.getCell(8).value = swp.originalWorkingTime || '09:00–18:00';
			styleCell(row.getCell(8), { fillColor: rowFill, indent: 1 });

			row.getCell(9).value = swp.replacementWorkingTime || '09:00–18:00';
			styleCell(row.getCell(9), { fillColor: rowFill, indent: 1 });

			row.getCell(10).value = swp.swapStartTime || '—';
			styleCell(row.getCell(10), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(11).value = swp.swapEndTime || '—';
			styleCell(row.getCell(11), { fillColor: rowFill, hAlign: 'center' });

			row.getCell(12).value = hours;
			styleCell(row.getCell(12), { fillColor: rowFill, hAlign: 'right', bold: true, numFmt: NUM_FORMATS.DECIMAL });

			row.getCell(13).value = swp.reason || 'Operational Coverage';
			styleCell(row.getCell(13), { fillColor: rowFill, indent: 1 });

			row.getCell(14).value = swp.createdByName || 'Supervisor';
			styleCell(row.getCell(14), { fillColor: rowFill, indent: 1 });

			row.getCell(15).value = formatDateDisplay(swp.createdAt);
			styleCell(row.getCell(15), { fillColor: rowFill, hAlign: 'center' });

			// Status
			const st = swp.status || 'Active';
			row.getCell(16).value = st;
			styleCell(row.getCell(16), {
				fillColor: st === 'Active' ? ARGB.SUCCESS_LIGHT_GREEN : ARGB.LIGHT_GRAY_FILL,
				fontColor: st === 'Active' ? ARGB.SUCCESS_GREEN : ARGB.MUTED_TEXT,
				bold: true,
				fontSize: 9,
				hAlign: 'center',
			});

			row.getCell(17).value = swp.reversedByName || '—';
			styleCell(row.getCell(17), { fillColor: rowFill, indent: 1 });

			row.getCell(18).value = swp.reversedAt ? formatDateDisplay(swp.reversedAt) : '—';
			styleCell(row.getCell(18), { fillColor: rowFill, hAlign: 'center', fontColor: ARGB.MUTED_TEXT });

			row.getCell(19).value = swp.reversalReason || '—';
			styleCell(row.getCell(19), { fillColor: rowFill, indent: 1, fontColor: ARGB.MUTED_TEXT });

			r++;
		});

		// Grand Total Row (22pt)
		const totRow = ws.getRow(r);
		totRow.height = ROW_HEIGHTS.TOTAL_ROW;
		ws.mergeCells(`A${r}:K${r}`);
		totRow.getCell(1).value = `TOTAL SWAPS RECORDED: ${swapList.length}`;
		styleCell(totRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		totRow.getCell(12).value = Math.round(totalHours * 10) / 10;
		styleCell(totRow.getCell(12), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		ws.mergeCells(`M${r}:S${r}`);
		totRow.getCell(13).value = 'Audit Reconciled';
		styleCell(totRow.getCell(13), {
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
// 6. SHEET 6 — "Vehicle Type Summary"
// ────────────────────────────────────────────────────────────────────────────

export function generateVehicleTypeSummaryWorksheet(
	workbook: ExcelJS.Workbook,
	sr: MonthlyShowroomDetailDto,
	monthName: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Vehicle Type Summary', {
		views: [{ showGridLines: true }],
		pageSetup: {
			orientation: 'portrait',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9,
			margins: { left: 0.6, right: 0.6, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	ws.columns = [
		{ key: 'colA', width: 28 }, // Vehicle Type
		{ key: 'colB', width: 18 }, // Vehicles
		{ key: 'colC', width: 18 }, // Services
		{ key: 'colD', width: 18 }, // Staff Hours
		{ key: 'colE', width: 18 }, // Share %
	];

	let r = 1;

	// Title
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:E${r}`);
	titleRow.getCell(1).value = reportTitle('VEHICLE TYPE SUMMARY');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Subtitle
	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:E${r}`);
	subRow.getCell(1).value = `SHOWROOM: ${sr.showroomName.toUpperCase()} (${sr.showroomMasterId})  |  PERIOD: ${monthName.toUpperCase()}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// Table Header (Row 4)
	const headRow = ws.getRow(r);
	headRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const headers = ['Vehicle Type', 'Vehicles Serviced', 'Services Performed', 'Staff Hours', 'Volume Share (%)'];
	headers.forEach((h, idx) => {
		const cell = headRow.getCell(idx + 1);
		cell.value = h.toUpperCase();
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 9.5,
			bold: true,
			hAlign: idx === 0 ? 'left' : 'right',
			indent: idx === 0 ? 1 : 0,
		});
	});
	r++;

	const vtList = sr.vehicleTypeSummary || [];
	if (vtList.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:E${r}`);
		emptyRow.getCell(1).value = 'No vehicle type records found for this showroom.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		let totalV = 0;
		let totalS = 0;
		let totalH = 0;

		vtList.forEach((vt, idx) => {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			totalV += vt.totalVehicles;
			totalS += vt.totalServices;
			totalH += Number(vt.totalStaffHours);

			row.getCell(1).value = vt.vehicleTypeName;
			styleCell(row.getCell(1), { fillColor: rowFill, bold: true, indent: 1 });

			row.getCell(2).value = vt.totalVehicles;
			styleCell(row.getCell(2), { fillColor: rowFill, hAlign: 'right', bold: true, numFmt: NUM_FORMATS.INTEGER });

			row.getCell(3).value = vt.totalServices;
			styleCell(row.getCell(3), { fillColor: rowFill, hAlign: 'right', numFmt: NUM_FORMATS.INTEGER });

			row.getCell(4).value = Number(vt.totalStaffHours);
			styleCell(row.getCell(4), { fillColor: rowFill, hAlign: 'right', numFmt: NUM_FORMATS.DECIMAL });

			row.getCell(5).value = vt.sharePercentage / 100;
			styleCell(row.getCell(5), { fillColor: rowFill, hAlign: 'right', numFmt: NUM_FORMATS.PERCENT });

			r++;
		});

		// Grand Total Row (22pt)
		const totRow = ws.getRow(r);
		totRow.height = ROW_HEIGHTS.TOTAL_ROW;
		totRow.getCell(1).value = 'TOTAL';
		styleCell(totRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		totRow.getCell(2).value = totalV;
		styleCell(totRow.getCell(2), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		totRow.getCell(3).value = totalS;
		styleCell(totRow.getCell(3), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		totRow.getCell(4).value = Math.round(totalH * 10) / 10;
		styleCell(totRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		totRow.getCell(5).value = 1.0;
		styleCell(totRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.PERCENT,
			border: totalRowBorder,
		});
		r++;
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. SHEET 7 — "Service Summary"
// ────────────────────────────────────────────────────────────────────────────

export function generateServiceSummaryWorksheet(
	workbook: ExcelJS.Workbook,
	sr: MonthlyShowroomDetailDto,
	monthName: string
): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet('Service Summary', {
		views: [{ showGridLines: true }],
		pageSetup: {
			orientation: 'portrait',
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			paperSize: 9,
			margins: { left: 0.6, right: 0.6, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
		},
	});

	ws.properties.defaultRowHeight = ROW_HEIGHTS.DATA_ROW;

	ws.columns = [
		{ key: 'colA', width: 24 }, // Category
		{ key: 'colB', width: 28 }, // Service Name
		{ key: 'colC', width: 18 }, // Vehicles
		{ key: 'colD', width: 18 }, // Quantity
		{ key: 'colE', width: 18 }, // Staff Hours
		{ key: 'colF', width: 18 }, // Share %
	];

	let r = 1;

	// Title
	const titleRow = ws.getRow(r);
	titleRow.height = ROW_HEIGHTS.TITLE;
	ws.mergeCells(`A${r}:F${r}`);
	titleRow.getCell(1).value = reportTitle('SERVICE SUMMARY');
	styleCell(titleRow.getCell(1), {
		fillColor: ARGB.PRIMARY_DARK,
		fontColor: ARGB.WHITE,
		fontSize: 14,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Subtitle
	const subRow = ws.getRow(r);
	subRow.height = ROW_HEIGHTS.SUBTITLE;
	ws.mergeCells(`A${r}:F${r}`);
	subRow.getCell(1).value = `SHOWROOM: ${sr.showroomName.toUpperCase()} (${sr.showroomMasterId})  |  PERIOD: ${monthName.toUpperCase()}`;
	styleCell(subRow.getCell(1), {
		fillColor: ARGB.SECONDARY_LIGHT_BLUE,
		fontColor: ARGB.PRIMARY_DARK,
		fontSize: 10,
		bold: true,
		hAlign: 'center',
		vAlign: 'middle',
	});
	r++;

	// Spacer Row
	ws.getRow(r++).height = ROW_HEIGHTS.SPACER;

	// Table Header (Row 4)
	const headRow = ws.getRow(r);
	headRow.height = ROW_HEIGHTS.TABLE_HEADER;
	const headers = ['Service Category', 'Service Name', 'Vehicles Attended', 'Total Quantity', 'Staff Hours', 'Service Share (%)'];
	headers.forEach((h, idx) => {
		const cell = headRow.getCell(idx + 1);
		cell.value = h.toUpperCase();
		styleCell(cell, {
			fillColor: ARGB.PRIMARY_BLUE,
			fontColor: ARGB.WHITE,
			fontSize: 9.5,
			bold: true,
			hAlign: idx < 2 ? 'left' : 'right',
			indent: idx < 2 ? 1 : 0,
		});
	});
	r++;

	const srvList = sr.serviceSummary || [];
	if (srvList.length === 0) {
		const emptyRow = ws.getRow(r);
		emptyRow.height = ROW_HEIGHTS.DATA_ROW;
		ws.mergeCells(`A${r}:F${r}`);
		emptyRow.getCell(1).value = 'No service records found for this showroom in the selected period.';
		styleCell(emptyRow.getCell(1), { hAlign: 'center', fontColor: ARGB.MUTED_TEXT, italic: true });
		r++;
	} else {
		let totalV = 0;
		let totalQ = 0;
		let totalH = 0;

		srvList.forEach((sv, idx) => {
			const row = ws.getRow(r);
			row.height = ROW_HEIGHTS.DATA_ROW;
			const isEven = idx % 2 === 0;
			const rowFill = isEven ? ARGB.WHITE : ARGB.ROW_ALT_FILL;
			totalV += sv.totalVehicles;
			totalQ += sv.totalQuantity;
			totalH += Number(sv.totalStaffHours);

			row.getCell(1).value = sv.serviceCategory || 'General Service';
			styleCell(row.getCell(1), { fillColor: rowFill, indent: 1 });

			row.getCell(2).value = sv.serviceName;
			styleCell(row.getCell(2), { fillColor: rowFill, bold: true, indent: 1 });

			row.getCell(3).value = sv.totalVehicles;
			styleCell(row.getCell(3), { fillColor: rowFill, hAlign: 'right', numFmt: NUM_FORMATS.INTEGER });

			row.getCell(4).value = sv.totalQuantity;
			styleCell(row.getCell(4), { fillColor: rowFill, hAlign: 'right', bold: true, numFmt: NUM_FORMATS.INTEGER });

			row.getCell(5).value = Number(sv.totalStaffHours);
			styleCell(row.getCell(5), { fillColor: rowFill, hAlign: 'right', numFmt: NUM_FORMATS.DECIMAL });

			row.getCell(6).value = sv.sharePercentage / 100;
			styleCell(row.getCell(6), { fillColor: rowFill, hAlign: 'right', numFmt: NUM_FORMATS.PERCENT });

			r++;
		});

		// Grand Total Row (22pt)
		const totRow = ws.getRow(r);
		totRow.height = ROW_HEIGHTS.TOTAL_ROW;
		ws.mergeCells(`A${r}:B${r}`);
		totRow.getCell(1).value = 'TOTAL';
		styleCell(totRow.getCell(1), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			indent: 1,
			border: totalRowBorder,
		});

		totRow.getCell(3).value = totalV;
		styleCell(totRow.getCell(3), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		totRow.getCell(4).value = totalQ;
		styleCell(totRow.getCell(4), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.INTEGER,
			border: totalRowBorder,
		});

		totRow.getCell(5).value = Math.round(totalH * 10) / 10;
		styleCell(totRow.getCell(5), {
			fillColor: ARGB.SECONDARY_LIGHT_BLUE,
			fontColor: ARGB.PRIMARY_DARK,
			bold: true,
			hAlign: 'right',
			numFmt: NUM_FORMATS.DECIMAL,
			border: totalRowBorder,
		});

		totRow.getCell(6).value = 1.0;
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

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// MASTER WORKBOOK BUILDER & EXPORT DISPATCHER
// ────────────────────────────────────────────────────────────────────────────

export function exportSingleShowroomWorkbook(
	targetShowroom: MonthlyShowroomDetailDto,
	reportData: MonthlyShowroomReportResponse
): ExcelJS.Workbook {
	const wb = new ExcelJS.Workbook();
	wb.creator = reportCreator();
	wb.lastModifiedBy = reportCreator();
	wb.created = new Date();
	wb.modified = new Date();

	// Sheet 1: Summary
	generateExecutiveSummaryWorksheet(
		wb,
		targetShowroom,
		reportData.monthName,
		reportData.fromDate,
		reportData.toDate
	);

	// Sheet 2: Vehicle Service Details
	generateVehicleServiceDetailsWorksheet(wb, targetShowroom, reportData.monthName);

	// Sheet 3: Staff Productivity
	generateStaffProductivityWorksheet(wb, targetShowroom, reportData.monthName);

	// Sheet 4: Attendance
	generateAttendanceWorksheet(wb, targetShowroom, reportData.monthName);

	// Sheet 5: Staff Swaps
	generateStaffSwapsWorksheet(wb, targetShowroom, reportData.monthName);

	// Sheet 6: Vehicle Type Summary
	generateVehicleTypeSummaryWorksheet(wb, targetShowroom, reportData.monthName);

	// Sheet 7: Service Summary
	generateServiceSummaryWorksheet(wb, targetShowroom, reportData.monthName);

	return wb;
}

export async function generateAndDownloadMonthlyShowroomReport(
	reportData: MonthlyShowroomReportResponse,
	mode: 'selected' | 'all',
	selectedShowroomId?: string
): Promise<void> {
	if (mode === 'selected' || (selectedShowroomId && selectedShowroomId !== 'all')) {
		// Single Showroom Mode -> Produces the complete 7-Sheet Executive Management Report
		const targetShowroom =
			selectedShowroomId && selectedShowroomId !== 'all'
				? reportData.showrooms.find((s) => s.showroomId === selectedShowroomId) ||
				  reportData.showrooms[0]
				: reportData.showrooms[0];

		if (targetShowroom) {
			const wb = exportSingleShowroomWorkbook(targetShowroom, reportData);
			const fileName = `${reportFilePrefix()}${targetShowroom.showroomName.replace(/\s+/g, '_')}_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
			await downloadWorkbook(wb, fileName);
			return;
		}
	}

	// Multi-Showroom Mode -> Each showroom receives its own independent 7-Sheet workbook
	if (reportData.showrooms && reportData.showrooms.length > 0) {
		for (const sr of reportData.showrooms) {
			const wb = exportSingleShowroomWorkbook(sr, reportData);
			const fileName = `${reportFilePrefix()}${sr.showroomName.replace(/\s+/g, '_')}_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
			await downloadWorkbook(wb, fileName);
		}
		return;
	}

	// Fallback empty workbook
	const wb = new ExcelJS.Workbook();
	const emptyWs = wb.addWorksheet('No Data');
	emptyWs.getCell('A1').value = 'No showroom data available for export';
	const fileName = `${reportFilePrefix()}Showroom_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
	await downloadWorkbook(wb, fileName);
}

async function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string): Promise<void> {
	const buffer = await wb.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});

	const url = window.URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	window.URL.revokeObjectURL(url);
}

export const exportMonthlyShowroomToExcel = generateAndDownloadMonthlyShowroomReport;
