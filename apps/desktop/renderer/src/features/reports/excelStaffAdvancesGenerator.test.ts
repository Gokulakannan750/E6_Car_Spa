import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createStaffAdvancesWorkbook,
	buildStaffSummarySheet,
	buildStaffMemberSheet,
	generateAndDownloadStaffAdvancesReport,
	groupAdvancesByStaff,
	calculateMonthlyTotals,
	calculateStaffAdvancesSummary,
	validateStaffAdvancesReconciliation,
	sanitizeSheetName,
	getMonthKeyAndLabel,
	ROW_HEIGHTS,
	ARGB,
	type StaffAdvanceRecord,
	type StaffAdvancesReportData,
} from './excelStaffAdvancesGenerator';
import ExcelJS from 'exceljs';

describe('excelStaffAdvancesGenerator (ExcelJS) — Executive Styling & Staff-Centric Structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const sampleAdvances: StaffAdvanceRecord[] = [
		{
			id: 'adv-1',
			staffId: 'staff-ramesh',
			staffName: 'Ramesh Kumar',
			staffRole: 'Detailer',
			staffPhone: '+91 9876543210',
			advanceDate: '2026-10-05T10:00:00Z',
			amount: 7000,
			reason: 'Medical emergency',
			notes: 'Approved by manager',
			status: 'Settled',
			settledAt: '2026-10-25T15:00:00Z',
			settledByName: 'Admin',
		},
		{
			id: 'adv-2',
			staffId: 'staff-ramesh',
			staffName: 'Ramesh Kumar',
			staffRole: 'Detailer',
			staffPhone: '+91 9876543210',
			advanceDate: '2026-11-10T10:00:00Z',
			amount: 3000,
			reason: 'Festival advance',
			notes: null,
			status: 'Outstanding',
		},
		{
			id: 'adv-3',
			staffId: 'staff-ramesh',
			staffName: 'Ramesh Kumar',
			staffRole: 'Detailer',
			staffPhone: '+91 9876543210',
			advanceDate: '2026-12-01T10:00:00Z',
			amount: 5000,
			reason: 'Personal expense',
			notes: null,
			status: 'Outstanding',
		},
		{
			id: 'adv-4',
			staffId: 'staff-kumar',
			staffName: 'Kumar Swamy',
			staffRole: 'Technician',
			staffPhone: '+91 9876543211',
			advanceDate: '2026-10-12T10:00:00Z',
			amount: 10000,
			reason: 'Tool purchase',
			notes: 'Repaid half',
			status: 'Settled',
			settledAt: '2026-10-28T12:00:00Z',
			settledByName: 'Owner',
		},
		{
			id: 'adv-5',
			staffId: 'staff-suresh',
			staffName: 'Suresh Raina',
			staffRole: 'Washer',
			staffPhone: '+91 9876543212',
			advanceDate: '2026-10-20T10:00:00Z',
			amount: 4000,
			reason: 'Family event',
			notes: null,
			status: 'Outstanding',
		},
	];

	const sampleReportData: StaffAdvancesReportData = {
		periodLabel: 'Q4 2026 (Oct to Dec)',
		startDate: '2026-10-01T00:00:00Z',
		endDate: '2026-12-31T23:59:59Z',
		generatedAt: '2026-12-31T23:59:59Z',
		advances: sampleAdvances,
	};

	it('derives correct month key and month label', () => {
		const res = getMonthKeyAndLabel('2026-10-15T00:00:00Z');
		expect(res.key).toBe('2026-10');
		expect(res.label).toBe('October 2026');
		expect(res.year).toBe(2026);
		expect(res.monthIndex).toBe(9);
	});

	it('sanitizes worksheet names and prevents duplicates', () => {
		const used = new Set<string>();
		expect(sanitizeSheetName('Ramesh/Kumar:Detailer', used)).toBe('RameshKumarDetailer');
		expect(sanitizeSheetName('Ramesh/Kumar:Detailer', used)).toBe('RameshKumarDetailer_1');
	});

	it('groups advances by staff member and sorts them in ascending chronological order', () => {
		const groups = groupAdvancesByStaff(sampleAdvances);
		expect(groups).toHaveLength(3);

		// Ramesh group
		const ramesh = groups.find((g) => g.staffName === 'Ramesh Kumar');
		expect(ramesh).toBeDefined();
		expect(ramesh!.advances).toHaveLength(3);
		expect(ramesh!.totalGiven).toBe(15000);
		expect(ramesh!.totalRecovered).toBe(7000);
		expect(ramesh!.outstandingBalance).toBe(8000);

		// Verify chronological ascending order
		expect(ramesh!.advances[0].advanceDate).toBe('2026-10-05T10:00:00Z');
		expect(ramesh!.advances[1].advanceDate).toBe('2026-11-10T10:00:00Z');
		expect(ramesh!.advances[2].advanceDate).toBe('2026-12-01T10:00:00Z');

		// Kumar group
		const kumar = groups.find((g) => g.staffName === 'Kumar Swamy');
		expect(kumar).toBeDefined();
		expect(kumar!.advances).toHaveLength(1);
		expect(kumar!.totalGiven).toBe(10000);
		expect(kumar!.totalRecovered).toBe(10000);
		expect(kumar!.outstandingBalance).toBe(0);

		// Suresh group
		const suresh = groups.find((g) => g.staffName === 'Suresh Raina');
		expect(suresh).toBeDefined();
		expect(suresh!.advances).toHaveLength(1);
		expect(suresh!.totalGiven).toBe(4000);
		expect(suresh!.totalRecovered).toBe(0);
		expect(suresh!.outstandingBalance).toBe(4000);
	});

	it('calculates monthly totals accurately per staff member', () => {
		const rameshAdvances = sampleAdvances.filter((a) => a.staffName === 'Ramesh Kumar');
		const monthly = calculateMonthlyTotals(rameshAdvances);

		expect(monthly).toHaveLength(3);

		expect(monthly[0].monthLabel).toBe('October 2026');
		expect(monthly[0].totalGiven).toBe(7000);
		expect(monthly[0].totalRecovered).toBe(7000);
		expect(monthly[0].outstandingBalance).toBe(0);

		expect(monthly[1].monthLabel).toBe('November 2026');
		expect(monthly[1].totalGiven).toBe(3000);
		expect(monthly[1].totalRecovered).toBe(0);
		expect(monthly[1].outstandingBalance).toBe(3000);

		expect(monthly[2].monthLabel).toBe('December 2026');
		expect(monthly[2].totalGiven).toBe(5000);
		expect(monthly[2].totalRecovered).toBe(0);
		expect(monthly[2].outstandingBalance).toBe(5000);
	});

	it('calculates executive summary and validates reconciliation between summary and staff sheets', () => {
		const summary = calculateStaffAdvancesSummary(sampleAdvances);

		expect(summary.totalStaffMembers).toBe(3);
		expect(summary.totalAdvancesGiven).toBe(29000);
		expect(summary.totalAdvancesRecovered).toBe(17000);
		expect(summary.totalOutstandingBalance).toBe(12000);
		expect(summary.totalAdvanceCount).toBe(5);
		expect(summary.settledCount).toBe(2);
		expect(summary.outstandingCount).toBe(3);

		const isReconciled = validateStaffAdvancesReconciliation(summary, summary.staffGroups);
		expect(isReconciled).toBe(true);
	});

	it('creates Staff Summary sheet (Sheet 1) with matching visual style of approved Billing Report', () => {
		const workbook = new ExcelJS.Workbook();
		const summary = calculateStaffAdvancesSummary(sampleAdvances);
		const ws = buildStaffSummarySheet(workbook, summary, sampleReportData);

		expect(ws).toBeDefined();
		expect(ws.name).toBe('Staff Summary');

		// Title cell A1
		const cellA1 = ws.getCell('A1');
		expect(cellA1.value).toBe('E6 CAR SPA — STAFF ADVANCE REPORT');
		expect(cellA1.font?.bold).toBe(true);
		expect(cellA1.font?.color?.argb).toBe(ARGB.WHITE);
		expect(cellA1.fill).toEqual({
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: ARGB.PRIMARY_DARK },
		});
		expect(ws.getRow(1).height).toBe(ROW_HEIGHTS.TITLE);

		// Subtitle cell A2
		const cellA2 = ws.getCell('A2');
		expect(cellA2.value).toBe('STAFF ADVANCES & SETTLEMENTS EXECUTIVE SUMMARY');
		expect(cellA2.font?.bold).toBe(true);
		expect(cellA2.font?.color?.argb).toBe(ARGB.PRIMARY_DARK);
		expect(cellA2.fill).toEqual({
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: ARGB.SECONDARY_LIGHT_BLUE },
		});

		// Page setup
		expect(ws.pageSetup.orientation).toBe('portrait');
		expect(ws.pageSetup.fitToWidth).toBe(1);
	});

	it('creates dedicated staff member sheet with monthly summary card and chronological transactions table', () => {
		const workbook = new ExcelJS.Workbook();
		const groups = groupAdvancesByStaff(sampleAdvances);
		const rameshGroup = groups.find((g) => g.staffName === 'Ramesh Kumar')!;

		const ws = buildStaffMemberSheet(workbook, rameshGroup, sampleReportData, 'Ramesh Kumar');
		expect(ws).toBeDefined();
		expect(ws.name).toBe('Ramesh Kumar');

		// Title cell A1
		const cellA1 = ws.getCell('A1');
		expect(cellA1.value).toBe('E6 CAR SPA — STAFF ADVANCE REPORT');
		expect(cellA1.font?.bold).toBe(true);
		expect(cellA1.font?.color?.argb).toBe(ARGB.WHITE);

		// Subtitle cell A2
		const cellA2 = ws.getCell('A2');
		expect(cellA2.value).toContain('STAFF STATEMENT: RAMESH KUMAR');

		// Verify frozen header rows
		expect(ws.views[0].state).toBe('frozen');
		expect((ws.views[0] as ExcelJS.WorksheetViewFrozen).ySplit).toBe(4);
	});

	it('creates complete workbook with Sheet 1 as Staff Summary and following sheets for each staff member', () => {
		const wb = createStaffAdvancesWorkbook(sampleReportData);
		expect(wb.worksheets).toHaveLength(4);

		// Sheet 1: Staff Summary
		expect(wb.worksheets[0].name).toBe('Staff Summary');

		// Following Sheets: One dedicated sheet per staff member (alphabetically sorted)
		expect(wb.worksheets[1].name).toBe('Kumar Swamy');
		expect(wb.worksheets[2].name).toBe('Ramesh Kumar');
		expect(wb.worksheets[3].name).toBe('Suresh Raina');

		// Verify that all Ramesh advances are in the single Ramesh sheet (no Ramesh-01, Ramesh-02)
		const sheetNames = wb.worksheets.map((w) => w.name);
		expect(sheetNames).toEqual(['Staff Summary', 'Kumar Swamy', 'Ramesh Kumar', 'Suresh Raina']);
	});

	it('generates workbook buffer and creates downloadable blob in generateAndDownloadStaffAdvancesReport', async () => {
		const mockClick = vi.fn();
		const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
		const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
		window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
		window.URL.revokeObjectURL = vi.fn();

		const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
			click: mockClick,
			setAttribute: vi.fn(),
		} as any);

		await generateAndDownloadStaffAdvancesReport(sampleReportData, 'Test_Staff_Report.xlsx');

		expect(window.URL.createObjectURL).toHaveBeenCalled();
		expect(mockClick).toHaveBeenCalled();
		expect(mockAppendChild).toHaveBeenCalled();
		expect(mockRemoveChild).toHaveBeenCalled();
		expect(window.URL.revokeObjectURL).toHaveBeenCalled();

		createElementSpy.mockRestore();
		mockAppendChild.mockRestore();
		mockRemoveChild.mockRestore();
	});

	it('handles empty advance records gracefully without crashing', () => {
		const emptyData: StaffAdvancesReportData = {
			periodLabel: 'Empty Month',
			startDate: '2026-10-01T00:00:00Z',
			endDate: '2026-10-31T23:59:59Z',
			advances: [],
		};

		const wb = createStaffAdvancesWorkbook(emptyData);
		expect(wb.worksheets).toHaveLength(1);
		expect(wb.worksheets[0].name).toBe('Staff Summary');
	});

	it('enforces standardized row heights consistently across every worksheet and every row', () => {
		const wb = createStaffAdvancesWorkbook(sampleReportData);
		const validHeights = new Set<number>([
			ROW_HEIGHTS.TITLE,          // 30
			ROW_HEIGHTS.SUBTITLE,       // 22
			ROW_HEIGHTS.SECTION_HEADER, // 24
			ROW_HEIGHTS.TABLE_HEADER,   // 22
			ROW_HEIGHTS.DATA_ROW,       // 21
			ROW_HEIGHTS.TOTAL_ROW,      // 22
			ROW_HEIGHTS.SPACER,         // 10
		]);

		for (const ws of wb.worksheets) {
			expect(ws.properties.defaultRowHeight).toBe(ROW_HEIGHTS.DATA_ROW);

			// Check title row
			expect(ws.getRow(1).height).toBe(ROW_HEIGHTS.TITLE);
			// Check subtitle row
			expect(ws.getRow(2).height).toBe(ROW_HEIGHTS.SUBTITLE);

			// Check every row in the worksheet has a standardized height
			ws.eachRow((row) => {
				expect(row.height).toBeDefined();
				expect(validHeights.has(row.height!)).toBe(true);
			});
		}
	});
});

