import { describe, it, expect, beforeEach } from 'vitest';
import { seedCompanyProfile } from '../../test/seedCompanyProfile';
import {
	createStaffAdvancesWorkbook,
	calculateStaffAdvancesSummary,
	validateStaffAdvancesReconciliation,
	ROW_HEIGHTS,
	ARGB,
	type StaffAdvanceRecord,
	type StaffAdvancesReportData,
} from './excelStaffAdvancesGenerator';
import ExcelJS from 'exceljs';

beforeEach(() => {
	seedCompanyProfile();
});

describe('Sample Staff Advances Excel Verification (ExcelJS)', () => {
	it('generates a real multi-sheet Excel file and verifies formatting integrity & reconciliation', async () => {
		const sampleAdvances: StaffAdvanceRecord[] = [
			// Ramesh (3 advances across 3 months)
			{
				id: 'adv-r1',
				staffId: 'staff-1',
				staffName: 'Ramesh',
				staffRole: 'Detailer',
				staffPhone: '+91 9876543210',
				advanceDate: '2026-10-05T09:00:00Z',
				amount: 7000,
				reason: 'Medical expense',
				notes: 'Repaid in Oct settlement',
				status: 'Settled',
				settledAt: '2026-10-31T18:00:00Z',
				settledByName: 'Finance Manager',
			},
			{
				id: 'adv-r2',
				staffId: 'staff-1',
				staffName: 'Ramesh',
				staffRole: 'Detailer',
				staffPhone: '+91 9876543210',
				advanceDate: '2026-11-12T10:00:00Z',
				amount: 3000,
				reason: 'Diwali festival bonus advance',
				notes: null,
				status: 'Outstanding',
			},
			{
				id: 'adv-r3',
				staffId: 'staff-1',
				staffName: 'Ramesh',
				staffRole: 'Detailer',
				staffPhone: '+91 9876543210',
				advanceDate: '2026-12-02T11:00:00Z',
				amount: 5000,
				reason: 'Home repairs',
				notes: null,
				status: 'Outstanding',
			},
			// Kumar (2 advances)
			{
				id: 'adv-k1',
				staffId: 'staff-2',
				staffName: 'Kumar',
				staffRole: 'Technician',
				staffPhone: '+91 9876543211',
				advanceDate: '2026-10-15T14:00:00Z',
				amount: 6000,
				reason: 'Workshop gear',
				notes: 'Settled via salary',
				status: 'Settled',
				settledAt: '2026-10-31T18:00:00Z',
				settledByName: 'Finance Manager',
			},
			{
				id: 'adv-k2',
				staffId: 'staff-2',
				staffName: 'Kumar',
				staffRole: 'Technician',
				staffPhone: '+91 9876543211',
				advanceDate: '2026-11-20T10:00:00Z',
				amount: 4000,
				reason: 'Personal',
				notes: null,
				status: 'Outstanding',
			},
			// Suresh (1 advance)
			{
				id: 'adv-s1',
				staffId: 'staff-3',
				staffName: 'Suresh',
				staffRole: 'Senior Detailer',
				staffPhone: '+91 9876543212',
				advanceDate: '2026-10-25T16:00:00Z',
				amount: 8000,
				reason: 'Bike maintenance',
				notes: null,
				status: 'Settled',
				settledAt: '2026-10-31T18:00:00Z',
				settledByName: 'Finance Manager',
			},
		];

		const reportData: StaffAdvancesReportData = {
			periodLabel: 'Q4 2026 (Oct 2026 to Dec 2026)',
			startDate: '2026-10-01T00:00:00Z',
			endDate: '2026-12-31T23:59:59Z',
			generatedAt: '2026-12-31T23:59:59Z',
			advances: sampleAdvances,
		};

		// 1. Create workbook
		const wb = createStaffAdvancesWorkbook(reportData);

		// 2. Verify Sheet Structure: Sheet 1 is ALWAYS Staff Summary, followed by 1 sheet per staff member
		expect(wb.worksheets.length).toBe(4);
		expect(wb.worksheets[0].name).toBe('Staff Summary');
		expect(wb.worksheets[1].name).toBe('Kumar');
		expect(wb.worksheets[2].name).toBe('Ramesh');
		expect(wb.worksheets[3].name).toBe('Suresh');

		// 3. Verify Sheet 1: Staff Summary
		const summaryWs = wb.getWorksheet('Staff Summary')!;
		expect(summaryWs).toBeDefined();

		// Title formatting
		const titleCell = summaryWs.getCell('A1');
		expect(titleCell.value).toBe('SUNRISE DETAILING — STAFF ADVANCE REPORT');
		expect(titleCell.font?.bold).toBe(true);
		expect(titleCell.font?.color?.argb).toBe(ARGB.WHITE);
		expect(titleCell.fill).toEqual({
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: ARGB.PRIMARY_DARK },
		});
		expect(summaryWs.getRow(1).height).toBe(ROW_HEIGHTS.TITLE);

		// Subtitle formatting
		const subCell = summaryWs.getCell('A2');
		expect(subCell.value).toBe('STAFF ADVANCES & SETTLEMENTS EXECUTIVE SUMMARY');
		expect(subCell.font?.bold).toBe(true);
		expect(subCell.font?.color?.argb).toBe(ARGB.PRIMARY_DARK);

		// 4. Verify Calculations & Reconciliation
		const summaryCalc = calculateStaffAdvancesSummary(sampleAdvances);
		expect(summaryCalc.totalStaffMembers).toBe(3);
		expect(summaryCalc.totalAdvancesGiven).toBe(33000); // 15000 (Ramesh) + 10000 (Kumar) + 8000 (Suresh)
		expect(summaryCalc.totalAdvancesRecovered).toBe(21000); // 7000 (Ramesh) + 6000 (Kumar) + 8000 (Suresh)
		expect(summaryCalc.totalOutstandingBalance).toBe(12000); // 8000 (Ramesh) + 4000 (Kumar) + 0 (Suresh)

		expect(validateStaffAdvancesReconciliation(summaryCalc, summaryCalc.staffGroups)).toBe(true);

		// 5. Verify Staff Sheet: Ramesh (all 3 advances must be in this single sheet)
		const rameshWs = wb.getWorksheet('Ramesh')!;
		expect(rameshWs).toBeDefined();

		const rTitleCell = rameshWs.getCell('A1');
		expect(rTitleCell.value).toBe('SUNRISE DETAILING — STAFF ADVANCE REPORT');
		const rSubCell = rameshWs.getCell('A2');
		expect(rSubCell.value).toContain('STAFF STATEMENT: RAMESH');

		// Check Ramesh Monthly Totals: Oct (7000), Nov (3000), Dec (5000)
		const rameshGroup = summaryCalc.staffGroups.find((g) => g.staffName === 'Ramesh')!;
		expect(rameshGroup.monthlyTotals).toHaveLength(3);
		expect(rameshGroup.monthlyTotals[0].totalGiven).toBe(7000);
		expect(rameshGroup.monthlyTotals[1].totalGiven).toBe(3000);
		expect(rameshGroup.monthlyTotals[2].totalGiven).toBe(5000);
		expect(rameshGroup.totalGiven).toBe(15000);
		expect(rameshGroup.totalRecovered).toBe(7000);
		expect(rameshGroup.outstandingBalance).toBe(8000);

		// 6. Write buffer and verify buffer integrity
		const buffer = await wb.xlsx.writeBuffer();
		expect(buffer).toBeDefined();
		expect(buffer.byteLength).toBeGreaterThan(5000);

		// 7. Re-read the generated buffer into a new ExcelJS Workbook to ensure 0 corruption / no repair warnings
		const loadedWb = new ExcelJS.Workbook();
		await loadedWb.xlsx.load(buffer as any);

		expect(loadedWb.worksheets.length).toBe(4);
		expect(loadedWb.worksheets[0].name).toBe('Staff Summary');
		expect(loadedWb.worksheets[1].name).toBe('Kumar');
		expect(loadedWb.worksheets[2].name).toBe('Ramesh');
		expect(loadedWb.worksheets[3].name).toBe('Suresh');

		// 8. Verify Uniform Row Heights across all worksheets
		for (const ws of wb.worksheets) {
			expect(ws.properties.defaultRowHeight).toBe(ROW_HEIGHTS.DATA_ROW);
			expect(ws.getRow(1).height).toBe(ROW_HEIGHTS.TITLE);
			expect(ws.getRow(2).height).toBe(ROW_HEIGHTS.SUBTITLE);
		}
	});
});
